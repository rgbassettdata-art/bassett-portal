const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE     = path.join(__dirname, 'users.json');
const REQUESTS_FILE  = path.join(__dirname, 'holiday_requests.json');
const PHONELIST_FILE = path.join(__dirname, 'phone_list.json');
const ABSENCES_FILE  = path.join(__dirname, 'absences.json');
const DB_FILE        = path.join(__dirname, 'data.db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
  })
);

// ── SQLite setup ──────────────────────────────────────────────────────────────

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username         TEXT PRIMARY KEY,
    password         TEXT NOT NULL,
    role             TEXT NOT NULL,
    totalHolidays    INTEGER DEFAULT 28,
    nextYearHolidays INTEGER DEFAULT 28,
    carriedOver      INTEGER DEFAULT 0,
    manager          TEXT,
    approver         TEXT,
    adminAccess      INTEGER DEFAULT 0,
    colour           TEXT DEFAULT '#4A90D9',
    department       TEXT,
    clockNumber      TEXT,
    workDays         TEXT DEFAULT '[1,2,3,4,5]',
    holidayYear      INTEGER,
    email            TEXT
  );

  CREATE TABLE IF NOT EXISTS holiday_requests (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    bookedBy    TEXT,
    startDate   TEXT NOT NULL,
    endDate     TEXT NOT NULL,
    days        INTEGER,
    status      TEXT DEFAULT 'pending',
    requestedAt TEXT,
    decidedBy   TEXT,
    decidedAt   TEXT,
    cancelledBy TEXT,
    cancelledAt TEXT,
    amendedBy   TEXT,
    amendedAt   TEXT,
    removedBy   TEXT,
    removedAt   TEXT
  );

  CREATE TABLE IF NOT EXISTS absences (
    id        TEXT PRIMARY KEY,
    username  TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate   TEXT NOT NULL,
    reason    TEXT DEFAULT '',
    createdBy TEXT,
    createdAt TEXT,
    updatedBy TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS phone_sections (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS phone_entries (
    id         TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES phone_sections(id),
    name       TEXT DEFAULT '',
    position   TEXT DEFAULT '',
    internal   TEXT DEFAULT '',
    direct     TEXT DEFAULT '',
    mobile     TEXT DEFAULT '',
    email      TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS news_posts (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    body      TEXT DEFAULT '',
    links     TEXT DEFAULT '[]',
    pinned    INTEGER DEFAULT 0,
    createdBy TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// ── One-time migration from JSON files ────────────────────────────────────────

function migrateFromJSON() {
  const existingUsers = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
  if (existingUsers.cnt > 0) return; // already migrated

  console.log('Migrating data from JSON files to SQLite...');

  // Migrate users
  try {
    const rawUsers = JSON.parse(fs.readFileSync(USERS_FILE));
    const insUser = db.prepare(`INSERT OR IGNORE INTO users
      (username,password,role,totalHolidays,nextYearHolidays,carriedOver,manager,approver,adminAccess,colour,department,clockNumber,workDays,holidayYear)
      VALUES (@username,@password,@role,@totalHolidays,@nextYearHolidays,@carriedOver,@manager,@approver,@adminAccess,@colour,@department,@clockNumber,@workDays,@holidayYear)`);
    db.transaction(() => {
      for (const u of rawUsers) {
        insUser.run({
          username:         u.username,
          password:         u.password,
          role:             u.role,
          totalHolidays:    u.totalHolidays    ?? 28,
          nextYearHolidays: u.nextYearHolidays ?? u.totalHolidays ?? 28,
          carriedOver:      u.carriedOver      ?? 0,
          manager:          u.manager          ?? null,
          approver:         u.approver         ?? null,
          adminAccess:      u.adminAccess       ? 1 : 0,
          colour:           u.colour           ?? '#4A90D9',
          department:       u.department       ?? null,
          clockNumber:      u.clockNumber      ?? null,
          workDays:         JSON.stringify(u.workDays ?? [1,2,3,4,5]),
          holidayYear:      u.holidayYear      ?? null,
        });
      }
    })();
    console.log(`  Migrated ${rawUsers.length} users.`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('  Could not migrate users.json:', e.message);
  }

  // Migrate holiday requests
  try {
    const rawReqs = JSON.parse(fs.readFileSync(REQUESTS_FILE));
    const insReq = db.prepare(`INSERT OR IGNORE INTO holiday_requests
      (id,username,bookedBy,startDate,endDate,days,status,requestedAt,decidedBy,decidedAt,cancelledBy,cancelledAt,amendedBy,amendedAt,removedBy,removedAt)
      VALUES (@id,@username,@bookedBy,@startDate,@endDate,@days,@status,@requestedAt,@decidedBy,@decidedAt,@cancelledBy,@cancelledAt,@amendedBy,@amendedAt,@removedBy,@removedAt)`);
    db.transaction(() => {
      for (const r of rawReqs) {
        insReq.run({
          id:          r.id,
          username:    r.username,
          bookedBy:    r.bookedBy    ?? null,
          startDate:   r.startDate,
          endDate:     r.endDate,
          days:        r.days        ?? null,
          status:      r.status,
          requestedAt: r.requestedAt ?? null,
          decidedBy:   r.decidedBy   ?? null,
          decidedAt:   r.decidedAt   ?? null,
          cancelledBy: r.cancelledBy ?? null,
          cancelledAt: r.cancelledAt ?? null,
          amendedBy:   r.amendedBy   ?? null,
          amendedAt:   r.amendedAt   ?? null,
          removedBy:   r.removedBy   ?? null,
          removedAt:   r.removedAt   ?? null,
        });
      }
    })();
    console.log(`  Migrated ${rawReqs.length} holiday requests.`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('  Could not migrate holiday_requests.json:', e.message);
  }

  // Migrate absences
  try {
    const rawAbsences = JSON.parse(fs.readFileSync(ABSENCES_FILE));
    const insAbs = db.prepare(`INSERT OR IGNORE INTO absences
      (id,username,startDate,endDate,reason,createdBy,createdAt,updatedBy,updatedAt)
      VALUES (@id,@username,@startDate,@endDate,@reason,@createdBy,@createdAt,@updatedBy,@updatedAt)`);
    db.transaction(() => {
      for (const a of rawAbsences) {
        insAbs.run({
          id:        a.id,
          username:  a.username,
          startDate: a.startDate,
          endDate:   a.endDate,
          reason:    a.reason    ?? '',
          createdBy: a.createdBy ?? null,
          createdAt: a.createdAt ?? null,
          updatedBy: a.updatedBy ?? null,
          updatedAt: a.updatedAt ?? null,
        });
      }
    })();
    console.log(`  Migrated ${rawAbsences.length} absences.`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('  Could not migrate absences.json:', e.message);
  }

  // Migrate phone list
  try {
    const rawPhone = JSON.parse(fs.readFileSync(PHONELIST_FILE));
    const insSec = db.prepare('INSERT OR IGNORE INTO phone_sections (id,title,sort_order) VALUES (?,?,?)');
    const insEnt = db.prepare('INSERT OR IGNORE INTO phone_entries (id,section_id,name,position,internal,direct,mobile,email,sort_order) VALUES (?,?,?,?,?,?,?,?,?)');
    db.transaction(() => {
      (rawPhone.sections || []).forEach((s, si) => {
        insSec.run(s.id, s.title, si);
        (s.entries || []).forEach((e, ei) => {
          insEnt.run(e.id, s.id, e.name ?? '', e.position ?? '', e.internal ?? '', e.direct ?? '', e.mobile ?? '', e.email ?? '', ei);
        });
      });
    })();
    const secCount = (rawPhone.sections || []).length;
    const entCount = (rawPhone.sections || []).reduce((n, s) => n + (s.entries || []).length, 0);
    console.log(`  Migrated ${secCount} phone sections, ${entCount} entries.`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('  Could not migrate phone_list.json:', e.message);
  }

  console.log('Migration complete.');
}

migrateFromJSON();

// Add email column to existing databases that pre-date this field
try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (_) { /* already exists */ }

// ── Data helpers ──────────────────────────────────────────────────────────────

function rowToUser(u) {
  return { ...u, workDays: JSON.parse(u.workDays || '[1,2,3,4,5]'), adminAccess: Boolean(u.adminAccess) };
}

function loadUsers() {
  return db.prepare('SELECT * FROM users').all().map(rowToUser);
}

function saveUsers(users) {
  db.transaction(() => {
    db.prepare('DELETE FROM users').run();
    const ins = db.prepare(`INSERT INTO users
      (username,password,role,totalHolidays,nextYearHolidays,carriedOver,manager,approver,adminAccess,colour,department,clockNumber,workDays,holidayYear,email)
      VALUES (@username,@password,@role,@totalHolidays,@nextYearHolidays,@carriedOver,@manager,@approver,@adminAccess,@colour,@department,@clockNumber,@workDays,@holidayYear,@email)`);
    for (const u of users) {
      ins.run({
        username:         u.username,
        password:         u.password,
        role:             u.role,
        totalHolidays:    u.totalHolidays    ?? 28,
        nextYearHolidays: u.nextYearHolidays ?? u.totalHolidays ?? 28,
        carriedOver:      u.carriedOver      ?? 0,
        manager:          u.manager          ?? null,
        approver:         u.approver         ?? null,
        adminAccess:      u.adminAccess       ? 1 : 0,
        colour:           u.colour           ?? '#4A90D9',
        department:       u.department       ?? null,
        clockNumber:      u.clockNumber      ?? null,
        workDays:         JSON.stringify(u.workDays ?? [1,2,3,4,5]),
        holidayYear:      u.holidayYear      ?? null,
        email:            u.email            ?? null,
      });
    }
  })();
}

function loadRequests() {
  return db.prepare('SELECT * FROM holiday_requests').all();
}

function saveRequests(reqs) {
  db.transaction(() => {
    db.prepare('DELETE FROM holiday_requests').run();
    const ins = db.prepare(`INSERT INTO holiday_requests
      (id,username,bookedBy,startDate,endDate,days,status,requestedAt,decidedBy,decidedAt,cancelledBy,cancelledAt,amendedBy,amendedAt,removedBy,removedAt)
      VALUES (@id,@username,@bookedBy,@startDate,@endDate,@days,@status,@requestedAt,@decidedBy,@decidedAt,@cancelledBy,@cancelledAt,@amendedBy,@amendedAt,@removedBy,@removedAt)`);
    for (const r of reqs) {
      ins.run({
        id:          r.id,
        username:    r.username,
        bookedBy:    r.bookedBy    ?? null,
        startDate:   r.startDate,
        endDate:     r.endDate,
        days:        r.days        ?? null,
        status:      r.status,
        requestedAt: r.requestedAt ?? null,
        decidedBy:   r.decidedBy   ?? null,
        decidedAt:   r.decidedAt   ?? null,
        cancelledBy: r.cancelledBy ?? null,
        cancelledAt: r.cancelledAt ?? null,
        amendedBy:   r.amendedBy   ?? null,
        amendedAt:   r.amendedAt   ?? null,
        removedBy:   r.removedBy   ?? null,
        removedAt:   r.removedAt   ?? null,
      });
    }
  })();
}

function loadPhoneList() {
  const sections = db.prepare('SELECT * FROM phone_sections ORDER BY sort_order, id').all();
  const entries  = db.prepare('SELECT * FROM phone_entries  ORDER BY sort_order, id').all();
  return {
    sections: sections.map(s => ({
      id:    s.id,
      title: s.title,
      entries: entries
        .filter(e => e.section_id === s.id)
        .map(e => ({ id: e.id, name: e.name, position: e.position, internal: e.internal, direct: e.direct, mobile: e.mobile, email: e.email })),
    })),
  };
}

function savePhoneList(data) {
  db.transaction(() => {
    db.prepare('DELETE FROM phone_entries').run();
    db.prepare('DELETE FROM phone_sections').run();
    (data.sections || []).forEach((s, si) => {
      db.prepare('INSERT INTO phone_sections (id,title,sort_order) VALUES (?,?,?)').run(s.id, s.title, si);
      (s.entries || []).forEach((e, ei) => {
        db.prepare('INSERT INTO phone_entries (id,section_id,name,position,internal,direct,mobile,email,sort_order) VALUES (?,?,?,?,?,?,?,?,?)').run(
          e.id, s.id, e.name ?? '', e.position ?? '', e.internal ?? '', e.direct ?? '', e.mobile ?? '', e.email ?? '', ei
        );
      });
    });
  })();
}

function loadAbsences() {
  return db.prepare('SELECT * FROM absences').all();
}

function saveAbsences(data) {
  db.transaction(() => {
    db.prepare('DELETE FROM absences').run();
    const ins = db.prepare(`INSERT INTO absences
      (id,username,startDate,endDate,reason,createdBy,createdAt,updatedBy,updatedAt)
      VALUES (@id,@username,@startDate,@endDate,@reason,@createdBy,@createdAt,@updatedBy,@updatedAt)`);
    for (const a of data) {
      ins.run({
        id:        a.id,
        username:  a.username,
        startDate: a.startDate,
        endDate:   a.endDate,
        reason:    a.reason    ?? '',
        createdBy: a.createdBy ?? null,
        createdAt: a.createdAt ?? null,
        updatedBy: a.updatedBy ?? null,
        updatedAt: a.updatedAt ?? null,
      });
    }
  })();
}

function dayCount(startDate, endDate) {
  return Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
}

// ── UK Bank Holidays (England & Wales) ────────────────────────────────────────

function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function firstMonday(year, month) {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
}

function lastMonday(year, month) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
}

function substituteMonday(date) {
  const d = new Date(date);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

const bankHolCache = {};
function getBankHolidays(year) {
  if (bankHolCache[year]) return bankHolCache[year];
  const fmt = (d) =>
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const dates = [];

  dates.push(fmt(substituteMonday(new Date(year, 0, 1)))); // New Year's Day

  const easter = easterSunday(year);
  const gf = new Date(easter); gf.setDate(gf.getDate() - 2);
  const em = new Date(easter); em.setDate(em.getDate() + 1);
  dates.push(fmt(gf), fmt(em)); // Good Friday & Easter Monday

  dates.push(fmt(firstMonday(year, 4))); // Early May bank holiday
  dates.push(fmt(lastMonday(year, 4)));  // Spring bank holiday
  dates.push(fmt(lastMonday(year, 7)));  // Summer bank holiday

  const xmas  = substituteMonday(new Date(year, 11, 25));
  const boxing = new Date(xmas); boxing.setDate(boxing.getDate() + 1);
  if (boxing.getDay() === 6) boxing.setDate(boxing.getDate() + 2);
  else if (boxing.getDay() === 0) boxing.setDate(boxing.getDate() + 1);
  dates.push(fmt(xmas), fmt(boxing)); // Christmas & Boxing Day

  bankHolCache[year] = new Set(dates);
  return bankHolCache[year];
}

// clampYear: if provided, only count days that fall within that calendar year
function workingDayCount(startDate, endDate, workDays, clampYear) {
  const wds = (workDays && workDays.length > 0) ? new Set(workDays) : new Set([1,2,3,4,5]);
  let count = 0;
  const d = new Date(startDate);
  const end = new Date(endDate);
  while (d <= end) {
    if (!clampYear || d.getFullYear() === clampYear) {
      const key = d.getFullYear() + '-' +
                  String(d.getMonth() + 1).padStart(2, '0') + '-' +
                  String(d.getDate()).padStart(2, '0');
      if (wds.has(d.getDay()) && !getBankHolidays(d.getFullYear()).has(key)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Calculate how many approved holiday days a user has taken in a given calendar year
function calcTakenForYear(username, year, allReqs, workDays) {
  return allReqs
    .filter(r => r.username === username && r.status === 'approved')
    .reduce((sum, r) => sum + workingDayCount(r.startDate, r.endDate, workDays, year), 0);
}

// If the user's holiday year is behind the current year, carry over unused days and reset.
// Returns true if the user object was mutated (caller should save).
function processYearEnd(user, allReqs, currentYear) {
  const hy = user.holidayYear || currentYear;
  if (hy >= currentYear) return false;
  const workDays = user.workDays || [1, 2, 3, 4, 5];
  const taken     = calcTakenForYear(user.username, hy, allReqs, workDays);
  const remaining = Math.max(0, (user.totalHolidays ?? 28) + (user.carriedOver ?? 0) - taken);
  user.carriedOver  = remaining;
  user.holidayYear  = currentYear;
  return true;
}

// ── Seed default admin ────────────────────────────────────────────────────────

{
  const users = loadUsers();
  if (users.length === 0) {
    const defaultPwd = 'adminpass';
    const hash = bcrypt.hashSync(defaultPwd, 10);
    const newUsers = [{ username: 'admin', password: hash, role: 'admin',
                 totalHolidays: 0, takenHolidays: 0, manager: null, colour: '#888888' }];
    saveUsers(newUsers);
    console.log(`Default admin created (username=admin, password=${defaultPwd}). Please change it!`);
  }
}

// ── Year-end carry-over on startup ────────────────────────────────────────────
(function runYearEndOnStartup() {
  const currentYear = new Date().getFullYear();
  const allUsers = loadUsers();
  const allReqs  = loadRequests();
  let changed = false;
  allUsers.forEach(u => { if (processYearEnd(u, allReqs, currentYear)) changed = true; });
  if (changed) saveUsers(allUsers);
})();

// ── Email notifications ───────────────────────────────────────────────────────

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // TLS via STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER || 'rgbassettdata@gmail.com',
    pass: process.env.SMTP_PASS || 'yseblqjbqlnkjlhr',
  },
};

const mailer = nodemailer.createTransport(SMTP_CONFIG);
console.log(`Email configured: ${SMTP_CONFIG.auth.user} via ${SMTP_CONFIG.host}`);

const EMAIL_FOOTER = `
<hr style="border:none;border-top:1px solid #ccc;margin:24px 0">
<table style="font-size:11px;color:#555;font-family:Arial,sans-serif;max-width:600px">
  <tr><td>
    <strong style="color:#cc0000">R G Bassett &amp; Sons Ltd</strong><br>
    Transport House, Tittensor, Stoke on Trent,<br>
    Staffordshire ST12 9HD, England.<br><br>
    T +44 (0)1782 372251 (Switchboard)<br>
    E <a href="mailto:palletforce@bassett-group.co.uk">palletforce@bassett-group.co.uk</a><br>
    W <a href="http://www.bassett-group.co.uk">www.bassett-group.co.uk</a>
    <br><br>
    <p style="margin:0 0 8px">All goods are transported by our Company in accordance with Road Haulage Association (RHA) Conditions of Carriage 2009, and stored under United Kingdom Warehousing Association (UKWA) Conditions of Contract 2006, copies of which are available upon request. Our standard payment terms for Account Customers are 30 Days End of Month. All invoice queries should be notified in writing to <a href="mailto:queries@bassett-group.co.uk">queries@bassett-group.co.uk</a> within 14 days of the date of invoice.</p>
    <p style="margin:0 0 8px">This e-mail may contain confidential or legally privileged information, and is intended for the person to whom it is addressed. Any views or opinions expressed are solely those of the author, and do not necessarily represent those of R G Bassett &amp; Sons Ltd. If you are not the named addressee you must not use, copy, distribute or disclose such information, nor take any action in reliance on it. If you have received this message in error, please contact the sender immediately by return e-mail or telephone +44 (0)1782 372251.</p>
    <p style="margin:0 0 8px">R G Bassett &amp; Sons Ltd has taken every reasonable precaution to ensure that any attachment to this e-mail has been checked for viruses. However, we cannot accept liability for any damage sustained as a result of software viruses and would advise that you carry out your own virus check prior to opening any attachment.</p>
    <p style="margin:0 0 8px">R G Bassett &amp; Sons Ltd. Registered in England No 2269632. Registered Office: SJ Bargh Group Ltd, Caton Road, Lancaster LA1 3PE</p>
    <p style="margin:0;color:#cc0000;font-style:italic">Please consider the environment and don&apos;t print this e-mail unless you must.</p>
  </td></tr>
</table>`;

function fmtEmailDate(iso) {
  if (!iso) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function buildCalendarLink(username, startDate, endDate, subject) {
  // Outlook uses exclusive end date for all-day events, so add 1 day
  const end = new Date(endDate + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  const calEnd = end.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    subject,
    startdt: startDate + 'T00:00:00',
    enddt:   calEnd    + 'T00:00:00',
    body:    `Holiday leave for ${username}: ${fmtEmailDate(startDate)} – ${fmtEmailDate(endDate)}`,
    allday:  'true',
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params}`;
}

async function sendEmail(to, subject, html) {
  if (!to) return;
  try {
    await mailer.sendMail({
      from:    `"RG Bassett & Sons" <${SMTP_CONFIG.auth.user}>`,
      to,
      subject,
      html:    html + EMAIL_FOOTER,
    });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function dashboardForRole(role) {
  if (role === 'admin')   return '/admin_dashboard.html';
  if (role === 'manager') return '/manager_dashboard.html';
  return '/dashboard.html';
}

function ensureLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}


function ensureManager(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (role === 'manager' || role === 'admin') return next();
  res.status(403).send('Forbidden');
}

function ensureAdminAccess(req, res, next) {
  const { username, role } = req.session.user || {};
  if (role === 'admin') return next();
  if (role === 'manager') {
    const u = loadUsers().find((u) => u.username === username);
    if (u && u.adminAccess) return next();
  }
  res.status(403).send('Forbidden');
}

function ensureEmployee(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (role === 'employee' || role === 'admin') return next();
  res.status(403).send('Forbidden');
}

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = { username: user.username, role: user.role };
    return res.redirect(dashboardForRole(user.role));
  }
  res.redirect('/login.html?error=' + encodeURIComponent('Invalid credentials'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// ── Password reset ─────────────────────────────────────────────────────────────

// In-memory store: token → { username, expires }
const passwordResetTokens = new Map();

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.email && u.email.toLowerCase() === (email || '').toLowerCase());

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    passwordResetTokens.set(token, { username: user.username, expires });

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

    await sendEmail(
      user.email,
      'Password Reset — RG Bassett & Sons Employee Portal',
      `<p style="font-family:Arial,sans-serif;font-size:14px;color:#333">Hi ${user.username},</p>
       <p style="font-family:Arial,sans-serif;font-size:14px;color:#333">
         We received a request to reset your Employee Portal password.
         Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
       </p>
       <p style="text-align:center;margin:32px 0">
         <a href="${resetUrl}" style="background:#E8780F;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-family:Arial,sans-serif;font-weight:600;font-size:14px">Reset Password</a>
       </p>
       <p style="font-family:Arial,sans-serif;font-size:12px;color:#777">
         If you didn't request this, you can safely ignore this email — your password won't change.<br>
         Or copy this link into your browser: ${resetUrl}
       </p>`
    );
  }

  // Always show the same message to prevent email enumeration
  res.redirect('/forgot-password.html?sent=1');
});

app.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  const entry = passwordResetTokens.get(token);

  if (!entry || Date.now() > entry.expires) {
    return res.redirect('/forgot-password.html?error=' + encodeURIComponent('Reset link has expired or is invalid. Please request a new one.'));
  }

  if (!password || password.length < 6) {
    return res.redirect('/reset-password.html?token=' + token + '&error=' + encodeURIComponent('Password must be at least 6 characters.'));
  }

  if (password !== confirmPassword) {
    return res.redirect('/reset-password.html?token=' + token + '&error=' + encodeURIComponent('Passwords do not match.'));
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => u.username === entry.username);
  if (idx === -1) {
    passwordResetTokens.delete(token);
    return res.redirect('/login.html?error=' + encodeURIComponent('User account not found.'));
  }

  users[idx].password = await bcrypt.hash(password, 10);
  saveUsers(users);
  passwordResetTokens.delete(token);

  res.redirect('/login.html?message=' + encodeURIComponent('Password reset successfully. Please sign in with your new password.'));
});

// ── User management (admin) ───────────────────────────────────────────────────

app.post('/user', ensureAdminAccess, async (req, res) => {
  const { username, password, role, department, clockNumber } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ error: 'All fields required' });
  const users = loadUsers();
  if (users.find((u) => u.username === username))
    return res.status(409).json({ error: 'Username already exists' });
  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash, role,
               totalHolidays: role === 'admin' ? 0 : 28,
               nextYearHolidays: role === 'admin' ? 0 : 28,
               carriedOver: 0,
               takenHolidays: 0, manager: null, colour: '#4A90D9',
               department: department || null,
               clockNumber: clockNumber || null,
               workDays: role === 'admin' ? [] : [1,2,3,4,5] });
  saveUsers(users);
  res.json({ success: true });
});

app.patch('/user/:username', ensureAdminAccess, (req, res) => {
  const { username } = req.params;
  const { totalHolidays, nextYearHolidays, carriedOver, manager, approver, adminAccess, colour, department, clockNumber, workDays, email } = req.body;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (totalHolidays     !== undefined) users[idx].totalHolidays     = Number(totalHolidays);
  if (nextYearHolidays  !== undefined) users[idx].nextYearHolidays  = Number(nextYearHolidays);
  if (carriedOver       !== undefined) users[idx].carriedOver       = Number(carriedOver);
  if (manager           !== undefined) users[idx].manager           = manager  || null;
  if (approver      !== undefined) users[idx].approver      = approver || null;
  if (adminAccess   !== undefined) users[idx].adminAccess   = Boolean(adminAccess);
  if (colour        !== undefined) users[idx].colour        = colour;
  if (department    !== undefined) users[idx].department    = department || null;
  if (clockNumber   !== undefined) users[idx].clockNumber   = clockNumber || null;
  if (workDays      !== undefined) users[idx].workDays      = Array.isArray(workDays) ? workDays : [];
  if (email         !== undefined) users[idx].email         = email || null;
  saveUsers(users);
  res.json({ success: true });
});

app.delete('/user/:username', ensureAdminAccess, (req, res) => {
  const { username } = req.params;
  if (username === req.session.user.username)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  const users = loadUsers();
  const next = users.filter((u) => u.username !== username);
  if (next.length === users.length) return res.status(404).json({ error: 'User not found' });
  saveUsers(next);
  res.json({ success: true });
});

// ── Holiday requests ──────────────────────────────────────────────────────────

// Submit a request (any logged-in user; managers may specify targetUsername)
app.post('/holiday-request', ensureLoggedIn, (req, res) => {
  const { startDate, endDate, targetUsername } = req.body;
  if (!startDate || !endDate) return res.status(400).json({ error: 'Dates required' });
  if (endDate < startDate)   return res.status(400).json({ error: 'End must be on or after start' });

  const { username: sessionUser, role } = req.session.user;
  const allUsers = loadUsers();

  // Determine who the request is actually for
  let forUsername = sessionUser;
  if (targetUsername && targetUsername !== sessionUser) {
    if (role !== 'manager' && role !== 'admin')
      return res.status(403).json({ error: 'Only managers can book on behalf of others' });
    forUsername = targetUsername;
  }

  const currentYear = new Date().getFullYear();
  const allReqs = loadRequests();
  const user    = allUsers.find((u) => u.username === forUsername);
  const days    = workingDayCount(startDate, endDate, user?.workDays, currentYear);
  const total   = (user?.totalHolidays ?? 28) + (user?.carriedOver ?? 0);
  const taken   = calcTakenForYear(forUsername, currentYear, allReqs, user?.workDays);
  const pending = allReqs
    .filter((r) => r.username === forUsername && r.status === 'pending')
    .reduce((sum, r) => sum + workingDayCount(r.startDate, r.endDate, user?.workDays, currentYear), 0);

  if (days > total - taken - pending)
    return res.status(400).json({ error: 'Insufficient holiday allowance' });

  const reqs = allReqs;
  reqs.push({
    id: Date.now().toString(),
    username: forUsername,
    bookedBy: forUsername !== sessionUser ? sessionUser : undefined,
    startDate, endDate,
    days: workingDayCount(startDate, endDate, user?.workDays), // total working days for display
    status: 'pending',
    requestedAt: new Date().toISOString(),
  });
  saveRequests(reqs);

  // Notify the manager/approver of the new request
  const submittedUser = allUsers.find((u) => u.username === forUsername);
  const notifyUsername = submittedUser?.manager || submittedUser?.approver;
  if (notifyUsername) {
    const notifyUser = allUsers.find((u) => u.username === notifyUsername);
    if (notifyUser?.email) {
      const calLink = buildCalendarLink(forUsername, startDate, endDate, `Holiday Request – ${forUsername}`);
      const html = `
        <h2 style="margin:0 0 16px;color:#333;font-family:Arial,sans-serif">New Holiday Request</h2>
        <p style="font-family:Arial,sans-serif;color:#444"><strong>${forUsername}</strong> has submitted a holiday request requiring your approval.</p>
        <table style="border-collapse:collapse;font-size:14px;font-family:Arial,sans-serif;margin:16px 0">
          <tr><td style="padding:4px 16px 4px 0;color:#777">Employee:</td><td><strong>${forUsername}</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#777">From:</td><td>${fmtEmailDate(startDate)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#777">To:</td><td>${fmtEmailDate(endDate)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#777">Working days:</td><td>${days}</td></tr>
        </table>
        <a href="${calLink}" style="display:inline-block;background:#0078d4;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-size:14px">&#128197; Add to Microsoft Calendar</a>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#777;margin-top:16px">Please log in to the dashboard to approve or decline this request.</p>`;
      sendEmail(notifyUser.email, `Holiday Request – ${forUsername}`, html);
    }
  }

  res.json({ success: true });
});

// Own requests
app.get('/holiday-requests/mine', ensureLoggedIn, (req, res) => {
  res.json(loadRequests().filter((r) => r.username === req.session.user.username));
});

// Cancel own pending request (soft delete for audit trail)
app.delete('/holiday-requests/mine/:id', ensureLoggedIn, (req, res) => {
  const { id } = req.params;
  const reqs = loadRequests();
  const idx  = reqs.findIndex((r) => r.id === id && r.username === req.session.user.username);
  if (idx === -1)                      return res.status(404).json({ error: 'Not found' });
  if (reqs[idx].status !== 'pending')  return res.status(400).json({ error: 'Only pending requests can be cancelled' });
  reqs[idx].status      = 'cancelled';
  reqs[idx].cancelledBy = req.session.user.username;
  reqs[idx].cancelledAt = new Date().toISOString();
  saveRequests(reqs);
  res.json({ success: true });
});

// Team requests (manager sees their team + managers they approve; admin sees all) — excludes cancelled/removed
app.get('/holiday-requests/team', ensureManager, (req, res) => {
  const { username, role } = req.session.user;
  const allUsers = loadUsers();
  const reqs = loadRequests();
  let teamNames;
  if (role === 'admin') {
    teamNames = allUsers.map((u) => u.username);
  } else {
    const directTeam     = allUsers.filter((u) => u.manager  === username).map((u) => u.username);
    const managedManagers = allUsers.filter((u) => u.approver === username).map((u) => u.username);
    teamNames = [...new Set([...directTeam, ...managedManagers])];
  }
  res.json(reqs.filter((r) => teamNames.includes(r.username) && r.status !== 'cancelled' && r.status !== 'removed'));
});

// Approve or decline
app.patch('/holiday-request/:id', ensureManager, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'declined'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const reqs = loadRequests();
  const idx = reqs.findIndex((r) => r.id === id);
  if (idx === -1)               return res.status(404).json({ error: 'Not found' });
  if (reqs[idx].status !== 'pending')
    return res.status(400).json({ error: 'Already decided' });

  reqs[idx].status    = status;
  reqs[idx].decidedBy = req.session.user.username;
  reqs[idx].decidedAt = new Date().toISOString();
  saveRequests(reqs);

  // Send notification emails
  const reqData      = reqs[idx];
  const allUsersNow  = loadUsers();
  const requester    = allUsersNow.find((u) => u.username === reqData.username);
  const deciderUser  = allUsersNow.find((u) => u.username === req.session.user.username);
  const statusWord   = status === 'approved' ? 'Approved' : 'Declined';
  const statusColour = status === 'approved' ? '#25764A'  : '#c0392b';
  const calLink      = buildCalendarLink(reqData.username, reqData.startDate, reqData.endDate, `Holiday – ${reqData.username}`);
  const calBtn       = status === 'approved'
    ? `<br><a href="${calLink}" style="display:inline-block;background:#0078d4;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-size:14px">&#128197; Add to Microsoft Calendar</a>`
    : '';

  // Email to requester
  if (requester?.email) {
    const html = `
      <h2 style="margin:0 0 16px;color:${statusColour};font-family:Arial,sans-serif">Holiday Request ${statusWord}</h2>
      <p style="font-family:Arial,sans-serif;color:#444">Your holiday request has been <strong style="color:${statusColour}">${statusWord.toLowerCase()}</strong> by ${req.session.user.username}.</p>
      <table style="border-collapse:collapse;font-size:14px;font-family:Arial,sans-serif;margin:16px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#777">From:</td><td>${fmtEmailDate(reqData.startDate)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#777">To:</td><td>${fmtEmailDate(reqData.endDate)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#777">Working days:</td><td>${reqData.days}</td></tr>
      </table>
      ${calBtn}`;
    sendEmail(requester.email, `Holiday Request ${statusWord}`, html);
  }

  // Confirmation email to the person who decided
  if (deciderUser?.email) {
    const html = `
      <h2 style="margin:0 0 16px;color:#333;font-family:Arial,sans-serif">Holiday Request ${statusWord}</h2>
      <p style="font-family:Arial,sans-serif;color:#444">You have <strong style="color:${statusColour}">${statusWord.toLowerCase()}</strong> the holiday request for <strong>${reqData.username}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px;font-family:Arial,sans-serif;margin:16px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#777">Employee:</td><td><strong>${reqData.username}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#777">From:</td><td>${fmtEmailDate(reqData.startDate)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#777">To:</td><td>${fmtEmailDate(reqData.endDate)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#777">Working days:</td><td>${reqData.days}</td></tr>
      </table>
      ${calBtn}`;
    sendEmail(deciderUser.email, `Holiday Request ${statusWord} – ${reqData.username}`, html);
  }

  res.json({ success: true });
});

// Amend dates of a pending request (manager)
app.put('/holiday-request/:id', ensureManager, (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) return res.status(400).json({ error: 'Dates required' });
  if (endDate < startDate)   return res.status(400).json({ error: 'End must be on or after start' });

  const reqs = loadRequests();
  const idx  = reqs.findIndex((r) => r.id === id);
  if (idx === -1)                      return res.status(404).json({ error: 'Not found' });
  if (reqs[idx].status !== 'pending')  return res.status(400).json({ error: 'Only pending requests can be amended' });

  const allUsers    = loadUsers();
  const currentYear = new Date().getFullYear();
  const user        = allUsers.find((u) => u.username === reqs[idx].username);
  const days        = workingDayCount(startDate, endDate, user?.workDays, currentYear);
  const total       = (user?.totalHolidays ?? 28) + (user?.carriedOver ?? 0);
  const taken       = calcTakenForYear(reqs[idx].username, currentYear, reqs, user?.workDays);
  const pending     = reqs
    .filter((r) => r.username === reqs[idx].username && r.status === 'pending' && r.id !== id)
    .reduce((sum, r) => sum + workingDayCount(r.startDate, r.endDate, user?.workDays, currentYear), 0);

  if (days > total - taken - pending)
    return res.status(400).json({ error: 'Insufficient holiday allowance for new dates' });

  reqs[idx].startDate  = startDate;
  reqs[idx].endDate    = endDate;
  reqs[idx].days       = days;
  reqs[idx].amendedBy  = req.session.user.username;
  reqs[idx].amendedAt  = new Date().toISOString();
  saveRequests(reqs);
  res.json({ success: true });
});

// Remove/cancel a request (manager); reverts takenHolidays if approved (soft delete for audit trail)
app.delete('/holiday-request/:id', ensureManager, (req, res) => {
  const { id } = req.params;
  const reqs = loadRequests();
  const idx  = reqs.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  reqs[idx].status    = 'removed';
  reqs[idx].removedBy = req.session.user.username;
  reqs[idx].removedAt = new Date().toISOString();
  saveRequests(reqs);
  res.json({ success: true });
});

// Approved requests with colours (for calendar overlays)
app.get('/holiday-requests/approved', ensureManager, (req, res) => {
  const { username, role } = req.session.user;
  const allUsers = loadUsers();
  let teamNames;
  if (role === 'admin') {
    teamNames = allUsers.map((u) => u.username);
  } else {
    const directTeam      = allUsers.filter((u) => u.manager  === username).map((u) => u.username);
    const managedManagers = allUsers.filter((u) => u.approver === username).map((u) => u.username);
    teamNames = [...new Set([...directTeam, ...managedManagers])];
  }

  const result = loadRequests()
    .filter((r) => r.status === 'approved' && teamNames.includes(r.username))
    .map((r) => {
      const u = allUsers.find((u) => u.username === r.username);
      return { ...r, colour: u?.colour || '#888888' };
    });
  res.json(result);
});

// All requests with audit data (admin only)
app.get('/admin/holiday-requests', ensureAdminAccess, (_req, res) => {
  const allUsers = loadUsers();
  const userMap  = {};
  allUsers.forEach((u) => { userMap[u.username] = u; });
  const reqs = loadRequests()
    .map((r) => ({ ...r, department: userMap[r.username]?.department ?? null }))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  res.json(reqs);
});

// All absences with audit data (admin only)
app.get('/admin/absences', ensureAdminAccess, (_req, res) => {
  const allUsers = loadUsers();
  const userMap  = {};
  allUsers.forEach((u) => { userMap[u.username] = u; });
  const absences = loadAbsences()
    .map((a) => ({ ...a, department: userMap[a.username]?.department ?? null }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(absences);
});

// ── Data endpoints ────────────────────────────────────────────────────────────

app.get('/admin/users', ensureAdminAccess, (_req, res) => {
  const currentYear = new Date().getFullYear();
  const allUsers = loadUsers();
  const allReqs  = loadRequests();
  let changed = false;
  allUsers.forEach(u => { if (processYearEnd(u, allReqs, currentYear)) changed = true; });
  if (changed) saveUsers(allUsers);
  const safe = allUsers.map((u) => ({
    username:         u.username,
    role:             u.role,
    totalHolidays:    u.totalHolidays    ?? 28,
    nextYearHolidays: u.nextYearHolidays ?? u.totalHolidays ?? 28,
    carriedOver:      u.carriedOver      ?? 0,
    takenHolidays:    calcTakenForYear(u.username, currentYear,     allReqs, u.workDays),
    nextYearTaken:    calcTakenForYear(u.username, currentYear + 1, allReqs, u.workDays),
    manager:          u.manager     ?? null,
    approver:         u.approver    ?? null,
    adminAccess:      u.adminAccess ?? false,
    colour:           u.colour      ?? '#4A90D9',
    department:       u.department  ?? null,
    clockNumber:      u.clockNumber ?? null,
    workDays:         u.workDays    ?? [1,2,3,4,5],
    email:            u.email       ?? null,
  }));
  res.json(safe);
});

app.get('/users', ensureManager, (_req, res) => {
  const currentYear = new Date().getFullYear();
  const allUsers = loadUsers().filter(u => u.role !== 'admin');
  const allReqs  = loadRequests();
  const safe = allUsers.map((u) => ({
    username:         u.username,
    role:             u.role,
    totalHolidays:    u.totalHolidays    ?? 28,
    nextYearHolidays: u.nextYearHolidays ?? u.totalHolidays ?? 28,
    carriedOver:      u.carriedOver      ?? 0,
    takenHolidays:    calcTakenForYear(u.username, currentYear,     allReqs, u.workDays),
    nextYearTaken:    calcTakenForYear(u.username, currentYear + 1, allReqs, u.workDays),
    department:       u.department    ?? null,
    colour:           u.colour        ?? '#4A90D9',
    workDays:         u.workDays      ?? [1,2,3,4,5],
  }));
  res.json(safe);
});

app.get('/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not authenticated' });
  const currentYear = new Date().getFullYear();
  const allUsers = loadUsers();
  const allReqs  = loadRequests();
  const idx = allUsers.findIndex((u) => u.username === req.session.user.username);
  if (idx !== -1) {
    const user = allUsers[idx];
    if (processYearEnd(user, allReqs, currentYear)) saveUsers(allUsers);
    const taken         = calcTakenForYear(user.username, currentYear,     allReqs, user.workDays);
    const nextYearTaken = calcTakenForYear(user.username, currentYear + 1, allReqs, user.workDays);
    return res.json({
      username:         user.username,
      role:             user.role,
      totalHolidays:    user.totalHolidays    ?? 28,
      nextYearHolidays: user.nextYearHolidays ?? user.totalHolidays ?? 28,
      carriedOver:      user.carriedOver      ?? 0,
      takenHolidays:    taken,
      nextYearTaken:    nextYearTaken,
      manager:          user.manager     ?? null,
      colour:           user.colour      ?? '#4A90D9',
      department:       user.department  ?? null,
      adminAccess:      user.adminAccess ?? false,
      workDays:         user.workDays    ?? [1,2,3,4,5],
    });
  }
  res.json(req.session.user);
});

// Holiday matrix data (available to all logged-in users)
app.get('/holiday-matrix', ensureLoggedIn, (req, res) => {
  const allUsers = loadUsers();
  const allReqs  = loadRequests();

  // Always show every non-admin user so everyone can see the full team calendar
  const teamUsers = allUsers.filter(u => u.role !== 'admin');

  const teamSet = new Set(teamUsers.map(u => u.username));
  const users   = teamUsers.map(u => ({
    username:   u.username,
    colour:     u.colour     ?? '#4A90D9',
    department: u.department ?? null,
    workDays:   u.workDays   ?? [1,2,3,4,5],
  }));
  const requests = allReqs
    .filter(r => teamSet.has(r.username) && (r.status === 'approved' || r.status === 'pending'))
    .map(r => ({ username: r.username, startDate: r.startDate, endDate: r.endDate, status: r.status }));

  const absences = loadAbsences()
    .filter(a => teamSet.has(a.username))
    .map(a => ({ username: a.username, startDate: a.startDate, endDate: a.endDate }));

  res.json({ users, requests, absences });
});

// ── Absences ──────────────────────────────────────────────────────────────────

// Team absences with reasons (manager only)
app.get('/absences/team', ensureManager, (req, res) => {
  const { username, role } = req.session.user;
  const allUsers = loadUsers();
  let teamNames;
  if (role === 'admin') {
    teamNames = new Set(allUsers.map(u => u.username));
  } else {
    const directTeam      = allUsers.filter(u => u.manager  === username).map(u => u.username);
    const managedManagers = allUsers.filter(u => u.approver === username).map(u => u.username);
    teamNames = new Set([username, ...directTeam, ...managedManagers]);
  }
  res.json(loadAbsences().filter(a => teamNames.has(a.username)));
});

// Own absences — no reason exposed (any logged-in user)
app.get('/absences/mine', ensureLoggedIn, (req, res) => {
  const { username } = req.session.user;
  res.json(loadAbsences()
    .filter(a => a.username === username)
    .map(a => ({ id: a.id, username: a.username, startDate: a.startDate, endDate: a.endDate })));
});

// Log an absence (manager only)
app.post('/absences', ensureManager, (req, res) => {
  const { username, startDate, endDate, reason } = req.body;
  if (!username || !startDate || !endDate)
    return res.status(400).json({ error: 'Employee and dates required' });
  if (endDate < startDate)
    return res.status(400).json({ error: 'End date must be on or after start date' });
  const absences = loadAbsences();
  const entry = {
    id: Date.now().toString(), username, startDate, endDate,
    reason: reason || '',
    createdBy: req.session.user.username,
    createdAt: new Date().toISOString(),
  };
  absences.push(entry);
  saveAbsences(absences);
  res.json(entry);
});

// Edit an absence (manager only)
app.patch('/absences/:id', ensureManager, (req, res) => {
  const absences = loadAbsences();
  const idx = absences.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { startDate, endDate, reason } = req.body;
  if (startDate) absences[idx].startDate = startDate;
  if (endDate)   absences[idx].endDate   = endDate;
  if (reason !== undefined) absences[idx].reason = reason;
  absences[idx].updatedBy = req.session.user.username;
  absences[idx].updatedAt = new Date().toISOString();
  saveAbsences(absences);
  res.json({ success: true });
});

// Delete an absence (manager only)
app.delete('/absences/:id', ensureManager, (req, res) => {
  const absences = loadAbsences();
  const idx = absences.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  absences.splice(idx, 1);
  saveAbsences(absences);
  res.json({ success: true });
});

// ── Phone List ────────────────────────────────────────────────────────────────

app.get('/api/phone-list', ensureLoggedIn, (_req, res) => {
  res.json(loadPhoneList());
});

app.post('/api/phone-list/section', ensureAdminAccess, (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const data = loadPhoneList();
  const section = { id: Date.now().toString(), title, entries: [] };
  data.sections.push(section);
  savePhoneList(data);
  res.json(section);
});

app.patch('/api/phone-list/section/:id', ensureAdminAccess, (req, res) => {
  const data = loadPhoneList();
  const sec = data.sections.find(s => s.id === req.params.id);
  if (!sec) return res.status(404).json({ error: 'Section not found' });
  if (req.body.title) sec.title = req.body.title;
  savePhoneList(data);
  res.json({ success: true });
});

app.delete('/api/phone-list/section/:id', ensureAdminAccess, (req, res) => {
  const data = loadPhoneList();
  data.sections = data.sections.filter(s => s.id !== req.params.id);
  savePhoneList(data);
  res.json({ success: true });
});

app.post('/api/phone-list/section/:sectionId/entry', ensureAdminAccess, (req, res) => {
  const data = loadPhoneList();
  const sec = data.sections.find(s => s.id === req.params.sectionId);
  if (!sec) return res.status(404).json({ error: 'Section not found' });
  const { name = '', position = '', internal = '', direct = '', mobile = '', email = '' } = req.body;
  const entry = { id: Date.now().toString(), name, position, internal, direct, mobile, email };
  sec.entries.push(entry);
  savePhoneList(data);
  res.json(entry);
});

app.patch('/api/phone-list/entry/:id', ensureAdminAccess, (req, res) => {
  const data = loadPhoneList();
  for (const sec of data.sections) {
    const idx = sec.entries.findIndex(e => e.id === req.params.id);
    if (idx !== -1) {
      sec.entries[idx] = { ...sec.entries[idx], ...req.body, id: req.params.id };
      savePhoneList(data);
      return res.json({ success: true });
    }
  }
  res.status(404).json({ error: 'Entry not found' });
});

app.delete('/api/phone-list/entry/:id', ensureAdminAccess, (req, res) => {
  const data = loadPhoneList();
  for (const sec of data.sections) {
    const idx = sec.entries.findIndex(e => e.id === req.params.id);
    if (idx !== -1) {
      sec.entries.splice(idx, 1);
      savePhoneList(data);
      return res.json({ success: true });
    }
  }
  res.status(404).json({ error: 'Entry not found' });
});

// ── News Posts ────────────────────────────────────────────────────────────────

app.get('/api/news', ensureLoggedIn, (_req, res) => {
  const posts = db.prepare('SELECT * FROM news_posts ORDER BY pinned DESC, createdAt DESC').all()
    .map(p => ({ ...p, links: JSON.parse(p.links || '[]'), pinned: Boolean(p.pinned) }));
  res.json(posts);
});

app.post('/api/news', ensureAdminAccess, (req, res) => {
  const { title, body, links, pinned } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = Date.now().toString();
  db.prepare('INSERT INTO news_posts (id,title,body,links,pinned,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, title, body || '', JSON.stringify(links || []), pinned ? 1 : 0, req.session.user.username, new Date().toISOString(), new Date().toISOString());
  res.json({ success: true, id });
});

app.patch('/api/news/:id', ensureAdminAccess, (req, res) => {
  const { title, body, links, pinned } = req.body;
  const post = db.prepare('SELECT id FROM news_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (title   !== undefined) db.prepare('UPDATE news_posts SET title=?, updatedAt=? WHERE id=?').run(title, new Date().toISOString(), req.params.id);
  if (body    !== undefined) db.prepare('UPDATE news_posts SET body=?,  updatedAt=? WHERE id=?').run(body,  new Date().toISOString(), req.params.id);
  if (links   !== undefined) db.prepare('UPDATE news_posts SET links=?, updatedAt=? WHERE id=?').run(JSON.stringify(links), new Date().toISOString(), req.params.id);
  if (pinned  !== undefined) db.prepare('UPDATE news_posts SET pinned=?,updatedAt=? WHERE id=?').run(pinned ? 1 : 0, new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/news/:id', ensureAdminAccess, (req, res) => {
  const result = db.prepare('DELETE FROM news_posts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Pages ─────────────────────────────────────────────────────────────────────

app.get('/login.html',            (_req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/phone_list.html',       ensureLoggedIn, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'phone_list.html')));
app.get('/dashboard.html',        ensureEmployee, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/manager_dashboard.html',ensureManager,  (_req, res) => res.sendFile(path.join(__dirname, 'public', 'manager_dashboard.html')));
app.get('/admin_dashboard.html',  ensureAdminAccess, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_dashboard.html')));

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect(dashboardForRole(req.session.user.role));
  res.redirect('/login.html');
});

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js',  express.static(path.join(__dirname, 'public', 'js')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
