import paramiko, time

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=300):
    print(f"  >> {cmd[:90]}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    combined = (out + "\n" + err).strip()
    if combined: print(combined[-800:])
    return out

# Stop the failing service
run("systemctl stop mongo-express 2>/dev/null || true")

# Remove broken install
run("rm -rf /usr/local/lib/node_modules/mongo-express")

# Install mongo-express 1.0.2 — the last version that works without a build step
print("=== Installing mongo-express@1.0.2 ===")
out = run("/usr/local/bin/npm install -g mongo-express@1.0.2 2>&1 | tail -5", timeout=120)
print(out)

# Find app path
me_path = run("find /usr/local /root -name 'app.js' -path '*/mongo-express/*' 2>/dev/null | head -1")
print(f"app.js path: {me_path}")

# List the me dir for inspection
me_dir = me_path.rsplit("/", 1)[0] if me_path else ""
print(run(f"ls {me_dir}/ 2>&1 | head -20"))

# Update service
service = f"""[Unit]
Description=Mongo Express Web UI
After=mongod.service network.target

[Service]
Type=simple
User=root
Environment=ME_CONFIG_MONGODB_URL=mongodb://localhost:27017/
Environment=ME_CONFIG_BASICAUTH=true
Environment=ME_CONFIG_BASICAUTH_USERNAME=admin
Environment=ME_CONFIG_BASICAUTH_PASSWORD=admin123
Environment=PORT=8081
ExecStart=/usr/local/bin/node {me_path}
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
print(run("journalctl -u mongo-express -n 10 --no-pager 2>&1"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
