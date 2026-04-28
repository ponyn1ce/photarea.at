const db = require('../database/init');

function normalizeOrderRow(row) {
  if (!row) return null;

  const contacts = (() => {
    try {
      return row.contacts ? JSON.parse(row.contacts) : null;
    } catch (_) {
      return row.contacts;
    }
  })();

  const items = (() => {
    try {
      return row.items ? JSON.parse(row.items) : [];
    } catch (_) {
      return [];
    }
  })();

  const customerName = row.customer_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();

  return {
    id: `ord_${row.id}`,
    db_id: row.id,
    user_id: row.user_id,

    order_number: row.order_number,
    contacts,

    total: row.total_amount,
    status: row.status,
    payment: row.payment,
    createdAt: row.order_date,
    pages_count: row.pages_count,
    // Add items and admin_comment for full data
    items,
    admin_comment: row.admin_comment,

    // Convenience for frontend
    customerName,
    email: row.email || (contacts && contacts.email) || '',
    phone: row.phone || (contacts && contacts.phone) || '',
  };
}

function buildListWhere(query) {
  const where = [];
  const params = [];

  if (query.status) {
    where.push('o.status = ?');
    params.push(query.status);
  }

  if (query.payment) {
    where.push('o.payment = ?');
    params.push(query.payment);
  }

  if (query.dateFrom) {
    where.push("datetime(o.order_date) >= datetime(?)");
    params.push(query.dateFrom);
  }

  if (query.dateTo) {
    where.push("datetime(o.order_date) <= datetime(?)");
    params.push(query.dateTo);
  }

  if (query.userId) {
    where.push('o.user_id = ?');
    params.push(Number(query.userId));
  }

  if (query.q) {
    const q = String(query.q).trim().toLowerCase();
    if (q) {
      where.push(
        `(
          lower(o.order_number) LIKE ? OR
          lower(u.email) LIKE ? OR
          lower(u.login) LIKE ? OR
          lower(u.first_name || ' ' || u.last_name) LIKE ?
        )`
      );
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
  }

  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { sql, params };
}

exports.list = (req, res) => {
  const { sql: whereSql, params } = buildListWhere(req.query || {});

  const q = `
    SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.contacts,
      o.total_amount,
      o.status,
      o.payment,
      o.order_date,
      o.pages_count,
      o.items,
      o.admin_comment,
      u.first_name,
      u.last_name,
      u.email,
      u.login
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ${whereSql}
    ORDER BY datetime(o.order_date) DESC, o.id DESC
    LIMIT 500
  `;

  db.all(q, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json({ orders: rows.map(normalizeOrderRow).filter(Boolean) });
  });
};

exports.getOne = (req, res) => {
  const dbId = Number(String(req.params.id || '').replace(/^ord_/, ''));
  if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: 'Invalid id' });

  const q = `
    SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.contacts,
      o.total_amount,
      o.status,
      o.payment,
      o.order_date,
      o.pages_count,
      o.items,
      o.admin_comment,
      u.first_name,
      u.last_name,
      u.email,
      u.login
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.id = ?
    LIMIT 1
  `;

  db.get(q, [dbId], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json({ order: normalizeOrderRow(row) });
  });
};

exports.create = (req, res) => {
  const body = req.body || {};

  const user_id = Number(body.user_id);
  const order_number = String(body.order_number || '').trim();
  const total_amount = Number(body.total_amount);
  const status = String(body.status || 'new').trim();
  const payment = String(body.payment || 'unpaid').trim();
  const order_date = body.order_date ? String(body.order_date) : null;
  const pages_count = Number(body.pages_count || 0);

  if (!Number.isFinite(user_id) || user_id <= 0) return res.status(400).json({ message: 'user_id required' });
  if (!order_number) return res.status(400).json({ message: 'order_number required' });
  if (!Number.isFinite(total_amount)) return res.status(400).json({ message: 'total_amount required' });

  const contacts = body.contacts ? JSON.stringify(body.contacts) : null;
  const items = body.items ? JSON.stringify(body.items) : null;

  const stmt = `
    INSERT INTO orders (user_id, order_number, contacts, total_amount, status, payment, order_date, pages_count, items)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
  `;

  db.run(stmt, [user_id, order_number, contacts, Math.round(total_amount), status, payment, order_date, Number.isFinite(pages_count) ? pages_count : 0, items], function (err) {
    if (err) {
      if (String(err.message || '').toLowerCase().includes('unique')) {
        return res.status(409).json({ message: 'order_number already exists' });
      }
      return res.status(500).json({ message: 'Database error' });
    }

    req.params.id = String(this.lastID);
    return exports.getOne(req, res);
  });
};

exports.createSelf = (req, res) => {
  const body = req.body || {};
  const user_id = req.userId; // Trust token

  if (!user_id) return res.status(401).json({ message: 'Unauthorized' });

  // Auto-generate order number if not provided, or validate?
  // Let's generate one: ORD-{timestamp}-{random}
  const order_number = String(body.order_number || `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`).trim();
  
  const total_amount = Number(body.total_amount || 0);
  const status = 'new';
  const payment = 'unpaid'; // Default
  const pages_count = Number(body.pages_count || 0);

  const contacts = body.contacts ? JSON.stringify(body.contacts) : null;
  const items = body.items ? JSON.stringify(body.items) : null;

  const stmt = `
    INSERT INTO orders (user_id, order_number, contacts, total_amount, status, payment, items, pages_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(stmt, [user_id, order_number, contacts, Math.round(total_amount), status, payment, items, pages_count], function (err) {
    if (err) {
       console.error(err);
       return res.status(500).json({ message: 'Database error' });
    }
    req.params.id = String(this.lastID);
    return exports.getOne(req, res);
  });
};

exports.patch = (req, res) => {
  const dbId = Number(String(req.params.id || '').replace(/^ord_/, ''));
  if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: 'Invalid id' });

  const body = req.body || {};
  const allowed = {};

  if (typeof body.status === 'string') allowed.status = body.status;
  if (typeof body.payment === 'string') allowed.payment = body.payment;
  if (typeof body.order_number === 'string') allowed.order_number = body.order_number.trim();
  if (typeof body.order_date === 'string') allowed.order_date = body.order_date;
  if (typeof body.total_amount !== 'undefined') {
    const ta = Number(body.total_amount);
    if (Number.isFinite(ta)) allowed.total_amount = Math.round(ta);
  }
  if (typeof body.pages_count !== 'undefined') {
    const pc = Number(body.pages_count);
    if (Number.isFinite(pc)) allowed.pages_count = pc;
  }
  if (typeof body.admin_comment === 'string') allowed.admin_comment = body.admin_comment;

  const keys = Object.keys(allowed);
  if (!keys.length) return res.status(400).json({ message: 'No fields to update' });

  const setSql = keys.map((k) => `${k} = ?`).join(', ');
  const params = keys.map((k) => allowed[k]);
  params.push(dbId);

  db.run(`UPDATE orders SET ${setSql} WHERE id = ?`, params, function (err) {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
    return exports.getOne(req, res);
  });
};

exports.remove = (req, res) => {
  const dbId = Number(String(req.params.id || '').replace(/^ord_/, ''));
  if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: 'Invalid id' });

  db.run('DELETE FROM orders WHERE id = ?', [dbId], function (err) {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true, id: `ord_${dbId}` });
  });
};
