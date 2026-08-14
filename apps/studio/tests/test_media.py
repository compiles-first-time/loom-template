"""Tests for the ffmpeg command builders — no ffmpeg binary required."""

from __future__ import annotations

import pytest

from studio.media import (
    MediaInfo,
    build_assemble_command,
    build_timeline_filter,
    clip_duration,
    parse_probe,
)
from studio.schemas import Clip, JobError


def info(duration=10.0, width=1280, height=720, fps=30.0, has_audio=True) -> MediaInfo:
    return MediaInfo(duration=duration, width=width, height=height, fps=fps, has_audio=has_audio)


# --- probe parsing ---------------------------------------------------------


def test_parse_probe_reads_stream_fields():
    payload = {
        "streams": [
            {"codec_type": "video", "width": 1920, "height": 1080,
             "avg_frame_rate": "30000/1001", "duration": "12.5"},
            {"codec_type": "audio"},
        ],
        "format": {"duration": "12.5"},
    }
    result = parse_probe(payload)
    assert result.width == 1920
    assert result.height == 1080
    assert result.duration == pytest.approx(12.5)
    assert result.fps == pytest.approx(29.97, abs=0.01)
    assert result.has_audio is True


def test_parse_probe_falls_back_to_container_duration():
    payload = {
        "streams": [{"codec_type": "video", "width": 640, "height": 480, "avg_frame_rate": "25/1"}],
        "format": {"duration": "8.0"},
    }
    assert parse_probe(payload).duration == pytest.approx(8.0)


def test_parse_probe_detects_missing_audio():
    payload = {
        "streams": [{"codec_type": "video", "width": 640, "height": 480,
                     "avg_frame_rate": "25/1", "duration": "4"}],
        "format": {},
    }
    assert parse_probe(payload).has_audio is False


def test_parse_probe_rejects_audio_only_file():
    with pytest.raises(JobError, match="no video stream"):
        parse_probe({"streams": [{"codec_type": "audio"}], "format": {"duration": "3"}})


def test_parse_probe_handles_unknown_frame_rate():
    payload = {
        "streams": [{"codec_type": "video", "width": 640, "height": 480,
                     "avg_frame_rate": "0/0", "duration": "4"}],
        "format": {},
    }
    assert parse_probe(payload).fps == 0.0


# --- clip ranges -----------------------------------------------------------


def test_clip_duration_uses_full_source_by_default():
    assert clip_duration(Clip(source="a.mp4"), info(duration=7.5)) == pytest.approx(7.5)


def test_clip_duration_respects_in_and_out_points():
    clip = Clip(source="a.mp4", start=2.0, end=5.0)
    assert clip_duration(clip, info(duration=10.0)) == pytest.approx(3.0)


def test_clip_duration_clamps_end_to_source_length():
    clip = Clip(source="a.mp4", start=1.0, end=99.0)
    assert clip_duration(clip, info(duration=4.0)) == pytest.approx(3.0)


def test_clip_duration_rejects_empty_range():
    clip = Clip(source="a.mp4", start=9.0, end=None)
    with pytest.raises(JobError, match="empty range"):
        clip_duration(clip, info(duration=5.0))


def test_clip_from_dict_rejects_inverted_range():
    with pytest.raises(ValueError, match="greater than start"):
        Clip.from_dict({"source": "a.mp4", "start": 5, "end": 2})


def test_clip_from_dict_requires_source():
    with pytest.raises(ValueError, match="requires a 'source'"):
        Clip.from_dict({"start": 1})


# --- timeline filter -------------------------------------------------------


def test_single_clip_timeline_normalises_only():
    graph, v, a = build_timeline_filter([5.0], [0.0], 1280, 720, 30)
    assert v == "[v0]" and a == "[a0]"
    assert "scale=1280:720" in graph
    assert "xfade" not in graph


def test_hard_cuts_use_concat_not_xfade():
    graph, v, a = build_timeline_filter([5.0, 4.0, 3.0], [0.0, 0.0, 0.0], 1280, 720, 30)
    assert "concat=n=3:v=1:a=1" in graph
    assert "xfade" not in graph
    assert (v, a) == ("[vout]", "[aout]")


def test_xfade_offsets_accumulate_across_clips():
    # 5 s + 4 s + 3 s with 1 s crossfades: first xfade at 5-1=4 s, second at
    # 4 + 4 - 1 = 7 s.
    graph, _, _ = build_timeline_filter([5.0, 4.0, 3.0], [0.0, 1.0, 1.0], 1280, 720, 30)
    assert "offset=4" in graph
    assert "offset=7" in graph
    assert graph.count("xfade") == 2
    assert graph.count("acrossfade") == 2


def test_transition_is_clamped_to_shortest_neighbour():
    # A 10 s requested crossfade between a 5 s and a 2 s clip must clamp to 2 s.
    graph, _, _ = build_timeline_filter([5.0, 2.0], [0.0, 10.0], 640, 480, 24)
    assert "duration=2" in graph
    assert "duration=10" not in graph


