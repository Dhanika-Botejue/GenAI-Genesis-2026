"""
Run this to find the correct MIC_DEVICE_INDEX for your machine.
It tests every input device and prints the RMS level — the one
with a non-zero RMS while you're speaking is your microphone.
"""

import math
import struct
import pyaudio

CHUNK       = 1024
RATE        = 16_000
DURATION_S  = 1      # seconds to sample per device

pa = pyaudio.PyAudio()

print("\n=== Mic Finder — make some noise while each device is tested ===\n")

for i in range(pa.get_device_count()):
    info = pa.get_device_info_by_index(i)
    if info["maxInputChannels"] < 1:
        continue

    channels = 1
    name     = info["name"]

    for rate in (16_000, int(info["defaultSampleRate"])):
        try:
            stream = pa.open(
                format=pyaudio.paInt16,
                channels=channels,
                rate=rate,
                input=True,
                input_device_index=i,
                frames_per_buffer=CHUNK,
            )
            n_chunks = max(1, int(rate / CHUNK * DURATION_S))
            raw      = b"".join(stream.read(CHUNK, exception_on_overflow=False) for _ in range(n_chunks))
            stream.stop_stream()
            stream.close()

            count  = len(raw) // 2
            shorts = struct.unpack(f"{count}h", raw)
            rms    = math.sqrt(sum(s * s for s in shorts) / count) if count else 0.0

            status = "✓ ACTIVE" if rms > 50 else "  silent"
            print(f"  [{i:2d}] {status}  RMS={rms:7.1f}  rate={rate}  {name}")
            break

        except Exception as e:
            print(f"  [{i:2d}]  ERROR  {name}  ({e})")
            break

pa.terminate()
print("\nSet MIC_DEVICE_INDEX in voice_chatbot.py to the index marked ✓ ACTIVE")
