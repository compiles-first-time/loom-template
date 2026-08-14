# Studio setup — RTX 5070 Ti / Windows 11

Target rig: RTX 5070 Ti (16 GB), 64 GB DDR4-3200, 12-core CPU, 3 TB storage, Windows 11 Home.

The single thing that derails this build is the Blackwell toolchain. Read the first
section before installing anything.

---

## 1. The Blackwell problem (read first)

The 5070 Ti is Blackwell — CUDA compute capability **sm_120**. PyTorch ships
precompiled kernels per architecture, and any wheel built before Blackwell
support has no sm_120 kernels at all. You get this at import time:

```
NVIDIA GeForce RTX 5070 Ti with CUDA capability sm_120 is not compatible with
the current PyTorch installation. The current PyTorch install supports CUDA
capabilities sm_50 sm_60 sm_61 sm_70 sm_75 sm_80 sm_86 sm_90.
```

Everything then falls back to CPU, or crashes. Rules that follow from this:

1. **Install PyTorch from a CUDA 12.8+ index**, never plain `pip install torch`
   (PyPI's default wheel is built for the older CUDA line).

   ```powershell
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```

   If a stable wheel still refuses the card, fall back to nightly:

   ```powershell
   pip install --pre torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cu128
   ```

2. **Verify after every custom-node install.** Custom nodes list `torch` in their
   `requirements.txt`; pip happily "satisfies" that by replacing your CUDA 12.8
   build with a default one, silently breaking the GPU. Check with:

   ```powershell
   python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
   ```

   You want a `+cu128` (or later) suffix and `True`. If a node install broke it,
   reinstall from the CUDA index — you do not need to rebuild the environment.

3. **Do not install `xformers`** unless you have confirmed a matching Blackwell
   build. It pins a torch version and will drag you back to a non-sm_120 wheel.
   PyTorch's built-in SDPA attention is fine; `SageAttention` is the upgrade
   path once everything else works, not a day-one install.

A quick way to avoid #2 entirely: strip `torch`, `torchvision` and `torchaudio`
lines out of each custom node's `requirements.txt` before installing it.

## 2. Install order

Do these in sequence. Skipping ahead is how the torch build gets clobbered.

| # | Step | Notes |
|---|---|---|
| 1 | NVIDIA Studio driver (latest) | Studio branch over Game Ready — fewer regressions for compute |
| 2 | Python 3.12 (python.org, not the Store) | Tick "Add to PATH". The Store build sandboxes paths and breaks ComfyUI |
| 3 | Git for Windows | |
| 4 | ffmpeg | `winget install Gyan.FFmpeg`, then confirm `ffmpeg -version` in a new shell |
| 5 | ComfyUI | Portable build, or clone + venv. Portable is easier to keep isolated |
| 6 | PyTorch cu128 into ComfyUI's Python | Per §1 |
| 7 | ComfyUI-Manager | Everything else installs through it |
| 8 | Custom nodes | Verify torch after each batch |
| 9 | Models | See [model-matrix.md](./model-matrix.md) |
| 10 | Studio orchestrator | `apps/studio`, see its README |

`scripts/studio-bootstrap.ps1` automates 4–7 and runs the verification.

## 3. Storage layout

Models are the bulk — budget **300–600 GB** if you collect a few video
checkpoints. Put them on the data drive, not `C:`.

```
D:\ai\
  ComfyUI\
    models\            # checkpoints, VAEs, text encoders, upscalers
  facefusion\
  studio-data\         # STUDIO_DATA_DIR
    uploads\  outputs\  workspace\  studio.sqlite3
```

Point ComfyUI at an external model directory rather than copying files around:
copy `extra_model_paths.yaml.example` to `extra_model_paths.yaml` and set the
base path. That way FaceFusion, ComfyUI and the studio share one model tree.

## 4. System tuning that actually matters

- **Page file: leave it system-managed, on an SSD, and give it room.** Loading a
  14B video model memory-maps tens of GB. A fixed small page file causes
  "paging file too small" crashes that look like model corruption. With 64 GB
  RAM, allow up to ~64 GB of page file.
- **64 GB RAM is the reason 14B models are reachable at all.** Block-swapping
  keeps most weights in system RAM and streams them to VRAM per step. It is
  slower per frame but it is the difference between running and OOM.
- **Disable hardware-accelerated GPU scheduling** if you see intermittent
  allocation failures — it reserves VRAM unpredictably.
- **Nothing else on the GPU while rendering.** A browser with hardware
  acceleration on can hold 1–2 GB, which is the margin you need at 720p.
- **Watch VRAM**: `nvidia-smi --query-gpu=memory.used,memory.total --format=csv -l 2`.
  The studio's `/api/health` reports the same numbers in the UI.

## 5. Expected performance

Rough figures for a 5070 Ti at 720p; treat as order-of-magnitude, not benchmarks.
Measure your own — first run of any model includes compile and load time that
does not recur.

| Task | Expectation |
|---|---|
| Wan 2.2 TI2V-5B, 5 s @ 720p, 30 steps | single-digit minutes |
| Wan 2.2 I2V-A14B GGUF + block swap, 5 s @ 720p | noticeably longer; RAM-bandwidth bound |
| FaceFusion swap + enhance, 1080p | roughly video length to a few times it |
| Real-ESRGAN 2× + RIFE 2×, per minute of 720p | minutes |
| SeedVR2 3B restoration | slowest of the set — reserve it for hero shots |

The practical workflow that follows: **generate at low resolution and few steps
until the motion and composition are right, then re-render the keeper at full
settings.** Seeds are recorded in each output's `.json` sidecar, so a good draft
can be reproduced exactly at higher quality.

## 6. Verifying the install

```powershell
# 1. GPU visible to torch, with a Blackwell-capable build
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"

# 2. ComfyUI answering
curl http://127.0.0.1:8188/system_stats

# 3. ffmpeg on PATH
ffmpeg -version

# 4. Everything, as the orchestrator sees it
curl http://127.0.0.1:8710/api/health
```

The last one is the real check — it reports each backend independently, so a
red chip in the UI tells you which of the three to fix.

## 7. Common failures

| Symptom | Cause |
|---|---|
| `sm_120 is not compatible` | Wrong torch build — §1 |
| Works, then stops using the GPU after installing a node | That node's `requirements.txt` replaced torch — §1.2 |
| `torch.cuda.is_available()` is False, driver is fine | Usually the Microsoft Store Python. Reinstall from python.org |
| "Allocation on device" / OOM mid-render | Lower resolution or frame count first; then enable block swap; then drop to a smaller quant |
| "paging file is too small" | §4 |
| Render finishes but no output file | Workflow has no save node — the studio surfaces this as an explicit error |
| Studio queues jobs but nothing runs | ComfyUI not started, or `STUDIO_COMFY_URL` points at the wrong port |
