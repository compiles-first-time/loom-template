# Loom Studio

A local orchestration layer over three engines that already do the hard work:

| Engine | Does |
|---|---|
| **ComfyUI** | image → video, upscaling, frame interpolation |
| **FaceFusion** | face swapping and face enhancement |
| **ffmpeg** | trimming, stitching, crossfades, muxing |

The studio adds what none of them provide on their own: **one queue, one job
history, one UI, and one HTTP API** across all three — so a clip can go
generate → enhance → swap → stitch without you hand-carrying files between
three separate tools.

It deliberately does *not* reimplement any of them. The diffusion graphs live in
ComfyUI where you can edit them visually; this drives them.

---

## Quickstart

```bash
cd apps/studio
python -m venv .venv && .venv\Scripts\activate     # PowerShell
pip install -e ".[dev]"

set STUDIO_DATA_DIR=D:\ai\studio-data              # put this on the data drive
python -m studio.main
```

Open <http://127.0.0.1:8710>. The header shows a chip per backend; anything red
tells you what to fix before rendering. ComfyUI must already be running.

Setup for the 5070 Ti specifically — including the Blackwell/PyTorch trap that
breaks most first installs — is in
[`docs/studio/setup-windows-5070ti.md`](../../docs/studio/setup-windows-5070ti.md).
Model choices are in [`docs/studio/model-matrix.md`](../../docs/studio/model-matrix.md).

## Configuration

All environment variables, all optional:

| Variable | Default | Meaning |
|---|---|---|
| `STUDIO_DATA_DIR` | `apps/studio/data` | Uploads, outputs, workspace, SQLite DB |
| `STUDIO_COMFY_URL` | `http://127.0.0.1:8188` | ComfyUI address |
| `STUDIO_COMFY_TIMEOUT_S` | `3600` | Give up on a render after this long |
| `STUDIO_FACEFUSION_DIR` | `C:/ai/facefusion` | FaceFusion checkout |
| `STUDIO_FACEFUSION_PYTHON` | `python` | Interpreter for FaceFusion's venv |
| `STUDIO_FFMPEG` / `STUDIO_FFPROBE` | `ffmpeg` / `ffprobe` | Binaries |
| `STUDIO_HOST` / `STUDIO_PORT` | `127.0.0.1` / `8710` | Bind address |
| `STUDIO_MAX_GPU_JOBS` | `1` | Leave at 1 — see below |
| `STUDIO_WRITE_PROVENANCE` | `true` | Sidecar JSON next to each output |

**`STUDIO_MAX_GPU_JOBS` stays at 1.** Two concurrent renders on a 16 GB card do
not finish sooner; they OOM together at minute nine. The queue is serial by
design.

## Job kinds

`POST /api/jobs` with `{"kind": ..., "params": {...}}`.

### `image_to_video`
```json
{ "kind": "image_to_video",
  "params": { "images": ["uploads/pool.png"],
              "prompt": "Slow dolly-in; she turns toward camera, water ripples behind her",
              "duration_s": 5, "fps": 24, "width": 1280, "height": 704,
              "steps": 30, "cfg": 5.0, "seed": 0,
              "workflow": "wan22_i2v_16gb" } }
```
Frame count is derived from `duration_s × fps` and snapped to `4n+1`, which is
what Wan/LTX-family samplers expect.

### `enhance`
```json
{ "kind": "enhance",
  "params": { "source": "outputs/<job>/clip.mp4",
              "interpolation_multiplier": 2, "fps": 48,
              "workflow": "enhance_upscale_interpolate" } }
```

### `face_swap`
```json
{ "kind": "face_swap",
  "params": { "sources": ["uploads/face1.jpg", "uploads/face2.jpg"],
              "target": "outputs/<job>/clip.mp4",
              "swapper_model": "inswapper_128_fp16",
              "enhancer_model": "gfpgan_1.4", "enhancer_blend": 80 } }
```
Multiple source images (varied angle and lighting) improve results more than
changing the swapper model does.

### `assemble`
```json
{ "kind": "assemble",
  "params": { "clips": [ {"source": "outputs/a/clip.mp4", "start": 0.5, "end": 3.5},
                         {"source": "outputs/b/clip.mp4", "transition_s": 1.0} ],
              "output_name": "scene.mp4", "crf": 18 } }
```
`transition_s` crossfades *into* that clip. Clips are normalised to a shared
canvas and frame rate, and clips without an audio track get silence injected —
otherwise mixing generated (silent) and recorded footage breaks the concat.

No GPU involved, so assemble jobs run fast even while a render is queued.

## Other endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Per-backend status, GPU name, free/total VRAM |
| `GET /api/workflows` | Installed templates with their bindable parameters |
| `POST /api/upload` | Multipart upload; returns the path the job API expects |
| `GET /api/jobs` | Recent jobs, filterable by `?state=` |
| `GET /api/jobs/{id}/events` | Server-sent progress, closes at a terminal state |
| `POST /api/jobs/{id}/cancel` | Cancels queued or running (interrupts ComfyUI too) |
| `GET /api/files?path=` | Serves a file from inside the data dir |

## Workflow templates

`workflows/*.json` wraps a ComfyUI API-format graph with a `bindings` block
mapping studio parameters onto `(node id, input name)` pairs:

```json
"bindings": { "prompt": [{ "node": "6", "input": "text" }],
              "seed":   [{ "node": "3", "input": "seed" }] }
```

Binding by node rather than string-substituting the JSON means a prompt
containing braces, quotes or backslashes cannot corrupt the graph, and a
renamed node fails loudly at bind time instead of silently rendering with
placeholder text still in it.

**The shipped templates are a starting point, not a guarantee** — node IDs
depend on how a graph was built, and available nodes depend on what you have
installed. The reliable path is to build the workflow in ComfyUI until it
renders what you want, then:

```bash
# ComfyUI: Workflow > Export (API)
python scripts/bindgen.py exported.json -o workflows/my_i2v.json -n my_i2v
```

`bindgen` scans for the inputs the pipelines know how to supply and writes the
bindings. It flags what it guessed — with two text encoders, only ordering
distinguishes positive from negative, so check that one.

## Tests

```bash
python -m pytest tests/ -q
```

63 tests, no GPU, no ComfyUI, no ffmpeg required — they cover the filter-graph
builders, template binding, the job store and path containment. The ffmpeg
command builders are pure functions precisely so this stays true.

## Legal note

Face swapping has legitimate uses, and this tool doesn't try to guess yours.
Two things are worth knowing before you point it at a real person:

- In the US, the **TAKE IT DOWN Act (2025)** makes publishing non-consensual
  intimate imagery a federal offence, and it covers AI-generated depictions
  explicitly. Most states have their own deepfake statutes on top, several
  covering non-sexual impersonation and election content.
- Depicting a real, identifiable person without their consent can create
  liability — defamation, right of publicity, harassment — independently of
  whether anything sexual is involved.

Outputs carry a `.json` sidecar recording the job, prompt and seed, and marking
the file as synthetic. Keep it with the file.
