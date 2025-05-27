const express = require('express');
const router = express.Router();
const db = require('../database');
const { ensureAuthenticated } = require('../auth');

// Simple random recommendations with all required fields
router.get('/', ensureAuthenticated, (req, res) => {
  const userId = req.user.user_id;
  const limit = 6; // Always show 6 recommendations
  
  db.query(`
    SELECT 
      recipe_id, 
      name, 
      image_url,
      time,
      cuisine,
      difficulty,
      calories,
      protein,
      carbs,
      fat
    FROM recipes
    WHERE recipe_id NOT IN (
      SELECT recipe_id FROM user_activity 
      WHERE user_id = ? AND action = 'viewed'
    )
    ORDER BY RAND()
    LIMIT ?
  `, [userId, limit], (err, recommendations) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error loading recommendations');
    }
    
    res.render('reciperecommendation', {
      recommendations: recommendations || [],
      currentPage: 'recommendations'
    });
  });
});

// Recipe quick-preview endpoint with all fields
router.get('/preview/:id', ensureAuthenticated, (req, res) => {
  const recipeId = req.params.id;
  
  db.query(`
    SELECT 
      recipe_id, 
      name, 
      image_url,
      time,
      difficulty,
      calories,
      protein,
      carbs,
      fat
    FROM recipes
    WHERE recipe_id = ?
  `, [recipeId], (err, results) => {
    if (err || !results.length) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json(results[0]);
  });
});

module.exports = router;