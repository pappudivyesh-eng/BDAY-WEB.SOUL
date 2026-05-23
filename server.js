const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

// ── API: Timeline entries ──
app.get('/api/timeline', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'timeline.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Could not load timeline.' });
        res.json(JSON.parse(data));
    });
});

// ── API: Messages / reasons ──
app.get('/api/messages', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'messages.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Could not load messages.' });
        res.json(JSON.parse(data));
    });
});

// ── API: Chat reveal entries ──
app.get('/api/chat', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'chat.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Could not load chat.' });
        res.json(JSON.parse(data));
    });
});

// Fallback — always serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🎂 Birthday site running → http://localhost:${PORT}\n`);
});