require('dotenv').config();
const express     = require('express');
const session     = require('express-session');
const cookieParser = require('cookie-parser');
const path        = require('path');

const surveyRoutes = require('./routes/survey');
const adminRoutes  = require('./routes/admin');
const reportRoutes = require('./routes/reports');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sh360-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));

// Routes
app.use('/survey', surveyRoutes);
app.use('/admin',  adminRoutes);
app.use('/report', reportRoutes);

// Home — redirect to admin
app.get('/', (req, res) => res.redirect('/admin'));

// Health check for Railway
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// 404
app.use((req, res) => {
  res.status(404).send('<h2 style="font-family:Arial;color:#1F3864;padding:40px">Page not found.</h2>');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('<h2 style="font-family:Arial;color:#A94442;padding:40px">Something went wrong. Please try again.</h2>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SH360 running on port ${PORT}`));
