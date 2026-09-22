# Blackboard AI — Detach from Cloud SQL & Run Fully on Contabo

> **Goal:** Remove all Google Cloud SQL dependency from the production server.  
> After following this guide the backend will connect directly to local MySQL on Contabo,  
> the Cloud SQL Auth Proxy will be gone, and the server will pass all health checks.

---

## Background

| Layer | Current State | Target State |
|-------|--------------|--------------|
| Database | MySQL on Cloud SQL (Account B GCP), tunnelled via Cloud SQL Auth Proxy on port 3307 | Local MySQL on Contabo, port 3306 |
| File storage | Already migrated to `/srv/blackboard/storage/gcs` on Contabo | No change |
| Google Sign-In | Uses `google-auth-library` to verify JWT tokens — calls Google's public API, no GCP account dependency | No change |
| `@google-cloud/secret-manager` | Installed as npm package but **never called** in code | Remove package |

**Your backend code is already Cloud-SQL-free.** The only live dependency is the  
**Cloud SQL Auth Proxy process** running on Contabo that creates the DB tunnel on port 3307.

---

## Pre-Migration Checklist

Run these on your **local machine** before touching the server:

```bash
# 1. Confirm the production .env on Contabo
ssh root@<contabo-ip> "cat /path/to/backend_nodejs/.env | grep -E 'DB_|INSTANCE'"

# 2. Confirm data was already migrated (tables exist in local MySQL)
ssh root@<contabo-ip> "mysql -u blackboard_user -p'BlackboardAI2024!' -h 127.0.0.1 blackboard_ai -e 'SHOW TABLES;' 2>&1 | head -40"
```

> ✅ If you see your tables — data is already there, safe to proceed.  
> ❌ If connection refused / access denied — fix MySQL first (see Step 2).

---

## Step 1 — SSH Into Your Contabo Server

```bash
ssh root@<contabo-ip>
# or
ssh <user>@<contabo-ip>

# Navigate to your backend directory
cd /path/to/backend_nodejs
# e.g. cd /home/blackboard/backend_nodejs
# e.g. cd /var/www/blackboard-ai/backend_nodejs
```

---

## Step 2 — Verify Local MySQL is Running and Accessible

```bash
# Check MySQL service status
sudo systemctl status mysql

# If not running:
sudo systemctl start mysql
sudo systemctl enable mysql   # auto-start on reboot

# Find what port MySQL is actually listening on
sudo ss -tlnp | grep mysql
# You'll see either 0.0.0.0:3306 or 127.0.0.1:3306
# Note the port — you'll set this in .env

# Test connection with your app credentials
mysql -u blackboard_user -p'BlackboardAI2024!' -h 127.0.0.1 blackboard_ai -e "SHOW TABLES;" 2>&1
```

**Expected output:** A list of tables like `users`, `subjects`, `documents`, etc.

### If MySQL user/database doesn't exist yet:

```sql
-- Run as root
sudo mysql

CREATE DATABASE IF NOT EXISTS blackboard_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'blackboard_user'@'localhost' IDENTIFIED BY 'BlackboardAI2024!';
CREATE USER IF NOT EXISTS 'blackboard_user'@'127.0.0.1' IDENTIFIED BY 'BlackboardAI2024!';
GRANT ALL PRIVILEGES ON blackboard_ai.* TO 'blackboard_user'@'localhost';
GRANT ALL PRIVILEGES ON blackboard_ai.* TO 'blackboard_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 3 — Stop and Remove the Cloud SQL Auth Proxy

The proxy is what creates the tunnel on port 3307. We're killing it permanently.

```bash
# ── Check if it's running ──────────────────────────────────────
ps aux | grep -i cloud.sql
ps aux | grep -i cloud-sql-proxy

# ── Check for a systemd service ───────────────────────────────
sudo systemctl list-units --all | grep -i cloud
sudo systemctl list-units --all | grep -i sql

# ── Stop and disable the service (if it exists) ───────────────
sudo systemctl stop cloud-sql-proxy 2>/dev/null
sudo systemctl disable cloud-sql-proxy 2>/dev/null

# ── Remove the service file ───────────────────────────────────
sudo rm -f /etc/systemd/system/cloud-sql-proxy.service
sudo systemctl daemon-reload

# ── Kill any lingering process ────────────────────────────────
sudo pkill -f cloud.sql.proxy || true
sudo pkill -f cloud-sql-proxy || true

# ── Remove the binary ─────────────────────────────────────────
sudo rm -f /usr/local/bin/cloud_sql_proxy
sudo rm -f /usr/local/bin/cloud-sql-proxy
sudo rm -f /usr/bin/cloud_sql_proxy

# ── Verify port 3307 is now free ──────────────────────────────
sudo ss -tlnp | grep 3307
# Should return nothing
```

---

## Step 4 — Update the `.env` File on Contabo

```bash
# Open the production .env in your backend directory
nano .env
# or: vim .env
```

Find the `DB_` section and make it look exactly like this:

```env
# ── Database (Local MySQL on Contabo) ──────────────────────────
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=blackboard_ai
DB_USER=blackboard_user
DB_PASSWORD=BlackboardAI2024!

