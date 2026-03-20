const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');

const app        = express();
const PORT       = 3000;
const SECRET_KEY = 'your-very-secure-secret';

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000']
}));

app.use(express.json());

// Serve frontend files (index.html, script.js, style.css)
app.use(express.static(path.join(__dirname)));

// ── In-memory data ────────────────────────────────────────────────────────────

let users = [
    { id: '1', firstName: 'Admin', lastName: '',    username: 'admin@example.com', password: '', role: 'Admin', verified: true },
    { id: '2', firstName: 'Alice', lastName: 'Doe', username: 'alice@example.com', password: '', role: 'User',  verified: true }
];

// Pre-hash passwords on startup
(async () => {
    users[0].password = await bcrypt.hash('admin123', 10);
    users[1].password = await bcrypt.hash('user123',  10);
})();

let departments = [
    { id: 'd1', name: 'Engineering', description: 'Software team' },
    { id: 'd2', name: 'HR',          description: 'Human Resources' }
];

let employees = [];
let requests  = [];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ── Auth routes ───────────────────────────────────────────────────────────────

// POST /api/register
app.post('/api/register', async (req, res) => {
    const { username, password, firstName = '', lastName = '' } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = users.find(u => u.username === username);
    if (existing) {
        return res.status(409).json({ error: 'User already exists' });
    }

    const newUser = {
        id: generateId(),
        firstName,
        lastName,
        username,
        password:  await bcrypt.hash(password, 10),
        role:      'User',
        verified:  false
    };

    users.push(newUser);
    res.status(201).json({ message: 'User registered', username });
});

// POST /api/verify-email
app.post('/api/verify-email', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.verified = true;
    res.json({ message: 'Email verified successfully' });
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }



    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName }
    });
});

// GET /api/profile
app.get('/api/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { password, ...safeUser } = user;
    res.json({ user: safeUser });
});

// ── Accounts routes ───────────────────────────────────────────────────────────

app.get('/api/accounts', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json({ accounts: safeUsers });
});

app.post('/api/accounts', authenticateToken, authorizeRole('Admin'), async (req, res) => {
    const { firstName = '', lastName = '', username, password, role = 'User', verified = false } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'Username already exists' });
    }

    const newUser = {
        id: generateId(),
        firstName, lastName, username,
        password: await bcrypt.hash(password, 10),
        role, verified
    };
    users.push(newUser);

    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ message: 'Account created', account: safeUser });
});

app.put('/api/accounts/:id', authenticateToken, authorizeRole('Admin'), async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, username, password, role, verified } = req.body;

    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Account not found' });

    if (username && username !== user.username && users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'Username already in use' });
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName  !== undefined) user.lastName  = lastName;
    if (username  !== undefined) user.username  = username;
    if (role      !== undefined) user.role      = role;
    if (verified  !== undefined) user.verified  = verified;
    if (password)                user.password  = await bcrypt.hash(password, 10);

    res.json({ message: 'Account updated' });
});

app.patch('/api/accounts/:id/password', authenticateToken, authorizeRole('Admin'), async (req, res) => {
    const { id }       = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Account not found' });

    user.password = await bcrypt.hash(password, 10);
    res.json({ message: 'Password reset successfully' });
});

app.delete('/api/accounts/:id', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { id } = req.params;

    if (req.user.id === id) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    const index = users.findIndex(u => u.id === id);
    if (index === -1) return res.status(404).json({ error: 'Account not found' });

    users.splice(index, 1);
    res.json({ message: 'Account deleted' });
});

// ── Departments routes ────────────────────────────────────────────────────────

app.get('/api/departments', authenticateToken, (req, res) => {
    res.json({ departments });
});

app.post('/api/departments', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { name, description = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });

    if (departments.find(d => d.name === name)) {
        return res.status(409).json({ error: 'Department already exists' });
    }

    const newDept = { id: generateId(), name, description };
    departments.push(newDept);
    res.status(201).json({ message: 'Department created', department: newDept });
});

app.put('/api/departments/:id', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { id }                = req.params;
    const { name, description } = req.body;

    const dept = departments.find(d => d.id === id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    if (name && name !== dept.name && departments.find(d => d.name === name)) {
        return res.status(409).json({ error: 'Department name already in use' });
    }

    if (name        !== undefined) dept.name        = name;
    if (description !== undefined) dept.description = description;

    res.json({ message: 'Department updated' });
});

