const express = require('express');
const db = require('../database');
const router = express.Router();


// Get user's favorite recipes
// Helper function to normalize tags
function normalizeTags(tags) {
    if (!tags) return [];
    
    // If already an array, return as is
    if (Array.isArray(tags)) return tags;
    
    // If it's a string that looks like JSON array
    if (typeof tags === 'string' && tags.trim().startsWith('[')) {
        try {
            return JSON.parse(tags);
        } catch (e) {
            // If JSON parsing fails, continue to other formats
        }
    }
    
    // If it's a comma-separated string
    if (typeof tags === 'string') {
        return tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    // If all else fails, return empty array
    return [];
}

// Get user's favorite recipes
router.get('/', (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    const userId = req.user.user_id;
    
    db.query(`
        SELECT r.* 
        FROM recipes r
        JOIN user_activity ua ON r.recipe_id = ua.recipe_id
        WHERE ua.user_id = ? AND ua.action = 'liked'
        ORDER BY ua.created_at DESC
    `, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching favorites:', error);
            return res.status(500).send('Internal Server Error');
        }

        // Process recipes to normalize tags
        const recipes = results.map(recipe => {
            return {
                ...recipe,
                tags: normalizeTags(recipe.tags)
            };
        });

        res.render('favourites', { 
            title: 'My Favorites',
            recipes: recipes,
            user: req.user
        });
    });
});

// Remove from favorites (keep the same as before)
router.post('/remove/:recipeId', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.user.user_id;
    const recipeId = req.params.recipeId;
    
    db.query(`
        DELETE FROM user_activity 
        WHERE user_id = ? AND recipe_id = ? AND action = 'liked'
    `, [userId, recipeId], (error, results) => {
        if (error) {
            console.error('Error removing favorite:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        res.json({ success: true });
    });
});

module.exports = router;