# ── Cloud SQL (REMOVED — no longer used) ───────────────────────
# INSTANCE_CONNECTION_NAME=blackboard-ai-468113:asia-south1:blackboard-mysql
```

> **Important:** Change `DB_PORT` from `3307` to `3306` (standard MySQL).  
> Port `3307` was only for the Cloud SQL Auth Proxy tunnel — it no longer exists.

Also confirm these other critical values are correct:

```env
LOCAL_STORAGE_ROOT=/srv/blackboard/storage/gcs
PUBLIC_BASE_URL=https://blackboardbackend.blackboardpk.com
NODE_ENV=production
PORT=5955
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## Step 5 — Remove the Unused Cloud Package

The `@google-cloud/secret-manager` package is installed but never called anywhere in the code.  
Remove it to eliminate the last npm-level GCP dependency.

```bash
# From your backend_nodejs directory
npm uninstall @google-cloud/secret-manager

# Verify it's gone
cat package.json | grep secret-manager
# Should return nothing
```

> **Keep** `google-auth-library` — it is used in `googleAuthService.js` to verify  
> Google Sign-In ID tokens. It calls Google's public API (`oauth2.googleapis.com`)  
> and has zero dependency on your GCP account.

---

## Step 6 — Verify Storage Directory Exists

The backend's `ensureStorageDirectories()` creates these on startup, but confirm the root exists:

```bash
ls -la /srv/blackboard/storage/gcs/
# You should see:
#   blackboardai-pdfs-resources/
#   blackboardai-profile-images/

# Check ownership (must match the user running Node.js)
ls -la /srv/blackboard/storage/
```

If the Node.js process runs as `root`, ownership doesn't matter.  
If it runs as a dedicated user (e.g. `blackboard`), fix ownership:

```bash
sudo chown -R blackboard:blackboard /srv/blackboard/storage/
```

---

## Step 7 — Restart the Node.js Server

### If using PM2 (most common):

```bash
# Check current PM2 processes
pm2 list

# Restart the backend app
pm2 restart all
# or by name/id:
pm2 restart blackboard-backend
pm2 restart 0

# Watch logs for startup (15 seconds should be enough)
pm2 logs --lines 50
```

**Successful startup looks like:**
```
[ENV] Optional feature variables missing: ...
Database Connected Successfully
Server running on port 5955
```

**Error you DO NOT want to see:**
```
Error: connect ECONNREFUSED 127.0.0.1:3307
# Fix: DB_PORT in .env must be 3306, not 3307
```

### If using a systemd service:

```bash
sudo systemctl restart blackboard-backend
sudo journalctl -u blackboard-backend -f --lines=50
```

---

## Step 8 — Health Check

```bash
# Test health endpoint from Contabo itself (internal)
curl -s http://127.0.0.1:5955/health
# Expected: {"success":true,"message":"Server is running."}

# Test from outside (your machine or browser)
curl -s https://blackboardbackend.blackboardpk.com/health
# Expected: {"success":true,"message":"Server is running."}

# Test database is actually responding (auth endpoint)
curl -s -X POST https://blackboardbackend.blackboardpk.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"test"}' | python3 -m json.tool
# Expected: 401 or 404 error — NOT a 500 (500 would mean DB is broken)
```

---

## Step 9 — Clean Up GCP (Account B)

Once the server is confirmed working, sever remaining GCP ties:

1. **GCP Console (Account B)** → IAM & Admin → Service Accounts  
   → Delete or revoke any service account key that was used for Cloud SQL Auth Proxy

2. **GCP Console (Account B)** → SQL → Connections  
   → Remove Contabo's IP from Cloud SQL authorized networks

3. **Optionally** delete the Cloud SQL instance entirely from Account B if it's not used for anything else

---

## Verification Summary

Run these final checks after completing all steps:

```bash
# 1. Proxy is dead
ps aux | grep cloud-sql && echo "STILL RUNNING - FIX NEEDED" || echo "OK - Proxy is gone"

# 2. Port 3307 is free
sudo ss -tlnp | grep 3307 && echo "PROXY STILL ON 3307 - FIX NEEDED" || echo "OK - Port 3307 is free"

# 3. MySQL is on 3306
sudo ss -tlnp | grep 3306 | grep -q mysql && echo "OK - MySQL on 3306" || echo "CHECK MYSQL PORT"

# 4. Server health
curl -sf https://blackboardbackend.blackboardpk.com/health && echo "OK - Server healthy" || echo "SERVER DOWN"

# 5. Secret-manager is removed
node -e "import('@google-cloud/secret-manager')" 2>&1 | grep -q "Cannot find" && echo "OK - Package removed" || echo "Still installed"
```

All 5 should return `OK`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED 127.0.0.1:3307` | `.env` still has `DB_PORT=3307` and proxy is gone | Change to `DB_PORT=3306` in `.env` and restart |
| `Access denied for user 'blackboard_user'` | MySQL user missing for `127.0.0.1` host | Run the `GRANT` commands in Step 2 |
| `ER_BAD_DB_ERROR: Unknown database` | Database not created locally | Run `CREATE DATABASE` in Step 2 |
| `ENOENT /srv/blackboard/storage/gcs` | Storage path wrong | Update `LOCAL_STORAGE_ROOT` in `.env` |
| PM2 process keeps crashing | Check `pm2 logs` — usually a missing `.env` variable | Run `pm2 logs --err` for full error |
| `Cannot find module '@google-cloud/secret-manager'` | Old code referencing it | Code doesn't use it; safe to ignore / run `npm uninstall` |
