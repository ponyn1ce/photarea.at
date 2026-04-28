const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');

const multer = require('multer');
const cors = require('cors'); // Import cors

// Load environment variables (production setups often keep .env under /var/www/backend/.env)
(() => {
  const candidates = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../backend/.env'),
  ];

  for (const p of candidates) {
    try {
      if (!p) continue;
      if (!fs.existsSync(p)) continue;
      dotenv.config({ path: p });
      console.log('[ENV] Loaded from', p);
      return;
    } catch (_) {
      // ignore and try next
    }
  }
  console.warn('[ENV] No .env file found in expected locations; relying on process.env');
})();

// IMPORTANT: require services that read process.env only AFTER dotenv is loaded.
const mailService = require('../backend/services/mail.service');
const tokenService = require('../backend/services/token.service');
const db = require('../database/init');

let supportThreadsHasOrderId = false;
let supportThreadsOrderIdChecked = false;
let supportThreadsOrderIdChecking = false;
const supportThreadsOrderIdWaiters = [];

function ensureSupportThreadsOrderIdColumn(cb) {
  if (supportThreadsOrderIdChecked) return cb && cb(null, supportThreadsHasOrderId);
  if (cb) supportThreadsOrderIdWaiters.push(cb);
  if (supportThreadsOrderIdChecking) return;
  supportThreadsOrderIdChecking = true;

  db.all('PRAGMA table_info(support_threads)', (err, cols) => {
    if (err) {
      supportThreadsOrderIdChecked = true;
      supportThreadsHasOrderId = false;
      supportThreadsOrderIdChecking = false;
      while (supportThreadsOrderIdWaiters.length) {
        try { supportThreadsOrderIdWaiters.shift()(null, supportThreadsHasOrderId); } catch (_) {}
      }
      return;
    }

    const names = (cols || []).map(c => c && c.name).filter(Boolean);
    const has = names.includes('order_id');

    const finalize = (hasCol) => {
      supportThreadsOrderIdChecked = true;
      supportThreadsHasOrderId = !!hasCol;
      supportThreadsOrderIdChecking = false;
      while (supportThreadsOrderIdWaiters.length) {
        try { supportThreadsOrderIdWaiters.shift()(null, supportThreadsHasOrderId); } catch (_) {}
      }
    };

    if (has) {
      // Ensure index exists (safe)
      db.run('CREATE INDEX IF NOT EXISTS idx_support_threads_order_id ON support_threads(order_id)', () => finalize(true));
      return;
    }

    db.run('ALTER TABLE support_threads ADD COLUMN order_id INTEGER', (e2) => {
      if (e2 && !String(e2.message || '').includes('duplicate column')) {
        console.error('ALTER support_threads.order_id failed', e2);
        return finalize(false);
      }
      db.run('CREATE INDEX IF NOT EXISTS idx_support_threads_order_id ON support_threads(order_id)', () => finalize(true));
    });
  });
}

// Kick off migration early (non-blocking)
ensureSupportThreadsOrderIdColumn();

function sendEmail(to, subject, text) {
  mailService.sendEmail(to, subject, text).catch(e => console.error(e));
}

const app = express();
app.use(cors()); // Enable CORS for Express

let server;
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

if (process.env.USE_INTERNAL_SSL === 'true' && sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  server = https.createServer(options, app);
  console.log('Chat Server initializing in HTTPS mode...');
  console.log('[SSL] key:', sslKeyPath);
  console.log('[SSL] cert:', sslCertPath);
} else {
  server = http.createServer(app);
  console.log('Chat Server initializing in HTTP mode...');
  console.log('[SSL] USE_INTERNAL_SSL:', process.env.USE_INTERNAL_SSL);
  console.log('[SSL] SSL_KEY_PATH:', sslKeyPath);
  console.log('[SSL] SSL_CERT_PATH:', sslCertPath);
}

const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json());

// Router is mounted twice:
// - at '/' for backward compatibility (direct :3001 access)
// - at '/support-chat' for production behind nginx (same-origin HTTPS)
const router = express.Router();
router.get('/ping', (req, res) => res.json({ ok: true }));