app.delete('/api/departments/:id', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { id } = req.params;

    if (employees.some(e => e.departmentId === id)) {
        return res.status(409).json({ error: 'Cannot delete a department that has employees' });
    }

    const index = departments.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ error: 'Department not found' });

    departments.splice(index, 1);
    res.json({ message: 'Department deleted' });
});

// ── Employees routes ──────────────────────────────────────────────────────────

app.get('/api/employees', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const result = employees.map(emp => {
        const dept = departments.find(d => d.id === emp.departmentId);
        const user = users.find(u => u.username === emp.userEmail);
        return {
            ...emp,
            departmentName: dept ? dept.name : 'N/A',
            userFirstName:  user ? user.firstName : emp.userEmail,
            userLastName:   user ? user.lastName  : ''
        };
    });
    res.json({ employees: result });
});

app.post('/api/employees', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { employeeId, userEmail, position, departmentId, hireDate } = req.body;

    if (!employeeId || !userEmail || !position || !departmentId || !hireDate) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (!users.find(u => u.username === userEmail)) {
        return res.status(404).json({ error: 'User email not found in accounts' });
    }
    if (!departments.find(d => d.id === departmentId)) {
        return res.status(404).json({ error: 'Department not found' });
    }
    if (employees.find(e => e.employeeId === employeeId)) {
        return res.status(409).json({ error: 'Employee ID already exists' });
    }

    const newEmployee = { id: generateId(), employeeId, userEmail, position, departmentId, hireDate };
    employees.push(newEmployee);
    res.status(201).json({ message: 'Employee added', id: newEmployee.id });
});

app.put('/api/employees/:id', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { id } = req.params;
    const { employeeId, userEmail, position, departmentId, hireDate } = req.body;

    const emp = employees.find(e => e.id === id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    if (userEmail && !users.find(u => u.username === userEmail)) {
        return res.status(404).json({ error: 'User email not found in accounts' });
    }
    if (employeeId && employeeId !== emp.employeeId && employees.find(e => e.employeeId === employeeId)) {
        return res.status(409).json({ error: 'Employee ID already in use' });
    }

    if (employeeId   !== undefined) emp.employeeId   = employeeId;
    if (userEmail    !== undefined) emp.userEmail    = userEmail;
    if (position     !== undefined) emp.position     = position;
    if (departmentId !== undefined) emp.departmentId = departmentId;
    if (hireDate     !== undefined) emp.hireDate     = hireDate;

    res.json({ message: 'Employee updated' });
});

app.delete('/api/employees/:id', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { id }  = req.params;
    const index   = employees.findIndex(e => e.id === id);
    if (index === -1) return res.status(404).json({ error: 'Employee not found' });

    employees.splice(index, 1);
    res.json({ message: 'Employee deleted' });
});

// ── Requests routes ───────────────────────────────────────────────────────────

app.get('/api/requests', authenticateToken, (req, res) => {
    const result = req.user.role === 'Admin'
        ? requests
        : requests.filter(r => r.employeeEmail === req.user.username);

    res.json({ requests: result.map(r => ({ ...r, items: JSON.parse(r.items) })) });
});

app.post('/api/requests', authenticateToken, (req, res) => {
    const { type, items } = req.body;

    if (!type || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'type and at least one item are required' });
    }

    const validItems = items.filter(i => i.name && i.qty > 0);
    if (validItems.length === 0) {
        return res.status(400).json({ error: 'Each item needs a name and qty > 0' });
    }

    const newRequest = {
        id:            generateId(),
        type,
        items:         JSON.stringify(validItems),
        status:        'Pending',
        date:          new Date().toISOString().split('T')[0],
        employeeEmail: req.user.username
    };
    requests.push(newRequest);
    res.status(201).json({ message: 'Request submitted', id: newRequest.id });
});

app.patch('/api/requests/:id/status', authenticateToken, authorizeRole('Admin'), (req, res) => {
    const { id }     = req.params;
    const { status } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    const request = requests.find(r => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    request.status = status;
    res.json({ message: 'Request status updated' });
});

// ── Middleware functions ───────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    };
}

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n✅ Backend running on http://localhost:${PORT}`);
    console.log(`\n🔐 Default credentials:`);
    console.log(`   Admin → admin@example.com / admin123`);
    console.log(`   User  → alice@example.com / user123\n`);
});