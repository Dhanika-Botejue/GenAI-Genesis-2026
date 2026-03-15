"""
Add ELEVENLABS_API_KEY to the Vultr backend .env and restart the service.
Reads the key from Frontend/Healthcare-Frontend/Backend/GenAI-Genesis-2026/.env
"""
import os
import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

# Load key from local backend .env
env_path = os.path.join(
    os.path.dirname(__file__),
    "Frontend/Healthcare-Frontend/Backend/GenAI-Genesis-2026/.env",
)
key = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                key = line.strip().split("=", 1)[1].strip().strip('"\'')
                break

if not key:
    print("ERROR: ELEVENLABS_API_KEY not found in", env_path)
    exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)


def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()


# Remove existing ELEVENLABS line if present, then append
run("sed -i '/^ELEVENLABS_API_KEY=/d' /opt/app-backend/.env")
# Append new key (escape $ and " for shell)
escaped = key.replace("'", "'\"'\"'")
run(f"echo 'ELEVENLABS_API_KEY={escaped}' >> /opt/app-backend/.env")

print("Added ELEVENLABS_API_KEY to /opt/app-backend/.env")
print(run("grep ELEVENLABS /opt/app-backend/.env"))

print("\nRestarting app-backend...")
run("systemctl restart app-backend")
import time

time.sleep(3)
print(run("systemctl status app-backend --no-pager 2>&1 | head -6"))

client.close()
print("\nDone.")
