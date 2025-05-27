const electron = require('electron');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const db = require('./database');
const flash = require('express-flash');
const bcrypt = require('bcryptjs');

const server = express();
const port = 3000;

// Middleware setup
server.use(bodyParser.urlencoded({ extended: true }));
server.use(express.static(path.join(__dirname, 'public')));
server.set('view engine', 'ejs');

// Session configuration
server.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

server.use(flash());
server.use(passport.initialize());
server.use(passport.session());

// CORS setup for development
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Passport configuration
passport.use(new LocalStrategy(
  async (username, password, done) => {
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
      if (err) return done(err);
      if (results.length === 0) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      
      const user = results[0];
      try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Incorrect password.' });
        }
      } catch (err) {
        return done(err);
      }
    });
  }
));


server.use(express.json()); // for parsing application/json
server.use(express.urlencoded({ extended: true }));



passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

passport.deserializeUser((user_id, done) => {
  db.query('SELECT * FROM users WHERE user_id = ?', [user_id], (err, results) => {
    if (err) return done(err);
    if (results.length === 0) return done(null, false);
    
    const user = results[0];
    try {
      if (user.preferences && typeof user.preferences === 'string') {
        user.preferences = JSON.parse(user.preferences);
      } else {
        user.preferences = {};
      }
      done(null, user);
    } catch (e) {
      console.error('Error parsing user preferences:', e);
      user.preferences = {};
      done(null, user);
    }
  });
});

// Template variables
server.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.currentPage = req.path.split('/')[1] || 'home';
  next();
});

// Request logging
server.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});



// Routes
const indexRoutes = require('./routes/indexRoutes');
const userRoutes = require('./routes/userRoutes'); 
const recipeRoutes = require('./routes/recipeRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const mealPlannerRoutes = require('./routes/mealPlannerRoutes');
const cookingTimerRoutes = require('./routes/cookingTimerRoutes');
const recipeDiscoveryRoutes = require('./routes/recipeDiscoveryRoutes');
const groceryRoutes = require('./routes/groceryRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const favouritesRouter = require('./routes/favourites');
const adminRouter = require('./routes/admin');

server.use('/', indexRoutes);
server.use('/', userRoutes);
server.use('/recipes', recipeRoutes);
server.use('/recommendations', recommendationRoutes);
server.use('/meal-planner', mealPlannerRoutes);
server.use('/cooking-timer', cookingTimerRoutes);
server.use('/discover', recipeDiscoveryRoutes);
server.use('/grocery', groceryRoutes);
server.use('/nutrition', nutritionRoutes);
server.use('/favourites', favouritesRouter);
server.use('/admin', adminRouter);

// Server setup
const httpServer = http.createServer(server);
httpServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Electron Window Setup
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Only for development
    }
  });

  mainWindow.webContents.session.clearCache()
    .then(() => mainWindow.loadURL('http://localhost:3000'))
    .catch(err => console.error('Failed to load window:', err));

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.error('Failed to load:', errorDesc);
  });
}

app.whenReady().then(createWindow).catch(err => {
  console.error('Failed to create window:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});