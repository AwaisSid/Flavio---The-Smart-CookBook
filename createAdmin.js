const bcrypt = require('bcryptjs');
const db = require('./database');

const username = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!username || !email || !password) {
  console.log('Usage: node createAdmin.js <username> <email> <password>');
  process.exit(1);
}

bcrypt.genSalt(10, (err, salt) => {
  if (err) {
    console.error('Error generating salt:', err);
    process.exit(1);
  }

  bcrypt.hash(password, salt, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      process.exit(1);
    }

    db.query(
      'INSERT INTO admins (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      (err, results) => {
        if (err) {
          console.error('Error creating admin:', err);
          process.exit(1);
        }
        console.log(`Admin created successfully with ID: ${results.insertId}`);
        process.exit(0);
      }
    );
  });
});