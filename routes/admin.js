const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ensureAdminAuthenticated, forwardAdminAuthenticated } = require('../auth');

// Admin Login Page
router.get('/login', forwardAdminAuthenticated, (req, res) => {
  const error = req.flash('error')[0] || '';
  const email = req.flash('email')[0] || '';
  
  res.render('admin/login', { 
    message: error,
    email: email 
  });
});

// Admin Login Handle
router.post('/login', (req, res, next) => {
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    req.flash('error', 'Both email and password are required');
    req.flash('email', email);
    return res.redirect('/admin/login');
  }

  passport.authenticate('admin-local', (err, user, info) => {
    if (err) {
      console.error('Auth error:', err);
      return next(err);
    }
    if (!user) {
      req.flash('error', info.message);
      req.flash('email', email);
      return res.redirect('/admin/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      return res.redirect('/admin/dashboard');
    });
  })(req, res, next);
});

// Admin Dashboard
router.get('/dashboard', ensureAdminAuthenticated, (req, res) => {
  res.render('admin/dashboard', { admin: req.user });
});

// Admin Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Logout failed');
    }
    res.redirect('/admin/login');
  });
});

module.exports = router;