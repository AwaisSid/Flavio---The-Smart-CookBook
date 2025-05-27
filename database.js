const mysql = require('mysql2');

// Keep your existing connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'awaisCr7',
  database: 'flaavio'
});

// Add promise wrapper to existing connection
db.promise = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Keep your pool but add promise wrapper
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'awaisCr7',
  database: 'flaavio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.promise = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Test connections
db.connect(err => {
  if (err) {
    console.error('Regular connection error:', err);
    process.exit(1);
  }
  console.log('✅ Regular DB connection established');
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Pool connection error:', err);
    process.exit(1);
  }
  console.log('✅ Connection pool ready');
  connection.release();
});

// Export both as before
module.exports = db;
module.exports.pool = pool;