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
c = MongoClient("mongodb://localhost:27017/")
print("All databases:", c.list_database_names())
for db_name in c.list_database_names():
    if db_name in ("admin","local","config"): continue
    db = c[db_name]
    colls = db.list_collection_names()
    if "residents" in colls:
        count = db.residents.count_documents({})
        print(f"  {db_name}.residents: {count} docs")
        for r in db.residents.find({}, {"_id":1,"full_name":1,"room_number":1}).sort("room_number",1):
            print(f"    Room {r.get('room_number','?')}  {r['_id']}  {r.get('full_name','?')}")
'''
with sftp.open("/tmp/deep_check.py", "w") as f:
    f.write(script.encode())
sftp.close()

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print(run("/opt/app-backend/venv/bin/python3 /tmp/deep_check.py"))
client.close()
