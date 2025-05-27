const express = require('express');
const router = express.Router();
const db = require('../database');
const { ensureAuthenticated } = require('../auth');

// Helper functions
const parseJsonSafely = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try {
      const cleanStr = input.replace(/\\"/g, '"').replace(/^"|"$/g, '');
      const parsed = JSON.parse(cleanStr);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return input.split(',').map(item => item.trim()).filter(item => item);
    }
  }
  return [input];
};

const parseInstructions = (instructions) => {
  if (!instructions) return ['No instructions provided'];
  if (Array.isArray(instructions)) return instructions;
  if (typeof instructions === 'string') {
    const stepsByNumber = instructions.split(/(?=\d+\.)/g).filter(step => step.trim());
    if (stepsByNumber.length > 1) return stepsByNumber;
    return instructions.split('\n').filter(step => step.trim());
  }
  return ['Could not parse instructions'];
};

// Convert callback-style queries to promises
const queryPromise = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Validate recipe ID
const validateRecipeId = (id) => {
  const num = parseInt(id);
  return !isNaN(num) && num > 0;
};

// Get all recipes
router.get('/', ensureAuthenticated, (req, res) => {
  const { search, category } = req.query;
  let sql = `SELECT recipe_id, name, ingredients, instructions, cuisine, tags, image_url, time, difficulty 
             FROM recipes`;
  const whereClauses = [];
  const params = [];

  if (search) {
    whereClauses.push('(name LIKE ? OR ingredients LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    whereClauses.push('cuisine = ?');
    params.push(category);
  }

  if (whereClauses.length > 0) sql += ' WHERE ' + whereClauses.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching recipes:", err);
      req.flash('error_msg', 'Error loading recipes');
      return res.redirect('/');
    }
    
    const recipes = results.map(recipe => ({
      ...recipe,
      ingredients: parseJsonSafely(recipe.ingredients),
      tags: parseJsonSafely(recipe.tags),
      instructions: parseInstructions(recipe.instructions)
    }));
    
    res.render('recipes', { 
      user: req.user,
      recipes,
      currentPage: 'recipes',
      searchQuery: search,
      category
    });
  });
});

// Get single recipe
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const recipeId = req.params.id;
    
    // Validate recipe ID
    if (!validateRecipeId(recipeId)) {
      req.flash('error_msg', 'Invalid recipe ID');
      return res.redirect('/recipes');
    }

    console.log(`Fetching recipe ID: ${recipeId}`);

    // Track view
    await queryPromise(
      `INSERT INTO user_activity (user_id, recipe_id, action, created_at)
       VALUES (?, ?, 'viewed', NOW())
       ON DUPLICATE KEY UPDATE created_at = NOW()`,
      [req.user.user_id, recipeId]
    );

    // Get recipe
    const [recipe] = await queryPromise('SELECT * FROM recipes WHERE recipe_id = ?', [recipeId]);
    if (!recipe) {
      req.flash('error_msg', 'Recipe not found');
      return res.redirect('/recipes');
    }

    // Get recommendations
    const recommendations = await queryPromise(
      `SELECT recipe_id, name, image_url FROM recipes 
       WHERE recipe_id != ? 
       ORDER BY RAND() LIMIT 4`,
      [recipeId]
    );

    res.render('recipeDetail', {
      recipe: {
        ...recipe,
        ingredients: parseJsonSafely(recipe.ingredients),
        instructions: parseInstructions(recipe.instructions),
        tags: parseJsonSafely(recipe.tags)
      },
      recommendations,
      user: req.user,
      currentPage: 'recipes'
    });

  } catch (err) {
    console.error('Error loading recipe:', err);
    req.flash('error_msg', 'Error loading recipe');
    res.redirect('/recipes');
  }
});

