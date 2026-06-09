/**
 * Email Open Tracker
 * ------------------
 * 1. Starts an Express server with a tracking pixel endpoint
 * 2. Sends an email with the pixel embedded via Nodemailer
 * 3. Logs every open to the console with metadata
 *
 * Usage:
 *   node server.js
 *
 * For public access (so Gmail/Outlook can reach the pixel):
 *   npx ngrok http 3000
 *   Then set BASE_URL to your ngrok URL in .env or config below.
 */
require('dotenv').config();

const express = require("express");
const nodemailer = require("nodemailer");
const chalk = require("chalk");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  PORT: process.env.PORT || 3000,

  // Your public base URL — replace with ngrok URL when testing with real email
  // e.g. "https://abc123.ngrok-free.app"
  BASE_URL: process.env.BASE_URL || `http://localhost:3000`,

  // Nodemailer SMTP config
  // For quick testing: use Gmail App Password or Ethereal (https://ethereal.email)
  SMTP: {
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "austen.rippin@ethereal.email", // fill in or use .env
      pass: process.env.SMTP_PASS || "1P5MJy1RPDySwFvjx8", // fill in or use .env
    },
  },
};
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// In-memory store of tracked emails
const emailLog = {};

// ── 1×1 transparent GIF (the tracking pixel) ─────────────────────────────────
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// ── Pretty console helpers ────────────────────────────────────────────────────
const log = {
  info:    (msg) => console.log(chalk.cyan("ℹ"), chalk.white(msg)),
  success: (msg) => console.log(chalk.green("✔"), chalk.greenBright(msg)),
  open:    (msg) => console.log(chalk.yellow("👁 "), chalk.yellowBright(msg)),
  send:    (msg) => console.log(chalk.magenta("✉"), chalk.magentaBright(msg)),
  warn:    (msg) => console.log(chalk.red("⚠"), chalk.redBright(msg)),
  divider: ()    => console.log(chalk.gray("─".repeat(55))),
  table:   (obj) => console.table(obj),
};

// ── Tracking pixel endpoint ───────────────────────────────────────────────────
app.get("/pixel/:emailId", (req, res) => {
  const { emailId } = req.params;
  const now = new Date();
  const ip  = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua  = req.headers["user-agent"] || "unknown";

  const record = {
    emailId,
    openedAt: now.toISOString(),
    ip,
    userAgent: ua,
    count: 1,
  };

  if (emailLog[emailId]) {
    emailLog[emailId].count++;
    emailLog[emailId].lastOpenedAt = now.toISOString();
    record.count = emailLog[emailId].count;
  } else {
    emailLog[emailId] = record;
  }

  log.divider();
  log.open(`EMAIL OPENED — ID: ${chalk.bold(emailId)}`);
  log.table({
    "Email ID":   emailId,
    "Opened at":  now.toLocaleString(),
    "Open count": emailLog[emailId].count,
    "IP address": ip,
    "User agent": ua.substring(0, 80),
  });
  log.divider();

  // Serve the 1×1 transparent GIF
  res.set({
    "Content-Type":  "image/gif",
    "Content-Length": PIXEL.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma":        "no-cache",
    "Expires":       "0",
  });
  res.end(PIXEL);
});

