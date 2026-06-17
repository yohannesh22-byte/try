const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./database.sqlite');

db.serialize(async () => {
    // Drop tables if they exist
    db.run("DROP TABLE IF EXISTS users");
    db.run("DROP TABLE IF EXISTS inventory");
    db.run("DROP TABLE IF EXISTS logs");

    // Create Users table
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        owner_pin TEXT NOT NULL,
        role TEXT CHECK(role IN ('owner', 'worker')) NOT NULL
    )`);

    // Create Inventory table
    db.run(`CREATE TABLE inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        description TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Logs table
    db.run(`CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT NOT NULL,
        action TEXT NOT NULL,
        quantity_change INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed initial users
    const ownerPassword = await bcrypt.hash('admin123', 10);
    const ownerPin = await bcrypt.hash('1234', 10);
    const workerPassword = await bcrypt.hash('worker123', 10);

    db.run("INSERT INTO users (username, password, owner_pin, role) VALUES (?, ?, ?, ?)", 
        ['admin', ownerPassword, ownerPin, 'owner']);
    db.run("INSERT INTO users (username, password, owner_pin, role) VALUES (?, ?, ?, ?)", 
        ['worker', workerPassword, '0000', 'worker']); // Worker has dummy PIN

    console.log("Database initialized and seeded.");
});

db.close();
