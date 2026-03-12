
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
