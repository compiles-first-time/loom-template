"""Tests for workflow template loading and parameter binding."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from studio.schemas import JobError
from studio.workflows import WorkflowRegistry, load_template

TEMPLATE = {
    "name": "demo",
    "description": "demo workflow",
    "defaults": {"steps": 20, "seed": 0},
    "bindings": {
        "prompt": [{"node": "6", "input": "text"}],
        "steps": [{"node": "3", "input": "steps"}],
        "seed": [{"node": "3", "input": "seed"}],
        "fps": [{"node": "9", "input": "fps"}, {"node": "10", "input": "frame_rate"}],
    },
    "graph": {
        "3": {"class_type": "KSampler", "inputs": {"steps": 1, "seed": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "PLACEHOLDER"}},
        "9": {"class_type": "CreateVideo", "inputs": {"fps": 8}},
        "10": {"class_type": "VHS_VideoCombine", "inputs": {"frame_rate": 8}},
    },
}


@pytest.fixture()
def workflows_dir(tmp_path: Path) -> Path:
    (tmp_path / "demo.json").write_text(json.dumps(TEMPLATE), encoding="utf-8")
    return tmp_path


def test_bind_applies_params_over_defaults(workflows_dir: Path):
    template = WorkflowRegistry(workflows_dir).get("demo")
    graph = template.bind({"prompt": "a cat", "steps": 35})
    assert graph["6"]["inputs"]["text"] == "a cat"
    assert graph["3"]["inputs"]["steps"] == 35
    assert graph["3"]["inputs"]["seed"] == 0  # from defaults


def test_bind_writes_every_target_of_a_multi_bound_param(workflows_dir: Path):
    graph = WorkflowRegistry(workflows_dir).get("demo").bind({"fps": 24})
    assert graph["9"]["inputs"]["fps"] == 24
    assert graph["10"]["inputs"]["frame_rate"] == 24


def test_bind_does_not_mutate_the_template(workflows_dir: Path):
    template = WorkflowRegistry(workflows_dir).get("demo")
    template.bind({"prompt": "first"})
    second = template.bind({"prompt": "second"})
    assert second["6"]["inputs"]["text"] == "second"
    assert template.graph["6"]["inputs"]["text"] == "PLACEHOLDER"


def test_bind_rejects_unknown_parameter(workflows_dir: Path):
    template = WorkflowRegistry(workflows_dir).get("demo")
    with pytest.raises(JobError, match="no binding for"):
        template.bind({"promt": "typo"})


def test_bind_ignores_none_values(workflows_dir: Path):
    graph = WorkflowRegistry(workflows_dir).get("demo").bind({"steps": None})
    assert graph["3"]["inputs"]["steps"] == 20  # default survives


def test_prompt_braces_do_not_corrupt_the_graph(workflows_dir: Path):
    # The whole reason for binding-by-node instead of string substitution.
    nasty = '{{seed}} {"node": "3"} \\ 100% "quoted"'
    graph = WorkflowRegistry(workflows_dir).get("demo").bind({"prompt": nasty})
    assert graph["6"]["inputs"]["text"] == nasty
    assert graph["3"]["inputs"]["seed"] == 0


def test_binding_to_a_missing_node_fails_loudly(tmp_path: Path):
    broken = {**TEMPLATE, "bindings": {"prompt": [{"node": "999", "input": "text"}]}}
    (tmp_path / "broken.json").write_text(json.dumps(broken), encoding="utf-8")
    template = WorkflowRegistry(tmp_path).get("broken")
    with pytest.raises(JobError, match="not in the graph"):
        template.bind({"prompt": "x"})


def test_registry_lists_available_templates(workflows_dir: Path):
    assert WorkflowRegistry(workflows_dir).available() == ["demo"]


def test_registry_reloads_after_the_file_changes(workflows_dir: Path):
    registry = WorkflowRegistry(workflows_dir)
    assert registry.get("demo").defaults["steps"] == 20

    changed = {**TEMPLATE, "defaults": {"steps": 99, "seed": 0}}
    path = workflows_dir / "demo.json"
    path.write_text(json.dumps(changed), encoding="utf-8")
    import os
    os.utime(path, (0, 0))  # force a distinct mtime

    assert registry.get("demo").defaults["steps"] == 99


def test_registry_rejects_path_traversal(workflows_dir: Path):
    with pytest.raises(JobError, match="invalid workflow name"):
        WorkflowRegistry(workflows_dir).get("../../etc/passwd")


def test_registry_error_names_available_workflows(workflows_dir: Path):
    with pytest.raises(JobError, match="demo"):
        WorkflowRegistry(workflows_dir).get("nope")


def test_load_template_rejects_graphless_file(tmp_path: Path):
    path = tmp_path / "empty.json"
    path.write_text(json.dumps({"name": "empty"}), encoding="utf-8")
    with pytest.raises(JobError, match="no 'graph'"):
        load_template(path)


def test_load_template_reports_bad_json(tmp_path: Path):
    path = tmp_path / "bad.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(JobError, match="not valid JSON"):
        load_template(path)


def test_shipped_templates_are_loadable_and_self_consistent():
    """Every template in workflows/ must bind to nodes that exist."""
    directory = Path(__file__).resolve().parent.parent / "workflows"
    names = WorkflowRegistry(directory).available()
    assert names, "expected shipped workflow templates"

    for name in names:
        template = WorkflowRegistry(directory).get(name)
        for param, targets in template.bindings.items():
            for target in targets:
                assert target.node in template.graph, (
                    f"{name}: binding '{param}' points at missing node {target.node}"
                )
        # Defaults must only name parameters the template can actually bind.
        assert not set(template.defaults) - set(template.bindings), (
            f"{name}: defaults reference unbound parameters"
        )
