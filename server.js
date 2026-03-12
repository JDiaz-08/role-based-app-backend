
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret'; 


app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'] 
}));


app.use(express.json());


let users = [
  { id: 1, username: 'admin', password: '$2a$10$...', role: 'admin' }, 
  { id: 2, username: 'alice', password: '$2a$10$...', role: 'user' }
];

// Pre-hash known passwords for demo
if (!users[0].password.includes('$2a$')) {
  users[0].password = bcrypt.hashSync('admin123', 10);
  users[1].password = bcrypt.hashSync('user123', 10);
}

// 📦 AUTH ROUTES

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { username, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check if user exists
  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword,
    role // Note: In real apps, role should NOT be set by client!
  };