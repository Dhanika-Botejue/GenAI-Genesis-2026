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

print("=== Backend .env MONGODB_URI ===")
print(run("grep MONGODB_URI /opt/app-backend/.env"))

print("\n=== DB the running service actually connects to ===")
print(run("""curl -s http://localhost:8000/api/patients | python3 -c "import sys,json; data=json.load(sys.stdin); print(f'{len(data)} patients:', [p['fullName'] for p in data[:4]])" """))

client.close()