const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/support-chat/uploads', express.static(uploadsDir));

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = tokenService.verifyToken(token);
    req.userId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function loadUserRoleLevel(userId, cb) {
  db.get('SELECT role_level, role FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(null, 0);

    // Special legacy mapping: role='777' and role_level='ad777min' => admin
    const r = String(row.role ?? '');
    const rl = String(row.role_level ?? '');
    if (
      (r === '777' && rl === 'ad777min') ||
      (r === 'ad777min' && rl === '777') ||
      r === '777' ||
      r === 'ad777min' ||
      rl === '777' ||
      rl === 'ad777min'
    ) {
      return cb(null, 2);
    }

    const n = Number(row.role_level);
    cb(null, Number.isFinite(n) ? n : 0);
  });
}

function requireManager(req, res, next) {
  loadUserRoleLevel(req.userId, (err, lvl) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (Number(lvl) < 1) return res.status(403).json({ message: 'Forbidden' });
    req.roleLevel = lvl;
    next();
  });
}

function getOrCreateDefaultThread(userId, cb) {
  db.get(
    "SELECT id FROM support_threads WHERE user_id = ? ORDER BY id ASC LIMIT 1",
    [userId],
    (err, row) => {
      if (err) return cb(err);
      if (row && row.id) return cb(null, row.id);
      db.run(
        "INSERT INTO support_threads (user_id, title) VALUES (?, ?)",
        [userId, 'Основной чат'],
        function (err2) {
          if (err2) return cb(err2);
          // Ensure a lead-order exists for the newly created default thread.
          const tid = this.lastID;
          ensureUserOrder(userId, tid, () => cb(null, tid));
        }
      );
    }
  );
}

function ensureUserOwnsThread(userId, threadId, cb) {
  db.get('SELECT user_id FROM support_threads WHERE id = ? LIMIT 1', [threadId], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(null, false);
    cb(null, Number(row.user_id) === Number(userId));
  });
}

