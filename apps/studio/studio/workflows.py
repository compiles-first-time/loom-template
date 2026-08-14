"""ComfyUI workflow templates with explicit parameter bindings.

A template is a JSON file shaped like::

    {
      "name": "wan22_i2v",
      "description": "...",
      "graph": { ... ComfyUI API-format prompt ... },
      "bindings": {
        "prompt": [{"node": "6", "input": "text"}],
        "seed":   [{"node": "3", "input": "seed"}]
      },
      "defaults": {"seed": 0, "steps": 20}
    }

Binding by (node id, input name) rather than string-substituting the JSON means
a prompt containing ``{{seed}}`` or a stray brace can't corrupt the graph, and
a renamed node fails loudly at bind time instead of silently rendering with the
template's placeholder text still in it.
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .schemas import JobError


@dataclass(frozen=True)
class Binding:
    node: str
    input: str


@dataclass(frozen=True)
class WorkflowTemplate:
    name: str
    description: str
    graph: dict[str, Any]
    bindings: dict[str, tuple[Binding, ...]]
    defaults: dict[str, Any]

    def bind(self, params: dict[str, Any]) -> dict[str, Any]:
        """Return a concrete ComfyUI prompt graph with `params` applied.

        Values in `params` win over `defaults`. Unknown parameter names raise —
        a typo'd key should not silently render the default.
        """
        unknown = set(params) - set(self.bindings)
        if unknown:
            raise JobError(
                f"workflow '{self.name}' has no binding for: {sorted(unknown)}. "
                f"Known parameters: {sorted(self.bindings)}"
            )

        resolved = {**self.defaults, **{k: v for k, v in params.items() if v is not None}}
        graph = copy.deepcopy(self.graph)

        for key, targets in self.bindings.items():
            if key not in resolved:
                continue
            for target in targets:
                node = graph.get(target.node)
                if node is None:
                    raise JobError(
                        f"workflow '{self.name}' binds '{key}' to node '{target.node}', "
                        "which is not in the graph (was the workflow re-exported?)"
                    )
                node.setdefault("inputs", {})[target.input] = resolved[key]
        return graph


def load_template(path: Path) -> WorkflowTemplate:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise JobError(f"workflow template not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise JobError(f"workflow template {path.name} is not valid JSON: {exc}") from exc

    graph = raw.get("graph")
    if not isinstance(graph, dict) or not graph:
        raise JobError(f"workflow template {path.name} has no 'graph'")

    bindings: dict[str, tuple[Binding, ...]] = {}
    for key, targets in (raw.get("bindings") or {}).items():
        if not isinstance(targets, list) or not targets:
            raise JobError(f"binding '{key}' in {path.name} must be a non-empty list")
        bindings[key] = tuple(
            Binding(node=str(t["node"]), input=str(t["input"])) for t in targets
        )

    return WorkflowTemplate(
        name=raw.get("name") or path.stem,
        description=raw.get("description", ""),
        graph=graph,
        bindings=bindings,
        defaults=raw.get("defaults") or {},
    )


class WorkflowRegistry:
    """Loads templates from disk, re-reading when the file changes.

    Editing a workflow in ComfyUI and re-exporting it should take effect on the
    next job, without restarting the orchestrator.
    """

    def __init__(self, directory: Path) -> None:
        self._dir = directory
        self._cache: dict[str, tuple[float, WorkflowTemplate]] = {}

    def available(self) -> list[str]:
        if not self._dir.is_dir():
            return []
        return sorted(p.stem for p in self._dir.glob("*.json"))

    def get(self, name: str) -> WorkflowTemplate:
        # Reject traversal: workflow names come in over HTTP.
        if "/" in name or "\\" in name or name.startswith("."):
            raise JobError(f"invalid workflow name: {name!r}")

        path = self._dir / f"{name}.json"
        if not path.is_file():
            raise JobError(
                f"unknown workflow '{name}'. Available: {self.available() or '(none installed)'}"
            )

        mtime = path.stat().st_mtime
        cached = self._cache.get(name)
        if cached and cached[0] == mtime:
            return cached[1]

        template = load_template(path)
        self._cache[name] = (mtime, template)
        return template
