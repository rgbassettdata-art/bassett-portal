const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
  })
);

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE));
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// create default admin if none exists
let users = loadUsers();
if (users.length === 0) {
  const defaultPwd = 'adminpass';
  const hash = bcrypt.hashSync(defaultPwd, 10);
  users.push({ username: 'admin', password: hash, role: 'superuser' });
  saveUsers(users);
  console.log(
    `Default superuser created (username=admin, password=${defaultPwd}). Please change it!`
  );
}

function ensureAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login.html?error=' + encodeURIComponent('Please log in'));
}

function ensureSuperuser(req, res, next) {
  if (req.session.user && req.session.user.role === 'superuser') {
    return next();
  }
  res.status(403).send('Forbidden');
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = { username: user.username, role: user.role };
    return res.redirect('/dashboard.html');
  }
  res.redirect('/login.html?error=' + encodeURIComponent('Invalid credentials'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

app.post('/user', ensureAuthenticated, ensureSuperuser, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.redirect(
      '/add_user.html?msg=' + encodeURIComponent('All fields required')
    );
  }
  users = loadUsers();
  if (users.find((u) => u.username === username)) {
    return res.redirect(
      '/add_user.html?msg=' + encodeURIComponent('User already exists')
    );
  }
  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash, role });
  saveUsers(users);
  res.redirect(
    '/add_user.html?msg=' + encodeURIComponent('User added successfully')
  );
});

// protect dashboard and add_user pages
app.get('/login.html', (req, res) => {
  // always allow login page
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/add_user.html', ensureSuperuser, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add_user.html'));
});

// endpoint to query current session user
app.get('/session', (req, res) => {
  if (req.session.user) {
    return res.json(req.session.user);
  }
  res.status(401).json({ error: 'not authenticated' });
});

// redirect root
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard.html');
  }
  res.redirect('/login.html');
});

// static assets (css/js)
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