// ── Send a tracked email ──────────────────────────────────────────────────────
app.get("/send", async (req, res) => {
  const to      = req.query.to;
  const subject = req.query.subject || "Hello from Email Tracker";
  console.log("Send request received:", { to, subject });
  console.log("Current SMTP config:", CONFIG.SMTP);
  if (!to) {
    return res.status(400).json({ error: "Pass ?to=email@example.com" });
  }

  // Generate a unique ID for this email
  const emailId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pixelUrl = `${CONFIG.BASE_URL}/pixel/${emailId}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: auto; color: #333;">
      <h2 style="color: #333;">Hey there 👋</h2>
      <p>This is a <strong>tracked email</strong> demo. When you open this email
         (and your client loads images), the server will log the open event in real time.</p>

      <p style="background: #f4f4f4; padding: 12px; border-radius: 6px; font-size: 13px;">
        📌 Email ID: <code>${emailId}</code>
      </p>

      <p>Check the terminal — it'll show exactly when you opened this.</p>
      <p style="color: #888; font-size: 12px;">Sent via Email Tracker demo · Node.js + Express</p>

      <!-- Tracking pixel — 1x1 transparent image -->
      <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block" />
    </div>
  `;

  try {
    // Auto-create Ethereal test account if no SMTP creds provided
    let transporter;
    if (!CONFIG.SMTP.auth.user) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host:   "smtp.ethereal.email",
        port:   587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      log.warn("No SMTP config found — using Ethereal test account.");
      log.info(`Ethereal user: ${testAccount.user}`);
    } else {
      transporter = nodemailer.createTransport(CONFIG.SMTP);
    }

    const info = await transporter.sendMail({
      from:    '"Email Tracker Demo" <tracker@demo.com>',
      to,
      subject,
      html,
      text: `Tracked email. ID: ${emailId}. Pixel URL: ${pixelUrl}`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    log.send(`Email sent to ${chalk.bold(to)}`);
    log.info(`Email ID : ${emailId}`);
    log.info(`Pixel URL: ${pixelUrl}`);
    if (previewUrl) {
      log.info(`Preview  : ${chalk.underline(previewUrl)}`);
    }

    res.json({
      success:    true,
      emailId,
      pixelUrl,
      previewUrl: previewUrl || null,
      message:    `Email sent! Check console for open events.`,
    });
  } catch (err) {
    log.warn(`Send failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── View all tracked opens ────────────────────────────────────────────────────
app.get("/stats", (req, res) => {
  const total = Object.keys(emailLog).length;
  res.json({
    totalTracked: total,
    emails: emailLog,
  });
});

// ── Home — shows usage ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`
    <html><head><title>Email Tracker</title>
    <style>body{font-family:monospace;max-width:640px;margin:40px auto;background:#0d0d0d;color:#0f0;padding:20px}
    code{background:#1a1a1a;padding:2px 8px;border-radius:4px}a{color:#0ff}</style></head>
    <body>
    <h2>📧 Email Tracker — Running</h2>
    <p><b>Base URL:</b> <code>${CONFIG.BASE_URL}</code></p>
    <hr>
    <h3>Endpoints</h3>
    <p><b>Send a tracked email:</b><br>
    <a href="/send?to=test@example.com">/send?to=your@email.com&subject=Hello</a></p>
    <p><b>Manual pixel (simulate open):</b><br>
    <a href="/pixel/test-001">/pixel/test-001</a></p>
    <p><b>View all open stats:</b><br>
    <a href="/stats">/stats</a></p>
    <hr>
    <h3>ngrok setup</h3>
    <pre>npx ngrok http ${CONFIG.PORT}
# Copy the https URL, then:
BASE_URL=https://xyz.ngrok-free.app node server.js</pre>
    </body></html>
  `);
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(CONFIG.PORT, () => {
  log.divider();
  log.success(`Email Tracker server running`);
  log.info(`Local  : http://localhost:${CONFIG.PORT}`);
  log.info(`Base URL set to: ${CONFIG.BASE_URL}`);
  log.divider();
  log.info("To expose publicly via ngrok:");
  log.info(chalk.bold(`  npx ngrok http ${CONFIG.PORT}`));
  log.info("Then restart with:");
  log.info(chalk.bold(`  BASE_URL=https://your-ngrok-url.app node server.js`));
  log.divider();
  log.info("To send a test email, open:");
  log.info(chalk.bold(`  http://localhost:${CONFIG.PORT}/send?to=you@example.com`));
  log.info("To simulate an open:");
  log.info(chalk.bold(`  http://localhost:${CONFIG.PORT}/pixel/test-001`));
  log.divider();
});