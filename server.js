const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

// Middleware
app.use(express.json({ limit: '50mb' })); // support large base64 images upload
app.use(express.static(path.join(__dirname, 'www')));

// Data Directory paths
const DATA_DIR = path.join(__dirname, 'data');
const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');
const YARD_SPECS_FILE = path.join(DATA_DIR, 'yard_specs.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Default Yard specifications
const DEFAULT_YARD_SPECS = {
    beach: { name: "Beach Yard", rows: 6, cols: 8, capacity: 48 },
    bhima: { name: "Bhima Yard", rows: 5, cols: 10, capacity: 50 },
    showroom: { name: "Showroom Yard", rows: 4, cols: 4, capacity: 16 }
};

// API: Get inspected vehicles registry
app.get('/api/vehicles', (req, res) => {
    try {
        if (!fs.existsSync(VEHICLES_FILE)) {
            return res.json([]);
        }
        const data = fs.readFileSync(VEHICLES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("Error reading vehicles:", err);
        res.status(500).json({ error: "Failed to read vehicle registry file" });
    }
});

// API: Save inspected vehicles registry
app.post('/api/vehicles', (req, res) => {
    try {
        const vehicles = req.body;
        if (!Array.isArray(vehicles)) {
            return res.status(400).json({ error: "Invalid payload format" });
        }
        fs.writeFileSync(VEHICLES_FILE, JSON.stringify(vehicles, null, 2), 'utf8');
        res.json({ success: true, message: "Registry saved successfully" });
    } catch (err) {
        console.error("Error saving vehicles:", err);
        res.status(500).json({ error: "Failed to save vehicle registry file" });
    }
});

// API: Get yard specs configs
app.get('/api/yard-specs', (req, res) => {
    try {
        if (!fs.existsSync(YARD_SPECS_FILE)) {
            return res.json(DEFAULT_YARD_SPECS);
        }
        const data = fs.readFileSync(YARD_SPECS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("Error reading yard specs:", err);
        res.status(500).json({ error: "Failed to read yard specs config file" });
    }
});

// API: Save yard specs configs
app.post('/api/yard-specs', (req, res) => {
    try {
        const specs = req.body;
        fs.writeFileSync(YARD_SPECS_FILE, JSON.stringify(specs, null, 2), 'utf8');
        res.json({ success: true, message: "Yard configuration saved successfully" });
    } catch (err) {
        console.error("Error saving yard specs:", err);
        res.status(500).json({ error: "Failed to save yard specs config file" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  MAHINDRA PDI BACKEND SERVER RUNNING`);
    console.log(`  Local Address: http://localhost:${PORT}`);
    console.log(`  Flat-File DB: ${DATA_DIR}`);
    console.log(`=================================================`);
});
