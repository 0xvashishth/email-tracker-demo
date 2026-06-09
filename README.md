# Email Open Tracker

Pixel-based email open tracking server. Deploy to Render for a permanent public HTTPS URL that Gmail's image proxy can reach.

---

## Deploy to Render (5 minutes)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USER/email-tracker.git
git push -u origin main
```

### Step 2 — Deploy on Render
1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Render auto-detects Node.js. Settings will be:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Click **Create Web Service**
5. Wait ~2 minutes. You'll get a URL like:
   `https://email-tracker-xxxx.onrender.com`

### Step 3 — Set environment variables on Render
Go to your service → **Environment** tab → add these:

| Key | Value |
|---|---|
| `BASE_URL` | `https://email-tracker-xxxx.onrender.com` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `you@gmail.com` |
| `SMTP_PASS` | your Gmail App Password |

> **Gmail App Password:** Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → generate a 16-char password for "Mail".

### Step 4 — Send a tracked email
```
https://email-tracker-xxxx.onrender.com/send?to=recipient@gmail.com
```

Open the email → check Render logs → you'll see the open event fire. 🎉

---

## Local Development

```bash
cp .env.example .env
# Fill in your values in .env
npm install
node server.js
```

---

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Usage guide |
| `GET /send?to=EMAIL&subject=TEXT` | Send a tracked email |
| `GET /pixel/:emailId` | Tracking pixel — logs an open |
| `GET /stats` | JSON of all tracked opens |

---

## View logs on Render
Render dashboard → your service → **Logs** tab.
Every email open fires a console log there in real time.