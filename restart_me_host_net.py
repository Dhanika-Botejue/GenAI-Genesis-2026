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

# Remove old container
run("docker rm -f mongo-express 2>/dev/null || true")

# Run with host networking so it can reach localhost:27017
print("=== Starting mongo-express with host network ===")
result = run(
    "docker run -d --name mongo-express --restart=always "
    "--network host "
    "-e ME_CONFIG_MONGODB_URL='mongodb://127.0.0.1:27017/' "
    "-e ME_CONFIG_BASICAUTH=true "
    "-e ME_CONFIG_BASICAUTH_USERNAME=admin "
    "-e ME_CONFIG_BASICAUTH_PASSWORD=admin123 "
    "-e PORT=8081 "
    "mongo-express:1.0.2-20 2>&1",
    timeout=30
)
print(result)

time.sleep(8)
print(run("docker ps --filter name=mongo-express"))
print(run("docker logs mongo-express 2>&1 | tail -8"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
