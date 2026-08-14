"""The four job pipelines.

Each pipeline is an async callable taking (job, ctx) and returning the list of
output paths. Anything that goes wrong in a way the user should read about is
raised as JobError; the worker turns that into a failed job with the message
attached.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from . import media
from .comfy import ComfyClient
from .config import Settings
from .schemas import BackendUnavailable, Clip, Job, JobError, JobKind
from .workflows import WorkflowRegistry

ProgressFn = Callable[[float, str], Awaitable[None]]


@dataclass
class PipelineContext:
    settings: Settings
    comfy: ComfyClient
    workflows: WorkflowRegistry
    progress: ProgressFn
    set_backend_ref: Callable[[str], Awaitable[None]]

    def job_workspace(self, job_id: str) -> Path:
        path = self.settings.workspace_dir / job_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def job_outputs(self, job_id: str) -> Path:
        path = self.settings.outputs_dir / job_id
        path.mkdir(parents=True, exist_ok=True)
        return path


# --- helpers ---------------------------------------------------------------


def _require(params: dict[str, Any], key: str) -> Any:
    value = params.get(key)
    if value in (None, "", []):
        raise JobError(f"missing required parameter '{key}'")
    return value


def _resolve_input(settings: Settings, raw: str) -> Path:
    """Resolve a user-supplied path, keeping it inside the data directory.

    Inputs arrive over HTTP, so a bare `..\\..\\Windows\\System32\\...` must not
    resolve to somewhere outside the studio's own storage.
    """
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = settings.data_dir / candidate

    resolved = candidate.resolve()
    data_root = settings.data_dir.resolve()
    if not resolved.is_relative_to(data_root):
        raise JobError(
            f"input path must live under the studio data directory ({data_root}); got {raw!r}"
        )
    if not resolved.is_file():
        raise JobError(f"input file not found: {resolved}")
    return resolved


async def _run_comfy_workflow(
    job: Job,
    ctx: PipelineContext,
    workflow_name: str,
    bound_params: dict[str, Any],
) -> list[Path]:
    await ctx.comfy.health()
    template = ctx.workflows.get(workflow_name)
    graph = template.bind(bound_params)

    await ctx.progress(0.05, "submitting to ComfyUI")
    prompt_id = await ctx.comfy.submit(graph)
    await ctx.set_backend_ref(prompt_id)

    async def relay(fraction: float, stage: str) -> None:
        # ComfyUI's own 0..1 spans the 10-90% band of the job as a whole.
        await ctx.progress(0.1 + fraction * 0.8, stage)

    entry = await ctx.comfy.wait(prompt_id, on_progress=relay)
    await ctx.progress(0.92, "collecting outputs")
    return await ctx.comfy.collect_outputs(entry, ctx.job_outputs(job.id))


# --- pipelines -------------------------------------------------------------


async def image_to_video(job: Job, ctx: PipelineContext) -> list[Path]:
    """Extend one or more stills into a short prompted clip."""
    params = job.params
    images = _require(params, "images")
    if isinstance(images, str):
        images = [images]

    prompt = _require(params, "prompt")
    duration_s = float(params.get("duration_s") or 5)
    fps = int(params.get("fps") or 16)

    if not 1 <= duration_s <= 30:
        raise JobError(f"duration_s must be between 1 and 30, got {duration_s}")

    await ctx.progress(0.02, "uploading stills")
    refs: list[str] = []
    for raw in images:
        path = _resolve_input(ctx.settings, raw)
        refs.append(await ctx.comfy.upload_image(path))

    # Video models sample a fixed frame count; most Wan/LTX graphs want 4n+1.
    frames = int(round(duration_s * fps))
    frames = frames - (frames % 4) + 1

    bound: dict[str, Any] = {
        "image": refs[0],
        "prompt": prompt,
        "negative_prompt": params.get("negative_prompt", ""),
        "frames": frames,
        "fps": fps,
        "width": int(params.get("width") or 832),
        "height": int(params.get("height") or 480),
        "steps": int(params.get("steps") or 20),
        "cfg": float(params.get("cfg") or 5.0),
        "seed": int(params.get("seed") or 0),
    }
    # Only pass the tail image to workflows that declare a binding for it
    # (first/last-frame graphs); plain I2V templates don't have one.
    if len(refs) > 1:
        bound["end_image"] = refs[-1]

    template_name = params.get("workflow") or "wan22_i2v_16gb"
    template = ctx.workflows.get(template_name)
    bound = {k: v for k, v in bound.items() if k in template.bindings}

    return await _run_comfy_workflow(job, ctx, template_name, bound)


async def enhance(job: Job, ctx: PipelineContext) -> list[Path]:
    """Upscale and/or frame-interpolate an existing video."""
    params = job.params
    source = _resolve_input(ctx.settings, _require(params, "source"))

    await ctx.progress(0.02, "uploading source")
    ref = await ctx.comfy.upload_image(source)

    bound: dict[str, Any] = {
        "video": ref,
        "upscale_factor": float(params.get("upscale_factor") or 2.0),
        "interpolation_multiplier": int(params.get("interpolation_multiplier") or 2),
        "denoise": float(params.get("denoise") or 0.35),
        "seed": int(params.get("seed") or 0),
    }

    template_name = params.get("workflow") or "enhance_upscale_interpolate"
    template = ctx.workflows.get(template_name)
    bound = {k: v for k, v in bound.items() if k in template.bindings}

    return await _run_comfy_workflow(job, ctx, template_name, bound)


async def face_swap(job: Job, ctx: PipelineContext) -> list[Path]:
    """Run FaceFusion's headless CLI over a target video."""
    settings = ctx.settings
    params = job.params

    entrypoint = settings.facefusion_dir / "facefusion.py"
    if not entrypoint.is_file():
        raise BackendUnavailable(
            f"FaceFusion not found at {settings.facefusion_dir}. Clone it and set "
            "STUDIO_FACEFUSION_DIR to the checkout."
        )

    sources = _require(params, "sources")
    if isinstance(sources, str):
        sources = [sources]
    source_paths = [str(_resolve_input(settings, s)) for s in sources]
    target = _resolve_input(settings, _require(params, "target"))

    output = ctx.job_outputs(job.id) / f"swap_{target.stem}.mp4"
    processors = params.get("processors") or ["face_swapper", "face_enhancer"]
    if isinstance(processors, str):
        processors = processors.split()

    cmd = [
        settings.facefusion_python, str(entrypoint), "headless-run",
        "--source-paths", *source_paths,
        "--target-path", str(target),
        "--output-path", str(output),
        "--processors", *processors,
        "--face-swapper-model", str(params.get("swapper_model") or "inswapper_128_fp16"),
        "--face-enhancer-model", str(params.get("enhancer_model") or "gfpgan_1.4"),
        "--face-enhancer-blend", str(int(params.get("enhancer_blend") or 80)),
        "--execution-providers", str(params.get("execution_provider") or "cuda"),
        "--output-video-encoder", str(params.get("encoder") or "libx264"),
        "--output-video-quality", str(int(params.get("quality") or 90)),
        "--log-level", "info",
    ]
    if params.get("extra_args"):
        cmd.extend(str(a) for a in params["extra_args"])

    await ctx.progress(0.1, "running FaceFusion")
    await media.run(cmd, what="FaceFusion")

    if not output.is_file():
        raise JobError(
            "FaceFusion exited cleanly but wrote no output — this usually means no face "
            "was detected in the target. Try lowering --face-detector-score."
        )
    return [output]


