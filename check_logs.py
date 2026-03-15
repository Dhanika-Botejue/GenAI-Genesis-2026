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

print("=== Recent service logs ===")
print(run("journalctl -u app-backend -n 40 --no-pager 2>&1"))

print("\n=== .env OPENAI vars ===")
print(run("grep -E 'OPENAI|OPENROUTER' /opt/app-backend/.env"))

print("\n=== Verify _generate_greeting_reply is in deployed main.py ===")
print(run("grep -n '_generate_greeting_reply\\|openrouter\\|openai.com' /opt/app-backend/main.py | head -20"))

client.close()
