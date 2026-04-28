const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ЕДИНАЯ БД бота в папке tgbot
const botDbPath = path.resolve(__dirname, 'bot.sqlite');
const mainDbPath = '/var/www/backend/database/database.sqlite';

if (!fs.existsSync(botDbPath)) {
  const dir = path.dirname(botDbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.closeSync(fs.openSync(botDbPath, 'w'));
}

const botDb = new Database(botDbPath);

function safeCb(cb, err, result) {
  if (typeof cb === 'function') cb(err || null, result);
}

function ensureSchema() {
  botDb.pragma('foreign_keys = ON');

  botDb.exec(`
    CREATE TABLE IF NOT EXISTS bot_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT DEFAULT 'ru',
      is_bot INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      site_user_id INTEGER,
      site_link_hash TEXT,
      site_linked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bot_users_telegram_id ON bot_users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_bot_users_site_user_id ON bot_users(site_user_id);
    CREATE INDEX IF NOT EXISTS idx_bot_users_site_link_hash ON bot_users(site_link_hash);

    CREATE TABLE IF NOT EXISTS bot_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      chat_id INTEGER NOT NULL,
      text TEXT,
      message_type TEXT DEFAULT 'text',
      is_bot_message INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(telegram_id) REFERENCES bot_users(telegram_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bot_messages_telegram_id ON bot_messages(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON bot_messages(created_at);

    CREATE TABLE IF NOT EXISTS bot_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      file_unique_id TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      file_path TEXT,
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(telegram_id) REFERENCES bot_users(telegram_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bot_files_telegram_id ON bot_files(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_bot_files_file_id ON bot_files(file_id);

    CREATE TABLE IF NOT EXISTS bot_orders_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      telegram_id INTEGER,
      order_number TEXT NOT NULL,
      status TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      order_date DATETIME NOT NULL,
      last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(telegram_id) REFERENCES bot_users(telegram_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bot_orders_cache_order_id ON bot_orders_cache(order_id);
    CREATE INDEX IF NOT EXISTS idx_bot_orders_cache_telegram_id ON bot_orders_cache(telegram_id);

    CREATE TABLE IF NOT EXISTS site_users (
      id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      login TEXT,
      email TEXT,
      role TEXT,
      role_level INTEGER DEFAULT 0,
      tg_link_hash TEXT,
      tg_linked_at DATETIME,
      tg_link_token_hash TEXT,
      tg_link_token_expires INTEGER,
      created_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_site_users_tg_link_token_hash ON site_users(tg_link_token_hash);

    CREATE TABLE IF NOT EXISTS site_orders (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      order_number TEXT NOT NULL,
      contacts TEXT,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      payment TEXT NOT NULL,
      order_date DATETIME NOT NULL,
      pages_count INTEGER DEFAULT 0,
      items TEXT,
      admin_comment TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_site_orders_user_id ON site_orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_site_orders_order_date ON site_orders(order_date);
  `);
}

function migrateFromMainDb() {
  if (!fs.existsSync(mainDbPath)) return;

  const mainDb = new Database(mainDbPath, { readonly: true, fileMustExist: false });
  try {
    const tables = mainDb.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users','orders')`
    ).all().map(r => r.name);

    if (!tables.includes('users') || !tables.includes('orders')) {
      return;
    }

    const users = mainDb.prepare(
      `SELECT id, first_name, last_name, login, email, role, role_level,
              tg_link_hash, tg_linked_at, tg_link_token_hash, tg_link_token_expires, created_at
       FROM users`
    ).all();

    const orders = mainDb.prepare(
      `SELECT id, user_id, order_number, contacts, total_amount, status, payment,
              order_date, pages_count, items, admin_comment
       FROM orders`
    ).all();

    const upsertUser = botDb.prepare(
      `INSERT INTO site_users (id, first_name, last_name, login, email, role, role_level, tg_link_hash, tg_linked_at, tg_link_token_hash, tg_link_token_expires, created_at)
       VALUES (@id, @first_name, @last_name, @login, @email, @role, @role_level, @tg_link_hash, @tg_linked_at, @tg_link_token_hash, @tg_link_token_expires, @created_at)
       ON CONFLICT(id) DO UPDATE SET
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         login = excluded.login,
         email = excluded.email,
         role = excluded.role,
         role_level = excluded.role_level,
         tg_link_hash = excluded.tg_link_hash,
         tg_linked_at = excluded.tg_linked_at,
         tg_link_token_hash = excluded.tg_link_token_hash,
         tg_link_token_expires = excluded.tg_link_token_expires,
         created_at = excluded.created_at`
    );

    const upsertOrder = botDb.prepare(
      `INSERT INTO site_orders (id, user_id, order_number, contacts, total_amount, status, payment, order_date, pages_count, items, admin_comment)
       VALUES (@id, @user_id, @order_number, @contacts, @total_amount, @status, @payment, @order_date, @pages_count, @items, @admin_comment)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         order_number = excluded.order_number,
         contacts = excluded.contacts,
         total_amount = excluded.total_amount,
         status = excluded.status,
         payment = excluded.payment,
         order_date = excluded.order_date,
         pages_count = excluded.pages_count,
         items = excluded.items,
         admin_comment = excluded.admin_comment`
    );

    const tx = botDb.transaction(() => {
      users.forEach((u) => upsertUser.run(u));
      orders.forEach((o) => upsertOrder.run(o));
    });

    tx();
  } catch (err) {
    console.error('❌ Ошибка миграции данных из основной БД:', err);
  } finally {
    mainDb.close();
  }
}

