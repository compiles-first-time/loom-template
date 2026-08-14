"""Job/asset domain types shared by the API, the queue and the pipelines."""

from __future__ import annotations

import enum
from dataclasses import asdict, dataclass, field
from typing import Any


class JobKind(str, enum.Enum):
    """The four things the platform actually does."""

    IMAGE_TO_VIDEO = "image_to_video"
    ENHANCE = "enhance"
    FACE_SWAP = "face_swap"
    ASSEMBLE = "assemble"


class JobState(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Terminal states never transition again; the worker and API both rely on this.
TERMINAL_STATES = frozenset({JobState.SUCCEEDED, JobState.FAILED, JobState.CANCELLED})


@dataclass
class Job:
    id: str
    kind: JobKind
    state: JobState
    params: dict[str, Any]
    created_at: str
    updated_at: str
    progress: float = 0.0
    stage: str = ""
    error: str | None = None
    outputs: list[str] = field(default_factory=list)
    backend_ref: str | None = None  # e.g. ComfyUI prompt_id, for cancellation

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["kind"] = self.kind.value
        payload["state"] = self.state.value
        return payload

    @property
    def is_terminal(self) -> bool:
        return self.state in TERMINAL_STATES


@dataclass(frozen=True)
class Clip:
    """One segment on the assemble timeline.

    `start`/`end` are seconds into the *source*; omit them to take the whole
    file. `transition_s` is the crossfade into this clip (ignored on the first).
    """

    source: str
    start: float | None = None
    end: float | None = None
    transition_s: float = 0.0

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Clip":
        source = raw.get("source")
        if not source or not isinstance(source, str):
            raise ValueError("clip requires a 'source' path")

        def _opt_float(key: str) -> float | None:
            value = raw.get(key)
            if value is None or value == "":
                return None
            return float(value)

        start = _opt_float("start")
        end = _opt_float("end")
        if start is not None and start < 0:
            raise ValueError(f"clip start must be >= 0, got {start}")
        if start is not None and end is not None and end <= start:
            raise ValueError(f"clip end ({end}) must be greater than start ({start})")

        transition = float(raw.get("transition_s") or 0.0)
        if transition < 0:
            raise ValueError("transition_s must be >= 0")

        return cls(source=source, start=start, end=end, transition_s=transition)


class JobError(RuntimeError):
    """Raised by a pipeline when a job fails for a reportable reason."""


class BackendUnavailable(JobError):
    """A required external backend (ComfyUI, ffmpeg, FaceFusion) is missing."""