// Track view (API endpoint)
router.post('/:id/track-view', ensureAuthenticated, (req, res) => {
  const { id } = req.params;
  
  // Validate ID
  if (!validateRecipeId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid recipe ID' });
  }

  db.query(
    `INSERT INTO user_activity (user_id, recipe_id, action, created_at)
     VALUES (?, ?, 'viewed', NOW())
     ON DUPLICATE KEY UPDATE created_at = NOW()`,
    [req.user.user_id, id],
    (err) => {
      if (err) {
        console.error('Error tracking view:', err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    }
  );
});



// router.post('/track-activity', ensureAuthenticated, (req, res) => {
//   const { recipeId, action } = req.body;
  
//   // Validate action
//   const validActions = ['viewed', 'saved', 'liked', 'cooked'];
//   if (!validActions.includes(action)) {
//     return res.status(400).json({ 
//       success: false, 
//       error: 'Invalid action type' 
//     });
//   }
  
//   // Check if recipe exists
//   db.query(
//     'SELECT recipe_id FROM recipes WHERE recipe_id = ?',
//     [recipeId],
//     (err, recipeResults) => {
//       if (err) {
//         console.error('Database error:', err);
//         return res.status(500).json({ 
//           success: false, 
//           error: 'Database error' 
//         });
//       }
      
//       if (recipeResults.length === 0) {
//         return res.status(404).json({ 
//           success: false, 
//           error: 'Recipe not found' 
//         });
//       }
      
//       // Check if activity already exists
//       db.query(
//         `SELECT activity_id FROM user_activity 
//          WHERE user_id = ? AND recipe_id = ?`,
//         [req.user.user_id, recipeId],
//         (err, activityResults) => {
//           if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ 
//               success: false, 
//               error: 'Database error' 
//             });
//           }
          
//           if (activityResults.length > 0) {
//             // Update existing activity
//             db.query(
//               `UPDATE user_activity 
//                SET action = ?, created_at = NOW()
//                WHERE activity_id = ?`,
//               [action, activityResults[0].activity_id],
//               (err) => {
//                 if (err) {
//                   console.error('Database error:', err);
//                   return res.status(500).json({ 
//                     success: false, 
//                     error: 'Failed to update activity' 
//                   });
//                 }
//                 res.json({ success: true });
//               }
//             );
//           } else {
//             // Insert new activity
//             db.query(
//               `INSERT INTO user_activity 
//                (user_id, recipe_id, action, created_at)
//                VALUES (?, ?, ?, NOW())`,
//               [req.user.user_id, recipeId, action],
//               (err) => {
//                 if (err) {
//                   console.error('Database error:', err);
//                   return res.status(500).json({ 
//                     success: false, 
//                     error: 'Failed to track activity' 
//                   });
//                 }
//                 res.json({ success: true });
//               }
//             );
//           }
//         }
//       );
//     }
//   );
// });

// // Add to userRoutes.js
// router.get('/check-activity', ensureAuthenticated, (req, res) => {
//   const { recipeId } = req.query;
  
//   db.query(
//     `SELECT action FROM user_activity 
//      WHERE user_id = ? AND recipe_id = ?`,
//     [req.user.user_id, recipeId],
//     (err, results) => {
//       if (err) {
//         console.error('Database error:', err);
//         return res.status(500).json({ 
//           success: false, 
//           error: 'Database error' 
//         });
//       }
      
//       res.json({ 
//         success: true, 
//         action: results.length > 0 ? results[0].action : null 
//       });
//     }
//   );
// });


// Add this new route (place it with your other API endpoints)
// Add this route to your recipeRoutes.js
// Like a recipe
router.post('/like-recipe', ensureAuthenticated, async (req, res) => {
  try {
    const { recipeId } = req.body;
    const userId = req.user.user_id;

    // Check if recipe exists
    const [recipe] = await queryPromise(
      'SELECT recipe_id FROM recipes WHERE recipe_id = ?', 
      [recipeId]
    );
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Check if already liked
    const [existing] = await queryPromise(
      `SELECT activity_id FROM user_activity 
       WHERE user_id = ? AND recipe_id = ? AND action = 'liked'`,
      [userId, recipeId]
    );

    if (existing) {
      await queryPromise(
        'DELETE FROM user_activity WHERE activity_id = ?',
        [existing.activity_id]
      );
      res.json({ isLiked: false, success: true });
    } else {
      await queryPromise(
        `INSERT INTO user_activity 
         (user_id, recipe_id, action, created_at)
         VALUES (?, ?, 'liked', NOW())`,
        [userId, recipeId]
      );
      res.json({ isLiked: true, success: true });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check like status
router.get('/check-like/:recipeId', ensureAuthenticated, async (req, res) => {
  try {
    const { recipeId } = req.params;
    const [like] = await queryPromise(
      `SELECT activity_id FROM user_activity 
       WHERE user_id = ? AND recipe_id = ? AND action = 'liked'`,
      [req.user.user_id, recipeId]
    );
    res.json({ isLiked: !!like });
  } catch (err) {
    console.error('Check like error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;