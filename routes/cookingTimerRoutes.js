const express = require('express');
const router = express.Router();
const db = require('../database');
const { ensureAuthenticated } = require('../auth');

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// Render cooking timer page
// Get all recipes (no user_id filter)
router.get('/recipes', ensureAuthenticated, async (req, res) => {
  try {
    const [recipes] = await queryAsync(
      `SELECT recipe_id, name, image_url, time FROM recipes`
    );
    res.json(recipes);
  } catch (err) {
    console.error('Get recipes error:', err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// In your GET / route
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Active timers (still user-specific)
    const [activeTimers] = await queryAsync(
      `SELECT ct.*, r.name, r.image_url 
       FROM cooking_timers ct
       JOIN recipes r ON ct.recipe_id = r.recipe_id
       WHERE ct.user_id = ? AND ct.status IN ('running', 'paused')`,
      [req.user.user_id]
    );

    // Get all recipes (no user_id filter)
    const [recipes] = await queryAsync(
      `SELECT recipe_id, name, image_url, time FROM recipes`
    );

    res.render('cookingTimer', {
      user: req.user,
      activeTimers: activeTimers || [],
      recipes: recipes || [],
      currentPage: 'cookingTimer'
    });
  } catch (err) {
    console.error('Render cooking timer error:', err);
    req.flash('error_msg', 'Failed to load cooking timer');
    res.redirect('/');
  }
});

// Start or update timer
router.post('/start', ensureAuthenticated, async (req, res) => {
  try {
    const { recipeId, duration } = req.body;
    
    // Clear any existing timers for this recipe
    await queryAsync(
      `UPDATE cooking_timers SET status = 'completed' 
       WHERE user_id = ? AND recipe_id = ? AND status = 'running'`,
      [req.user.user_id, recipeId]
    );

    // Start new timer
    await queryAsync(
      `INSERT INTO cooking_timers (user_id, recipe_id, start_time, duration, status)
       VALUES (?, ?, NOW(), ?, 'running')`,
      [req.user.user_id, recipeId, duration]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Timer start error:', err);
    res.status(500).json({ success: false, error: 'Failed to start timer' });
  }
});

// Pause timer
router.post('/pause/:timerId', ensureAuthenticated, async (req, res) => {
  try {
    await queryAsync(
      `UPDATE cooking_timers SET status = 'paused' 
       WHERE timer_id = ? AND user_id = ?`,
      [req.params.timerId, req.user.user_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Timer pause error:', err);
    res.status(500).json({ success: false, error: 'Failed to pause timer' });
  }
});

// Resume timer
router.post('/resume/:timerId', ensureAuthenticated, async (req, res) => {
  try {
    await queryAsync(
      `UPDATE cooking_timers SET status = 'running', 
       start_time = NOW() - INTERVAL (duration - TIMESTAMPDIFF(SECOND, start_time, NOW())) SECOND
       WHERE timer_id = ? AND user_id = ?`,
      [req.params.timerId, req.user.user_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Timer resume error:', err);
    res.status(500).json({ success: false, error: 'Failed to resume timer' });
  }
});

// Stop timer
router.post('/stop/:timerId', ensureAuthenticated, async (req, res) => {
  try {
    // First get the timer details before stopping
    const [timer] = await queryAsync(
      `SELECT * FROM cooking_timers WHERE timer_id = ? AND user_id = ?`,
      [req.params.timerId, req.user.user_id]
    );
    
    if (timer.length === 0) {
      return res.status(404).json({ success: false, error: 'Timer not found' });
    }

    const elapsedSeconds = Math.floor((new Date() - new Date(timer[0].start_time)) / 1000);
    const completionTime = Math.min(elapsedSeconds, timer[0].duration);

    // Update timer status to completed and store completion time
    await queryAsync(
      `UPDATE cooking_timers 
       SET status = 'completed', 
           completion_time = ?,
           end_time = NOW()
       WHERE timer_id = ? AND user_id = ?`,
      [completionTime, req.params.timerId, req.user.user_id]
    );

    res.json({ 
      success: true,
      completionTime: formatTime(completionTime)
    });
  } catch (err) {
    console.error('Timer stop error:', err);
    res.status(500).json({ success: false, error: 'Failed to stop timer' });
  }
});

// Get active timers
router.get('/active', ensureAuthenticated, async (req, res) => {
  try {
      const [timers] = await queryAsync(
          `SELECT ct.*, r.name, r.image_url 
           FROM cooking_timers ct
           JOIN recipes r ON ct.recipe_id = r.recipe_id
           WHERE ct.user_id = ? AND ct.status IN ('running', 'paused')`,
          [req.user.user_id]
      );
      
      // Ensure we always return an array
      res.json(Array.isArray(timers) ? timers : []);
  } catch (err) {
      console.error('Get timers error:', err);
      res.status(500).json([]);
  }
});

// Get all recipes
router.get('/recipes', ensureAuthenticated, async (req, res) => {
  try {
    const [recipes] = await queryAsync(
      `SELECT recipe_id, name, image_url, time FROM recipes`
    );
    res.json(recipes || []);
  } catch (err) {
    console.error('Get recipes error:', err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Helper function to format time
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

module.exports = router;