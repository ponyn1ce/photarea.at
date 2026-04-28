const path = require('path');
require('dotenv').config();
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const fs = require('fs');
const https = require('https');
const http = require('http');
const db = require('../database/init'); // Initialize DB

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const userRoutes = require('./routes/user.routes');
const uploadRoutes = require('./routes/upload.routes');
const ordersRoutes = require('./routes/orders.routes');

// If running behind a reverse proxy (nginx), this enables req.secure via X-Forwarded-Proto
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enables req.cookies for JWT cookie auth
app.use(cookieParser());

// Debug logging
app.use((req, res, next) => {
  console.log(`[INCOMING] ${req.method} ${req.url}`);
  next();
});

// --- Mount Routes (API first) ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', ordersRoutes);

// Helper route for connectivity check
app.get('/api/ping', (req, res) => res.json({ message: 'pong', protocol: req.protocol }));

// Serve frontend static files from project root
app.use(express.static(path.join(__dirname, '..')));
// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Catch-all for SPA (optional, if you want index.html for unknown routes)
// app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

const PORT = process.env.PORT || 3000;

let server;
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

if (process.env.USE_INTERNAL_SSL === 'true' && sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  server = https.createServer(options, app).listen(PORT, () => {
    console.log(`Secure Server (HTTPS) started on port ${PORT}`);
  });
} else {
  server = app.listen(PORT, () => {
    console.log(`Server started on port ${PORT} (HTTP)`);
  });
}

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the occupying process or change PORT in .env.`);
    process.exit(1);
  }
  console.error('Server error', err);
  process.exit(1);
});

module.exports = app;
