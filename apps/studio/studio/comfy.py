"""Async client for a local ComfyUI instance.

ComfyUI is the compute backend for everything diffusion-shaped: image-to-video,
upscaling, interpolation. This module owns the three things that are annoying
to get right — uploading inputs, streaming progress off the websocket, and
working out which node produced the video.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import uuid
from pathlib import Path
from typing import Any, AsyncIterator, Awaitable, Callable

import httpx

from .schemas import BackendUnavailable, JobError

ProgressFn = Callable[[float, str], Awaitable[None]]

# ComfyUI groups outputs by media kind; which key a video lands under depends on
# the save node (VHS_VideoCombine -> "gifs", core SaveVideo -> "videos"/"images").
_OUTPUT_KEYS = ("videos", "gifs", "images", "audio")
_VIDEO_SUFFIXES = {".mp4", ".webm", ".mkv", ".mov", ".gif", ".avi"}


class ComfyClient:
    def __init__(self, base_url: str, timeout_s: int = 3600) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self.client_id = uuid.uuid4().hex

    @property
    def _ws_url(self) -> str:
        scheme = "wss" if self.base_url.startswith("https") else "ws"
        host = self.base_url.split("://", 1)[-1]
        return f"{scheme}://{host}/ws?clientId={self.client_id}"

    # -- health -------------------------------------------------------------

    async def health(self) -> dict[str, Any]:
        """Return ComfyUI's reported system stats, or raise BackendUnavailable."""
        try:
            async with httpx.AsyncClient(timeout=10) as http:
                resp = await http.get(f"{self.base_url}/system_stats")
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:  # noqa: BLE001 - any failure means "not usable"
            raise BackendUnavailable(
                f"ComfyUI is not reachable at {self.base_url}. Start it first "
                f"(run_nvidia_gpu.bat), or set STUDIO_COMFY_URL. ({exc})"
            ) from exc

    # -- inputs -------------------------------------------------------------

    async def upload_image(self, path: Path, subfolder: str = "studio") -> str:
        """Upload a local file into ComfyUI's input dir.

        Returns the reference string to feed a LoadImage node — ComfyUI expects
        ``subfolder/name`` when the file is not at the input root.
        """
        if not path.is_file():
            raise JobError(f"input file does not exist: {path}")

        data = path.read_bytes()
        async with httpx.AsyncClient(timeout=120) as http:
            resp = await http.post(
                f"{self.base_url}/upload/image",
                files={"image": (path.name, data, "application/octet-stream")},
                data={"subfolder": subfolder, "type": "input", "overwrite": "true"},
            )
            resp.raise_for_status()
            body = resp.json()

        name = body.get("name", path.name)
        folder = body.get("subfolder", "")
        return f"{folder}/{name}" if folder else name

    # -- execution ----------------------------------------------------------

    async def submit(self, graph: dict[str, Any]) -> str:
        async with httpx.AsyncClient(timeout=60) as http:
            resp = await http.post(
                f"{self.base_url}/prompt",
                json={"prompt": graph, "client_id": self.client_id},
            )
            if resp.status_code >= 400:
                # ComfyUI returns a structured validation error worth surfacing
                # verbatim — it names the node and input that failed.
                raise JobError(f"ComfyUI rejected the workflow: {_describe_error(resp)}")
            body = resp.json()

        prompt_id = body.get("prompt_id")
        if not prompt_id:
            raise JobError(f"ComfyUI did not return a prompt_id: {body}")
        return prompt_id

    async def interrupt(self) -> None:
        with contextlib.suppress(Exception):
            async with httpx.AsyncClient(timeout=10) as http:
                await http.post(f"{self.base_url}/interrupt")

    async def wait(self, prompt_id: str, on_progress: ProgressFn | None = None) -> dict[str, Any]:
        """Block until `prompt_id` finishes, streaming progress if possible.

        Falls back to plain history polling when the websocket can't be opened,
        so a missing `websockets` package costs progress reporting, not the run.
        """
        ws_task: asyncio.Task[None] | None = None
        if on_progress is not None:
            ws_task = asyncio.create_task(self._stream_progress(prompt_id, on_progress))

        try:
            return await self._poll_history(prompt_id)
        finally:
            if ws_task is not None:
                ws_task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await ws_task

    async def _poll_history(self, prompt_id: str) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + self.timeout_s
        delay = 0.5
        async with httpx.AsyncClient(timeout=30) as http:
            while True:
                if asyncio.get_running_loop().time() > deadline:
                    await self.interrupt()
                    raise JobError(
                        f"ComfyUI job exceeded {self.timeout_s}s. Raise STUDIO_COMFY_TIMEOUT_S "
                        "if this render is legitimately that slow."
                    )
                try:
                    resp = await http.get(f"{self.base_url}/history/{prompt_id}")
                    resp.raise_for_status()
                    history = resp.json()
                except Exception:  # noqa: BLE001 - transient; keep polling
                    history = {}

                entry = history.get(prompt_id)
                if entry:
                    status = entry.get("status") or {}
                    # ComfyUI marks failures with status_str == "error"; the
                    # detail lives in the messages array.
                    if status.get("status_str") == "error":
                        raise JobError(_describe_history_error(status))
                    if status.get("completed") or entry.get("outputs"):
                        return entry

                await asyncio.sleep(delay)
                delay = min(delay * 1.3, 3.0)

    async def _stream_progress(self, prompt_id: str, on_progress: ProgressFn) -> None:
        try:
            import websockets  # noqa: PLC0415 - optional dependency
        except ImportError:
            return

        try:
            async with websockets.connect(self._ws_url, max_size=None) as ws:
                async for raw in ws:
                    if not isinstance(raw, str):
                        continue  # binary frames are preview images; ignore
                    try:
                        message = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    data = message.get("data") or {}
                    if data.get("prompt_id") not in (None, prompt_id):
                        continue

                    if message.get("type") == "progress":
                        value, maximum = data.get("value", 0), data.get("max", 0) or 1
                        await on_progress(min(value / maximum, 1.0), "sampling")
                    elif message.get("type") == "executing" and data.get("node") is None:
                        await on_progress(1.0, "finishing")
                        return
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - progress is best-effort
            return

    # -- outputs ------------------------------------------------------------

    async def collect_outputs(self, entry: dict[str, Any], dest_dir: Path) -> list[Path]:
        """Download every file the run produced into `dest_dir`."""
        dest_dir.mkdir(parents=True, exist_ok=True)
        saved: list[Path] = []

        async with httpx.AsyncClient(timeout=300) as http:
            for node_output in (entry.get("outputs") or {}).values():
                for key in _OUTPUT_KEYS:
                    for item in node_output.get(key) or []:
                        filename = item.get("filename")
                        if not filename:
                            continue
                        params = {
                            "filename": filename,
                            "subfolder": item.get("subfolder", ""),
                            "type": item.get("type", "output"),
                        }
                        resp = await http.get(f"{self.base_url}/view", params=params)
                        resp.raise_for_status()
                        target = _unique_path(dest_dir / filename)
                        target.write_bytes(resp.content)
                        saved.append(target)

        if not saved:
            raise JobError(
                "the workflow completed but produced no files — check that it ends in a "
                "save node (VHS_VideoCombine, SaveVideo or SaveImage)."
            )
        # Videos first, so callers that want "the result" can take saved[0]
        # even when the workflow also saved preview frames.
        saved.sort(key=lambda p: (p.suffix.lower() not in _VIDEO_SUFFIXES, p.name))
        return saved


