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
    if combined: print(combined[-600:])
    return out

# Check docker network details
print("=== Docker network interfaces ===")
print(run("ip addr show docker0"))

print("\n=== Container IP ===")
print(run("docker inspect mongo-express --format '{{.NetworkSettings.IPAddress}}'"))

print("\n=== Container can reach 172.17.0.1? ===")
print(run("docker exec mongo-express sh -c 'nc -zv 172.17.0.1 27017 2>&1 || echo failed'"))

print("\n=== iptables rules for docker ===")
print(run("iptables -L DOCKER-USER -n 2>&1 | head -10"))

print("\n=== mongod listening ports ===")
print(run("ss -tlnp | grep 27017"))

# Maybe ufw is blocking docker → host traffic
print("\n=== UFW status ===")
print(run("ufw status numbered 2>&1 | head -20"))

# Allow docker bridge to reach host ports
print("\n=== Allow docker bridge in iptables ===")
run("iptables -I INPUT -i docker0 -p tcp --dport 27017 -j ACCEPT")

time.sleep(2)
print(run("docker exec mongo-express sh -c 'nc -zv 172.17.0.1 27017 2>&1 || echo failed'"))

# Restart container again
run("docker restart mongo-express")
time.sleep(8)
print(run("docker logs mongo-express 2>&1 | tail -6"))

time.sleep(2)
test = run("curl -s -o /dev/null -w '%{http_code}' -u admin:admin123 http://localhost:8081/ --max-time 8")
print(f"\nHTTP: {test}")
client.close()
