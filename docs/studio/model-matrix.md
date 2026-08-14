# Model matrix — what fits in 16 GB

Everything here is scoped to a single RTX 5070 Ti (16 GB) with 64 GB system RAM.
VRAM figures are for the weights plus working set at 720p; they move with
resolution, frame count and attention backend, so treat them as a starting
point for what to try first, not a guarantee.

Sources for the model claims are listed at the bottom.

---

## Part 1 — Image → video (the "extend a still into a 5–10 s scene" feature)

This is the core of what you described: one or more stills, a prompt describing
the scene, out comes a short clip.

| Model | Params | Fits 16 GB? | Notes |
|---|---|---|---|
| **Wan 2.2 TI2V-5B** | 5B | Yes, fp16, comfortably | **Start here.** Single model (not MoE), native ComfyUI support, 720p @ 24 fps. Apache 2.0 |
| **Wan 2.2 I2V-A14B** (GGUF Q4_K_M / Q5_K_M) | 14B MoE | Yes, with block swap | Best open I2V quality at this size. Two experts (high/low noise) load sequentially; leans on your 64 GB RAM. Slower |
| **HunyuanVideo 1.5** | 8.3B | Yes, ~14 GB with offloading | Strong on realistic human faces and motion |
| **LTX-2 / 2.3** (distilled, FP8) | — | Awkward | Fast, and generates synced audio in one pass — but the Gemma 3 12B text encoder alone wants ~24–27 GB. Needs encoder offload or precomputed embeddings on a 16 GB card |
| **CogVideoX-5B I2V** | 5B | Yes | Older, weaker prompt adherence. Skip unless you hit a specific need |
| **Stable Video Diffusion** | — | Yes | No text prompt — it animates an image with no scene control. Wrong tool for what you want |

**Recommendation:** Wan 2.2 TI2V-5B first — it is the fastest path to a working
loop and the shipped `wan22_i2v_16gb.json` workflow targets it. Once you know
what you want, add the A14B GGUF for final renders.