def test_mixed_transitions_and_hard_cuts():
    graph, _, _ = build_timeline_filter([4.0, 4.0, 4.0], [0.0, 0.0, 1.0], 1280, 720, 30)
    assert graph.count("xfade") == 1
    assert "concat=n=2:v=1:a=0" in graph


def test_normalisation_puts_fps_after_setpts():
    """Regression: xfade rejects any input whose frame rate is not constant.

    `setpts` marks its output link as unknown-rate, so a chain ending
    `fps=...,setpts=...` makes ffmpeg fail with "current rate of 1/0 is
    invalid". `fps` has to come last of the two.
    """
    graph, _, _ = build_timeline_filter([5.0, 4.0], [0.0, 1.0], 1280, 720, 30)
    for segment in graph.split(";"):
        if "setpts=PTS-STARTPTS" in segment and "asetpts" not in segment:
            assert "fps=" in segment, "video normalisation must set an explicit fps"
            assert segment.index("setpts=PTS-STARTPTS") < segment.index("fps="), (
                f"fps must follow setpts to restore CFR for xfade: {segment}"
            )


def test_timeline_total_duration_accounts_for_overlap():
    """Crossfades overlap, so the timeline is shorter than the sum of clips."""
    durations = [3.0, 3.0, 3.0]
    transitions = [0.0, 1.0, 0.5]
    graph, _, _ = build_timeline_filter(durations, transitions, 1280, 720, 30)
    # Final xfade offset + final clip duration == total length (7.5 s here).
    final_offset = float(graph.split("offset=")[-1].split("[")[0])
    assert final_offset + durations[-1] == pytest.approx(7.5)


def test_timeline_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        build_timeline_filter([1.0, 2.0], [0.0], 640, 480, 30)


def test_timeline_rejects_empty():
    with pytest.raises(JobError):
        build_timeline_filter([], [], 640, 480, 30)


# --- assemble command ------------------------------------------------------


def test_assemble_seeks_before_input_for_trimmed_clips():
    clips = [Clip(source="a.mp4", start=2.0, end=6.0)]
    cmd = build_assemble_command(clips, [info()], "out.mp4")
    # -ss must precede -i to get a fast keyframe seek.
    assert cmd.index("-ss") < cmd.index("-i")
    assert cmd[cmd.index("-ss") + 1] == "2"
    assert cmd[cmd.index("-to") + 1] == "6"


def test_assemble_injects_silence_for_video_without_audio():
    clips = [Clip(source="a.mp4"), Clip(source="b.mp4")]
    infos = [info(has_audio=False), info(has_audio=True)]
    cmd = build_assemble_command(clips, infos, "out.mp4")
    assert "anullsrc=channel_layout=stereo:sample_rate=48000" in cmd

    filter_complex = cmd[cmd.index("-filter_complex") + 1]
    # Clip 0 is inputs 0 (video) + 1 (silence); clip 1 lands on input 2.
    assert "[0:v]" in filter_complex
    assert "[1:a]" in filter_complex
    assert "[2:v]" in filter_complex
    assert "[2:a]" in filter_complex


def test_assemble_input_indices_are_identity_when_all_have_audio():
    clips = [Clip(source="a.mp4"), Clip(source="b.mp4")]
    infos = [info(), info()]
    filter_complex = _filter_of(build_assemble_command(clips, infos, "out.mp4"))
    assert "[0:v]" in filter_complex and "[0:a]" in filter_complex
    assert "[1:v]" in filter_complex and "[1:a]" in filter_complex
    assert "anullsrc" not in filter_complex


def test_assemble_remaps_indices_for_three_silent_clips():
    clips = [Clip(source=f"{n}.mp4") for n in "abc"]
    infos = [info(has_audio=False)] * 3
    filter_complex = _filter_of(build_assemble_command(clips, infos, "out.mp4"))
    # Each clip consumes two inputs, so videos land on 0, 2, 4.
    for expected in ("[0:v]", "[1:a]", "[2:v]", "[3:a]", "[4:v]", "[5:a]"):
        assert expected in filter_complex, expected


def test_assemble_canvas_defaults_to_largest_input():
    clips = [Clip(source="a.mp4"), Clip(source="b.mp4")]
    infos = [info(width=640, height=480), info(width=1920, height=1080)]
    filter_complex = _filter_of(build_assemble_command(clips, infos, "out.mp4"))
    assert "scale=1920:1080" in filter_complex


def test_assemble_forces_even_dimensions_for_yuv420p():
    clips = [Clip(source="a.mp4")]
    filter_complex = _filter_of(
        build_assemble_command(clips, [info(width=641, height=481)], "out.mp4")
    )
    assert "scale=642:482" in filter_complex


def test_assemble_rejects_no_clips():
    with pytest.raises(JobError, match="at least one clip"):
        build_assemble_command([], [], "out.mp4")


def _filter_of(cmd: list[str]) -> str:
    return cmd[cmd.index("-filter_complex") + 1]
