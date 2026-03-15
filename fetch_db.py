import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

sftp = client.open_sftp()
with sftp.open("/opt/app-backend/db.py", "r") as f:
    content = f.read().decode(errors="replace")
sftp.close()
client.close()

with open("/home/zayaan/Downloads/App/db_remote.py", "w") as f:
    f.write(content)
print(f"Fetched {len(content)} bytes, {content.count(chr(10))} lines")
