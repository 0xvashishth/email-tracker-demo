// Load .env file for local development (ignored in production)
try { require("fs").existsSync(".env") && require("child_process")
  .execSync("npm list dotenv 2>/dev/null | grep dotenv") &&
  require("dotenv").config(); } catch (_) {}
// Simpler: just read .env manually if present
try {
  const fs = require("fs");
  if (fs.existsSync(".env")) {
    fs.readFileSync(".env", "utf8").split("\n").forEach(line => {
      const [k, ...v] = line.replace(/\s*#.*/, "").split("=");
      if (k && v.length) process.env[k.trim()] = v.join("=").trim();
    });
  }
} catch (_) {}

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

const express = require("express");
const nodemailer = require("nodemailer");
const chalk = require("chalk");

// ── FILE LOGGING & SSE ─────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const LOG_FILE = path.join(__dirname, "tracker.log");
let logStream;
try {
  logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
} catch (_) {
  logStream = { write: () => {} };
}
const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(100);

const recentEvents = [];
const MAX_EVENTS = 50;

function emitLog(type, data) {
  const entry = { ts: Date.now(), type, ...data };
  logStream.write(JSON.stringify(entry) + "\n");
  recentEvents.push(entry);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();
  logEmitter.emit("log", entry);
}
// ───────────────────────────────────────────────────────────────────────────

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || `http://localhost:3000`,

  // Gmail SMTP (real sending)
  GMAIL: {
    host: process.env.GMAIL_HOST || process.env.SMTP_HOST || "",
    port: Number(process.env.GMAIL_PORT || process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER || process.env.SMTP_USER || "",
      pass: process.env.GMAIL_PASS || process.env.SMTP_PASS || "",
    },
  },

  // Ethereal SMTP (test / preview)
  ETHEREAL: {
    host: process.env.ETHEREAL_HOST || "smtp.ethereal.email",
    port: Number(process.env.ETHEREAL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.ETHEREAL_USER || "cedrick.hilll24@ethereal.email",
      pass: process.env.ETHEREAL_PASS || "3kaGsteuU6EEp21wCG",
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

  emitLog("OPENED", {
    emailId,
    ip,
    userAgent: ua.substring(0, 80),
    count: emailLog[emailId].count,
  });

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
  const sender  = req.query.sender || "ethereal";

  if (!to) {
    return res.status(400).json({ error: "Pass ?to=email@example.com" });
  }

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
      <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block" />
    </div>
  `;

  try {
    let transporter;
    let senderLabel;

    if (sender === "gmail") {
      if (!CONFIG.GMAIL.auth.user) {
        return res.status(400).json({
          error: "Gmail SMTP not configured. Set GMAIL_USER and GMAIL_PASS in .env",
        });
      }
      transporter = nodemailer.createTransport(CONFIG.GMAIL);
      senderLabel = "Gmail";
      log.info(`Using Gmail SMTP: ${CONFIG.GMAIL.auth.user}`);
    } else {
      if (CONFIG.ETHEREAL.auth.user) {
        transporter = nodemailer.createTransport(CONFIG.ETHEREAL);
        senderLabel = "Ethereal";
      } else {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        senderLabel = "Ethereal (auto)";
        log.info(`Ethereal auto-created account: ${testAccount.user}`);
      }
    }

    const info = await transporter.sendMail({
      from:    `"Email Tracker Demo" <${sender === "gmail" ? CONFIG.GMAIL.auth.user : CONFIG.ETHEREAL.auth.user}>`,
      to,
      subject,
      html,
      text: `Tracked email. ID: ${emailId}. Pixel URL: ${pixelUrl}`,
    });

    let previewUrl = null;
    if (sender !== "gmail") {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }

    log.send(`Email sent via ${senderLabel} to ${chalk.bold(to)}`);
    log.info(`Email ID : ${emailId}`);
    log.info(`Pixel URL: ${pixelUrl}`);
    if (previewUrl) {
      log.info(`Preview  : ${chalk.underline(previewUrl)}`);
    }

    emitLog("SENT", { to, emailId, sender: senderLabel, previewUrl });

    res.json({
      success:    true,
      emailId,
      pixelUrl,
      previewUrl,
      sender: senderLabel,
      message:   `Email sent via ${senderLabel}!`,
    });
  } catch (err) {
    log.warn(`Send failed: ${err.message}`);
    emitLog("ERROR", { message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── View all tracked opens ────────────────────────────────────────────────────
app.get("/stats", (req, res) => {
  const total = Object.keys(emailLog).length;
  res.json({
    totalTracked: total,
    emails: emailLog,
    recentEvents,
  });
});

// ── Serve index.html ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ── SSE log stream ────────────────────────────────────────────────────────────
app.get("/logs/stream", (req, res) => {
  if (process.env.VERCEL) {
    return res.status(501).json({ error: "SSE not available in serverless environment" });
  }
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ ts: Date.now(), type: "INFO", message: "Connected to log stream" })}\n\n`);

  const handler = (entry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };
  logEmitter.on("log", handler);
  req.on("close", () => logEmitter.off("log", handler));
});

// ── Expose non-sensitive config for the frontend ──────────────────────────────
app.get("/config", (req, res) => {
  res.json({
    port: CONFIG.PORT,
    baseUrl: CONFIG.BASE_URL,
    logFile: "tracker.log",
    senders: {
      ethereal: {
        available: true,
        label: "Ethereal (Test)",
        configured: !!CONFIG.ETHEREAL.auth.user,
      },
      gmail: {
        available: !!CONFIG.GMAIL.auth.user,
        label: "Gmail (Real SMTP)",
        configured: !!CONFIG.GMAIL.auth.user,
      },
    },
    nodeVersion: process.version,
  });
});

// ── Export app for serverless (Vercel) ────────────────────────────────────────
module.exports = app;

// ── Start server (local only) ─────────────────────────────────────────────────
if (require.main === module) {
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
}