import paramiko, time

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=180):
    print(f"  >> {cmd[:80]}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    if out: print(out[-500:])
    if err: print("[ERR]", err[-300:])
    return out

# Step 1: Install Node via apt (faster than nodesource script)
print("=== Installing Node.js via apt ===")
run("apt-get update -qq", timeout=60)
run("apt-get install -y nodejs npm", timeout=120)
print(run("node --version"))
print(run("npm --version"))

# Step 2: Install mongo-express
print("\n=== Installing mongo-express ===")
run("npm install -g mongo-express --prefer-offline 2>&1 | tail -3", timeout=180)

# Step 3: Find the actual app.js path
me_path = run("find /usr -name 'app.js' -path '*/mongo-express/*' 2>/dev/null | head -1")
if not me_path:
    me_path = run("find /root -name 'app.js' -path '*/mongo-express/*' 2>/dev/null | head -1")
print(f"mongo-express app.js: {me_path}")

# Step 4: Create systemd service
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
ExecStart=/usr/bin/node {me_path}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
sftp = client.open_sftp()
with sftp.open("/etc/systemd/system/mongo-express.service", "w") as f:
    f.write(service.encode())
sftp.close()
print("Systemd service written.")

print("\n=== Starting mongo-express ===")
run("systemctl daemon-reload")
run("systemctl enable mongo-express")
run("systemctl restart mongo-express")
time.sleep(5)
status = run("systemctl status mongo-express --no-pager 2>&1 | head -10")
print(status)

# Open firewall
run("ufw allow 8081/tcp 2>/dev/null || true")

# Test
time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP response: {test}")

client.close()
print("\nDone! Access at: http://216.128.182.121:8081")