function initBotDatabase() {
  try {
    ensureSchema();
    migrateFromMainDb();
    console.log('✅ Единая база данных бота инициализирована');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
  }
}

const db = {
  refreshSiteCache(callback) {
    try {
      migrateFromMainDb();
      safeCb(callback);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  // === ПОЛЬЗОВАТЕЛИ ===
  saveUser(telegramUser, callback) {
    try {
      const { id, username, first_name, last_name, language_code, is_bot } = telegramUser;
      botDb.prepare(
        `INSERT INTO bot_users (telegram_id, username, first_name, last_name, language_code, is_bot, last_activity)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(telegram_id) DO UPDATE SET
           username = excluded.username,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           language_code = excluded.language_code,
           last_activity = CURRENT_TIMESTAMP`
      ).run(id, username, first_name, last_name, language_code, is_bot ? 1 : 0);
      safeCb(callback);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  getUser(telegramId, callback) {
    try {
      const row = botDb.prepare('SELECT * FROM bot_users WHERE telegram_id = ?').get(telegramId);
      safeCb(callback, null, row);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  linkSiteUser(telegramId, siteUserId, siteLinkHash, callback) {
    try {
      botDb.prepare(
        'UPDATE bot_users SET site_user_id = ?, site_link_hash = ?, site_linked_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'
      ).run(siteUserId, siteLinkHash, telegramId);
      safeCb(callback);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  // === СООБЩЕНИЯ ===
  saveMessage(telegramId, messageId, chatId, text, messageType = 'text', isBotMessage = false, callback) {
    try {
      botDb.prepare(
        `INSERT INTO bot_messages (telegram_id, message_id, chat_id, text, message_type, is_bot_message)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(telegramId, messageId, chatId, text, messageType, isBotMessage ? 1 : 0);
      safeCb(callback);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  // === ФАЙЛЫ ===
  saveFile(telegramId, fileData, callback) {
    try {
      const {
        file_id,
        file_unique_id,
        file_type,
        file_name = null,
        file_size = null,
        mime_type = null,
        file_path = null,
        caption = null
      } = fileData;

      botDb.prepare(
        `INSERT INTO bot_files (telegram_id, file_id, file_unique_id, file_type, file_name, file_size, mime_type, file_path, caption)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(telegramId, file_id, file_unique_id, file_type, file_name, file_size, mime_type, file_path, caption);
      safeCb(callback);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  // === ДАННЫЕ САЙТА (ИЗ ЛОКАЛЬНОЙ КОПИИ) ===
  getSiteOrders(siteUserId, callback) {
    try {
      const rows = botDb.prepare(
        `SELECT id, user_id, order_number, total_amount, status, payment, order_date, pages_count, items, admin_comment
         FROM site_orders
         WHERE user_id = ?
         ORDER BY order_date DESC`
      ).all(siteUserId);
      safeCb(callback, null, rows);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  getSiteUserById(siteUserId, callback) {
    try {
      const row = botDb.prepare(
        `SELECT id, first_name, last_name, login, email, role, role_level, tg_link_hash, tg_linked_at
         FROM site_users
         WHERE id = ?`
      ).get(siteUserId);
      safeCb(callback, null, row);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  getSiteOrderById(orderId, callback) {
    try {
      const row = botDb.prepare(
        `SELECT id, user_id, order_number, contacts, total_amount, status, payment, order_date, pages_count, items, admin_comment
         FROM site_orders
         WHERE id = ?`
      ).get(orderId);
      safeCb(callback, null, row);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  getSiteUserByLinkTokenHash(tokenHash, callback) {
    try {
      const row = botDb.prepare(
        `SELECT id, tg_link_token_expires
         FROM site_users
         WHERE tg_link_token_hash = ?`
      ).get(tokenHash);
      safeCb(callback, null, row);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  finalizeSiteLink(userId, linkHash, callback) {
    try {
      botDb.prepare(
        `UPDATE site_users
         SET tg_link_hash = ?, tg_linked_at = CURRENT_TIMESTAMP,
             tg_link_token_hash = NULL, tg_link_token_expires = NULL
         WHERE id = ?`
      ).run(linkHash, userId);
      safeCb(callback);
    } catch (err) {
      safeCb(callback, err);
    }
  },

  // === СТАТИСТИКА ===
  getStats(callback) {
    try {
      const row = botDb.prepare(
        `SELECT
           (SELECT COUNT(*) FROM bot_users) as total_users,
           (SELECT COUNT(*) FROM bot_users WHERE is_active = 1) as active_users,
           (SELECT COUNT(*) FROM bot_messages) as total_messages,
           (SELECT COUNT(*) FROM bot_files) as total_files,
           (SELECT COUNT(*) FROM bot_orders_cache) as cached_orders,
           (SELECT COUNT(*) FROM site_orders) as site_orders
        `
      ).get();
      safeCb(callback, null, row);
    } catch (err) {
      safeCb(callback, err);
    }
  }
};

const promiseDb = {
  refreshSiteCache: () => new Promise((resolve, reject) => {
    db.refreshSiteCache((err) => err ? reject(err) : resolve());
  }),

  saveUser: (telegramUser) => new Promise((resolve, reject) => {
    db.saveUser(telegramUser, (err) => err ? reject(err) : resolve());
  }),

  getUser: (telegramId) => new Promise((resolve, reject) => {
    db.getUser(telegramId, (err, row) => err ? reject(err) : resolve(row));
  }),

  linkSiteUser: (telegramId, siteUserId, siteLinkHash) => new Promise((resolve, reject) => {
    db.linkSiteUser(telegramId, siteUserId, siteLinkHash, (err) => err ? reject(err) : resolve());
  }),

  saveMessage: (telegramId, messageId, chatId, text, messageType, isBotMessage) => new Promise((resolve, reject) => {
    db.saveMessage(telegramId, messageId, chatId, text, messageType, isBotMessage, (err) => err ? reject(err) : resolve());
  }),

  saveFile: (telegramId, fileData) => new Promise((resolve, reject) => {
    db.saveFile(telegramId, fileData, (err) => err ? reject(err) : resolve());
  }),

  getSiteOrders: (siteUserId) => new Promise((resolve, reject) => {
    db.getSiteOrders(siteUserId, (err, rows) => err ? reject(err) : resolve(rows));
  }),

  getSiteUserById: (siteUserId) => new Promise((resolve, reject) => {
    db.getSiteUserById(siteUserId, (err, row) => err ? reject(err) : resolve(row));
  }),

  getSiteOrderById: (orderId) => new Promise((resolve, reject) => {
    db.getSiteOrderById(orderId, (err, row) => err ? reject(err) : resolve(row));
  }),

  getSiteUserByLinkTokenHash: (tokenHash) => new Promise((resolve, reject) => {
    db.getSiteUserByLinkTokenHash(tokenHash, (err, row) => err ? reject(err) : resolve(row));
  }),

  finalizeSiteLink: (userId, linkHash) => new Promise((resolve, reject) => {
    db.finalizeSiteLink(userId, linkHash, (err) => err ? reject(err) : resolve());
  }),

  getStats: () => new Promise((resolve, reject) => {
    db.getStats((err, row) => err ? reject(err) : resolve(row));
  })
};

db.promise = promiseDb;

module.exports = {
  botDb,
  initBotDatabase,
  db
};
