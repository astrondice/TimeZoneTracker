// ── Audio Engine (lazy init — requires user gesture) ──────────────────────────
let actx = null;
function getCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
['click', 'keydown', 'touchstart'].forEach(evt => 
  document.addEventListener(evt, () => getCtx(), { once: true })
);

function playAlarm() {
  const a = getCtx();
  const t = a.currentTime;
  // Louder, longer sequences for the alarm
  [[880,.05],[1100,.3],[880,.55],[660,.8],[880,1.05],[1100,1.3]].forEach(([f, d]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + d);
    g.gain.linearRampToValueAtTime(0.8, t + d + .05);
    g.gain.exponentialRampToValueAtTime(0.001, t + d + .35);
    o.connect(g); g.connect(a.destination);
    o.start(t + d); o.stop(t + d + .4);
  });
}

// ── Clock Engine ──────────────────────────────────────────────────────────────
const CIRC = 138.2;
const ZONES = [
  { tz:'Asia/Kolkata',     hm:'ist-time', ss:'ist-sec', dt:'ist-date', arc:'arc-ist', tzEl:'ist-tz' },
  { tz:'Europe/London',    hm:'gmt-time', ss:'gmt-sec', dt:'gmt-date', arc:'arc-gmt', tzEl:'gmt-tz' },
  { tz:'America/New_York', hm:'est-time', ss:'est-sec', dt:'est-date', arc:'arc-est', tzEl:'est-tz' }
];

const fmtHM = z => new Intl.DateTimeFormat('en-GB', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:z });
const fmtSS = z => new Intl.DateTimeFormat('en-GB', { second:'2-digit', timeZone:z });
const fmtDT = z => new Intl.DateTimeFormat('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:z });
const fmtTZ = z => new Intl.DateTimeFormat('en-US', { timeZoneName:'short', timeZone:z });

// Cache formatters
const hmFmts = ZONES.map(z => fmtHM(z.tz));
const ssFmts = ZONES.map(z => fmtSS(z.tz));
const dtFmts = ZONES.map(z => fmtDT(z.tz));
const tzFmts = ZONES.map(z => fmtTZ(z.tz));

function tick() {
  const now = new Date();

  ZONES.forEach((z, i) => {
    const hm = hmFmts[i].format(now);
    const ss = parseInt(ssFmts[i].format(now), 10);
    document.getElementById(z.hm).textContent = hm;
    document.getElementById(z.ss).textContent = ':' + String(ss).padStart(2, '0');
    document.getElementById(z.dt).textContent = dtFmts[i].format(now);
    // Seconds ring
    const arc = document.getElementById(z.arc);
    if (arc) arc.style.strokeDashoffset = CIRC - (CIRC * (ss / 60));
  });

  // DST-aware timezone labels
  const lonStr = tzFmts[1].format(now);
  document.getElementById('gmt-tz').textContent = lonStr.includes('BST') ? 'BST \u2014 UTC+1' : 'GMT \u2014 UTC+0';
  const nyStr = tzFmts[2].format(now);
  document.getElementById('est-tz').textContent = nyStr.includes('EDT') ? 'EDT \u2014 UTC\u22124' : 'EST \u2014 UTC\u22125';

  // Nav local time
  document.getElementById('local-nav').textContent =
    new Intl.DateTimeFormat('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(now);

  checkAlarms(now);
}
// Init moved to boot section

// ── Alarm Engine ──────────────────────────────────────────────────────────────
let alarms = [], fired = new Set(), toastTimer;

function addAlarm() {
  const tv = document.getElementById('alarm-time').value;
  const lv = (document.getElementById('alarm-label').value.trim()) || 'Alarm';
  if (!tv) { toast('⚠️', 'Validation', 'Please select a time first.'); return; }
  const id = Date.now();
  alarms.push({ id, time: tv, label: lv });
  document.getElementById('alarm-label').value = '';
  renderAlarms();
  saveAlarms();
  toast('✅', 'Alarm Set', tv + ' \u2014 ' + lv);
}

function delAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  fired.delete(id);
  renderAlarms();
  saveAlarms();
}

function clearAll() {
  alarms = []; fired.clear();
  renderAlarms(); saveAlarms();
  toast('🗑️', 'Cleared', 'All alarms removed.');
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderAlarms() {
  const el = document.getElementById('alm-table');
  if (!alarms.length) { el.innerHTML = ''; return; }
  el.innerHTML = alarms.map(a =>
    `<div class="alm-row">
      <div class="alm-info">
        <i class="bi bi-alarm-fill" style="color:#7c3aed;font-size:.82rem"></i>
        <span class="alm-time-val">${a.time}</span>
        <span class="alm-lbl-val">${esc(a.label)}</span>
      </div>
      <span class="alm-status">Active</span>
      <button class="alm-del" onclick="delAlarm(${a.id})" title="Remove alarm" aria-label="Remove ${esc(a.label)}">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>`
  ).join('');
}

function checkAlarms(now) {
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  if (hh === '00' && mm === '00') fired.clear();
  const cur = hh + ':' + mm;
  alarms.forEach(a => {
    if (a.time === cur && !fired.has(a.id)) {
      fired.add(a.id);
      playAlarm();
      toast('⏰', 'Alarm Triggered!', a.label + ' \u2014 ' + a.time, 7000);
      logAlarm(a);
    }
  });
}

// ── API / DB Persistence ──────────────────────────────────────────────────────
async function saveAlarms() {
  try { await fetch('/api/alarms/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ alarms }) }); }
  catch(e) { console.warn('saveAlarms failed', e); }
}

async function logAlarm(a) {
  try {
    await fetch('/api/alarms/log', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ time:a.time, label:a.label }) });
    loadLogs();
  } catch(e) { console.warn('logAlarm failed', e); }
}

async function loadAlarms() {
  try { const r = await fetch('/api/alarms'); alarms = await r.json(); renderAlarms(); }
  catch(e) { console.warn('loadAlarms failed', e); }
}

async function loadLogs() {
  try {
    const r = await fetch('/api/alarms/logs');
    const logs = await r.json();
    const el = document.getElementById('logs-wrap');
    if (!logs.length) { el.innerHTML = '<div class="no-log">No alarms triggered yet.</div>'; return; }
    el.innerHTML = logs.slice(0, 10).map(l =>
      `<div class="log-row">
        <span class="log-t"><i class="bi bi-alarm"></i> ${l.time}</span>
        <span class="log-l">${esc(l.label)}</span>
        <span class="log-a">${new Date(l.triggeredAt).toLocaleString()}</span>
      </div>`
    ).join('');
  } catch(e) { console.warn('loadLogs failed', e); }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(icon, title, msg, dur = 3500) {
  clearTimeout(toastTimer);
  document.getElementById('t-icon').textContent = icon;
  document.getElementById('t-title').textContent = title;
  document.getElementById('t-msg').textContent = msg;
  document.getElementById('toast').classList.add('show');
  toastTimer = setTimeout(() => document.getElementById('toast').classList.remove('show'), dur);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
setInterval(tick, 1000);
tick();
loadAlarms();
loadLogs();
