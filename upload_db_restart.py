import paramiko, time

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

sftp = client.open_sftp()
sftp.put("/home/zayaan/Downloads/App/db_remote.py", "/opt/app-backend/db.py")
sftp.close()
print("Uploaded db.py")

run("systemctl restart app-backend")
time.sleep(4)
print(run("systemctl status app-backend --no-pager | head -4"))

# Verify API now returns all 8 patients
time.sleep(2)
result = run('''curl -s http://localhost:8000/api/patients | python3 -c "
import sys,json
data=json.load(sys.stdin)
print(f'Total patients: {len(data)}')
for p in data:
    print(f\'  {p[\\"id\\"][:12]}  {p[\\"fullName\\"]}  Room {p[\\"room\\"]}')
"''')
print(result)
client.close()
