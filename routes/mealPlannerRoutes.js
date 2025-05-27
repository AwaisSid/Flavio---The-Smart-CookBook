const express = require('express');
const router = express.Router();
const db = require('../database');

// Get meal planner for a user
router.get('/:user_id', async (req, res) => {
  const user_id = req.params.user_id;
  
  try {
      const [mealPlans] = await db.query(
          "SELECT * FROM meal_plans WHERE user_id = ? ORDER BY FIELD(plan_day, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')",
          [user_id]
      );

      const [recipes] = await db.query("SELECT * FROM recipes");

      res.render('mealPlanner', { user_id, mealPlans, recipes });

  } catch (error) {
      console.error(error);
      res.status(500).send("Error loading meal planner.");
  }
});

// 📌 Route: Add Meal to Plan
router.post('/add', async (req, res) => {
  const { user_id, meal_type, recipe_id, plan_day } = req.body;

  if (!user_id || !meal_type || !recipe_id || !plan_day) {
      return res.status(400).send("Missing required fields.");
  }

  try {
      const [recipe] = await db.query("SELECT name, image_url FROM recipes WHERE recipe_id = ?", [recipe_id]);

      if (recipe.length === 0) {
          return res.status(404).send("Recipe not found.");
      }

      await db.query(
          "INSERT INTO meal_plans (user_id, meal_type, recipe_id, recipe_name, recipe_image, plan_day, created_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
          [user_id, meal_type, recipe_id, recipe[0].name, recipe[0].image_url, plan_day]
      );

      res.redirect(`/meal-planner/${user_id}`);

  } catch (error) {
      console.error(error);
      res.status(500).send("Error adding meal to plan.");
  }
});

// 📌 Route: Delete Meal from Plan
router.post('/delete', async (req, res) => {
  const { meal_plan_id, user_id } = req.body;

  if (!meal_plan_id || !user_id) {
      return res.status(400).send("Missing required fields.");
  }

  try {
      await db.query("DELETE FROM meal_plans WHERE meal_plan_id = ?", [meal_plan_id]);

      res.redirect(`/meal-planner/${user_id}`);

  } catch (error) {
      console.error(error);
      res.status(500).send("Error deleting meal.");
  }
});

module.exports = router;

