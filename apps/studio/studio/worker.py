"""Serial job worker.

One GPU means one job at a time. Running two video renders concurrently on a
16 GB card does not make them finish sooner — it makes them both OOM at
minute nine. `max_concurrent_gpu_jobs` stays at 1 unless you know better.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path

from .comfy import ComfyClient
from .config import Settings
from .db import JobStore
from .pipelines import PIPELINES, PipelineContext, write_provenance
from .schemas import Job, JobError, JobState
from .workflows import WorkflowRegistry

log = logging.getLogger("studio.worker")


class Worker:
    def __init__(self, settings: Settings, store: JobStore) -> None:
        self.settings = settings
        self.store = store
        self.comfy = ComfyClient(settings.comfy_url, settings.comfy_timeout_s)
        self.workflows = WorkflowRegistry(settings.workflows_dir)
        self._tasks: list[asyncio.Task[None]] = []
        self._stopping = asyncio.Event()
        # job_id -> the asyncio task running it, so cancel() can interrupt.
        self._running: dict[str, asyncio.Task[None]] = {}

    # -- lifecycle ----------------------------------------------------------

    async def start(self) -> None:
        requeued = self.store.requeue_orphans()
        if requeued:
            log.warning("requeued %d job(s) left running by a previous shutdown", requeued)

        for n in range(max(1, self.settings.max_concurrent_gpu_jobs)):
            self._tasks.append(asyncio.create_task(self._loop(n), name=f"studio-worker-{n}"))

    async def stop(self) -> None:
        self._stopping.set()
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()

    async def cancel(self, job_id: str) -> bool:
        """Cancel a queued or running job. Returns True if anything changed."""
        job = self.store.get(job_id)
        if job is None or job.is_terminal:
            return False

        if job.state == JobState.QUEUED:
            self.store.update(job_id, state=JobState.CANCELLED, stage="cancelled before start")
            return True

        task = self._running.get(job_id)
        if task is not None:
            # Tell ComfyUI to abandon the in-flight prompt as well, otherwise the
            # GPU keeps sampling a render nobody is waiting for.
            await self.comfy.interrupt()
            task.cancel()
            return True
        return False

    # -- main loop ----------------------------------------------------------

    async def _loop(self, index: int) -> None:
        while not self._stopping.is_set():
            job = self.store.claim_next_queued()
            if job is None:
                try:
                    await asyncio.wait_for(self._stopping.wait(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                return

            task = asyncio.current_task()
            if task is not None:
                self._running[job.id] = task
            try:
                await self._run_job(job)
            finally:
                self._running.pop(job.id, None)

    async def _run_job(self, job: Job) -> None:
        log.info("job %s (%s) started", job.id, job.kind.value)

        async def progress(fraction: float, stage: str) -> None:
            self.store.update(job.id, progress=round(max(0.0, min(fraction, 1.0)), 4), stage=stage)

        async def set_backend_ref(ref: str) -> None:
            self.store.update(job.id, backend_ref=ref)

        ctx = PipelineContext(
            settings=self.settings,
            comfy=self.comfy,
            workflows=self.workflows,
            progress=progress,
            set_backend_ref=set_backend_ref,
        )

        pipeline = PIPELINES.get(job.kind)
        if pipeline is None:
            self.store.update(
                job.id, state=JobState.FAILED, error=f"no pipeline for kind {job.kind.value}"
            )
            return

        try:
            outputs: list[Path] = await pipeline(job, ctx)
        except asyncio.CancelledError:
            self.store.update(job.id, state=JobState.CANCELLED, stage="cancelled")
            log.info("job %s cancelled", job.id)
            raise
        except JobError as exc:
            self.store.update(job.id, state=JobState.FAILED, error=str(exc), stage="failed")
            log.warning("job %s failed: %s", job.id, exc)
            return
        except Exception as exc:  # noqa: BLE001 - a crash must not kill the worker
            log.exception("job %s crashed", job.id)
            self.store.update(
                job.id,
                state=JobState.FAILED,
                error=f"unexpected {type(exc).__name__}: {exc}",
                stage="failed",
            )
            return

        if self.settings.write_provenance:
            write_provenance(job, outputs)

        self.store.update(
            job.id,
            state=JobState.SUCCEEDED,
            progress=1.0,
            stage="complete",
            outputs=[str(p) for p in outputs],
        )
        log.info("job %s succeeded -> %s", job.id, ", ".join(p.name for p in outputs))
