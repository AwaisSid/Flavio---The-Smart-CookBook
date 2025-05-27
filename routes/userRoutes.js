const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { forwardAuthenticated, ensureAuthenticated, forwardAdminAuthenticated, ensureAdminAuthenticated } = require('../auth');

// Login routes
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('login', { 
    message: req.flash('error'),
    currentPage: 'login'
  });
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

// Signup routes
router.get('/signup', forwardAuthenticated, (req, res) => {
  res.render('signup', { 
    message: req.flash('error'),
    currentPage: 'signup'
  });
});

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // Check if user exists
    const [existing] = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], 
        (err, results) => err ? reject(err) : resolve(results));
    });

    if (existing) {
      req.flash('error', 'Username or email already exists');
      return res.redirect('/signup');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.redirect('/login');
  } catch (err) {
    console.error('Signup error:', err);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/signup');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Preferences
router.get('/preferences', ensureAuthenticated, (req, res) => {
  res.render('preferences', { 
    user: req.user,
    currentPage: 'preferences',
    preferences: req.user.preferences || {}
  });
});

router.post('/preferences', ensureAuthenticated, (req, res) => {
  const userId = req.user.user_id;
  const preferences = req.body;
  
  db.query(
    'UPDATE users SET preferences = ? WHERE user_id = ?',
    [JSON.stringify(preferences), userId],
    (err) => {
      if (err) {
        console.error('Error saving preferences:', err);
        req.flash('error_msg', 'Error saving preferences');
        return res.redirect('/preferences');
      }
      req.flash('success_msg', 'Preferences updated successfully');
      res.redirect('/recommendations');
    }
  );
});


// Add this to your userRoutes.js
// Update this in your userRoutes.js
router.get('/profile', ensureAuthenticated, (req, res) => {
  const userId = req.user.user_id;
  const profileData = {
      user: req.user,
      currentPage: 'profile'
  };

  // 1. Get user activity
  db.query(`
      SELECT a.*, r.name, r.image_url 
      FROM user_activity a
      JOIN recipes r ON a.recipe_id = r.recipe_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT 5
  `, [userId], (err, activityResults) => {
      if (err) {
          console.error('Error fetching user activity:', err);
          return res.status(500).send('Error loading profile');
      }

      profileData.userActivity = activityResults;

      // 2. Get nutrition selections
      db.query(`
          SELECT * FROM nutrition_selections 
          WHERE user_id = ?
          ORDER BY created_at DESC
      `, [userId], (err, nutritionResults) => {
          if (err) {
              console.error('Error fetching nutrition selections:', err);
              return res.status(500).send('Error loading profile');
          }

          profileData.nutritionSelections = nutritionResults;

          // 3. Get grocery lists (updated to match groceryRoutes logic)
          db.query(`
              SELECT * FROM grocery_lists 
              WHERE user_id = ?
              ORDER BY created_at DESC  /* Changed from list_date to created_at */
              LIMIT 5  /* Added limit to match grocery list logic */
          `, [userId], (err, groceryResults) => {
              if (err) {
                  console.error('Error fetching grocery lists:', err);
                  return res.status(500).send('Error loading profile');
              }

              // Parse ingredients for each list
              const groceryLists = groceryResults.map(list => {
                  try {
                      return {
                          ...list,
                          ingredients: list.ingredients ? JSON.parse(list.ingredients) : {}
                      };
                  } catch (e) {
                      console.error('Error parsing ingredients:', e);
                      return {
                          ...list,
                          ingredients: {}
                      };
                  }
              });

              profileData.groceryLists = groceryLists;

              // 4. Generate nutrition suggestions (mock data)
              profileData.nutritionSuggestions = {
                  protein: Math.round(0.8 * 70), // Example: 0.8g per kg of body weight
                  carbs: 250,
                  fat: 65,
                  calories: 2000
              };

              // 5. Get suggested recipes based on protein needs
              db.query(`
                  SELECT r.* FROM recipes r
                  WHERE r.protein BETWEEN ? AND ?
  AND r.recipe_id NOT IN (  /* Exclude already selected recipes */
      SELECT recipe_id FROM nutrition_selections 
      WHERE user_id = ?
  )
                  ORDER BY RAND()
                  LIMIT 3
              `, [
                  profileData.nutritionSuggestions.protein - 10,
                  profileData.nutritionSuggestions.protein + 10,
                  userId
              ], (err, suggestedRecipes) => {
                  if (err) {
                      console.error('Error fetching suggested recipes:', err);
                      return res.status(500).send('Error loading profile');
                  }

                  profileData.suggestedRecipes = suggestedRecipes;

                  // Finally render the profile page with all data
                  res.render('profile', profileData);
              });
          });
      });
  });
});


// Get all user activity
router.get('/activity', ensureAuthenticated, (req, res) => {
  db.query(`
    SELECT a.*, r.name, r.image_url 
    FROM user_activity a
    JOIN recipes r ON a.recipe_id = r.recipe_id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `, [req.user.user_id], (err, activities) => {
    if (err) {
      console.error('Activity fetch error:', err);
      return res.status(500).render('error', { 
        message: 'Error loading activity history' 
      });
    }

    res.render('activityHistory', {
      user: req.user,
      activities,
      currentPage: 'profile'
    });
  });
});



module.exports = router;