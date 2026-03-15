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
    if combined: print(combined[-600:])
    return out

# Fix broken dpkg first
print("=== Fix broken dpkg ===")
run("dpkg --configure -a 2>&1 || true", timeout=60)
run("apt-get install -f -y 2>&1 || true", timeout=60)

# Try installing nodejs 18 again now that dpkg is fixed
print("\n=== Install Node 18 ===")
result = run("apt-get install -y nodejs", timeout=180)

ver = run("node --version")
print(f"Node version: {ver}")

if "v18" not in ver and "v20" not in ver:
    # Fallback: install via nvm
    print("\n=== Trying nvm approach ===")
    run("curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh -o /tmp/nvm_install.sh", timeout=60)
    run("bash /tmp/nvm_install.sh", timeout=60)
    run('export NVM_DIR="/root/.nvm" && . "$NVM_DIR/nvm.sh" && nvm install 18 && nvm use 18 && nvm alias default 18', timeout=180)
    # Create symlinks
    nvm_node = run('ls /root/.nvm/versions/node/ 2>/dev/null | tail -1')
    print(f"nvm node: {nvm_node}")
    if nvm_node:
        run(f"ln -sf /root/.nvm/versions/node/{nvm_node}/bin/node /usr/local/bin/node")
        run(f"ln -sf /root/.nvm/versions/node/{nvm_node}/bin/npm /usr/local/bin/npm")
        run(f"ln -sf /root/.nvm/versions/node/{nvm_node}/bin/npx /usr/local/bin/npx")
    ver = run("/usr/local/bin/node --version 2>/dev/null || node --version")
    print(f"Node version after nvm: {ver}")

# Reinstall mongo-express with the working node
print("\n=== Install mongo-express ===")
npm_path = run("which npm || echo /usr/local/bin/npm")
node_path = run("which node || echo /usr/local/bin/node")
print(f"npm: {npm_path}, node: {node_path}")
run(f"{npm_path} install -g mongo-express 2>&1 | tail -5", timeout=180)

# Find app.js
me_path = run("find /usr /root -name 'app.js' -path '*/mongo-express/*' 2>/dev/null | head -1")
print(f"mongo-express path: {me_path}")

# Update the service with correct node path
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
ExecStart={node_path} {me_path}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
sftp = client.open_sftp()
with sftp.open("/etc/systemd/system/mongo-express.service", "w") as f:
    f.write(service.encode())
sftp.close()

print("\n=== Restart service ===")
run("systemctl daemon-reload")
run("systemctl restart mongo-express")
time.sleep(6)
status = run("systemctl status mongo-express --no-pager 2>&1 | head -10")
print(status)

# Logs
print("\n=== Logs ===")
print(run("journalctl -u mongo-express -n 15 --no-pager 2>&1"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
