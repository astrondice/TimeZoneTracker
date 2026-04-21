/**
 * World Clock & Alarm Hub — Server
 * AntiGravity Agent: Phase 2 — Backend Construction
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 88;

// ─── Simulated Database Module ───────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'db', 'alarms.json');

function initDB() {
  console.log('🔗 DB Connection Established: AntiGravity-Vault-01');
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ alarms: [], logs: [] }, null, 2));
    console.log('📂 Alarm database initialised at:', DB_PATH);
  } else {
    console.log('📂 Alarm database loaded from:', DB_PATH);
  }
}

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { alarms: [], logs: [] }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'templates')));

// ─── Routes ──────────────────────────────────────────────────────────────────

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// API: Save an alarm log entry
app.post('/api/alarms/log', (req, res) => {
  const db = readDB();
  const entry = {
    id: Date.now(),
    time: req.body.time,
    label: req.body.label || 'Alarm',
    triggeredAt: new Date().toISOString()
  };
  db.logs.push(entry);
  // Keep last 50 logs
  if (db.logs.length > 50) db.logs = db.logs.slice(-50);
  writeDB(db);
  console.log(`⏰ Alarm triggered & logged → ${entry.label} @ ${entry.time}`);
  res.json({ success: true, entry });
});

// API: Get alarm logs
app.get('/api/alarms/logs', (req, res) => {
  const db = readDB();
  res.json(db.logs.reverse());
});

// API: Save active alarms
app.post('/api/alarms/save', (req, res) => {
  const db = readDB();
  db.alarms = req.body.alarms || [];
  writeDB(db);
  res.json({ success: true, count: db.alarms.length });
});

// API: Get active alarms
app.get('/api/alarms', (req, res) => {
  const db = readDB();
  res.json(db.alarms);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
initDB();
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    🌍  World Clock & Alarm Hub  —  AntiGravity   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  ✅  Server listening on  →  http://localhost:${PORT}  ║`);
  console.log('║  📡  Environment: Production-Ready                ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
