"""ffmpeg/ffprobe wrappers for trimming, stitching and muxing.

The filter-graph builders are pure functions so they can be unit-tested without
ffmpeg installed; only `run_ffmpeg` and `probe` actually shell out.

The recurring gotcha this module exists to absorb: generated clips usually have
*no audio track*, arrive at different resolutions, and carry odd frame rates.
Concatenating those naively either drops audio silently or fails outright, so
every clip is normalised to a common geometry/fps and given a real (possibly
silent) audio stream before it reaches the concat filter.
"""

from __future__ import annotations

import asyncio
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from .schemas import BackendUnavailable, Clip, JobError


@dataclass(frozen=True)
class MediaInfo:
    duration: float
    width: int
    height: int
    fps: float
    has_audio: bool


def ensure_ffmpeg(ffmpeg_bin: str, ffprobe_bin: str) -> None:
    missing = [b for b in (ffmpeg_bin, ffprobe_bin) if shutil.which(b) is None]
    if missing:
        raise BackendUnavailable(
            f"could not find {', '.join(missing)} on PATH. Install ffmpeg "
            "(`winget install Gyan.FFmpeg`) or set STUDIO_FFMPEG / STUDIO_FFPROBE."
        )


async def run(cmd: Sequence[str], *, what: str = "ffmpeg") -> str:
    """Run a command, returning stderr; raise JobError with the tail on failure."""
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await process.communicate()
    stderr = stderr_bytes.decode("utf-8", errors="replace")
    if process.returncode != 0:
        tail = "\n".join(stderr.strip().splitlines()[-15:])
        raise JobError(f"{what} failed (exit {process.returncode}):\n{tail}")
    return stderr


