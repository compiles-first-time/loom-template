"""FastAPI surface for the studio orchestrator."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import Body, FastAPI, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import media
from .comfy import ComfyClient
from .config import get_settings
from .db import JobStore
from .schemas import JobKind, JobState
from .worker import Worker
from .workflows import WorkflowRegistry

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("studio")

# Windows-hostile characters plus anything path-like.
_UNSAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.ensure_dirs()

    app.state.settings = settings
    app.state.store = JobStore(settings.db_path)
    app.state.workflows = WorkflowRegistry(settings.workflows_dir)
    app.state.worker = Worker(settings, app.state.store)
    await app.state.worker.start()

    log.info("studio ready on http://%s:%d (data: %s)", settings.host, settings.port, settings.data_dir)
    try:
        yield
    finally:
        await app.state.worker.stop()
        app.state.store.close()


app = FastAPI(title="Loom Studio", version="0.1.0", lifespan=lifespan)


# --- health ----------------------------------------------------------------


@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Report which backends are actually usable right now.

    The UI shows this up front because 'nothing happens when I click render'
    is almost always one of these three being down.
    """
    settings = app.state.settings
    result: dict[str, Any] = {"ok": True, "backends": {}}

    comfy = ComfyClient(settings.comfy_url, settings.comfy_timeout_s)
    try:
        stats = await comfy.health()
        devices = stats.get("devices") or [{}]
        vram_total = devices[0].get("vram_total") or 0
        vram_free = devices[0].get("vram_free") or 0
        result["backends"]["comfyui"] = {
            "ok": True,
            "url": settings.comfy_url,
            "device": devices[0].get("name", "unknown"),
            "vram_total_gb": round(vram_total / 1024**3, 1),
            "vram_free_gb": round(vram_free / 1024**3, 1),
        }
    except Exception as exc:  # noqa: BLE001
        result["backends"]["comfyui"] = {"ok": False, "url": settings.comfy_url, "error": str(exc)}
        result["ok"] = False

    try:
        media.ensure_ffmpeg(settings.ffmpeg_bin, settings.ffprobe_bin)
        result["backends"]["ffmpeg"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001
        result["backends"]["ffmpeg"] = {"ok": False, "error": str(exc)}
        result["ok"] = False

    facefusion_ok = (settings.facefusion_dir / "facefusion.py").is_file()
    result["backends"]["facefusion"] = {
        "ok": facefusion_ok,
        "path": str(settings.facefusion_dir),
        **({} if facefusion_ok else {"error": "facefusion.py not found (face swap disabled)"}),
    }

    result["workflows"] = app.state.workflows.available()
    return result


# --- uploads ---------------------------------------------------------------


@app.post("/api/upload")
async def upload(file: UploadFile) -> dict[str, str]:
    settings = app.state.settings
    safe_name = _UNSAFE_NAME.sub("_", Path(file.filename or "upload.bin").name).strip("._") or "upload.bin"

    target = settings.uploads_dir / safe_name
    counter = 1
    while target.exists():
        target = settings.uploads_dir / f"{Path(safe_name).stem}_{counter}{Path(safe_name).suffix}"
        counter += 1

    size = 0
    with target.open("wb") as handle:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            handle.write(chunk)

    # Return a data-dir-relative path; that is what the job API accepts.
    return {"path": str(target.relative_to(settings.data_dir)), "name": target.name, "bytes": str(size)}


# --- jobs ------------------------------------------------------------------


@app.get("/api/workflows")
async def list_workflows() -> dict[str, Any]:
    registry: WorkflowRegistry = app.state.workflows
    out = []
    for name in registry.available():
        try:
            template = registry.get(name)
        except Exception as exc:  # noqa: BLE001 - a broken template shouldn't hide the rest
            out.append({"name": name, "error": str(exc)})
            continue
        out.append(
            {
                "name": name,
                "description": template.description,
                "parameters": sorted(template.bindings),
                "defaults": template.defaults,
            }
        )
    return {"workflows": out}


@app.post("/api/jobs", status_code=201)
async def create_job(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    raw_kind = payload.get("kind")
    try:
        kind = JobKind(raw_kind)
    except ValueError:
        raise HTTPException(
            400, f"unknown job kind {raw_kind!r}; expected one of {[k.value for k in JobKind]}"
        ) from None

    params = payload.get("params") or {}
    if not isinstance(params, dict):
        raise HTTPException(400, "'params' must be an object")

    job = app.state.store.create(kind, params)
    return job.to_dict()


@app.get("/api/jobs")
async def list_jobs(
    limit: int = Query(50, ge=1, le=500),
    state: str | None = Query(None),
) -> dict[str, Any]:
    states = None
    if state:
        try:
            states = [JobState(s) for s in state.split(",")]
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
    jobs = app.state.store.list(limit=limit, states=states)
    return {"jobs": [j.to_dict() for j in jobs]}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    job = app.state.store.get(job_id)
    if job is None:
        raise HTTPException(404, f"no job {job_id}")
    return job.to_dict()


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict[str, Any]:
    job = app.state.store.get(job_id)
    if job is None:
        raise HTTPException(404, f"no job {job_id}")
    changed = await app.state.worker.cancel(job_id)
    if not changed:
        raise HTTPException(409, f"job {job_id} is {job.state.value} and cannot be cancelled")
    return {"cancelled": True, "id": job_id}


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str) -> StreamingResponse:
    """Server-sent progress for one job; closes when the job reaches a terminal state."""
    if app.state.store.get(job_id) is None:
        raise HTTPException(404, f"no job {job_id}")

    async def stream() -> AsyncIterator[bytes]:
        last: str | None = None
        while True:
            job = app.state.store.get(job_id)
            if job is None:
                return
            payload = json.dumps(job.to_dict(), sort_keys=True)
            if payload != last:
                yield f"data: {payload}\n\n".encode()
                last = payload
            if job.is_terminal:
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- files -----------------------------------------------------------------


@app.get("/api/files")
async def get_file(path: str = Query(...)) -> FileResponse:
    """Serve a file from inside the data directory.

    Everything the UI links to (outputs, uploads) lives under data_dir; the
    containment check is what keeps this from becoming an arbitrary file read.
    """
    settings = app.state.settings
    candidate = Path(path).expanduser()
    if not candidate.is_absolute():
        candidate = settings.data_dir / candidate

    resolved = candidate.resolve()
    if not resolved.is_relative_to(settings.data_dir.resolve()):
        raise HTTPException(403, "path is outside the data directory")
    if not resolved.is_file():
        raise HTTPException(404, f"no such file: {path}")
    return FileResponse(resolved)


# Static UI last, so it doesn't shadow the /api routes.
_STATIC_DIR = Path(__file__).parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")


def run() -> None:
    import uvicorn  # noqa: PLC0415

    settings = get_settings()
    uvicorn.run(
        "studio.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        run()
