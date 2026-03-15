import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=60):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return stdout.read().decode(errors="replace") + stderr.read().decode(errors="replace")

print("=== Service journal logs ===")
print(run("journalctl -u mongo-express -n 30 --no-pager 2>&1"))

print("\n=== Node version ===")
print(run("node --version"))

print("\n=== Direct run test ===")
print(run("ME_CONFIG_MONGODB_URL=mongodb://localhost:27017/ ME_CONFIG_BASICAUTH=true ME_CONFIG_BASICAUTH_USERNAME=admin ME_CONFIG_BASICAUTH_PASSWORD=admin123 PORT=8081 /usr/bin/node /usr/local/lib/node_modules/mongo-express/app.js 2>&1 &"))

import time; time.sleep(4)
print(run("curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/ --max-time 4"))

client.close()