async def probe(path: Path, ffprobe_bin: str = "ffprobe") -> MediaInfo:
    if not path.is_file():
        raise JobError(f"media file not found: {path}")

    cmd = [
        ffprobe_bin, "-v", "error",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(path),
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        raise JobError(f"ffprobe failed on {path.name}: {stderr.decode(errors='replace')[:400]}")

    return parse_probe(json.loads(stdout.decode("utf-8")), path.name)


def parse_probe(payload: dict, name: str = "input") -> MediaInfo:
    """Pull the fields we care about out of ffprobe's JSON. Pure — testable."""
    streams = payload.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise JobError(f"{name} has no video stream")

    has_audio = any(s.get("codec_type") == "audio" for s in streams)

    # Duration can live on the stream or only on the container.
    duration = _as_float(video.get("duration")) or _as_float(
        (payload.get("format") or {}).get("duration")
    )
    if duration is None:
        raise JobError(f"could not determine duration of {name}")

    return MediaInfo(
        duration=duration,
        width=int(video.get("width") or 0),
        height=int(video.get("height") or 0),
        fps=_parse_rate(video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"),
        has_audio=has_audio,
    )


def _as_float(value: object) -> float | None:
    try:
        result = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return result if result > 0 else None


def _parse_rate(rate: str) -> float:
    """'30000/1001' -> 29.97. Returns 0.0 for ffprobe's '0/0' unknown marker."""
    try:
        if "/" in rate:
            num, den = rate.split("/", 1)
            denominator = float(den)
            return float(num) / denominator if denominator else 0.0
        return float(rate)
    except (TypeError, ValueError):
        return 0.0


def clip_duration(clip: Clip, source: MediaInfo) -> float:
    """Effective on-timeline duration of a clip after its in/out points."""
    start = clip.start or 0.0
    end = clip.end if clip.end is not None else source.duration
    end = min(end, source.duration)
    if end <= start:
        raise JobError(
            f"clip '{Path(clip.source).name}' has an empty range "
            f"(start={start}, end={end}, source duration={source.duration:.2f}s)"
        )
    return end - start


def build_timeline_filter(
    durations: Sequence[float],
    transitions: Sequence[float],
    width: int,
    height: int,
    fps: float,
) -> tuple[str, str, str]:
    """Build the filter_complex for an assemble job.

    `transitions[i]` is the crossfade duration *into* clip i (index 0 unused).
    Returns (filter_complex, video_label, audio_label).

    Each input is first normalised — scaled and letterboxed onto a common
    canvas, resampled to a common fps, square pixels, timestamps reset — because
    xfade and concat both require identical geometry across inputs.
    """
    count = len(durations)
    if count == 0:
        raise JobError("cannot build a timeline with no clips")
    if len(transitions) != count:
        raise ValueError("transitions must be the same length as durations")

    parts: list[str] = []
    for i in range(count):
        # Filter order is load-bearing: `setpts` marks its output link's frame
        # rate as unknown, and xfade refuses any input that is not constant
        # frame rate ("current rate of 1/0 is invalid"). Putting `fps` *after*
        # `setpts` re-establishes CFR on the link xfade actually sees.
        parts.append(
            f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,settb=AVTB,"
            f"setpts=PTS-STARTPTS,fps={fps:g},format=yuv420p[v{i}]"
        )
        parts.append(f"[{i}:a]aresample=48000,asetpts=PTS-STARTPTS[a{i}]")

    if count == 1:
        return ";".join(parts), "[v0]", "[a0]"

    # Clamp each transition so it cannot exceed either neighbouring clip; an
    # xfade longer than its shortest input produces frozen or dropped frames.
    effective = [0.0] * count
    for i in range(1, count):
        effective[i] = max(0.0, min(transitions[i], durations[i - 1], durations[i]))

    if all(t == 0.0 for t in effective[1:]):
        streams = "".join(f"[v{i}][a{i}]" for i in range(count))
        parts.append(f"{streams}concat=n={count}:v=1:a=1[vout][aout]")
        return ";".join(parts), "[vout]", "[aout]"

    # Chained xfade: each transition starts `transition` seconds before the end
    # of everything accumulated so far.
    v_prev, a_prev = "[v0]", "[a0]"
    offset = durations[0]
    for i in range(1, count):
        transition = effective[i]
        offset -= transition
        v_out = f"[vx{i}]" if i < count - 1 else "[vout]"
        a_out = f"[ax{i}]" if i < count - 1 else "[aout]"

        if transition > 0:
            parts.append(
                f"{v_prev}[v{i}]xfade=transition=fade:duration={transition:g}:"
                f"offset={offset:g}{v_out}"
            )
            parts.append(f"{a_prev}[a{i}]acrossfade=d={transition:g}{a_out}")
        else:
            parts.append(f"{v_prev}[v{i}]concat=n=2:v=1:a=0{v_out}")
            parts.append(f"{a_prev}[a{i}]concat=n=2:v=0:a=1{a_out}")

        offset += durations[i]
        v_prev, a_prev = v_out, a_out

    return ";".join(parts), "[vout]", "[aout]"


def build_assemble_command(
    clips: Sequence[Clip],
    infos: Sequence[MediaInfo],
    output: Path,
    *,
    ffmpeg_bin: str = "ffmpeg",
    width: int | None = None,
    height: int | None = None,
    fps: float | None = None,
    crf: int = 18,
    preset: str = "slow",
) -> list[str]:
    """Full ffmpeg argv for stitching `clips` into `output`.

    Split out from execution so tests can assert on the command without a
    working ffmpeg, and so a failing render can be reproduced by hand.
    """
    if not clips:
        raise JobError("assemble needs at least one clip")
    if len(clips) != len(infos):
        raise ValueError("clips and infos must be the same length")

    # Default the canvas to the largest input so nothing is downscaled.
    out_w = width or max(i.width for i in infos)
    out_h = height or max(i.height for i in infos)
    out_fps = fps or max((i.fps for i in infos if i.fps > 0), default=30.0)

    # ffmpeg requires even dimensions for yuv420p.
    out_w += out_w % 2
    out_h += out_h % 2

    cmd: list[str] = [ffmpeg_bin, "-hide_banner", "-y"]
    for clip, info in zip(clips, infos):
        if clip.start is not None:
            # Before -i, so ffmpeg seeks rather than decoding-and-discarding.
            cmd += ["-ss", f"{clip.start:g}"]
        if clip.end is not None:
            cmd += ["-to", f"{clip.end:g}"]
        cmd += ["-i", str(clip.source)]

        if not info.has_audio:
            # Substitute silence so every input has both stream types; without
            # this the concat filter errors out on a missing [a] label.
            duration = clip_duration(clip, info)
            cmd += [
                "-f", "lavfi",
                "-t", f"{duration:g}",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            ]

    # Inputs were emitted in pairs where silence was injected, so recompute the
    # ffmpeg input index each clip actually landed on.
    index_map: list[int] = []
    cursor = 0
    for info in infos:
        index_map.append(cursor)
        cursor += 1 if info.has_audio else 2

    durations = [clip_duration(c, i) for c, i in zip(clips, infos)]
    transitions = [c.transition_s for c in clips]
    filter_complex, v_label, a_label = build_timeline_filter(
        durations, transitions, out_w, out_h, out_fps
    )
    filter_complex = _remap_input_indices(filter_complex, index_map, [i.has_audio for i in infos])

    cmd += [
        "-filter_complex", filter_complex,
        "-map", v_label,
        "-map", a_label,
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(output),
    ]
    return cmd


def _remap_input_indices(
    filter_complex: str, index_map: Sequence[int], has_audio: Sequence[bool]
) -> str:
    """Rewrite `[i:v]`/`[i:a]` labels onto real ffmpeg input indices.

    `build_timeline_filter` numbers clips 0..n-1, but clips without audio
    consumed two ffmpeg inputs (the file plus an anullsrc), so the mapping is
    not the identity once any clip is silent.
    """
    for clip_index in reversed(range(len(index_map))):
        base = index_map[clip_index]
        filter_complex = filter_complex.replace(f"[{clip_index}:v]", f"[\x00{base}:v]")
        audio_index = base if has_audio[clip_index] else base + 1
        filter_complex = filter_complex.replace(f"[{clip_index}:a]", f"[\x00{audio_index}:a]")
    return filter_complex.replace("\x00", "")


def build_extract_audio_command(source: Path, output: Path, ffmpeg_bin: str = "ffmpeg") -> list[str]:
    return [ffmpeg_bin, "-hide_banner", "-y", "-i", str(source), "-vn", "-c:a", "aac", str(output)]


def build_mux_command(
    video: Path, audio: Path, output: Path, ffmpeg_bin: str = "ffmpeg"
) -> list[str]:
    """Attach `audio` to `video`, trimming to whichever is shorter."""
    return [
        ffmpeg_bin, "-hide_banner", "-y",
        "-i", str(video), "-i", str(audio),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-shortest",
        str(output),
    ]
