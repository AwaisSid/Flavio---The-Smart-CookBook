const express = require('express');
const router = express.Router();
const db = require('../database');
const { ensureAuthenticated } = require('../auth');

// Get current grocery list
router.get('/', ensureAuthenticated, (req, res) => {
  db.query(
    `SELECT * FROM grocery_lists 
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 1`, // Get only the most recent list
    [req.user.user_id],
    (err, groceryLists) => {
      if (err) {
        console.error('Grocery list error:', err);
        req.flash('error_msg', 'Error loading grocery lists');
        return res.redirect('/planner');
      }

      // Get nutrition selections for recipe names
      db.query(
        `SELECT recipe_name FROM nutrition_selections 
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.user.user_id],
        (err, nutritionSelections) => {
          if (err) {
            console.error('Nutrition selections error:', err);
            nutritionSelections = [];
          }

          // Safely parse ingredients
          let ingredients = {};
          let listId = null;
          
          if (groceryLists.length > 0) {
            try {
              listId = groceryLists[0].list_id;
              ingredients = typeof groceryLists[0].ingredients === 'string' 
                ? JSON.parse(groceryLists[0].ingredients) 
                : groceryLists[0].ingredients || {};
            } catch (e) {
              console.error('Error parsing ingredients:', e);
              ingredients = {};
            }
          }

          // Get unique recipe names
          const recipeNames = [...new Set(nutritionSelections.map(s => s.recipe_name))];

          res.render('groceryList', {
            user: req.user,
            listId,
            ingredients: Object.entries(ingredients),
            recipeNames,
            currentPage: 'grocery'
          });
        }
      );
    }
  );
});

// Generate new grocery list
router.post('/generate', ensureAuthenticated, (req, res) => {
  db.query(
    `SELECT recipe_id FROM nutrition_selections 
     WHERE user_id = ?`,
    [req.user.user_id],
    (err, selections) => {
      if (err) return handleError(res, err);
      
      if (!selections?.length) {
        return res.status(404).json({ 
          success: false, 
          error: 'No recipes selected' 
        });
      }

      const recipeIds = selections.map(s => s.recipe_id);
      
      db.query(
        `SELECT ingredients FROM recipes WHERE recipe_id IN (?)`,
        [recipeIds],
        (err, recipes) => {
          if (err) return handleError(res, err);

          let allIngredients = [];
          recipes.forEach(recipe => {
            try {
              const ingredients = typeof recipe.ingredients === 'string' 
                ? JSON.parse(recipe.ingredients) 
                : recipe.ingredients || [];
              if (Array.isArray(ingredients)) {
                allIngredients = [...allIngredients, ...ingredients];
              }
            } catch (e) {
              console.error('Error parsing ingredients:', e);
            }
          });

          const ingredientCount = {};
          allIngredients.forEach(ingredient => {
            if (ingredient) {
              ingredientCount[ingredient] = (ingredientCount[ingredient] || 0) + 1;
            }
          });

          db.query(
            `INSERT INTO grocery_lists (user_id, ingredients, created_at)
             VALUES (?, ?, NOW())`,
            [req.user.user_id, JSON.stringify(ingredientCount)],
            (err, result) => {
              if (err) return handleError(res, err);
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// New PUT /update-quantity route
router.put('/update-quantity/:listId', ensureAuthenticated, (req, res) => {
  const { listId } = req.params;
  const { ingredient, quantity } = req.body;

  db.query(
    `SELECT ingredients FROM grocery_lists 
     WHERE list_id = ? AND user_id = ?`,
    [listId, req.user.user_id],
    (err, results) => {
      if (err || !results?.length) {
        return res.status(404).json({ 
          success: false, 
          error: 'List not found' 
        });
      }

      let ingredients = {};
      try {
        ingredients = JSON.parse(results[0].ingredients) || {};
      } catch (e) {
        console.error('Error parsing ingredients:', e);
      }

      if (quantity > 0) {
        ingredients[ingredient] = quantity;
      } else {
        delete ingredients[ingredient];
      }

      db.query(
        `UPDATE grocery_lists SET ingredients = ? 
         WHERE list_id = ? AND user_id = ?`,
        [JSON.stringify(ingredients), listId, req.user.user_id],
        (err) => {
          if (err) return handleError(res, err);
          res.json({ success: true });
        }
      );
    }
  );
});

function handleError(res, err) {
  console.error(err);
  return res.status(500).json({ 
    success: false, 
    error: 'Database error' 
  });
}

// Update grocery list item
router.post('/update/:id', ensureAuthenticated, (req, res) => {
  const { ingredient, quantity } = req.body;
  
  db.query(
    'SELECT * FROM grocery_lists WHERE list_id = ? AND user_id = ?',
    [req.params.id, req.user.user_id],
    (err, results) => {
      if (err || !results || results.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'List not found' 
        });
      }

      const list = results[0];
      let ingredients = {};
      
      try {
        ingredients = list.ingredients ? JSON.parse(list.ingredients) : {};
      } catch (e) {
        console.error('Error parsing ingredients:', e);
        ingredients = {};
      }

      if (quantity > 0) {
        ingredients[ingredient] = quantity;
      } else {
        delete ingredients[ingredient];
      }

      db.query(
        'UPDATE grocery_lists SET ingredients = ? WHERE list_id = ?',
        [JSON.stringify(ingredients), req.params.id],
        (err) => {
          if (err) {
            console.error('Update error:', err);
            return res.status(500).json({ 
              success: false, 
              error: 'Failed to update list' 
            });
          }

          res.json({ success: true });
        }
      );
    }
  );
});

module.exports = router;