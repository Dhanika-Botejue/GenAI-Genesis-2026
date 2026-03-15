"""
Test that the deployed backend uses ElevenLabs TTS (not IBM).
Fetches /test/tts from the server and saves the audio for manual verification.
"""
import os
import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)


def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()


# Fetch /test/tts and save to file on server
print("=== Fetching /test/tts (ElevenLabs TTS) ===")
run("curl -s -o /tmp/test_elevenlabs.mp3 http://localhost:8000/test/tts --max-time 15")
size = run("stat -c%s /tmp/test_elevenlabs.mp3 2>/dev/null || echo 0")
print(f"Saved to /tmp/test_elevenlabs.mp3 on server ({size} bytes)")

# Verify it's valid MP3 (starts with ID3 or 0xFF 0xFB)
header = run("xxd -l 4 /tmp/test_elevenlabs.mp3 2>/dev/null || echo 'fail'")
print(f"File header: {header}")

# Download to local machine for playback
sftp = client.open_sftp()
local_path = os.path.join(os.path.dirname(__file__), "test_elevenlabs.mp3")
sftp.get("/tmp/test_elevenlabs.mp3", local_path)
sftp.close()
print(f"\nDownloaded to: {local_path}")

if int(size or 0) > 1000:
    print("\n✓ Audio file received. Play test_elevenlabs.mp3 to verify ElevenLabs voice.")
    print("  The clip says: 'This is ElevenLabs text to speech. If you hear this, the backend is using ElevenLabs correctly.'")
else:
    print("\n✗ Audio file too small or missing. Check backend logs.")

# Public URL
print("\n=== Direct playback ===")
print("  http://216.128.182.121:8000/test/tts")
print("  (Or your PUBLIC_BASE_URL + /test/tts)")

client.close()
