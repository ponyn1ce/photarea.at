// Run: node database/migrate-orders-db.js
// Ensures the `orders` table exists in the main SQLite DB (database.sqlite).

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const mainDbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(mainDbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(
    `
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_number TEXT NOT NULL UNIQUE,
      contacts TEXT,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      payment TEXT NOT NULL,
      order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      pages_count INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
    (err) => {
      if (err) {
        console.error('Create table failed:', err);
        process.exitCode = 1;
        db.close();
        return;
      }

      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date)`);

      console.log('OK: orders table is ready in', mainDbPath);
      db.close();
    }
  );
});
