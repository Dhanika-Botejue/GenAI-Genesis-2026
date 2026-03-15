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
from datetime import datetime

c = MongoClient("mongodb://localhost:27017/")
src = c["nursing_home"]
dst = c["genai_app"]
now = datetime.utcnow()

# 1. Copy all collections from nursing_home -> genai_app (skip residents, handle separately)
skip_colls = {"residents"}
for coll_name in src.list_collection_names():
    if coll_name in skip_colls:
        continue
    docs = list(src[coll_name].find({}))
    if not docs:
        continue
    # upsert each doc
    for doc in docs:
        dst[coll_name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
    print(f"Copied {len(docs)} docs -> genai_app.{coll_name}")

# 2. Copy all 6 cc000000 residents from nursing_home to genai_app
cc_residents = list(src.residents.find({}))
for r in cc_residents:
    dst.residents.replace_one({"_id": r["_id"]}, r, upsert=True)
print(f"Copied {len(cc_residents)} residents from nursing_home -> genai_app")

# 3. The dd000000/ee000000 are already in genai_app — verify they survived
total = dst.residents.count_documents({})
print(f"genai_app.residents total: {total}")
for r in dst.residents.find({}, {"_id":1,"full_name":1,"room_number":1}).sort("room_number",1):
    print(f"  Room {r.get('room_number','?')}  {r['_id'][:12]}...  {r.get('full_name','?')}")

print("\\nCollections in genai_app:", dst.list_collection_names())
'''
with sftp.open("/tmp/migrate.py", "w") as f:
    f.write(script.encode())
sftp.close()

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print(run("/opt/app-backend/venv/bin/python3 /tmp/migrate.py"))
client.close()
