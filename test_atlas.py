import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "ITS A SECRET"
ATLAS_URI = "ITS A SECRET"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

# Write a test script to the server
sftp = client.open_sftp()
script = f'''from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
try:
    c = MongoClient("{ATLAS_URI}", serverSelectionTimeoutMS=10000)
    c.admin.command("ping")
    dbs = c.list_database_names()
    print("SUCCESS databases:", dbs)
except Exception as e:
    print("FAILED:", e)
'''
with sftp.open("/tmp/test_atlas.py", "w") as f:
    f.write(script.encode())
sftp.close()

print(run("/opt/app-backend/venv/bin/python3 /tmp/test_atlas.py", timeout=20))
client.close()
