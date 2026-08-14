#!/usr/bin/env python3
"""Turn a ComfyUI "Export (API)" file into a studio workflow template.

The templates shipped in workflows/ are a starting point, but node IDs depend
on how a graph was built, so the reliable path is: build the workflow in
ComfyUI until it renders what you want, Export (API), then run this.

    python scripts/bindgen.py exported.json -o workflows/my_i2v.json

It scans the graph for inputs whose names match the parameters the studio
pipelines pass, and writes a `bindings` block wiring them up. Review the
result — where a graph has two CLIPTextEncode nodes, only ordering
distinguishes the positive from the negative prompt, and this guesses.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Input names the studio knows how to supply, mapped from (class_type, input).
# Order matters for the prompt heuristic: first text encode -> positive.
_DIRECT: dict[tuple[str, str], str] = {
    ("LoadImage", "image"): "image",
    ("VHS_LoadVideo", "video"): "video",
    ("LoadVideo", "video"): "video",
    ("KSampler", "seed"): "seed",
    ("KSampler", "steps"): "steps",
    ("KSampler", "cfg"): "cfg",
    ("KSamplerAdvanced", "noise_seed"): "seed",
    ("KSamplerAdvanced", "steps"): "steps",
    ("KSamplerAdvanced", "cfg"): "cfg",
    ("RandomNoise", "noise_seed"): "seed",
    ("ModelSamplingSD3", "shift"): "shift",
    ("CreateVideo", "fps"): "fps",
    ("VHS_VideoCombine", "frame_rate"): "fps",
    ("SaveWEBM", "fps"): "fps",
}

# Geometry/length inputs, matched on input name across any latent-ish node.
_BY_INPUT_NAME = {
    "width": "width",
    "height": "height",
    "length": "frames",
    "num_frames": "frames",
    "video_frames": "frames",
    "batch_size": None,  # deliberately not exposed
}

_LATENT_CLASSES = (
    "Wan22ImageToVideoLatent",
    "WanImageToVideo",
    "EmptyHunyuanLatentVideo",
    "EmptyLTXVLatentVideo",
    "LTXVImgToVideo",
    "EmptyLatentImage",
    "SVD_img2vid_Conditioning",
    "CogVideoImageEncode",
)


def derive_bindings(graph: dict[str, Any]) -> tuple[dict[str, list[dict[str, str]]], list[str]]:
    bindings: dict[str, list[dict[str, str]]] = {}
    notes: list[str] = []

    def add(param: str, node: str, input_name: str) -> None:
        bindings.setdefault(param, []).append({"node": node, "input": input_name})

    for node_id, node in graph.items():
        class_type = node.get("class_type", "")
        inputs = node.get("inputs") or {}

        for input_name in inputs:
            param = _DIRECT.get((class_type, input_name))
            if param:
                add(param, node_id, input_name)
                continue
            if class_type in _LATENT_CLASSES:
                mapped = _BY_INPUT_NAME.get(input_name)
                if mapped:
                    add(mapped, node_id, input_name)

    # Prompt encoders: sort by node id so the assignment is at least stable.
    encoders = sorted(
        (nid for nid, n in graph.items() if n.get("class_type", "").startswith("CLIPTextEncode")),
        key=lambda x: (len(x), x),
    )
    if encoders:
        add("prompt", encoders[0], "text")
    if len(encoders) > 1:
        add("negative_prompt", encoders[1], "text")
        notes.append(
            f"Guessed node {encoders[0]} = positive prompt, {encoders[1]} = negative. "
            "Check against your graph and swap if wrong."
        )
    if len(encoders) > 2:
        notes.append(
            f"Found {len(encoders)} text encoders; only the first two were bound."
        )

    if "image" not in bindings and "video" not in bindings:
        notes.append("No LoadImage/LoadVideo node found — this graph takes no media input.")

    savers = [
        nid for nid, n in graph.items()
        if any(k in n.get("class_type", "") for k in ("Save", "VideoCombine"))
    ]
    if not savers:
        notes.append("No save node found — the studio will not be able to collect any output.")

    return bindings, notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="ComfyUI API-format export")
    parser.add_argument("-o", "--output", type=Path, help="template path (default: stdout)")
    parser.add_argument("-n", "--name", help="template name (default: output stem)")
    parser.add_argument("-d", "--description", default="", help="human-readable description")
    args = parser.parse_args(argv)

    try:
        raw = json.loads(args.input.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: cannot read {args.input}: {exc}", file=sys.stderr)
        return 1

    # An API export is a bare {node_id: {...}} map; a UI export has "nodes".
    if "nodes" in raw and "class_type" not in next(iter(raw.values()), {}):
        print(
            "error: this looks like a UI-format workflow. In ComfyUI use "
            "Workflow > Export (API), not Export.",
            file=sys.stderr,
        )
        return 1

    graph = raw.get("prompt", raw)
    bindings, notes = derive_bindings(graph)

    template = {
        "name": args.name or (args.output.stem if args.output else args.input.stem),
        "description": args.description,
        "defaults": {},
        "bindings": bindings,
        "graph": graph,
    }
    payload = json.dumps(template, indent=2)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
        print(f"wrote {args.output} with {len(bindings)} binding(s): {', '.join(sorted(bindings))}")
    else:
        print(payload)

    for note in notes:
        print(f"note: {note}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
