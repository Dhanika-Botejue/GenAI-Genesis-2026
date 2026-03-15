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

# Get raw patient IDs from the API
print("=== API patient IDs and names ===")
print(run("""curl -s http://localhost:8000/api/patients | python3 -c "
import sys,json
data=json.load(sys.stdin)
print(f'Total: {len(data)}')
for p in data:
    print(p['id'][:12], p['fullName'])
" """))

client.close()
