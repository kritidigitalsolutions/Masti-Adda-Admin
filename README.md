# Masti Adda Admin Panel & Backend – Hostinger VPS Deployment

A complete, beginner-friendly guide to deploying and updating the **Masti Adda Admin Panel**, **Node.js Backend**, and **SabPaisa Payment Gateway** on your Hostinger Ubuntu VPS.

---

## 🌐 Live Domains & Services Overview

| Service | Public URL | Description |
| :--- | :--- | :--- |
| **Admin Panel** | `https://admin.mastiadda.in` | React Admin Dashboard |
| **Backend API** | `https://api.mastiadda.in` | Node.js Express REST API |
| **User Website** | `https://mastiadda.in` | Web Client / OTT Streaming |
| **SabPaisa Webhook** | `https://api.mastiadda.in/api/payment/webhook` | Gateway Server-to-Server Callback |

---

## 🚀 Step-by-Step Deployment Instructions

### 1. Connect to VPS via SSH

Open your terminal or PowerShell and connect to your Hostinger server:

```bash
ssh root@YOUR_SERVER_IP
```
*(Replace `YOUR_SERVER_IP` with your actual Hostinger VPS IP address)*

---

### 2. Go to Project Directory

```bash
cd /var/www/mastiadda-app
```

---

### 3. Pull Latest Code from GitHub

```bash
git stash
git pull origin main
```

---

### 4. Configure Backend Environment (`.env`)

Before restarting, ensure all environment variables—especially **SabPaisa Payment Gateway**—are set in the server's `.env` file:

```bash
nano /var/www/mastiadda-app/backend/.env
```

Ensure the **SabPaisa Configuration Block** is present and accurate:

```env
# ========================================
# SabPaisa Payment Gateway (Live Production)
# ========================================
SABPAISA_MODE=live
SABPAISA_BASE_URL=https://merchant-api.sabpaisa.in
SABPAISA_RETURN_URL=https://mastiadda.in/subscription
SABPAISA_WEBHOOK_URL=https://api.mastiadda.in/api/payment/webhook

SABPAISA_API_KEY=YOUR_LIVE_API_KEY_HERE
SABPAISA_SECRET_KEY=YOUR_LIVE_SECRET_KEY_HERE
SABPAISA_MERCHANT_ID=YOUR_LIVE_MERCHANT_ID_HERE
SABPAISA_WEBHOOK_SECRET=YOUR_LIVE_WEBHOOK_SECRET_HERE

# (Note: For Staging/Testing, set SABPAISA_MODE=test and SABPAISA_BASE_URL=https://staging-sb-merchant-api.sabpaisa.in)
```

*(Press `CTRL + O`, then `Enter` to save, and `CTRL + X` to exit nano)*

---

### 5. Deploy & Restart Backend

```bash
cd /var/www/mastiadda-app/backend
npm install
pm2 restart mastiadda-backend
```

**If the backend is not running in PM2 for the first time:**

```bash
pm2 start server.js --name mastiadda-backend
pm2 save
```

---

### 6. Deploy Frontend (Admin Panel)

```bash
cd /var/www/mastiadda-app/frontend
npm install
npm run build
```

---

### 7. Test & Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### 8. Check PM2 Process & Logs

Check that the server is running healthy without crashes:

```bash
pm2 list
pm2 logs mastiadda-backend --lines 50
```

You should see:
```text
✅ MongoDB Connected
✅ SabPaisa configured successfully (Mode: live)
✅ Server running on port 5000
```

---

### 9. Verify Live Websites & API Endpoints

Check HTTP status codes to confirm everything is live:

```bash
curl -I https://admin.mastiadda.in
curl -I https://api.mastiadda.in
```

Verify that the payment & plan API is responding with JSON:
```bash
curl -s https://api.mastiadda.in/api/plan | grep "success"
```

---

### 10. SabPaisa Portal Webhook Registration

Log in to your **SabPaisa Merchant Dashboard** and register your webhook endpoint:
* **Webhook URL**: `https://api.mastiadda.in/api/payment/webhook`
* **Events**: `Payment Success`, `Payment Failed`
* **Signature Algorithm**: `HMAC-SHA256`

---

## 🛠️ Troubleshooting & Common Fixes

### Issue 1: "SabPaisa payment gateway is not configured" (HTTP 503)
* **Cause**: Missing `SABPAISA_API_KEY` or `SABPAISA_SECRET_KEY` in `/var/www/mastiadda-app/backend/.env`.
* **Fix**: Open `.env`, paste the credentials, and restart PM2:
  ```bash
  nano /var/www/mastiadda-app/backend/.env
  pm2 restart mastiadda-backend
  ```

### Issue 2: Backend Process Crashed or Port in Use
Check the error logs:
```bash
pm2 logs mastiadda-backend --err --lines 50
```
Restart cleanly:
```bash
pm2 restart mastiadda-backend --update-env
```

### Issue 3: Nginx 502 Bad Gateway
Make sure the backend is listening on port 5000:
```bash
netstat -tlpn | grep 5000
sudo systemctl status nginx
```

---

## 📌 Important Notes

1. **Local Changes**: Run `git stash` only if you have local changes on the server you want to preserve. Check `git stash list` before applying a stash.
2. **Environment File**: Never delete or overwrite the production `.env` file during `git pull` (git does not track `.env`).
3. **PM2 Startup**: If your VPS restarts, PM2 automatically restarts your backend because of `pm2 save`. To verify startup on boot: `pm2 startup`.
4. **Frontend Builds**: Always run `npm run build` after pulling updates to the admin panel. Nginx serves static files from `frontend/dist`.
5. **Flutter Mobile App URL**: Ensure Flutter developers point API calls to **`https://api.mastiadda.in/api`** (never `https://mastiadda.in` which serves the HTML frontend).

