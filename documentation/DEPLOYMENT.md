# Deploy Lark Meeting Bot on a VM with Docker

This guide walks you through deploying the Lark Meeting Bot on your own VM using Docker and running it in **production mode**.

---

## Prerequisites on Your VM

- **Docker** and **Docker Compose** installed
- A public URL or domain for your webhook (Lark must reach your server)
- Port **3000** (or your chosen port) open in the VM firewall

### Install Docker (if needed)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

## Step 1: Get the Code on Your VM

Either clone the repo or copy the project folder to your VM:

```bash
# Option A: Clone
git clone <your-repo-url> lark-meeting-bot
cd lark-meeting-bot

# Option B: Copy from your machine (from your local machine)
# scp -r /path/to/lark-meeting-bot user@your-vm-ip:~/
```

---

## Step 2: Create Production Environment File

On the VM, create a `.env` file in the project root. **Do not commit this file** (it’s in `.gitignore`).

```bash
cd ~/lark-meeting-bot   # or your project path
cp ENV_TEMPLATE.txt .env
nano .env   # or vim / your editor
```

Fill in **all required values** (see [ENV_TEMPLATE.txt](ENV_TEMPLATE.txt)):

| Variable | Required | Description |
|----------|----------|-------------|
| `LARK_APP_ID` | Yes | From Lark Developer Console |
| `LARK_APP_SECRET` | Yes | From Lark Developer Console |
| `LARK_BITABLE_APP_TOKEN` | Yes | Bitable for thoughts |
| `LARK_THOUGHTS_TABLE_ID` | Yes | Thoughts table ID |
| `OPENAI_API_KEY` | Yes* | For AI summaries (*or HuggingFace) |
| `AI_PROVIDER` | Yes | `openai` or `huggingface` |
| `WEBHOOK_VERIFICATION_TOKEN` | Optional* | **Any value works** - Lark Developer Console requires it, but your code doesn't validate it. Use any string you want. |
| `PORT` | No | Default `3000` |
| `HOST` | No | Use `0.0.0.0` for Docker (already set in compose) |

Example minimal production `.env`:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret
LARK_BITABLE_APP_TOKEN=your_bitable_token
LARK_THOUGHTS_TABLE_ID=your_table_id

OPENAI_API_KEY=your_openai_key
AI_PROVIDER=openai

WEBHOOK_VERIFICATION_TOKEN=your_webhook_token
```

---

## Step 3: Build and Run with Docker Compose (Production)

From the project root on the VM:

```bash
# Build the image
docker compose build

# Run in background (production mode)
docker compose up -d

# Check status and logs
docker compose ps
docker compose logs -f
```

The app runs with:

- **NODE_ENV=production**
- **HOST=0.0.0.0** (so it’s reachable inside the container)
- Restart policy **unless-stopped**
- Health checks enabled

---

## Step 4: Expose the Server (Webhook URL)

Lark must reach your webhook over HTTPS.

### Option A: Reverse proxy (recommended)

Put **Nginx** (or Caddy) in front and terminate TLS:

1. Install Nginx on the VM.
2. Configure a server block that:
   - Listens on `443` with SSL (e.g. Let’s Encrypt).
   - Proxies `https://your-domain.com/webhook` to `http://localhost:3000/webhook`.

Example Nginx location:

```nginx
location /webhook {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

3. In Lark Developer Console → Event Subscriptions, set:
   - **Request URL:** `https://your-domain.com/webhook`

### Option B: Direct port (testing only)

- Open port 3000 in the VM firewall.
- Use **HTTP** only for quick tests (Lark may require HTTPS in production).
- Request URL: `http://your-vm-ip:3000/webhook`

---

## Step 5: Set Webhook Verification Token (Optional but Required by Lark)

**Important:** Lark's Developer Console **requires** a verification token when setting up event subscriptions, but **your application code doesn't validate it**. You can use any value you want.

### 5.1 Choose a Token Value

You can use any string - it doesn't need to be cryptographically secure since your code doesn't validate it:

```bash
# Option 1: Generate a secure random token (recommended for security)
openssl rand -hex 32

# Option 2: Use a simple value (works fine)
# Just use: my-webhook-token-123
```

### 5.2 Add Token to .env

Add the token to your `.env` file (can be any value):

```env
# Simple value works fine:
WEBHOOK_VERIFICATION_TOKEN=my-webhook-token-123

# Or use a generated secure token:
# WEBHOOK_VERIFICATION_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 5.3 Configure Lark Event Subscription

1. Open [Lark Developer Console](https://open.larksuite.com/app) → your app.
2. Go to **Event Subscriptions**.
3. Enable event subscriptions.
4. Set:
   - **Request URL:** `https://your-domain.com/webhook` (or your real URL).
   - **Verification Token:** Paste the **SAME** token you put in `.env` (can be any value, just needs to match).
5. Subscribe to **im.message.receive_v1** (and any other events you need).
6. Click **Save**.
7. Lark will send a verification request to your URL - if the token matches, verification will succeed automatically.

---

## Production Mode Summary

| Aspect | How it’s set |
|--------|----------------------|
| **Node environment** | `NODE_ENV=production` (in Dockerfile and docker-compose) |
| **Binding** | `HOST=0.0.0.0` so the app listens on all interfaces inside the container |
| **Port** | `PORT=3000` (override with `HOST_PORT` on host if needed) |
| **Restart** | `restart: unless-stopped` |
| **Health check** | HTTP GET `/` every 30s |
| **Logs** | JSON file driver, 10MB × 3 files |

---

## Useful Commands

```bash
# View logs (follow)
docker compose logs -f

# Restart after changing .env or code
docker compose down
docker compose build --no-cache
docker compose up -d

# Stop
docker compose down

# Run with custom host port (e.g. 8080 on host → 3000 in container)
HOST_PORT=8080 docker compose up -d
```

---

## Troubleshooting

### Docker Daemon Not Running

If you see: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`

**Step 1: Check Docker service status**
```bash
sudo systemctl status docker
```

**Step 2: Start Docker service**
```bash
sudo systemctl start docker
sudo systemctl enable docker  # Enable auto-start on boot
```

**Step 3: Check if you need to add user to docker group**
```bash
# Check current groups
groups

# If 'docker' is not in the list, add your user:
sudo usermod -aG docker $USER

# Log out and log back in (or run):
newgrp docker

# Verify Docker works without sudo:
docker ps
```

**Step 4: Verify Docker is working**
```bash
docker --version
docker compose version
docker ps  # Should show empty list, not an error
```

### Other Common Issues

- **Lark verification fails:** Ensure the Request URL is exactly your `/webhook` URL, that the server is reachable from the internet, and that `WEBHOOK_VERIFICATION_TOKEN` matches.
- **Container exits:** Run `docker compose logs` and check `.env` (no typos, all required vars set).
- **Health check failing:** Ensure `PORT` in `.env` matches the port the app listens on (default 3000). Hit `http://localhost:3000/` on the VM; you should get `{"status":"ok",...}`.
- **Permission denied:** Make sure your user is in the `docker` group (see Docker Daemon section above).
