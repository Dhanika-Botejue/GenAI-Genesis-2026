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

# Install Node 18 via NodeSource — use longer timeout
print("=== Downloading NodeSource setup script ===")
run("curl -fsSL https://deb.nodesource.com/setup_18.x -o /tmp/node_setup.sh", timeout=60)
print(run("wc -l /tmp/node_setup.sh"))

print("\n=== Running NodeSource setup script ===")
run("bash /tmp/node_setup.sh", timeout=120)

print("\n=== Installing Node 18 ===")
run("apt-get install -y nodejs", timeout=180)

print("\n=== Node version ===")
print(run("node --version"))

print("\n=== Reinstalling mongo-express with Node 18 ===")
run("npm install -g mongo-express 2>&1 | tail -5", timeout=180)

print("\n=== Restarting mongo-express service ===")
run("systemctl restart mongo-express")
time.sleep(5)
print(run("systemctl status mongo-express --no-pager 2>&1 | head -8"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP response: {test}")

client.close()
