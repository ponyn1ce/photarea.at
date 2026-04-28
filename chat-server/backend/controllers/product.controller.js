const db = require('../database/init');

exports.getAllProducts = (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error" });
        // Parse images JSON
        const products = rows.map(p => ({
            ...p,
            images: JSON.parse(p.images || '[]')
        }));
        res.json(products);
    });
};

exports.getProductById = (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM products WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (!row) return res.status(404).json({ message: "Product not found" });
        row.images = JSON.parse(row.images || '[]');
        res.json(row);
    });
};

exports.createProduct = (req, res) => {
    // Admin only check should be in middleware
    const { title, price, old_price, rating, reviews_count, description, images, is_sale } = req.body;
    const stmt = db.prepare("INSERT INTO products (title, price, old_price, rating, reviews_count, description, images, is_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    stmt.run(title, price, old_price, rating, reviews_count, description, JSON.stringify(images || []), is_sale ? 1 : 0, function(err) {
        if (err) return res.status(500).json({ message: "Failed to create product" });
        res.status(201).json({ id: this.lastID, ...req.body });
    });
};

exports.updateProduct = (req, res) => {
    const id = req.params.id;
    const { title, price, old_price, rating, reviews_count, description, images, is_sale } = req.body;
    
    const stmt = db.prepare(`
        UPDATE products SET 
        title = ?, price = ?, old_price = ?, rating = ?, reviews_count = ?, description = ?, images = ?, is_sale = ?
        WHERE id = ?
    `);
    
    stmt.run(title, price, old_price, rating, reviews_count, description, JSON.stringify(images || []), is_sale ? 1 : 0, id, function(err) {
        if (err) return res.status(500).json({ message: "Failed to update product" });
        if (this.changes === 0) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product updated" });
    });
};

exports.deleteProduct = (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM products WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: "Failed to delete product" });
        if (this.changes === 0) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product deleted" });
    });
};
