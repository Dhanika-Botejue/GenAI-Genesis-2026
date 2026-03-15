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

# Upload updated main.py
sftp = client.open_sftp()
sftp.put("/home/zayaan/Downloads/App/main_remote.py", "/opt/app-backend/main.py")
sftp.close()
print("Uploaded main.py")

# Restart service
run("systemctl restart app-backend")
import time; time.sleep(4)
status = run("systemctl status app-backend --no-pager | head -6")
print(status)

# Quick health check
import time; time.sleep(2)
print(run("curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/ --max-time 5"))

client.close()
