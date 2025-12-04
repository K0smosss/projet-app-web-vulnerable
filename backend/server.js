const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
require('dotenv').config();

const app = express();
const PORT = 5001;

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ message: 'Token manquant' });
    }

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Token invalide' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "laccès est interdit (admin uniquement)" });
    }
    next();
}


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path:"/"
    }
}));

const db = {};
db.users = [];
db.products = [];
db.orders = [];

db.users.push({
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    email: 'admin@ecommerce.com',
    role: 'admin',
});

db.users.push({
    id: 2,
    username: 'user',
    password: bcrypt.hashSync('user123', 10),
    email: 'user@example.com',
    role: 'customer',
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
    const query = (req.query.q || "").toLowerCase().trim();

    try {
        const results = db.products.filter(p =>
            p.name.toLowerCase().includes(query)
        );
        
        res.json(results);
        
    } catch(e) {
        res.status(500).json({
            error: e.message,
            stack: e.stack
        });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;

    const existingUser = db.users.find(
        u => u.username === username || u.email === email
    );

    if (existingUser) {
        return res.status(400).json({
            success: false,
            message: 'Nom d’utilisateur ou email déjà utilisé'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Mot de passe trop court ! Merci dutiliser un mot de passe de 8 caractères minimum'
        })
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        id: db.users.length + 1,
        username: username,
        password: hashedPassword,
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

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const query = `username = '${username}' AND password = '${password}'`;

    const user = db.users.find(u => u.username === username);
    
    if (!user) {
        return res.status(401).json({
            success: false,
            message:'Identifiants incorrects'
        })
    }

    const compare = await bcrypt.compare(password, user.password);

    if (compare) {
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

app.get('/api/users/:id', requireAuth, (req, res) => {
    const userId = parseInt(req.params.id);

    const user = db.users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (req.user.role !== "admin" && req.user.id !== userId) {
        return res.status(403).json({ message: "Accès interdit" });
    }

    const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
    };

    res.json(safeUser);
});

app.post('/api/products/:id/review', (req, res) => {
    const productId = parseInt(req.params.id);
    const { rating } = req.body;
    let { comment } = req.body;

    comment = sanitizeHtml(comment, {
        allowedTags: [],
        allowedAttributes: {}
    })

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
            userId,
            productId,
            quantity,
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

app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
    res.json({
        totalUsers: db.users.length,
        totalProducts: db.products.length,
        totalOrders: db.orders.length,
        users: db.users,
        orders: db.orders
    });
});

app.get('/api/files/:filename', (req, res) => {
    const safeBase = path.join(__dirname, "uploads");
    const requestedPath = path.normalize(path.join(safeBase, req.params.filename));

    if (!requestedPath.startsWith(safeBase)) {
        return res.status(400).json({ message: "Chemin interdit" });
    }

    fs.readFile(requestedPath, 'utf8', (err, data) => {
        if (err) {
            res.status(404).json({ message: "Fichier non trouvé" });
        } else {
            res.send(data);
        }
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
            'GET /api/users/:id',
            'POST /api/products/:id/review',
            'POST /api/checkout',
            'GET /api/admin/stats',
            'GET /api/files/:filename'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