async def stream_lines(process: asyncio.subprocess.Process) -> AsyncIterator[str]:
    """Yield decoded stderr lines from a subprocess as they arrive."""
    assert process.stderr is not None
    while True:
        raw = await process.stderr.readline()
        if not raw:
            return
        yield raw.decode("utf-8", errors="replace").rstrip()


def _unique_path(path: Path) -> Path:
    """Avoid clobbering an existing output with the same ComfyUI filename."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    for n in range(1, 10_000):
        candidate = path.with_name(f"{stem}_{n}{suffix}")
        if not candidate.exists():
            return candidate
    raise JobError(f"could not find a free filename for {path}")


def _describe_error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except Exception:  # noqa: BLE001
        return f"HTTP {resp.status_code}: {resp.text[:500]}"

    parts: list[str] = []
    error = body.get("error") or {}
    if error:
        parts.append(str(error.get("message") or error))
    for node_id, detail in (body.get("node_errors") or {}).items():
        for err in detail.get("errors", []):
            parts.append(f"node {node_id}: {err.get('message')} ({err.get('details')})")
    return "; ".join(parts) or json.dumps(body)[:500]


def _describe_history_error(status: dict[str, Any]) -> str:
    for kind, payload in status.get("messages") or []:
        if kind == "execution_error":
            node = payload.get("node_type", "?")
            return f"ComfyUI execution failed in {node}: {payload.get('exception_message')}"
    return "ComfyUI reported an execution error with no detail"
