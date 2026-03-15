import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=15):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print("=== Service status ===")
print(run("systemctl status app-backend --no-pager | head -4"))

print("\n=== Health check ===")
print(run("curl -s http://localhost:8000/ --max-time 5"))

print("\n=== Key functions present in deployed code ===")
checks = [
    ("_generate_greeting_reply", "LLM greeting reply"),
    ("openrouter.ai", "OpenRouter URL fix"),
    ("_prewarm", "TTS pre-warm cache"),
    ("TWILIO_SPEECH_TIMEOUT", "Configurable speech timeout"),
    ("Hello.*How are you doing today", "Simple warm greeting"),
]
for pattern, label in checks:
    result = run(f"grep -c '{pattern}' /opt/app-backend/main.py")
    status = "✓" if result.strip() != "0" else "✗ MISSING"
    print(f"  {status}  {label}")

print("\n=== Deployed at ===")
print(run("stat /opt/app-backend/main.py | grep Modify"))

client.close()
