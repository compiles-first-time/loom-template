"""Tests for the SQLite job store."""

from __future__ import annotations

from pathlib import Path

import pytest

from studio.db import JobStore
from studio.schemas import JobKind, JobState


@pytest.fixture()
def store(tmp_path: Path) -> JobStore:
    s = JobStore(tmp_path / "test.sqlite3")
    yield s
    s.close()


def test_create_returns_a_queued_job(store: JobStore):
    job = store.create(JobKind.ASSEMBLE, {"clips": []})
    assert job.state is JobState.QUEUED
    assert job.progress == 0.0
    assert store.get(job.id).params == {"clips": []}


def test_update_patches_fields_and_bumps_timestamp(store: JobStore):
    job = store.create(JobKind.ENHANCE, {})
    updated = store.update(job.id, progress=0.5, stage="sampling")
    assert updated.progress == 0.5
    assert updated.stage == "sampling"
    assert updated.updated_at >= job.updated_at


def test_update_roundtrips_json_columns(store: JobStore):
    job = store.create(JobKind.IMAGE_TO_VIDEO, {})
    updated = store.update(job.id, outputs=["a.mp4", "b.mp4"])
    assert store.get(updated.id).outputs == ["a.mp4", "b.mp4"]


def test_update_accepts_state_as_enum_or_string(store: JobStore):
    job = store.create(JobKind.ENHANCE, {})
    assert store.update(job.id, state=JobState.RUNNING).state is JobState.RUNNING
    assert store.update(job.id, state="succeeded").state is JobState.SUCCEEDED


def test_update_rejects_unknown_field(store: JobStore):
    job = store.create(JobKind.ENHANCE, {})
    with pytest.raises(ValueError, match="unknown job fields"):
        store.update(job.id, sneaky=1)


def test_update_of_missing_job_returns_none(store: JobStore):
    assert store.update("nope", progress=1.0) is None


def test_claim_takes_the_oldest_queued_job_first(store: JobStore):
    first = store.create(JobKind.ASSEMBLE, {"n": 1})
    second = store.create(JobKind.ASSEMBLE, {"n": 2})

    claimed = store.claim_next_queued()
    assert claimed.id == first.id
    assert claimed.state is JobState.RUNNING
    assert store.get(first.id).state is JobState.RUNNING

    assert store.claim_next_queued().id == second.id
    assert store.claim_next_queued() is None


def test_claim_skips_terminal_jobs(store: JobStore):
    job = store.create(JobKind.ASSEMBLE, {})
    store.update(job.id, state=JobState.SUCCEEDED)
    assert store.claim_next_queued() is None


def test_requeue_orphans_recovers_jobs_stuck_running(store: JobStore):
    job = store.create(JobKind.IMAGE_TO_VIDEO, {})
    store.claim_next_queued()
    store.update(job.id, progress=0.6, backend_ref="prompt-123")

    assert store.requeue_orphans() == 1

    recovered = store.get(job.id)
    assert recovered.state is JobState.QUEUED
    assert recovered.progress == 0.0
    assert recovered.backend_ref is None


def test_requeue_orphans_leaves_finished_jobs_alone(store: JobStore):
    job = store.create(JobKind.ASSEMBLE, {})
    store.update(job.id, state=JobState.SUCCEEDED)
    assert store.requeue_orphans() == 0
    assert store.get(job.id).state is JobState.SUCCEEDED


def test_list_filters_by_state(store: JobStore):
    a = store.create(JobKind.ASSEMBLE, {})
    store.create(JobKind.ASSEMBLE, {})
    store.update(a.id, state=JobState.FAILED, error="boom")

    failed = store.list(states=[JobState.FAILED])
    assert [j.id for j in failed] == [a.id]
    assert failed[0].error == "boom"
    assert len(store.list()) == 2


def test_list_respects_limit(store: JobStore):
    for _ in range(5):
        store.create(JobKind.ASSEMBLE, {})
    assert len(store.list(limit=3)) == 3


def test_state_survives_reopening_the_database(tmp_path: Path):
    path = tmp_path / "persist.sqlite3"
    store = JobStore(path)
    job = store.create(JobKind.FACE_SWAP, {"target": "x.mp4"})
    store.update(job.id, state=JobState.SUCCEEDED, outputs=["out.mp4"])
    store.close()

    reopened = JobStore(path)
    try:
        restored = reopened.get(job.id)
        assert restored.state is JobState.SUCCEEDED
        assert restored.outputs == ["out.mp4"]
        assert restored.kind is JobKind.FACE_SWAP
    finally:
        reopened.close()
