import paramiko, time

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=60):
    print(f"  >> {cmd[:100]}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    combined = (out + "\n" + err).strip()
    if combined: print(combined[-400:])
    return out

# Check current mongod.conf
print("=== Current mongod.conf bindIp ===")
print(run("grep -n 'bindIp' /etc/mongod.conf"))

# Update to bind to localhost + docker bridge
run("sed -i 's/bindIp:.*/bindIp: 127.0.0.1,172.17.0.1/' /etc/mongod.conf")
print(run("grep 'bindIp' /etc/mongod.conf"))

# Restart MongoDB
print("\n=== Restarting MongoDB ===")
run("systemctl restart mongod")
time.sleep(4)
print(run("systemctl status mongod --no-pager | head -4"))

# Test connectivity on docker bridge
print("\n=== Test mongo on 172.17.0.1 ===")
print(run("mongosh --host 172.17.0.1 --eval 'db.runCommand({ping:1})' 2>&1 | tail -5"))

# Restart mongo-express container
print("\n=== Restart mongo-express container ===")
run("docker restart mongo-express")
time.sleep(8)
print(run("docker logs mongo-express 2>&1 | tail -8"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
