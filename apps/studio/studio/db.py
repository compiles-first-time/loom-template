"""SQLite-backed job store.

Deliberately boring: one file, WAL mode, a process-wide lock around writes.
A single-user workstation does not need Postgres, and a job store that
survives `Ctrl-C` in the middle of a 20-minute render is worth more than
throughput here.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .schemas import Job, JobKind, JobState

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL,
    state        TEXT NOT NULL,
    params       TEXT NOT NULL,
    progress     REAL NOT NULL DEFAULT 0,
    stage        TEXT NOT NULL DEFAULT '',
    error        TEXT,
    outputs      TEXT NOT NULL DEFAULT '[]',
    backend_ref  TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_state_created ON jobs(state, created_at);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class JobStore:
    def __init__(self, db_path: Path) -> None:
        self._path = db_path
        self._lock = threading.RLock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    # -- lifecycle ----------------------------------------------------------

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # -- writes -------------------------------------------------------------

    def create(self, kind: JobKind, params: dict[str, Any]) -> Job:
        now = utc_now()
        job = Job(
            id=uuid.uuid4().hex[:16],
            kind=kind,
            state=JobState.QUEUED,
            params=params,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._conn.execute(
                "INSERT INTO jobs (id, kind, state, params, progress, stage, error, outputs,"
                " backend_ref, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    job.id,
                    job.kind.value,
                    job.state.value,
                    json.dumps(job.params),
                    job.progress,
                    job.stage,
                    job.error,
                    json.dumps(job.outputs),
                    job.backend_ref,
                    job.created_at,
                    job.updated_at,
                ),
            )
            self._conn.commit()
        return job

    def update(self, job_id: str, **fields: Any) -> Job | None:
        """Patch a job. Unknown keys are rejected loudly rather than ignored."""
        allowed = {"state", "progress", "stage", "error", "outputs", "backend_ref", "params"}
        unknown = set(fields) - allowed
        if unknown:
            raise ValueError(f"cannot update unknown job fields: {sorted(unknown)}")
        if not fields:
            return self.get(job_id)

        columns: list[str] = []
        values: list[Any] = []
        for key, value in fields.items():
            if key == "state":
                value = value.value if isinstance(value, JobState) else str(value)
            elif key in {"outputs", "params"}:
                value = json.dumps(value)
            columns.append(f"{key} = ?")
            values.append(value)

        columns.append("updated_at = ?")
        values.append(utc_now())
        values.append(job_id)

        with self._lock:
            cur = self._conn.execute(
                f"UPDATE jobs SET {', '.join(columns)} WHERE id = ?", values
            )
            self._conn.commit()
            if cur.rowcount == 0:
                return None
        return self.get(job_id)

    def requeue_orphans(self) -> int:
        """Reset jobs left RUNNING by a crash back to QUEUED on startup.

        Without this, killing the server mid-render leaves a job wedged in
        `running` forever and the worker never picks it up again.
        """
        with self._lock:
            cur = self._conn.execute(
                "UPDATE jobs SET state = ?, stage = ?, progress = 0, backend_ref = NULL,"
                " updated_at = ? WHERE state = ?",
                (JobState.QUEUED.value, "requeued after restart", utc_now(), JobState.RUNNING.value),
            )
            self._conn.commit()
            return cur.rowcount

    # -- reads --------------------------------------------------------------

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _row_to_job(row) if row else None

    def claim_next_queued(self) -> Job | None:
        """Atomically move the oldest queued job to RUNNING and return it."""
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM jobs WHERE state = ? ORDER BY created_at, rowid LIMIT 1",
                (JobState.QUEUED.value,),
            ).fetchone()
            if row is None:
                return None
            self._conn.execute(
                "UPDATE jobs SET state = ?, updated_at = ? WHERE id = ? AND state = ?",
                (JobState.RUNNING.value, utc_now(), row["id"], JobState.QUEUED.value),
            )
            self._conn.commit()
        job = _row_to_job(row)
        job.state = JobState.RUNNING
        return job

    def list(self, limit: int = 100, states: Iterable[JobState] | None = None) -> list[Job]:
        query = "SELECT * FROM jobs"
        params: list[Any] = []
        if states:
            values = [s.value for s in states]
            query += f" WHERE state IN ({','.join('?' * len(values))})"
            params.extend(values)
        query += " ORDER BY created_at DESC, rowid DESC LIMIT ?"
        params.append(limit)
        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [_row_to_job(row) for row in rows]


def _row_to_job(row: sqlite3.Row) -> Job:
    return Job(
        id=row["id"],
        kind=JobKind(row["kind"]),
        state=JobState(row["state"]),
        params=json.loads(row["params"]),
        progress=row["progress"],
        stage=row["stage"],
        error=row["error"],
        outputs=json.loads(row["outputs"]),
        backend_ref=row["backend_ref"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
