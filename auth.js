const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./database');

// Serialization
// Serialization
passport.serializeUser((user, done) => {
  if (user.admin_id) {
    done(null, { id: user.admin_id, isAdmin: true });
  } else {
    done(new Error('Invalid user type for admin'));
  }
});

// Deserialization
passport.deserializeUser((obj, done) => {
  if (!obj.isAdmin) return done(new Error('Not an admin user'));
  
  db.query('SELECT * FROM admins WHERE admin_id = ?', [obj.id], (err, results) => {
    if (err) return done(err);
    if (!results || results.length === 0) return done(null, false);
    done(null, results[0]);
  });
});

// Regular User Strategy (keep existing)
passport.use('local', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password'
}, (username, password, done) => {
  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) return done(err);
    if (results.length === 0) {
      return done(null, false, { message: 'Incorrect username or password' });
    }
    
    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return done(err);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      return done(null, user);
    });
  });
}));

// Admin Strategy - Email Only
passport.use('admin-local', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, (email, password, done) => {
  if (!email || !password) {
    return done(null, false, { message: 'Email and password required' });
  }

  db.query('SELECT * FROM admins WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return done(err);
    }
    
    if (!results || results.length === 0) {
      return done(null, false, { message: 'Invalid credentials' });
    }
    
    const admin = results[0];
    bcrypt.compare(password, admin.password, (err, isMatch) => {
      if (err) {
        console.error('Bcrypt error:', err);
        return done(err);
      }
      if (!isMatch) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      return done(null, admin);
    });
  });
}));

// Middleware exports
module.exports = {
  // User authentication
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash('error_msg', 'Please log in to view this resource');
    res.redirect('/login');
  },
  
  // Admin authentication
  ensureAdminAuthenticated: (req, res, next) => {
    if (req.isAuthenticated() && req.user.admin_id) return next();
    req.flash('error_msg', 'Please login as admin');
    res.redirect('/admin/login');
  },
  
  // Forward if already authenticated (users)
  forwardAuthenticated: function(req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    }
    res.redirect('/');      
  },
  
  // Forward if already authenticated (admins)
  forwardAdminAuthenticated: function(req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    }
    res.redirect('/admin/dashboard');
  }
};