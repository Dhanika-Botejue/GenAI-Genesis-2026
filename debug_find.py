import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

sftp = client.open_sftp()
script = '''
import sys
sys.path.insert(0, "/opt/app-backend")
import os
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/genai_app")

import db as db_service
db = db_service.get_db()

print("Total via count:", db.residents.count_documents({}))
print("\\nAll docs via find().sort():")
for r in db.residents.find().sort("created_at", -1):
    print(f"  {r['_id'][:12]}  room={r.get('room_number','?')}  name={r.get('full_name','?')}  created_at={r.get('created_at','MISSING')}")
'''
with sftp.open("/tmp/debug_find.py", "w") as f:
    f.write(script.encode())
sftp.close()

def run(cmd, timeout=15):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print(run("MONGODB_URI=mongodb://localhost:27017/genai_app /opt/app-backend/venv/bin/python3 /tmp/debug_find.py"))
client.close()