async def assemble(job: Job, ctx: PipelineContext) -> list[Path]:
    """Trim and stitch clips into a single video. Pure ffmpeg — no GPU."""
    settings = ctx.settings
    media.ensure_ffmpeg(settings.ffmpeg_bin, settings.ffprobe_bin)

    raw_clips = _require(job.params, "clips")
    if not isinstance(raw_clips, list):
        raise JobError("'clips' must be a list")

    clips: list[Clip] = []
    for raw in raw_clips:
        clip = Clip.from_dict(raw)
        clips.append(
            Clip(
                source=str(_resolve_input(settings, clip.source)),
                start=clip.start,
                end=clip.end,
                transition_s=clip.transition_s,
            )
        )

    await ctx.progress(0.1, "probing clips")
    infos = [await media.probe(Path(c.source), settings.ffprobe_bin) for c in clips]

    output = ctx.job_outputs(job.id) / (job.params.get("output_name") or "timeline.mp4")
    cmd = media.build_assemble_command(
        clips,
        infos,
        output,
        ffmpeg_bin=settings.ffmpeg_bin,
        width=job.params.get("width"),
        height=job.params.get("height"),
        fps=job.params.get("fps"),
        crf=int(job.params.get("crf") or 18),
    )

    await ctx.progress(0.3, "encoding timeline")
    await media.run(cmd, what="ffmpeg assemble")
    await ctx.progress(0.95, "done")
    return [output]


PIPELINES: dict[JobKind, Callable[[Job, PipelineContext], Awaitable[list[Path]]]] = {
    JobKind.IMAGE_TO_VIDEO: image_to_video,
    JobKind.ENHANCE: enhance,
    JobKind.FACE_SWAP: face_swap,
    JobKind.ASSEMBLE: assemble,
}


def write_provenance(job: Job, outputs: list[Path]) -> None:
    """Drop a sidecar JSON recording how each output was produced.

    Six months from now, "which prompt and seed made this clip?" is a question
    you will actually need answered, and it is free to record now.
    """
    for path in outputs:
        sidecar = path.with_suffix(path.suffix + ".json")
        payload = {
            "job_id": job.id,
            "kind": job.kind.value,
            "params": job.params,
            "created_at": job.created_at,
            "output": path.name,
            "generator": "loom-studio",
            "synthetic": True,
        }
        try:
            sidecar.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except OSError:
            # Provenance is a nicety; never fail a completed render over it.
            pass


def copy_into_uploads(src: Path, settings: Settings, name: str | None = None) -> Path:
    settings.ensure_dirs()
    target = settings.uploads_dir / (name or src.name)
    shutil.copy2(src, target)
    return target
