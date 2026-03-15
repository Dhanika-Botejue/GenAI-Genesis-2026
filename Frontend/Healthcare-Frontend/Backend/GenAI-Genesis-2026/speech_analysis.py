# speech_analysis.py

THRESHOLDS = {
    "low_loudness": 0.30,
    "low_speech_dynamics": 2.2,
    "voice_instability": 0.04,
    "fragmented_speech": 0.5,
    "long_pauses": 0.8,
}


def derive_acoustic_flags(features: dict) -> dict:
    flags = {}

    flags["low_loudness"] = (
        features.get("loudness_sma3_amean", 0)
        < THRESHOLDS["low_loudness"]
    )

    flags["low_speech_dynamics"] = (
        features.get("loudnessPeaksPerSec", 0)
        < THRESHOLDS["low_speech_dynamics"]
    )

    flags["voice_instability"] = (
        features.get("jitterLocal_sma3nz_amean", 0)
        > THRESHOLDS["voice_instability"]
    )

    flags["fragmented_speech"] = (
        features.get("VoicedSegmentsPerSec", 0)
        < THRESHOLDS["fragmented_speech"]
    )

    flags["long_pauses"] = (
        features.get("MeanUnvoicedSegmentLength", 0)
        > THRESHOLDS["long_pauses"]
    )

    return flags


def summarize_acoustic_features(features: dict) -> dict:
    return {
        "pitch_mean": features.get("F0semitoneFrom27.5Hz_sma3nz_amean"),
        "loudness_mean": features.get("loudness_sma3_amean"),
        "loudness_peaks_per_sec": features.get("loudnessPeaksPerSec"),
        "jitter": features.get("jitterLocal_sma3nz_amean"),
        "shimmer": features.get("shimmerLocaldB_sma3nz_amean"),
        "voiced_segments_per_sec": features.get("VoicedSegmentsPerSec"),
        "mean_voiced_segment_length": features.get("MeanVoicedSegmentLengthSec"),
        "mean_unvoiced_segment_length": features.get("MeanUnvoicedSegmentLength"),
    }


def analyze_audio(features: dict) -> dict:
    summary = summarize_acoustic_features(features)
    flags = derive_acoustic_flags(features)

    return {
        "acoustic_summary": summary,
        "speech_flags": flags,
    }