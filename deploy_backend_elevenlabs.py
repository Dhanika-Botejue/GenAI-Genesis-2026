"""
Deploy the ElevenLabs backend from GenAI-Genesis-2026 to Vultr.
Uploads main.py, tts_elevenlabs.py, stt_elevenlabs.py, voice_chatbot.py,
and ensures ELEVENLABS_API_KEY is in remote .env.
"""
import os
import time
import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

BACKEND_DIR = os.path.join(
    os.path.dirname(__file__),
    "Frontend/Healthcare-Frontend/Backend/GenAI-Genesis-2026",
)
REMOTE_DIR = "/opt/app-backend"

FILES_TO_UPLOAD = [
    "main.py",
    "tts_elevenlabs.py",
    "stt_elevenlabs.py",
    "voice_chatbot.py",
]

# Load ELEVENLABS_API_KEY from local .env
env_path = os.path.join(BACKEND_DIR, ".env")
key = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                key = line.strip().split("=", 1)[1].strip().strip('"\'')
                break

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)


def run(cmd, timeout=60):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()


sftp = client.open_sftp()
for fname in FILES_TO_UPLOAD:
    local = os.path.join(BACKEND_DIR, fname)
    remote = f"{REMOTE_DIR}/{fname}"
    if os.path.exists(local):
        sftp.put(local, remote)
        print(f"Uploaded {fname}")
    else:
        print(f"SKIP {fname} (not found)")
sftp.close()

# Ensure ELEVENLABS_API_KEY in remote .env
if key:
    run("sed -i '/^ELEVENLABS_API_KEY=/d' /opt/app-backend/.env")
    escaped = key.replace("'", "'\"'\"'")
    run(f"echo 'ELEVENLABS_API_KEY={escaped}' >> /opt/app-backend/.env")
    print("Updated ELEVENLABS_API_KEY in remote .env")
else:
    print("WARN: ELEVENLABS_API_KEY not in local .env — remote may already have it")

print("\nRestarting app-backend...")
run("systemctl restart app-backend")
time.sleep(4)
print(run("systemctl status app-backend --no-pager 2>&1 | head -8"))

# Verify ElevenLabs code is present
print("\n=== Verify ElevenLabs on server ===")
print(run("grep -l 'elevenlabs\\|tts_elevenlabs\\|stt_elevenlabs' /opt/app-backend/*.py 2>/dev/null || true"))
print(run("grep ELEVENLABS /opt/app-backend/.env"))

client.close()
print("\nDone. Twilio calls should now use ElevenLabs TTS/STT.")
