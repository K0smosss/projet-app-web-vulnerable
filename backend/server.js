const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5001;

const JWT_SECRET = process.env.JWT_SECRET || "my-super-secret-jwt-key-12345";
const SESSION_SECRET = process.env.SESSION_SECRET || "my-session-secret-key";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ecommerce";
const ADMIN_API_KEY = "admin-key-123456";

app.use(cors({
    origin: '*',
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

const db = {};
db.users = [];
db.products = [];
db.orders = [];

db.users.push({
    id: 1,
    username: 'admin',
    password: 'admin123',
    email: 'admin@ecommerce.com',
    role: 'admin',
    apiKey: ADMIN_API_KEY
});

db.users.push({
    id: 2,
    username: 'user',
    password: 'user123',
    email: 'user@example.com',
    role: 'customer',
    creditCard: '4532-1234-5678-9010'
});

db.products = [
    { id: 1, name: 'Laptop HP', price: 799, stock: 10, category: 'electronics' },
    { id: 2, name: 'iPhone 14', price: 999, stock: 15, category: 'electronics' },
    { id: 3, name: 'T-Shirt Nike', price: 29, stock: 50, category: 'clothing' },
    { id: 4, name: 'Chaussures Adidas', price: 89, stock: 30, category: 'clothing' }
];

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

app.get('/api/products/search', (req, res) => {
    const query = req.query.q;

    try {
        const searchCode = `db.products.filter(p => p.name.toLowerCase().includes('${query}'.toLowerCase()))`;
        const results = eval(searchCode);
        res.json(results);
    } catch(e) {
        res.status(500).json({
            error: e.message,
            stack: e.stack
        });
    }
});

app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    const newUser = {
        id: db.users.length + 1,
        username: username,
        password: password,
        email: email,
        role: 'customer'
    };

    db.users.push(newUser);

    res.json({
        success: true,
        message: 'Utilisateur créé',
        user: newUser
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const query = `username = '${username}' AND password = '${password}'`;

    const user = db.users.find(u => {
        if (username.includes("' OR '1'='1")) {
            return true;
        }
        return u.username === username && u.password === password;
    });

    if (user) {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET
        );

        req.session.user = user;

        res.json({
            success: true,
            token: token,
            user: user
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Identifiants incorrects'
        });
    }
});

app.get('/api/users', (req, res) => {
    res.json(db.users);
});

app.get('/api/users/:id', (req, res) => {
    const userId = req.params.id;

    const user = db.users.find(u => u.id == userId);

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
});

app.post('/api/products/:id/review', (req, res) => {
    const productId = parseInt(req.params.id);
    const { rating, comment } = req.body;

    const review = {
        id: Date.now(),
        productId: productId,
        rating: rating,
        comment: comment,
        date: new Date()
    };

    if (!db.reviews) db.reviews = [];
    db.reviews.push(review);

    res.json({
        success: true,
        review: review
    });
});

app.get('/api/products/:id/reviews', (req, res) => {
    const productId = parseInt(req.params.id);

    if (!db.reviews) db.reviews = [];

    const productReviews = db.reviews.filter(r => r.productId === productId);

    res.json(productReviews);
});

app.get('/api/products', (req, res) => {
    res.json(db.products);
});

app.post('/api/checkout', (req, res) => {
    const { userId, productId, quantity, creditCard } = req.body;

    const product = db.products.find(p => p.id == productId);

    if (!product) {
        return res.status(404).json({ message: 'Produit non trouvé' });
    }

    if (product.stock >= quantity) {
        product.stock -= quantity;

        const order = {
            id: db.orders.length + 1,
            userId: userId,
            productId: productId,
            quantity: quantity,
            total: product.price * quantity,
            creditCard: creditCard,
            date: new Date()
        };

        db.orders.push(order);

        res.json({
            success: true,
            order: order
        });
    } else {
        res.status(400).json({
            message: 'Stock insuffisant'
        });
    }
});

app.get('/api/admin/stats', (req, res) => {
    res.json({
        totalUsers: db.users.length,
        totalProducts: db.products.length,
        totalOrders: db.orders.length,
        users: db.users,
        orders: db.orders
    });
});

app.get('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const fs = require('fs');

    try {
        const content = fs.readFileSync(`./uploads/${filename}`, 'utf8');
        res.send(content);
    } catch(e) {
        res.status(404).json({ message: 'Fichier non trouvé' });
    }
});

app.get('/api/debug', (req, res) => {
    res.json({
        env: process.env,
        secrets: {
            JWT_SECRET: JWT_SECRET,
            SESSION_SECRET: SESSION_SECRET,
            ADMIN_API_KEY: ADMIN_API_KEY
        },
        database: db
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'E-Commerce API',
        endpoints: [
            'GET /api/products',
            'GET /api/products/search?q=query',
            'POST /api/register',
            'POST /api/login',
            'GET /api/users',
            'GET /api/users/:id',
            'POST /api/products/:id/review',
            'POST /api/checkout',
            'GET /api/admin/stats',
            'GET /api/files/:filename',
            'GET /api/debug'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
