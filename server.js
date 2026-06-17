require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.sqlite');
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Twilio Setup
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
    : null;

const sendSms = async (message) => {
    if (!twilioClient) {
        console.log('Twilio not configured. SMS Log:', message);
        return;
    }
    try {
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: process.env.OWNER_PHONE_NUMBER
        });
    } catch (err) {
        console.error('Twilio Error:', err.message);
    }
};

// --- Middleware ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeOwner = (req, res, next) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
    next();
};

// --- Auth Routes ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY);
        res.json({ token, role: user.role });
    });
});

app.post('/api/verify-pin', authenticateToken, (req, res) => {
    const { pin } = req.body;
    db.get("SELECT owner_pin FROM users WHERE id = ?", [req.user.id], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Error' });
        
        const valid = await bcrypt.compare(pin, user.owner_pin);
        if (!valid) return res.status(401).json({ error: 'Invalid PIN' });
        
        res.json({ success: true });
    });
});

// --- Inventory Routes ---

app.get('/api/inventory', authenticateToken, authorizeOwner, (req, res) => {
    db.all("SELECT * FROM inventory", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/inventory/:barcode', authenticateToken, (req, res) => {
    db.get("SELECT * FROM inventory WHERE barcode = ?", [req.params.barcode], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    });
});

app.post('/api/inventory', authenticateToken, authorizeOwner, (req, res) => {
    const { barcode, product_name, quantity, description } = req.body;
    db.run("INSERT INTO inventory (barcode, product_name, quantity, description) VALUES (?, ?, ?, ?)",
        [barcode, product_name, quantity, description], function(err) {
            if (err) return res.status(400).json({ error: 'Barcode already exists' });
            res.json({ id: this.lastID });
        });
});

app.post('/api/scan-checkout', authenticateToken, (req, res) => {
    const { barcode } = req.body;
    db.get("SELECT * FROM inventory WHERE barcode = ?", [barcode], (err, item) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (item.quantity <= 0) return res.status(400).json({ error: 'Out of stock' });

        const newQty = item.quantity - 1;
        db.run("UPDATE inventory SET quantity = ? WHERE barcode = ?", [newQty, barcode], async (err) => {
            if (err) return res.status(500).json({ error: 'Update error' });
            
            // Log
            db.run("INSERT INTO logs (barcode, action, quantity_change) VALUES (?, ?, ?)", [barcode, 'SALE', -1]);
            
            // Twilio
            await sendSms(`SALE ALERT: ${item.product_name} sold. Remaining stock: ${newQty}`);
            
            res.json({ success: true, item: { ...item, quantity: newQty } });
        });
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