**A note on duration.** These models generate a fixed frame count in one pass,
typically ~5 seconds. For 10 seconds you either extend (feed the last frame back
as the next clip's start image) or stitch two clips on the timeline. The studio's
`assemble` job exists partly for this — chaining 5 s generations into a longer
scene is the normal workflow, not a workaround.

**Prompting for I2V** differs from image prompting. Describe *motion and camera*,
not appearance — appearance is already fixed by your input image:

> Slow dolly-in. She turns her head toward camera and smiles; water ripples
> behind her, late afternoon light, shallow depth of field, subtle handheld drift.

**Wan 2.2 needs a real negative prompt.** The shipped template defaults to the
standard one (overexposed, blurry, static, low quality, artifacts…); leaving it
empty measurably degrades output.

**Multi-image.** "Use any image**s**" maps to first/last-frame workflows: give a
start and end frame and let the model interpolate the scene between them. That
is a different graph than plain I2V — build it in ComfyUI, export API format,
and run `scripts/bindgen.py` to generate the template.

---

## Part 2 — Video enhancement (more frames, better quality)

Two separable operations. Do them in this order — upscale first, interpolate
second, so the interpolator works on clean frames.

### Spatial (resolution / detail)

| Tool | Fits | Notes |
|---|---|---|
| **Real-ESRGAN / 4x-UltraSharp** | Trivially | Fast, per-frame, no temporal awareness — can shimmer on video. Good default |
| **SeedVR2** (3B fp8, tiling + BlockSwap) | Yes | Diffusion video restoration with real temporal consistency. Much better on soft or compression-damaged footage. Slow — reserve for shots that matter. ICLR 2026 |
| **SUPIR** | Tight | Heavy, image-oriented; temporal flicker on video unless carefully driven |

### Temporal (frame rate)

| Tool | Notes |
|---|---|
| **RIFE** (rife47/rife49) | The practical default. Fast, good quality, 2×/4× |
| **FILM** | Better on large motion, slower |
| **GIMM-VFI** | Newer, stronger on complex motion, heavier |

The shipped `enhance_upscale_interpolate.json` does ESRGAN → RIFE. Swap in
SeedVR2 when a clip deserves it.

**Interpolating generated video is unusually effective**, because these models
often produce 16–24 fps natively. 2× RIFE to 48 fps removes most of the
"AI video" judder for very little compute.

---

## Part 3 — Face swap

Not VRAM-bound; 16 GB is ample. The real axis is *per-clip* versus *per-identity*.

| Tool | Approach | When |
|---|---|---|
| **FaceFusion** | Pretrained one-shot swap (inswapper/simswap) + face enhancer | Actively maintained, headless CLI, CUDA. This is what the studio drives |
| **DeepFaceLab** | Train a dedicated model per identity pair, hours to days | Historically the quality ceiling, but largely unmaintained. Only worth it for one identity you will reuse a lot |
| **DeepFaceLive** | Real-time, DFL-trained models | Streaming/webcam, not file rendering |
| **FaceFusion "deep swapper"** | Runs DFL-style trained models inside FaceFusion | The bridge between the two tiers — train once, run in the maintained tool |

Since you said accuracy and quality are key, the two things that move quality
most are not the swapper model:

1. **Source face set.** Multiple angles and lighting conditions matching the
   target beat any model choice. FaceFusion accepts multiple source images.
2. **The enhancer pass.** `gfpgan_1.4` or `codeformer` at 70–85 blend. At 100
   you get a plastic, over-restored look that reads as fake immediately.

Then: match resolution and grain between source and target, and prefer targets
without heavy motion blur, extreme angles, or occlusion.

---

## Part 4 — Corrections to the stack you were quoted

The description you heard ("Deepseek V3 engine… Stable Diffusion 1.5 and
fine-tuned SDXL… consistent in 90–95% of renders") is marketing copy for a
*hosted* companion-chat product. It doesn't transfer to a local video pipeline:

**DeepSeek V3 cannot run on this machine, and is unrelated to video.** It is a
671B-parameter Mixture-of-Experts *text* model — even at 4-bit it needs
hundreds of GB. It generates conversation, not images or video. Nothing in your
four features needs it.

If you want a local LLM to help *write prompts*, that's a reasonable addition,
and a 12–30B model quantized to Q4 fits 16 GB comfortably (Mistral Small,
Gemma 3 27B, Qwen3 30B-A3B). Run it in a separate process from ComfyUI, or
they will fight over VRAM — and expect to unload one to run the other.

**SD 1.5 is a 2022 model.** For photorealistic stills in 2026 the current
options are Flux.1-dev (GGUF Q6/Q8 fits 16 GB), Qwen-Image, or a good SDXL
fine-tune. SD 1.5 survives only for its LoRA ecosystem and speed.

**"90–95% character consistency" is not a property of SD 1.5 or SDXL.**
Consistency comes from technique layered on top: a character LoRA (the reliable
method — train once per character), or identity adapters like IPAdapter FaceID,
PuLID or InstantID (no training, less exact). Any vendor quoting a consistency
percentage without naming the technique is quoting a marketing number.

---

## Suggested build order

Do not install everything at once — each layer is independently debuggable, and
a broken torch install is much easier to find with three custom nodes present
than thirty.

1. ComfyUI + PyTorch cu128, verified against the checks in the setup guide.
2. Wan 2.2 TI2V-5B, rendering one 5 s clip from the ComfyUI UI directly.
3. The studio orchestrator on top, same render via the API.
4. ffmpeg timeline — stitch two generated clips.
5. Enhancement nodes (ESRGAN + RIFE).
6. FaceFusion.
7. Only then: A14B GGUF, SeedVR2, first/last-frame workflows.

Steps 1–4 give you a working end-to-end loop. Everything after that is quality.

---

## Sources

- [ComfyUI Blackwell (50-series) support thread](https://github.com/Comfy-Org/ComfyUI/discussions/6643) — sm_120 / PyTorch build requirements
- [ComfyUI sm_120 incompatibility issue #7127](https://github.com/Comfy-Org/ComfyUI/issues/7127)
- [ComfyUI official Wan 2.2 workflow docs](https://docs.comfy.org/tutorials/video/wan/wan2_2)
- [Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2) · [Wan2.2-I2V-A14B GGUF quants](https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF)
- [Wan2GP — low-VRAM wrapper for Wan/LTX/Hunyuan](https://github.com/deepbeepmeep/Wan2GP)
- [Lightricks/LTX-2](https://github.com/Lightricks/LTX-2) · [text-encoder VRAM discussion](https://github.com/Lightricks/ComfyUI-LTXVideo/issues/303)
- [ComfyUI-SeedVR2_VideoUpscaler](https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler) — sizes, tiling, BlockSwap, measured throughput
- [facefusion/facefusion](https://github.com/facefusion/facefusion) · [deep swapper docs](https://docs.facefusion.io/usage/cli-arguments/processors/deep-swapper)
- [iperov/DeepFaceLab](https://github.com/iperov/DeepFaceLab) · [DeepFaceLive](https://github.com/iperov/DeepFaceLive)