function ensureUserOrder(userId, threadId, orderDraft, cb) {
  if (typeof orderDraft === 'function') {
    cb = orderDraft;
    orderDraft = null;
  }

  // Only create chat-orders for regular users.
  loadUserRoleLevel(userId, (err, lvl) => {
    // REMOVED ADMIN CHECK to allow admins to test order creation
    // if (err || Number(lvl) > 0) return cb && cb();
    if (err) console.error('loadUserRoleLevel error', err);

    console.log('[ensureUserOrder] ensuring order for user', userId, 'thread', threadId);

    const tid = Number(threadId);
    if (!Number.isFinite(tid) || tid <= 0) {
        console.log('[ensureUserOrder] Invalid threadId', tid);
        return cb && cb();
    }

    // Prevent duplicates: if thread already has an order_id, don't create a new one.
    ensureSupportThreadsOrderIdColumn(() => {
      // Even if column couldn't be added, we still create order, but cannot attach it.
      const canAttach = supportThreadsHasOrderId;

      const readExisting = (done) => {
        if (!canAttach) return done(null, null);
        db.get('SELECT order_id FROM support_threads WHERE id = ? AND user_id = ? LIMIT 1', [tid, userId], (e0, row0) => {
          if (e0) return done(e0);
          done(null, row0 || null);
        });
      };

      readExisting((e0, row0) => {
        if (e0) return cb && cb();
        if (row0 && row0.order_id) return cb && cb();

        const draft = orderDraft && typeof orderDraft === 'object' ? orderDraft : {};
        const pagesCount = Number(draft.pages_count ?? draft.pages ?? 0);
        const itemsArr = Array.isArray(draft.items) ? draft.items : [];
        const itemsJson = JSON.stringify(itemsArr);

        const totalFromDraft = Number(draft.total_amount ?? draft.total ?? draft.amount ?? 0);
        const totalFromItems = itemsArr.reduce((sum, it) => {
          const qty = Number(it && (it.qty ?? it.quantity ?? 1));
          const price = Number(it && (it.price ?? it.unitPrice ?? 0));
          return sum + (Number.isFinite(qty) ? qty : 1) * (Number.isFinite(price) ? price : 0);
        }, 0);
        const totalAmount = Math.round(Number.isFinite(totalFromDraft) && totalFromDraft > 0 ? totalFromDraft : totalFromItems);

          const orderNumber = `ORD-${Date.now()}-${tid}`;
        const sqlInsert = `
           INSERT INTO orders (user_id, order_number, status, payment, total_amount, items, pages_count, order_date)
           VALUES (?, ?, 'unconfirmed', 'unpaid', ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        db.run(
          sqlInsert,
          [userId, orderNumber, Number.isFinite(totalAmount) ? totalAmount : 0, itemsJson, Number.isFinite(pagesCount) ? pagesCount : 0],
          function (err2) {
            if (err2) {
              console.error('Auto-order creation failed', err2);
              return cb && cb();
            }
            const newOrderId = this.lastID;
            console.log('[ensureUserOrder] Created order', newOrderId, orderNumber);
            if (!canAttach) {
                 console.log('[ensureUserOrder] Cannot attach order_id (column missing?)');
                 return cb && cb();
            }
            db.run('UPDATE support_threads SET order_id = ? WHERE id = ? AND user_id = ?', [newOrderId, tid, userId], (e3) => {
                if(e3) console.error('[ensureUserOrder] Attach error', e3);
                else console.log('[ensureUserOrder] Attached order', newOrderId, 'to thread', tid);
                cb && cb();
            });
          }
        );
      });
    });
  });
}

function findChatOrderByThread(threadId, threadUserId, cb) {
  const tid = Number(threadId);
  const uid = Number(threadUserId);
  if (!Number.isFinite(tid) || tid <= 0 || !Number.isFinite(uid) || uid <= 0) return cb(null, null);

  const likeChat = `CHAT-${tid}-%`;
  const likeOrd = `ORD-%-${tid}`;

  db.get(
    `SELECT id, user_id, order_number, status, payment, total_amount, pages_count, items, order_date, admin_comment
     FROM orders
     WHERE user_id = ?
       AND (order_number LIKE ? OR order_number LIKE ?)
     ORDER BY datetime(order_date) DESC, id DESC
     LIMIT 1`,
    [uid, likeChat, likeOrd],
    (err, row) => {
      if (err) return cb(err);
      if (!row) return cb(null, null);

      // Backfill support_threads.order_id when possible (so next time it's instant and deterministic)
      ensureSupportThreadsOrderIdColumn(() => {
        if (!supportThreadsHasOrderId) return cb(null, row);
        db.run(
          'UPDATE support_threads SET order_id = ? WHERE id = ? AND user_id = ? AND (order_id IS NULL OR order_id = 0)',
          [Number(row.id), tid, uid],
          () => cb(null, row)
        );
      });
    }
  );
}

function getOrderForThread(threadId, cb) {
  const tid = Number(threadId);
  if (!Number.isFinite(tid) || tid <= 0) return cb(null, null);

  ensureSupportThreadsOrderIdColumn(() => {
    const selectSql = supportThreadsHasOrderId
      ? 'SELECT user_id, order_id FROM support_threads WHERE id = ? LIMIT 1'
      : 'SELECT user_id FROM support_threads WHERE id = ? LIMIT 1';

    db.get(selectSql, [tid], (err, row) => {
      if (err) return cb(err);
      if (!row) return cb(null, null);

      const uid = Number(row.user_id);
      const oid = supportThreadsHasOrderId && row.order_id ? Number(row.order_id) : null;

      if (oid && Number.isFinite(oid) && oid > 0) {
        db.get(
          `SELECT id, user_id, order_number, status, payment, total_amount, pages_count, items, order_date, admin_comment
           FROM orders
           WHERE id = ? AND user_id = ?
           LIMIT 1`,
          [oid, uid],
          (e2, orderRow) => {
            if (e2) return cb(e2);
            if (orderRow) return cb(null, orderRow);
            return findChatOrderByThread(tid, uid, cb);
          }
        );
        return;
      }

      return findChatOrderByThread(tid, uid, cb);
    });
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});
const ONE_GB = 1024 * 1024 * 1024;

function isAllowedUpload(file) {
  const original = String(file && file.originalname ? file.originalname : '');
  const ext = path.extname(original).toLowerCase();
  const mimetype = String(file && file.mimetype ? file.mimetype : '').toLowerCase();

  // Images
  if (mimetype.startsWith('image/')) return true;

  // WinRAR archives (.rar) — browsers often send generic mimetypes
  if (ext === '.rar') return true;
  if (mimetype === 'application/vnd.rar') return true;
  if (mimetype === 'application/x-rar-compressed') return true;

  return false;
}

const upload = multer({
  storage,
  limits: {
    fileSize: ONE_GB,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedUpload(file)) return cb(null, true);
    cb(new Error('Unsupported file type'));
  }
});

router.post(
  '/upload',
  authMiddleware,
  upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'file', maxCount: 1 }, // backward compat
  ]),
  (req, res) => {
  const files = [];
  if (req.files && req.files.files && Array.isArray(req.files.files)) files.push(...req.files.files);
  if (req.files && req.files.file && Array.isArray(req.files.file)) files.push(...req.files.file);
  if (!files.length) return res.status(400).json({ message: 'No file(s)' });

  const bodyThread = req.body && (req.body.thread_id || req.body.threadId);
  const requestedThreadId = bodyThread ? Number(bodyThread) : null;

  const saveFileMessages = (threadId, ownerUserId, sender) => {
    const createdAt = new Date().toISOString();
    const uploaded = [];
    const stmt = `INSERT INTO support_messages (user_id, thread_id, sender, message, file_url) VALUES (?, ?, ?, ?, ?)`;

    let i = 0;
    const next = () => {
      if (i >= files.length) {
        return res.json({ thread_id: threadId, files: uploaded });
      }

      const f = files[i++];
      const fileUrl = `/support-chat/uploads/${f.filename}`;
      db.run(stmt, [ownerUserId, threadId, sender, null, fileUrl], function (err) {
        if (err) return res.status(500).json({ message: 'DB error' });
        const msg = { id: this.lastID, user_id: ownerUserId, thread_id: threadId, sender, file_url: fileUrl, created_at: createdAt };
        uploaded.push({ url: fileUrl, id: msg.id });
        io.to(`thread_${threadId}`).to('support_agents').emit('new_message', msg);
        next();
      });
    };

    next();
  };

  function socketSafeEmitMessageSent(threadId, url) {
    try {
      io.to(`thread_${threadId}`).emit('message_sent', { client_id: null, thread_id: threadId, message: null, file: { url } });
    } catch (_) {
      // ignore
    }
  }

  if (!requestedThreadId || !Number.isFinite(requestedThreadId) || requestedThreadId <= 0) {
    return res.status(400).json({ message: 'thread_id is required' });
  }

  db.get('SELECT user_id FROM support_threads WHERE id = ? LIMIT 1', [requestedThreadId], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!row) return res.status(404).json({ message: 'Thread not found' });

    const ownerId = Number(row.user_id);

    // If the uploader is the thread owner, always save as user (even if role_level is mis-set).
    if (Number(ownerId) === Number(req.userId)) {
      return saveFileMessages(requestedThreadId, req.userId, 'user');
    }

    // Otherwise, only managers/admins can upload as agent.
    loadUserRoleLevel(req.userId, (roleErr, lvl) => {
      if (roleErr) return res.status(500).json({ message: 'DB error' });
      if (Number(lvl) < 1) return res.status(403).json({ message: 'Forbidden' });
      saveFileMessages(requestedThreadId, ownerId, 'agent');
    });
  });
});

// Threads (user)
router.get('/orders-list', authMiddleware, (req, res) => {
  db.all(
    'SELECT id, order_number, status, total_amount FROM orders WHERE user_id = ? ORDER BY order_date DESC',
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      res.json({ orders: rows || [] });
    }
  );
});

// Compatibility alias for old frontends via /api/orders
router.get('/api/orders', authMiddleware, (req, res) => {
  // If no userId query param, return empty or handle differently?
  // Current requirement: expect userId for admin-like fetching or specific user fetching.
  const queryUserId = Number(req.query.userId);

  if (!Number.isFinite(queryUserId)) {
      return res.status(400).json({ orders: [] });
  }

  // Logic: return orders for that user
  db.all(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC',
    [queryUserId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      res.json({ orders: rows || [] });
    }
  );
});

// Compatibility alias for deployments where frontend uses /backend prefix.
// NOTE: this only works if nginx proxies /backend to this service.
router.get('/backend/api/orders', authMiddleware, (req, res) => {
  const queryUserId = Number(req.query.userId);

  if (!Number.isFinite(queryUserId)) {
    return res.status(400).json({ orders: [] });
  }

  db.all(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC',
    [queryUserId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error', orders: [] });
      res.json({ orders: rows || [] });
    }
  );
});

// Compatibility PATCH aliases for older admin UIs that updated orders via /api/orders/:id
function compatPatchOrder(req, res) {
  loadUserRoleLevel(req.userId, (err, lvl) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (Number(lvl) < 1) return res.status(403).json({ message: 'Forbidden' });

    const { status, admin_comment, payment, total_amount, pages_count } = req.body || {};
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(String(status));
    }
    if (admin_comment !== undefined) {
      updates.push('admin_comment = ?');
      params.push(admin_comment);
    }
    if (payment !== undefined) {
      updates.push('payment = ?');
      params.push(String(payment));
    }
    if (total_amount !== undefined) {
      updates.push('total_amount = ?');
      params.push(Number(total_amount));
    }
    if (pages_count !== undefined) {
      updates.push('pages_count = ?');
      params.push(Number(pages_count));
    }

    if (updates.length === 0) return res.json({ message: 'No changes' });

    const rawId = String(req.params.id || '');
    const dbId = Number(rawId.replace(/^ord_/, ''));
    if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: 'Invalid id' });

    const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
    params.push(dbId);

    db.run(sql, params, (e2) => {
      if (e2) return res.status(500).json({ message: 'DB error' });
      res.json({ message: 'Updated' });
    });
  });
}

router.patch('/api/orders/:id', authMiddleware, compatPatchOrder);
router.patch('/backend/api/orders/:id', authMiddleware, compatPatchOrder);

router.get('/threads', authMiddleware, (req, res) => {
  const isAdminMode = String((req.query && req.query.admin) || '') === '1';

  if (isAdminMode) {
    // Managers/admins can list all threads (needed when nginx doesn't proxy /admin/*).
    loadUserRoleLevel(req.userId, (err, lvl) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (Number(lvl) < 1) return res.status(403).json({ message: 'Forbidden' });

      const query = `
        SELECT 
          t.id as thread_id,
          t.user_id,
          u.login as user_login,
          u.first_name as user_first_name,
          u.last_name as user_last_name,
          u.email as user_email,
          u.role_level as user_role_level,
          u.role as user_role,
          u.created_at as user_created_at,
          t.title,
          t.status,
          t.created_at,
          (SELECT m.created_at FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_msg_time,
          (SELECT m.message FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
          (SELECT m.file_url FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_file
        FROM support_threads t
        JOIN users u ON u.id = t.user_id
        ORDER BY datetime(last_msg_time) DESC, t.id DESC
      `;

      db.all(query, (err2, rows) => {
        if (err2) return res.status(500).json({ message: 'DB error' });
        // Return array for admin UI convenience
        res.json(rows || []);
      });
    });
    return;
  }

  // Normal user mode: only own threads
  const q = `
    SELECT
      t.id,
      t.user_id,
      t.title,
      t.status,
      t.created_at,
      (SELECT m.created_at FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_msg_time,
      (SELECT m.message FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT m.file_url FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_file
    FROM support_threads t
    WHERE t.user_id = ?
    ORDER BY datetime(last_msg_time) DESC, t.id DESC
  `;
  db.all(q, [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json({ threads: rows || [] });
  });
});

router.post('/threads', authMiddleware, (req, res) => {
  const body = req.body || {};
  const title = String((body && body.title) || '').trim() || 'Новый чат';
  const reason = String(body.reason || '').trim();
  const orderId = body.order_id || body.orderId;
  const orderDraft = body.orderDraft || body.order_draft || null;

  db.run('INSERT INTO support_threads (user_id, title) VALUES (?, ?)', [req.userId, title], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    db.get('SELECT * FROM support_threads WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ message: 'DB error' });

      const threadId = row && row.id;

      // If chat is created to discuss an existing order, attach it.
      if (String(reason) === '2') {
        const oid = Number(orderId);
        if (!Number.isFinite(oid) || oid <= 0) {
          return res.status(400).json({ message: 'orderId required' });
        }
        db.get('SELECT id FROM orders WHERE id = ? AND user_id = ? LIMIT 1', [oid, req.userId], (e3, oRow) => {
          if (e3) return res.status(500).json({ message: 'DB error' });
          if (!oRow) return res.status(404).json({ message: 'Order not found' });

          ensureSupportThreadsOrderIdColumn(() => {
            if (!supportThreadsHasOrderId) {
              io.to('support_agents').emit('thread_created', row);
              return res.status(201).json({ thread: row });
            }
            db.run('UPDATE support_threads SET order_id = ? WHERE id = ? AND user_id = ?', [oid, threadId, req.userId], (e4) => {
              if (e4) return res.status(500).json({ message: 'DB error' });
              io.to('support_agents').emit('thread_created', row);
              res.status(201).json({ thread: row });
            });
          });
        });
        return;
      }

      // Default: create an "unconfirmed" order for this new chat, then notify agents.
      ensureUserOrder(req.userId, threadId, orderDraft, () => {
        io.to('support_agents').emit('thread_created', row);
        res.status(201).json({ thread: row });
      });
    });
  });
});

router.get('/threads/:threadId/messages', authMiddleware, (req, res) => {
  const threadId = Number(req.params.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) return res.status(400).json({ message: 'Invalid threadId' });

  const isAdminMode = String((req.query && req.query.admin) || '') === '1';
  if (isAdminMode) {
    loadUserRoleLevel(req.userId, (err, lvl) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (Number(lvl) < 1) return res.status(403).json({ message: 'Forbidden' });
      db.all('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC', [threadId], (err2, rows) => {
        if (err2) return res.status(500).json({ message: 'DB error' });
        res.json({ messages: rows || [] });
      });
    });
    return;
  }

  ensureUserOwnsThread(req.userId, threadId, (err, ok) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!ok) return res.status(403).json({ message: 'Forbidden' });
    db.all('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC', [threadId], (err2, rows) => {
      if (err2) return res.status(500).json({ message: 'DB error' });
      res.json({ messages: rows || [] });
    });
  });
});

router.get('/threads/:threadId/order', authMiddleware, (req, res) => {
  const threadId = Number(req.params.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) return res.status(400).json({ message: 'Invalid threadId' });

  const isAdminMode = String((req.query && req.query.admin) || '') === '1';

  const load = () => {
    getOrderForThread(threadId, (err2, order) => {
      if (err2) return res.status(500).json({ message: 'DB error' });
      res.json({ order: order || null });
    });
  };

  if (isAdminMode) {
    loadUserRoleLevel(req.userId, (err, lvl) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (Number(lvl) < 1) return res.status(403).json({ message: 'Forbidden' });
      db.get('SELECT user_id FROM support_threads WHERE id = ? LIMIT 1', [threadId], (err2, row) => {
        if (err2) return res.status(500).json({ message: 'DB error' });
        if (!row) return res.status(404).json({ message: 'Thread not found' });
        load();
      });
    });
    return;
  }

  ensureUserOwnsThread(req.userId, threadId, (err, ok) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!ok) return res.status(403).json({ message: 'Forbidden' });
    load();
  });
});

router.delete('/threads/:threadId', authMiddleware, (req, res) => {
  const threadId = Number(req.params.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) return res.status(400).json({ message: 'Invalid threadId' });

  loadUserRoleLevel(req.userId, (err, lvl) => {
    if (err) return res.status(500).json({ message: 'DB error' });

    // Only admins can delete chats
    const lStr = String(lvl ?? '');
    const isLegacyAdmin = lStr === '777' || lStr === 'ad777min';
    if (Number(lvl) < 2 && !isLegacyAdmin) return res.status(403).json({ message: 'Forbidden' });

    db.get('SELECT user_id FROM support_threads WHERE id = ? LIMIT 1', [threadId], (e0, row) => {
      if (e0) return res.status(500).json({ message: 'DB error' });
      if (!row) return res.status(404).json({ message: 'Thread not found' });

      const threadUserId = Number(row.user_id);
      getOrderForThread(threadId, (e1, order) => {
        if (e1) return res.status(500).json({ message: 'DB error' });

        const cancelThenDelete = () => {
          db.run('DELETE FROM support_messages WHERE thread_id = ?', [threadId], (e2) => {
            if (e2) return res.status(500).json({ message: 'DB error' });
            db.run('DELETE FROM support_threads WHERE id = ?', [threadId], (e3) => {
              if (e3) return res.status(500).json({ message: 'DB error' });
              io.to(`thread_${threadId}`).to('support_agents').emit('thread_deleted', { threadId, userId: threadUserId, orderId: order ? order.id : null });
              io.to(`user_${threadUserId}`).emit('thread_deleted', { threadId, userId: threadUserId, orderId: order ? order.id : null });
              res.json({ success: true, canceledOrderId: order ? order.id : null });
            });
          });
        };

        if (!order || !order.id) return cancelThenDelete();

        const note = 'Заказ отменен автоматически при удалении чата администратором.';
        db.run(
          `UPDATE orders
           SET status = 'canceled',
               admin_comment = CASE
                 WHEN admin_comment IS NULL OR admin_comment = '' THEN ?
                 ELSE admin_comment || char(10) || ?
               END
           WHERE id = ?`,
          [note, note, Number(order.id)],
          (e4) => {
            if (e4) return res.status(500).json({ message: 'DB error' });
            cancelThenDelete();
          }
        );
      });
    });
  });
});

// Backward compat for old clients: default thread messages
router.get('/messages', authMiddleware, (req, res) => {
  return res.status(410).json({ message: 'Deprecated. Use /threads/:threadId/messages' });
});

// Admin endpoints
router.get('/admin/threads', authMiddleware, requireManager, (req, res) => {
  const query = `
    SELECT 
      t.id as thread_id,
      t.user_id,
      t.title,
      t.status,
      t.created_at,
      (SELECT m.created_at FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_msg_time,
      (SELECT m.message FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT m.file_url FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_file
    FROM support_threads t
    ORDER BY datetime(last_msg_time) DESC, t.id DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows || []);
  });
});

router.get('/admin/conversations', authMiddleware, requireManager, (req, res) => {
  // alias
  const query = `
    SELECT 
      t.id as thread_id,
      t.user_id,
      t.title,
      t.status,
      t.created_at,
      (SELECT m.created_at FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_msg_time,
      (SELECT m.message FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT m.file_url FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_file
    FROM support_threads t
    ORDER BY datetime(last_msg_time) DESC, t.id DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows || []);
  });
});

router.get('/admin/threads/:threadId/messages', authMiddleware, requireManager, (req, res) => {
  const threadId = Number(req.params.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) return res.status(400).json({ message: 'Invalid threadId' });
  db.all('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC', [threadId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows || []);
  });
});

router.get('/admin/messages/:userId', authMiddleware, requireManager, (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ message: 'Invalid userId' });
  return res.status(410).json({ message: 'Deprecated. Use /admin/threads/:threadId/messages' });
});

router.get('/admin/orders/:userId', authMiddleware, requireManager, (req, res) => {
  const userId = req.params.userId;
  db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC', [userId], (err, rows) => {
    if(err) return res.status(500).json({message: 'DB error'});
    res.json(rows || []);
  });
});

router.patch('/admin/orders/:id', authMiddleware, requireManager, (req, res) => {
   const { status, admin_comment, payment, total_amount, pages_count } = req.body;
   const updates = [];
   const params = [];
   if(status) { updates.push('status = ?'); params.push(status); }
   if(admin_comment !== undefined) { updates.push('admin_comment = ?'); params.push(admin_comment); }
   if(payment !== undefined) { updates.push('payment = ?'); params.push(payment); }
   if(total_amount !== undefined) { updates.push('total_amount = ?'); params.push(Number(total_amount)); }
   if(pages_count !== undefined) { updates.push('pages_count = ?'); params.push(Number(pages_count)); }
   
   if(updates.length === 0) return res.json({message:'No changes'});
   
   const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
   params.push(req.params.id);
   
   db.run(sql, params, (err) => {
      if(err) return res.status(500).json({message: 'DB error'});
      res.json({message: 'Updated'});
   });
});

// Mount routes
app.use(router);
app.use('/support-chat', router);

// Upload error handling (multer)
app.use((err, req, res, next) => {
  if (!err) return next();

  // Multer file size limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large (limit 1GB per file)' });
  }

  if (String(err.message || '') === 'Unsupported file type') {
    return res.status(400).json({ message: 'Unsupported file type. Allowed: images, .rar' });
  }

  return next(err);
});

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const payload = tokenService.verifyToken(token);
    socket.userId = payload.id;
    loadUserRoleLevel(socket.userId, (err, lvl) => {
      if (err) return next(new Error('DB error'));
      socket.roleLevel = lvl;
      next();
    });
  } catch (e) {
    return next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.userId;
  console.log('Support chat connected:', uid, socket.id);
  console.log('New socket connected', socket.id, 'userId:', socket.userId, 'roleLevel:', socket.roleLevel);
  socket.join(`user_${uid}`);

  // join all user's thread rooms
  db.all('SELECT id FROM support_threads WHERE user_id = ?', [uid], (err, rows) => {
    if (!err && rows && rows.length) {
      rows.forEach(r => socket.join(`thread_${r.id}`));
    }
  });

  // agents: role >= 1
  if (socket.handshake.auth && socket.handshake.auth.agent && Number(socket.roleLevel) >= 1) {
    socket.join('support_agents');
  }

 socket.on('join_thread', (data) => {
  const tid = Number(data.thread_id);
  if (!Number.isFinite(tid)) return;

  // user
  if (socket.roleLevel < 1) {
    ensureUserOwnsThread(uid, tid, (err, ok) => {
      if (!err && ok) socket.join(`thread_${tid}`);
    });
  } 
  // agent
  else {
    socket.join(`thread_${tid}`);
  }
});
  socket.on('send_message', (data) => {
    const message = (data && data.message) || null;
    const clientId = (data && data.client_id) || null;
    const requestedThreadId = data && (data.thread_id || data.threadId);
    
    // Helper to save and emit
    const performSave = (tid) => {
      const stmt = `INSERT INTO support_messages (user_id, thread_id, sender, message) VALUES (?, ?, ?, ?)`;
      db.run(stmt, [uid, tid, 'user', message], function (err) {
        if (err) return console.error('DB save error', err);
        
        const saved = { 
            id: this.lastID, 
            user_id: uid, 
            thread_id: tid, 
            sender: 'user', 
            message, 
            created_at: new Date().toISOString() 
        };
        
        // Unified emit to both rooms (chained to prevent duplicate events for overlapping sockets)
        io.to(`thread_${tid}`).to('support_agents').emit('new_message', saved);
        
        // Ack to sender
        socket.emit('message_sent', { client_id: clientId, thread_id: tid, message });

        // Email Notification
        if (process.env.ADMIN_EMAIL) {
            sendEmail(process.env.ADMIN_EMAIL, `Новое сообщение от пользователя #${uid}`, `Сообщение: ${message}`);
        }
      });
    };

    if (requestedThreadId && Number(requestedThreadId) > 0) {
      const tid = Number(requestedThreadId);
      ensureUserOwnsThread(uid, tid, (err, ok) => {
        if (!err && ok) {
          socket.join(`thread_${tid}`);
          performSave(tid);
        }
      });
    } else {
      socket.emit('message_sent', { client_id: clientId, thread_id: null, message: null, error: 'thread_id is required' });
    }
  });

  socket.on('reply', (data) => {
    // agent replies: { thread_id, user_id?, reply, file }
    if (Number(socket.roleLevel) < 1) return;

    const threadId = Number(data && (data.thread_id || data.threadId));
    const reply = data && (data.reply || data.message || null);
    const file = data && (data.file || null);
    const explicitUserId = data && data.user_id ? Number(data.user_id) : null;

    const saveAgent = (userId, tid) => {
      const stmt = `INSERT INTO support_messages (user_id, thread_id, sender, message, file_url) VALUES (?, ?, ?, ?, ?)`;
      db.run(stmt, [userId, tid, 'agent', reply || null, file || null], function (err) {
        if (err) return console.error('DB save error', err);
        const saved = { id: this.lastID, user_id: userId, thread_id: tid, sender: 'agent', message: reply, file_url: file, created_at: new Date().toISOString() };
        // Unified event for both user thread room and agent room
        io.to(`thread_${threadId}`).to('support_agents').emit('new_message', saved);

        // Email Notification to User
        db.get('SELECT email FROM users WHERE id = ?', [userId], (err, row) => {
            if(!err && row && row.email) {
                sendEmail(row.email, 'Ответ от службы поддержки', `Менеджер ответил вам: ${reply || '(Вложение)'}`);
            }
        });
      });
    };

    if (Number.isFinite(threadId) && threadId > 0) {
      if (Number.isFinite(explicitUserId) && explicitUserId > 0) return saveAgent(explicitUserId, threadId);
      db.get('SELECT user_id FROM support_threads WHERE id = ?', [threadId], (err, row) => {
        if (err || !row) return;
        saveAgent(Number(row.user_id), threadId);
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected', uid, socket.id);
  });
});

const PORT = process.env.SUPPORT_CHAT_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Support Socket.IO server running on port ${PORT}`);
});
