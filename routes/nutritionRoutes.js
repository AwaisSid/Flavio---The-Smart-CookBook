const express = require('express');
const router = express.Router();
const db = require('../database');
const { ensureAuthenticated } = require('../auth');



// Render nutrition planner page
router.get('/planner', ensureAuthenticated, (req, res) => {
    res.render('nutritionPlanner', {
        user: req.user,
        currentPage: 'nutrition'
    });
});

// Render grocery list page
router.get('/grocery-list', ensureAuthenticated, (req, res) => {
    res.render('groceryList', {
        user: req.user,
        currentPage: 'grocery'
    });
});

// Get recipes by nutrition filter
// Get recipes by nutrition filter - UPDATED
router.get('/filter', ensureAuthenticated, (req, res) => {
    console.log('\n=== FILTER REQUEST ===');
    console.log('Headers:', req.headers);
    console.log('User:', req.user);
    console.log('Query:', req.query);
    
    const { nutrient, minValue, maxValue } = req.query;
    
    // Validate inputs
    if (!['protein', 'carbs', 'fat', 'calories'].includes(nutrient)) {
        console.log('Invalid nutrient type:', nutrient);
        return res.status(400).json({ 
            error: 'Invalid nutrient type',
            received: nutrient
        });
    }
    
    const min = parseInt(minValue) || 0;
    const max = parseInt(maxValue) || 9999;
    
    console.log(`Filtering ${nutrient} between ${min}-${max}`);
    
    // Test query with hardcoded values first
    const testQuery = false; // Set to true for testing
    if (testQuery) {
        console.log('Running test query with hardcoded values');
        return res.json([
            {
                recipe_id: 1,
                name: "Test Recipe",
                image_url: "/images/placeholder.jpg",
                time: "30 mins",
                difficulty: "Medium",
                protein: 25,
                carbs: 30,
                fat: 10,
                calories: 350
            }
        ]);
    }
    
    db.query(
        `SELECT recipe_id, name, image_url, time, difficulty, 
         protein, carbs, fat, calories 
         FROM recipes 
         WHERE ${nutrient} BETWEEN ? AND ?
         ORDER BY ${nutrient} DESC
         LIMIT 50`,
        [min, max],
        (err, recipes) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    error: 'Database error',
                    details: err.message
                });
            }
            
            console.log(`Found ${recipes.length} recipes`);
            if (recipes.length > 0) {
                console.log('Sample recipe:', recipes[0]);
            }
            
            res.json(recipes);
        }
    );
});

// Save selected recipes
router.post('/save-selected', ensureAuthenticated, (req, res) => {
    console.log('\n=== SAVE SELECTED REQUEST ===');
    console.log('User ID:', req.user.user_id);
    
    const { recipes } = req.body;
    
    // Validate input
    if (!Array.isArray(recipes)) {
        console.log('Invalid recipes data:', recipes);
        return res.status(400).json({ error: 'Invalid recipes data format' });
    }
    
    // Validate each recipe
    for (const recipe of recipes) {
        if (!recipe.recipe_id || isNaN(recipe.recipe_id)) {
            console.log('Invalid recipe:', recipe);
            return res.status(400).json({ 
                error: 'Invalid recipe data',
                details: `Missing or invalid recipe_id in recipe: ${JSON.stringify(recipe)}`
            });
        }
        
        // Ensure all required fields are present
        const requiredFields = ['name', 'protein', 'carbs', 'fat', 'calories'];
        for (const field of requiredFields) {
            if (recipe[field] === undefined) {
                console.log(`Missing field ${field} in recipe:`, recipe);
                return res.status(400).json({ 
                    error: 'Invalid recipe data',
                    details: `Missing ${field} in recipe`
                });
            }
        }
    }
    
    console.log(`Saving ${recipes.length} valid recipes for user ${req.user.user_id}`);
    
    // First clear previous selections for this user
    db.query(
        `DELETE FROM nutrition_selections WHERE user_id = ?`,
        [req.user.user_id],
        (err, result) => {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).json({ 
                    error: 'Database error',
                    details: err.message
                });
            }
            
            console.log(`Deleted ${result.affectedRows} previous selections`);
            
            // Insert new selections
            const values = recipes.map(recipe => [
                req.user.user_id,
                recipe.recipe_id,
                recipe.name,
                recipe.image_url,
                recipe.protein,
                recipe.carbs,
                recipe.fat,
                recipe.calories
            ]);
            
            if (values.length > 0) {
                db.query(
                    `INSERT INTO nutrition_selections 
                     (user_id, recipe_id, recipe_name, recipe_image, protein, carbs, fat, calories)
                     VALUES ?`,
                    [values],
                    (err, result) => {
                        if (err) {
                            console.error('Insert error:', err);
                            return res.status(500).json({ 
                                error: 'Database error',
                                details: err.message
                            });
                        }
                        
                        console.log(`Inserted ${result.affectedRows} records`);
                        res.json({ success: true });
                    }
                );
            } else {
                console.log('No recipes to insert');
                res.json({ success: true });
            }
        }
    );
});

// Get selected recipes
router.get('/selected', ensureAuthenticated, (req, res) => {
    db.query(
        `SELECT * FROM nutrition_selections WHERE user_id = ?`,
        [req.user.user_id],
        (err, recipes) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(recipes);
        }
    );
});

// Get grocery list ingredients
router.post('/grocery-ingredients', ensureAuthenticated, (req, res) => {
    const { recipeIds } = req.body;
    
    // Validate input
    if (!Array.isArray(recipeIds)) {
        return res.status(400).json({ error: 'Invalid recipe IDs' });
    }
    
    if (recipeIds.length === 0) {
        return res.json({ ingredients: {} });
    }
    
    // Create placeholders for the IN clause
    const placeholders = recipeIds.map(() => '?').join(',');
    
    db.query(
        `SELECT recipe_id, ingredients FROM recipes WHERE recipe_id IN (${placeholders})`,
        recipeIds,
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    error: 'Database error',
                    details: err.message 
                });
            }
            
            const ingredientsByRecipe = {};
            
            results.forEach(recipe => {
                try {
                    ingredientsByRecipe[recipe.recipe_id] = recipe.ingredients ? 
                        JSON.parse(recipe.ingredients) : [];
                } catch (e) {
                    console.error('Error parsing ingredients:', e);
                    ingredientsByRecipe[recipe.recipe_id] = [];
                }
            });
            
            res.json({ ingredients: ingredientsByRecipe });
        }
    );
});

module.exports = router;