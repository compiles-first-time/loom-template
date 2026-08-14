"""Tests for pipeline input validation and path containment."""

from __future__ import annotations

from pathlib import Path

import pytest

from studio.config import Settings
from studio.pipelines import _require, _resolve_input
from studio.schemas import JobError


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    s = Settings(data_dir=tmp_path / "data")
    s.ensure_dirs()
    return s


def test_resolve_input_accepts_a_relative_path_under_data_dir(settings: Settings):
    target = settings.uploads_dir / "clip.mp4"
    target.write_bytes(b"x")
    assert _resolve_input(settings, "uploads/clip.mp4") == target.resolve()


def test_resolve_input_accepts_an_absolute_path_under_data_dir(settings: Settings):
    target = settings.uploads_dir / "clip.mp4"
    target.write_bytes(b"x")
    assert _resolve_input(settings, str(target)) == target.resolve()


def test_resolve_input_rejects_traversal_out_of_data_dir(settings: Settings, tmp_path: Path):
    outside = tmp_path / "secret.txt"
    outside.write_text("nope")
    with pytest.raises(JobError, match="must live under the studio data directory"):
        _resolve_input(settings, "../secret.txt")


def test_resolve_input_rejects_an_absolute_path_elsewhere(settings: Settings, tmp_path: Path):
    outside = tmp_path / "elsewhere.mp4"
    outside.write_bytes(b"x")
    with pytest.raises(JobError, match="must live under the studio data directory"):
        _resolve_input(settings, str(outside))


def test_resolve_input_reports_a_missing_file(settings: Settings):
    with pytest.raises(JobError, match="input file not found"):
        _resolve_input(settings, "uploads/ghost.mp4")


@pytest.mark.parametrize("value", [None, "", []])
def test_require_rejects_empty_values(value):
    with pytest.raises(JobError, match="missing required parameter"):
        _require({"prompt": value}, "prompt")


def test_require_allows_zero():
    # 0 is a legitimate seed and must not be treated as missing.
    assert _require({"seed": 0}, "seed") == 0
