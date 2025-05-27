const express = require('express');
const router = express.Router();
const db = require('../database'); // Import your database connection

// Render homepage with recipes from database
router.get('/', (req, res) => {
  const sql = "SELECT recipe_id, name FROM recipes"; // Adjust this if needed based on your schema
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching recipes:", err);
      return res.status(500).send("Database error");
    }
    
    // Render the 'index.ejs' file, passing the user and the fetched recipes
    res.render('index', { user: req.user, recipes: results , currentPage: 'home', });
  });
});

module.exports = router;
