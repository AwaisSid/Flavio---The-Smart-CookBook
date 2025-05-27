const express = require('express');
const router = express.Router();
const db = require('../database');
const { ensureAuthenticated } = require('../auth');

// Helper function to wrap db.query in a promise
const queryPromise = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Helper function to process recipe data
const processRecipe = (recipe) => {
  try {
    return {
      ...recipe,
      ingredients: JSON.parse(recipe.ingredients),
      tags: JSON.parse(recipe.tags)
    };
  } catch (e) {
    console.error('Error parsing recipe data:', e);
    return {
      ...recipe,
      ingredients: [],
      tags: []
    };
  }
};

// Get discovery page with personalized recommendations
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get user preferences
    const preferences = req.user.preferences || {};
    
    // Get trending recipes (most viewed in last 7 days)
    const trending = await queryPromise(
      `SELECT r.*, COUNT(ua.recipe_id) as views 
       FROM recipes r
       LEFT JOIN user_activity ua ON r.recipe_id = ua.recipe_id 
         AND ua.action = 'viewed' 
         AND ua.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY r.recipe_id
       ORDER BY views DESC
       LIMIT 6`,
      []
    );

    // Get personalized recommendations
    const personalized = await queryPromise(
      `SELECT r.* FROM recipes r
       LEFT JOIN user_activity ua ON r.recipe_id = ua.recipe_id AND ua.user_id = ?
       WHERE (ua.recipe_id IS NULL OR ua.action != 'viewed')
       AND (r.cuisine = ? OR JSON_CONTAINS(r.tags, ?))
       ORDER BY RAND()
       LIMIT 6`,
      [
        req.user.user_id,
        preferences.cuisine || 'Italian',
        JSON.stringify(preferences.tags || ['easy'])
      ]
    );

    // Get recently added recipes
    const recent = await queryPromise(
      `SELECT * FROM recipes 
       ORDER BY created_at DESC 
       LIMIT 6`,
      []
    );

    res.render('recipeDiscovery', {
      user: req.user,
      trending: trending.map(processRecipe),
      personalized: personalized.map(processRecipe),
      recent: recent.map(processRecipe),
      currentPage: 'discover'
    });

  } catch (err) {
    console.error('Discovery error:', err);
    req.flash('error_msg', 'Error loading discovery page');
    res.redirect('/');
  }
});

module.exports = router;