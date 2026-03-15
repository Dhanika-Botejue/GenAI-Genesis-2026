from llm_reasoning import ask_watsonx

transcript = "I am feeling funny and a little weak today."

speech_analysis = {
    "acoustic_summary": {
        "pitch_mean": 26.8,
        "loudness_mean": 0.29,
        "loudness_peaks_per_sec": 2.1,
        "jitter": 0.03,
        "shimmer": 4.0,
        "voiced_segments_per_sec": 0.42,
        "mean_voiced_segment_length": 0.03,
        "mean_unvoiced_segment_length": 1.0
    },
    "speech_flags": {
        "low_loudness": True,
        "low_speech_dynamics": True,
        "voice_instability": False,
        "fragmented_speech": True,
        "long_pauses": True
    }
}

response = ask_watsonx(transcript, speech_analysis)
print(response)