"""Runtime configuration for the studio orchestrator.

Everything is overridable from the environment (or an .env file next to the
app) so the same code runs on the Windows workstation and in CI, where no GPU,
no ComfyUI and no ffmpeg exist.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_path(name: str, default: Path) -> Path:
    raw = os.environ.get(name)
    return Path(raw).expanduser() if raw else default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# Repo-relative default: apps/studio/
APP_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    """Immutable settings snapshot, built once at process start."""

    # --- storage -----------------------------------------------------------
    # 3 TB of disk means we can afford to keep every intermediate. Point this
    # at a data drive, not the OS drive, or ComfyUI outputs will fill C:.
    data_dir: Path = field(default_factory=lambda: _env_path("STUDIO_DATA_DIR", APP_ROOT / "data"))

    # --- ComfyUI backend ---------------------------------------------------
    comfy_url: str = field(default_factory=lambda: os.environ.get("STUDIO_COMFY_URL", "http://127.0.0.1:8188"))
    comfy_timeout_s: int = field(default_factory=lambda: _env_int("STUDIO_COMFY_TIMEOUT_S", 3600))

    # --- FaceFusion backend ------------------------------------------------
    # Path to the facefusion checkout; we invoke its headless CLI.
    facefusion_dir: Path = field(default_factory=lambda: _env_path("STUDIO_FACEFUSION_DIR", Path("C:/ai/facefusion")))
    facefusion_python: str = field(default_factory=lambda: os.environ.get("STUDIO_FACEFUSION_PYTHON", "python"))

    # --- external binaries -------------------------------------------------
    ffmpeg_bin: str = field(default_factory=lambda: os.environ.get("STUDIO_FFMPEG", "ffmpeg"))
    ffprobe_bin: str = field(default_factory=lambda: os.environ.get("STUDIO_FFPROBE", "ffprobe"))

    # --- server ------------------------------------------------------------
    host: str = field(default_factory=lambda: os.environ.get("STUDIO_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _env_int("STUDIO_PORT", 8710))

    # A single 16 GB GPU serialises anyway. Keeping this at 1 is what stops
    # two video jobs from racing into an OOM halfway through a 10 s render.
    max_concurrent_gpu_jobs: int = field(default_factory=lambda: _env_int("STUDIO_MAX_GPU_JOBS", 1))

    # Write a sidecar .json next to every output recording how it was made.
    write_provenance: bool = field(default_factory=lambda: _env_bool("STUDIO_WRITE_PROVENANCE", True))

    @property
    def db_path(self) -> Path:
        return self.data_dir / "studio.sqlite3"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"

    @property
    def workspace_dir(self) -> Path:
        """Scratch space for per-job intermediates (frame dumps, clip lists)."""
        return self.data_dir / "workspace"

    @property
    def workflows_dir(self) -> Path:
        return _env_path("STUDIO_WORKFLOWS_DIR", APP_ROOT / "workflows")

    def ensure_dirs(self) -> None:
        for path in (self.data_dir, self.uploads_dir, self.outputs_dir, self.workspace_dir):
            path.mkdir(parents=True, exist_ok=True)


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings_cache() -> None:
    """Test hook — drops the memoised settings so env changes take effect."""
    global _settings
    _settings = None
