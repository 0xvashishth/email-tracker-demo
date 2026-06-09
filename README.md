# Email Open Tracker — Node.js Demo

A minimal demo showing how email open tracking works using a **1×1 tracking pixel**.

---

## Quick Start

```bash
npm install
node server.js
```

Then open: http://localhost:3000

---

## How to Demo

### Option A — Simulate an open locally (no email needed)
1. Start the server: `node server.js`
2. Open in browser: http://localhost:3000/pixel/my-test-email
3. Watch the terminal log the "open" event

### Option B — Send a real tracked email via Ethereal (fake inbox, no config needed)
1. Start the server: `node server.js`
2. Open: http://localhost:3000/send?to=anyone@example.com
3. Copy the **Ethereal preview URL** from the JSON response (or terminal)
4. Open that URL in a browser — it simulates the email being opened
5. Watch the terminal fire the open notification

### Option C — Send to a real inbox + expose via ngrok
```bash
# Terminal 1 — start the tracker
node server.js

# Terminal 2 — expose it
npx ngrok http 3000
# Copy the https://xxx.ngrok-free.app URL

# Terminal 1 — restart with public URL
BASE_URL=https://xxx.ngrok-free.app node server.js
```
Then open: `http://localhost:3000/send?to=your-real@email.com`

When you open the email on your phone or another client, the terminal fires immediately.

---

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Usage guide |
| `GET /send?to=EMAIL&subject=TEXT` | Send a tracked email |
| `GET /pixel/:emailId` | Tracking pixel (logs an open) |
| `GET /stats` | JSON log of all tracked opens |

---

## SMTP Config (for real email sending)

Set environment variables or edit CONFIG in server.js:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password   # Gmail: use App Password, not account password
BASE_URL=https://your-ngrok-url.app
```

---

## Notes

- **Apple Mail Privacy Protection** (iOS 15+) pre-fetches images — you'll see opens even for Apple Mail users who never read it
- **Image blocking** — Outlook and some corporate clients block images by default, so real opens may go undetected
- **Link tracking** is more reliable than pixel tracking for confirming real engagement