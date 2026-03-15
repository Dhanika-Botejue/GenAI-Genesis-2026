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
import db as db_service
db_service.init_db()
db = db_service.get_db()
print("Collections:", db.list_collection_names())
print("Residents:", db.residents.count_documents({}))
for r in db.residents.find({}, {"_id":1,"full_name":1,"room_number":1}).sort("room_number",1):
    print(" ", r["_id"], r.get("room_number","?"), r.get("full_name","?"))
print("Rooms:", db.rooms.count_documents({}))
print("Sessions:", db.ai_sessions.count_documents({}))
'''
with sftp.open("/tmp/reseed.py", "w") as f:
    f.write(script.encode())
sftp.close()

def run(cmd, timeout=60):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print(run("/opt/app-backend/venv/bin/python3 /tmp/reseed.py"))
client.close()
