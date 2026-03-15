import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

sftp = client.open_sftp()
script = '''
from pymongo import MongoClient
db = MongoClient("mongodb://localhost:27017/")["genai_app"]
print("Collections:", db.list_collection_names())
print("Residents count:", db.residents.count_documents({}))
for r in db.residents.find({}, {"_id":1,"full_name":1,"room_number":1}):
    print(" ", r)
'''
with sftp.open("/tmp/check_db.py", "w") as f:
    f.write(script.encode())
sftp.close()

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print(run("/opt/app-backend/venv/bin/python3 /tmp/check_db.py"))
client.close()
