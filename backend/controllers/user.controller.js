const db = require('../database/init');

// Cart
exports.getCart = (req, res) => {
    const userId = req.userId;
    const sql = `
        SELECT c.id as cart_item_id, c.quantity, p.* 
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error" });
        const cart = rows.map(p => ({
            ...p,
            images: JSON.parse(p.images || '[]')
        }));
        res.json(cart);
    });
};

exports.addToCart = (req, res) => {
    const userId = req.userId;
    const { productId } = req.body;
    
    // Check if exists
    db.get("SELECT * FROM cart WHERE user_id = ? AND product_id = ?", [userId, productId], (err, row) => {
        if (err) return res.status(500).json({ message: "Database error" });
        
        if (row) {
            // Update quantity
            db.run("UPDATE cart SET quantity = quantity + 1 WHERE id = ?", [row.id], (err) => {
                if (err) return res.status(500).json({ message: "Failed to update cart" });
                res.json({ message: "Quantity updated" });
            });
        } else {
            // Insert
            db.run("INSERT INTO cart (user_id, product_id) VALUES (?, ?)", [userId, productId], function(err) {
                if (err) return res.status(500).json({ message: "Failed to add to cart" });
                res.status(201).json({ id: this.lastID, message: "Added to cart" });
            });
        }
    });
};

exports.removeFromCart = (req, res) => {
    const userId = req.userId;
    const cartItemId = req.params.id;
    db.run("DELETE FROM cart WHERE id = ? AND user_id = ?", [cartItemId, userId], function(err) {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "Removed from cart" });
    });
};

// Favorites
exports.getFavorites = (req, res) => {
    const userId = req.userId;
    const sql = `
        SELECT f.id as fav_id, p.* 
        FROM favorites f
        JOIN products p ON f.product_id = p.id
        WHERE f.user_id = ?
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error" });
        const favs = rows.map(p => ({
            ...p,
            images: JSON.parse(p.images || '[]')
        }));
        res.json(favs);
    });
};

exports.addToFavorites = (req, res) => {
    const userId = req.userId;
    const { productId } = req.body;
    
    db.get("SELECT * FROM favorites WHERE user_id = ? AND product_id = ?", [userId, productId], (err, row) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (row) return res.status(400).json({ message: "Already in favorites" });
        
        db.run("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", [userId, productId], function(err) {
            if (err) return res.status(500).json({ message: "Failed to add to favorites" });
            res.status(201).json({ id: this.lastID, message: "Added to favorites" });
        });
    });
};

exports.removeFromFavorites = (req, res) => {
    const userId = req.userId;
    const productId = req.params.productId;
    db.run("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", [userId, productId], function(err) {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "Removed from favorites" });
    });
};

exports.checkout = (req, res) => {
    const userId = req.userId;
    const { pages_count } = req.body;
    
    // 1. Get Cart
    db.all(`SELECT c.id as cart_item_id, c.quantity, p.id as product_id, p.title, p.price 
            FROM cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (!rows || rows.length === 0) return res.status(400).json({ message: "Cart is empty" });
        
        let total = 0;
        const items = [];
        
        rows.forEach(r => {
            let priceStr = (r.price || '0').replace(/[^\d.,]/g, '').replace(',','.');
            let price = parseFloat(priceStr);
            if(isNaN(price)) price = 0;
            total += price * r.quantity;
            items.push({
                product_id: r.product_id,
                title: r.title,
                quantity: r.quantity,
                price: r.price
            });
        });
        
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const status = 'new';
        const payment = 'unpaid';
        const itemsJson = JSON.stringify(items);
        
        db.run(`INSERT INTO orders (user_id, order_number, total_amount, status, payment, items, pages_count) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [userId, orderNumber, Math.round(total), status, payment, itemsJson, pages_count || 0], 
                function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Failed to create order" });
            }
            const orderId = this.lastID;
            
            db.run(`DELETE FROM cart WHERE user_id = ?`, [userId], (err) => {
                res.status(201).json({ 
                    message: "Order created", 
                    orderId: orderId,
                    orderNumber: orderNumber 
                });
            });
        });
    });
};
