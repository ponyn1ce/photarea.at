// db/init.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Safer defaults
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            login TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            verification_code TEXT,
            verification_expires INTEGER,
            is_verified INTEGER DEFAULT 0,
            role_level INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            thread_id INTEGER,
            sender TEXT NOT NULL,
            message TEXT,
            file_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS support_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            order_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_support_threads_user_id ON support_threads(user_id)`);

    // Ensure support_threads.order_id exists (for older DBs), then create index
    db.all(`PRAGMA table_info(support_threads)`, (err, rows) => {
        if (err) return;
        const cols = (rows || []).map(r => r.name);

        const ensureIndex = () => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_support_threads_order_id ON support_threads(order_id)`);
        };

        if (!cols.includes('order_id')) {
            db.run(`ALTER TABLE support_threads ADD COLUMN order_id INTEGER`, (e2) => {
                if (e2 && !String(e2.message || '').includes('duplicate column')) {
                    console.error('ALTER support_threads.order_id failed', e2);
                    return;
                }
                ensureIndex();
            });
        } else {
            ensureIndex();
        }
    });

    function backfillSupportThreads() {
        db.all(
            `SELECT DISTINCT user_id FROM support_messages WHERE thread_id IS NULL OR thread_id = 0`,
            (err, rows) => {
                if (err) return;
                const userIds = (rows || []).map(r => r.user_id).filter(Boolean);
                let i = 0;

                const next = () => {
                    if (i >= userIds.length) return;
                    const userId = userIds[i++];

                    db.get(
                        `SELECT id FROM support_threads WHERE user_id = ? ORDER BY id ASC LIMIT 1`,
                        [userId],
                        (err2, tRow) => {
                            if (err2) return next();

                            const useThread = (threadId) => {
                                db.run(
                                    `UPDATE support_messages
                                     SET thread_id = ?
                                     WHERE user_id = ? AND (thread_id IS NULL OR thread_id = 0)`,
                                    [threadId, userId],
                                    () => next()
                                );
                            };

                            if (tRow && tRow.id) return useThread(tRow.id);

                            db.run(
                                `INSERT INTO support_threads (user_id, title) VALUES (?, ?)` ,
                                [userId, 'Основной чат'],
                                function (err3) {
                                    if (err3) return next();
                                    useThread(this.lastID);
                                }
                            );
                        }
                    );
                };

                next();
            }
        );
    }

    // Backward compatible migration: ensure support_messages has thread_id, then backfill
    db.all(`PRAGMA table_info(support_messages)`, (e, cols) => {
        if (e) return;
        const names = (cols || []).map(c => c.name);

        const afterEnsureThreadId = () => {
            // Create index only after column exists (older DBs may lack it)
            db.run(`CREATE INDEX IF NOT EXISTS idx_support_messages_thread_id ON support_messages(thread_id)`);
            backfillSupportThreads();
        };

        if (!names.includes('thread_id')) {
            db.run(`ALTER TABLE support_messages ADD COLUMN thread_id INTEGER`, (alterErr) => {
                // If something goes wrong, don't crash the whole app on boot.
                if (alterErr && !String(alterErr.message || '').includes('duplicate column')) {
                    console.error('ALTER support_messages.thread_id failed', alterErr);
                }
                afterEnsureThreadId();
            });
        } else {
            afterEnsureThreadId();
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            price TEXT NOT NULL,
            old_price TEXT,
            rating TEXT,
            reviews_count TEXT,
            description TEXT,
            images TEXT, -- JSON string of image URLs
            is_sale INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    `);

    // Orders (single DB, strong FK)
    db.run(`
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
            items TEXT,
            admin_comment TEXT, -- New column for manager comments
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date)`);

    // Ensure columns exist (for existing DBs) — add missing columns if necessary
    db.all(`PRAGMA table_info(users)`, (err, rows) => {
        if (err) return console.error('PRAGMA error', err);
        const cols = rows.map(r => r.name);
        if (!cols.includes('verification_code')) {
            db.run(`ALTER TABLE users ADD COLUMN verification_code TEXT`);
        }
        if (!cols.includes('verification_expires')) {
            db.run(`ALTER TABLE users ADD COLUMN verification_expires INTEGER`);
        }
        if (!cols.includes('login')) {
            // If login column missing, add it (may require manual migration in complex cases)
            db.run(`ALTER TABLE users ADD COLUMN login TEXT`);
        }
        if (!cols.includes('tg_link_hash')) {
            db.run(`ALTER TABLE users ADD COLUMN tg_link_hash TEXT`);
        }
        if (!cols.includes('tg_linked_at')) {
            db.run(`ALTER TABLE users ADD COLUMN tg_linked_at DATETIME`);
        }
        if (!cols.includes('tg_link_token_hash')) {
            db.run(`ALTER TABLE users ADD COLUMN tg_link_token_hash TEXT`);
        }
        if (!cols.includes('tg_link_token_expires')) {
            db.run(`ALTER TABLE users ADD COLUMN tg_link_token_expires INTEGER`);
        }
        const needsRole = !cols.includes('role');
        const needsRoleLevel = !cols.includes('role_level');

        function migrateRoles() {
            // One-time-ish migration: map legacy role text -> role_level
            // user:0, manager:1, admin:2
            // (safe to run repeatedly)
            db.run(`UPDATE users SET role_level = 2 WHERE role = 'admin' AND role_level != 2`);
            db.run(`UPDATE users SET role_level = 1 WHERE role = 'manager' AND role_level != 1`);
            db.run(`UPDATE users SET role_level = 0 WHERE (role IS NULL OR role = 'user') AND role_level IS NULL`);
        }

        // If we had to add columns, run migration after columns are present
        if (needsRoleLevel) {
            db.run(`ALTER TABLE users ADD COLUMN role_level INTEGER DEFAULT 0`, (e2) => {
                if (e2 && !String(e2.message || '').includes('duplicate column')) {
                    console.error('ALTER users.role_level failed', e2);
                    return;
                }
                if (needsRole) {
                    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (e3) => {
                        if (e3 && !String(e3.message || '').includes('duplicate column')) {
                            console.error('ALTER users.role failed', e3);
                            return;
                        }
                        migrateRoles();
                    });
                } else {
                    migrateRoles();
                }
            });
        } else if (needsRole) {
            db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (e2) => {
                if (e2 && !String(e2.message || '').includes('duplicate column')) {
                    console.error('ALTER users.role failed', e2);
                    return;
                }
                migrateRoles();
            });
        } else {
            migrateRoles();
        }

        // Индексы для скрытой привязки Telegram
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_tg_link_hash ON users(tg_link_hash)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_tg_link_token_hash ON users(tg_link_token_hash)`);
    });

    db.all(`PRAGMA table_info(orders)`, (err, rows) => {
        if(err) return;
        const cols = rows.map(r => r.name);
        if(!cols.includes('admin_comment')) {
             db.run(`ALTER TABLE orders ADD COLUMN admin_comment TEXT`);
        }
        if(!cols.includes('items')) {
             db.run(`ALTER TABLE orders ADD COLUMN items TEXT`);
        }
    });

    // (orders are stored in the main DB; no ATTACH needed)

    // Seed products if empty
    db.get("SELECT count(*) as count FROM products", (err, row) => {
        if (err) return console.error(err);
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO products (title, price, old_price, rating, reviews_count, description, images, is_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            
            // Product 1
            stmt.run(
                "Альбом Простой", 
                "99€", 
                "2.400€", 
                "4.7", 
                "5 806 отзывов", 
                "Тёплые галоши непромокаемые.", 
                JSON.stringify(['/photo/photo_2026-01-04_17-44-36.jpg', '/photo/photo_2026-01-04_17-44-38.jpg', '/photo/photo_2026-01-04_17-44-41.jpg']), 
                1
            );

            // Product 2
            stmt.run(
                "Альбом не простой а крутой очень классный купи пожалуйста", 
                "208 ₽", 
                "915.999.999.999 ₽", 
                "1.7", 
                "2 255000 отзывов", 
                "Галоши флисовые тёплые непромокаемые.", 
                JSON.stringify(['/photo/photo_2026-01-04_18-20-48.jpg', '/photo/photo_2026-01-04_17-46-37.jpg']), 
                1
            );
            
            stmt.finalize();
            console.log("Products seeded");
        }
    });
});

module.exports = db;
