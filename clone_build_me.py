import paramiko, time

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=300):
    print(f"  >> {cmd[:100]}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    combined = (out + "\n" + err).strip()
    if combined: print(combined[-600:])
    return out

NODE = "/usr/local/bin/node"
NPM  = "/usr/local/bin/npm"
ME_DIR = "/opt/mongo-express"

run("systemctl stop mongo-express 2>/dev/null || true")

# Clone the repo
print("=== Cloning mongo-express from GitHub ===")
run(f"rm -rf {ME_DIR}")
run(f"git clone --depth 1 --branch v1.0.2 https://github.com/mongo-express/mongo-express.git {ME_DIR}", timeout=60)

print("\n=== npm install ===")
run(f"cd {ME_DIR} && {NPM} install 2>&1 | tail -5", timeout=180)

print("\n=== npm run build ===")
out = run(f"cd {ME_DIR} && {NPM} run build 2>&1", timeout=120)
print(out[-400:])

print("\n=== Check build-assets.json ===")
print(run(f"ls {ME_DIR}/build-assets.json 2>&1"))

# Update service
service = f"""[Unit]
Description=Mongo Express Web UI
After=mongod.service network.target

[Service]
Type=simple
User=root
WorkingDirectory={ME_DIR}
Environment=ME_CONFIG_MONGODB_URL=mongodb://localhost:27017/
Environment=ME_CONFIG_BASICAUTH=true
Environment=ME_CONFIG_BASICAUTH_USERNAME=admin
Environment=ME_CONFIG_BASICAUTH_PASSWORD=admin123
Environment=PORT=8081
ExecStart={NODE} {ME_DIR}/app.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
sftp = client.open_sftp()
with sftp.open("/etc/systemd/system/mongo-express.service", "w") as f:
    f.write(service.encode())
sftp.close()

print("\n=== Starting service ===")
run("systemctl daemon-reload")
run("systemctl restart mongo-express")
time.sleep(6)
print(run("systemctl status mongo-express --no-pager 2>&1 | head -8"))
print(run("journalctl -u mongo-express -n 15 --no-pager 2>&1"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
