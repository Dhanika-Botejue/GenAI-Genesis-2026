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

# Stop failing service
run("systemctl stop mongo-express 2>/dev/null || true")
run("systemctl disable mongo-express 2>/dev/null || true")

# Check if docker is installed
ver = run("docker --version 2>&1")
print(f"Docker: {ver}")

if "Docker version" not in ver:
    print("\n=== Installing Docker ===")
    run("curl -fsSL https://get.docker.com -o /tmp/get-docker.sh", timeout=30)
    run("sh /tmp/get-docker.sh 2>&1 | tail -5", timeout=180)
    run("systemctl start docker", timeout=30)
    run("systemctl enable docker", timeout=10)
    print(run("docker --version"))

# Get the server's docker bridge IP (to reach MongoDB on host)
host_ip = run("ip route | grep docker | awk '{print $9}' | head -1")
if not host_ip:
    host_ip = "172.17.0.1"  # default docker bridge
print(f"Docker host IP: {host_ip}")

# Stop existing container if any
run("docker rm -f mongo-express 2>/dev/null || true")

# Run mongo-express in Docker
print("\n=== Starting mongo-express container ===")
result = run(
    f"docker run -d --name mongo-express --restart=always "
    f"-p 8081:8081 "
    f"-e ME_CONFIG_MONGODB_URL='mongodb://{host_ip}:27017/' "
    f"-e ME_CONFIG_BASICAUTH=true "
    f"-e ME_CONFIG_BASICAUTH_USERNAME=admin "
    f"-e ME_CONFIG_BASICAUTH_PASSWORD=admin123 "
    f"mongo-express:1.0.2-20 2>&1",
    timeout=120
)
print(result)

time.sleep(8)
print(run("docker ps --filter name=mongo-express"))
print(run("docker logs mongo-express 2>&1 | tail -10"))

time.sleep(3)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
