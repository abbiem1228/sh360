require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');

const surveyRoutes = require('./routes/survey');
const adminRoutes  = require('./routes/admin');
const reportRoutes = require('./routes/reports');

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || 'sh360-secret'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  req.isAdmin = req.signedCookies && req.signedCookies.adminAuth === 'yes';
  next();
});

app.use('/survey', surveyRoutes);
app.use('/admin',  adminRoutes);
app.use('/report', reportRoutes);

app.get('/', (req, res) => res.redirect('/admin'));
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((req, res) => {
  res.status(404).send('<h2 style="font-family:Arial;color:#1F3864;padding:40px">Page not found.</h2>');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('<h2 style="font-family:Arial;color:#A94442;padding:40px">Something went wrong.</h2>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SH360 running on port ${PORT}`));
