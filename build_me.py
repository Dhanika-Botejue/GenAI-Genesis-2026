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

ME_DIR = "/usr/local/lib/node_modules/mongo-express"

# Run the build step inside mongo-express
print("=== Building mongo-express assets ===")
run(f"cd {ME_DIR} && /usr/local/bin/npm install 2>&1 | tail -5", timeout=120)
run(f"cd {ME_DIR} && /usr/local/bin/npm run build 2>&1 | tail -10", timeout=120)

print("\n=== Check for build-assets.json ===")
print(run(f"ls {ME_DIR}/build-assets.json 2>&1"))

print("\n=== Restart service ===")
run("systemctl restart mongo-express")
time.sleep(6)
print(run("systemctl status mongo-express --no-pager 2>&1 | head -6"))
print(run("journalctl -u mongo-express -n 10 --no-pager 2>&1"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
