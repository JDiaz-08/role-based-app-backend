// ── Global state ──────────────────────────────────────────────────────────────

let currentUser = null;

// ── API helper ────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

async function apiCall(endpoint, options = {}) {
    const token = sessionStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { ...headers, ...(options.headers || {}) }
        });
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (err) {
        console.error('API error:', err);
        return { ok: false, status: 0, data: { error: 'Network error. Is the server running?' } };
    }
}

// ── localStorage (kept for CRUD features) ────────────────────────────────────

const STORAGE_KEY = 'ipt_demo_v1';

window.db = {
    accounts:    [],
    departments: [],
    employees:   [],
    requests:    []
};

function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            window.db = JSON.parse(stored);
        } else {
            seedDatabase();
        }
    } catch (e) {
        console.error('Error loading data:', e);
        seedDatabase();
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
    } catch (e) {
        console.error('Error saving data:', e);
        showToast('Error saving data', 'danger');
    }
}

function seedDatabase() {
    window.db = {
        accounts: [
            {
                id: generateId(),
                firstName: 'Admin',
                lastName: '',
                email: 'admin@example.com',
                password: 'admin123',
                role: 'Admin',
                verified: true
            }
        ],
        departments: [
            { id: 'd1', name: 'Engineering', description: 'Software team' },
            { id: 'd2', name: 'HR',          description: 'Human Resources' }
        ],
        employees: [],
        requests:  []
    };
    saveToStorage();
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    loadFromStorage();
    initializeEventListeners();

    if (!window.location.hash) {
        window.location.hash = '#/';
    }

    // Restore session — check JWT first, fall back to old localStorage token
    const jwtToken  = sessionStorage.getItem('authToken');
    const authToken = localStorage.getItem('auth_token');

    if (jwtToken) {
        const { ok, data } = await apiCall('/profile');
        if (ok) {
            const account = window.db.accounts.find(
                acc => acc.email === data.user.username && acc.verified
            );
            setAuthState(true, account || {
                firstName: data.user.username,
                lastName:  '',
                email:     data.user.username,
                role:      data.user.role
            });
        } else {
            sessionStorage.removeItem('authToken');
        }
    } else if (authToken) {
        const user = window.db.accounts.find(acc => acc.email === authToken && acc.verified);
        if (user) {
            setAuthState(true, user);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    handleRouting();
    window.addEventListener('hashchange', handleRouting);
});

// ── Routing ───────────────────────────────────────────────────────────────────

function navigateTo(hash) {
    window.location.hash = hash;
}

function handleRouting() {
    const hash  = window.location.hash || '#/';
    const route = hash.substring(2);

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

    const protectedRoutes = ['profile', 'employees', 'departments', 'accounts', 'requests'];
    const adminRoutes     = ['employees', 'departments', 'accounts'];

    if (protectedRoutes.includes(route) && !currentUser) {
        showToast('Please log in first', 'warning');
        navigateTo('#/login');
        return;
    }

    if (adminRoutes.includes(route) && currentUser?.role !== 'Admin') {
        showToast('Access denied. Admin only.', 'danger');
        navigateTo('#/');
        return;
    }

    let pageId = '';
    switch (route) {
        case '':
        case '/':
            pageId = 'home-page';
            break;
        case 'register':
            pageId = 'register-page';
            break;
        case 'verify-email':
            pageId = 'verify-email-page';
            const unverifiedEmail = localStorage.getItem('unverified_email');
            if (unverifiedEmail) {
                document.getElementById('verify-email-display').textContent = unverifiedEmail;
            }
            break;
        case 'login':
            pageId = 'login-page';
            if (localStorage.getItem('email_verified') === 'true') {
                document.getElementById('login-success-alert').classList.remove('d-none');
                localStorage.removeItem('email_verified');
            }
            break;
        case 'profile':
            pageId = 'profile-page';
            renderProfile();
            break;
        case 'employees':
            pageId = 'employees-page';
            renderEmployeesList();
            break;
        case 'departments':
            pageId = 'departments-page';
            renderDepartmentsList();
            break;
        case 'accounts':
            pageId = 'accounts-page';
            renderAccountsList();
            break;
        case 'requests':
            pageId = 'requests-page';
            renderRequestsList();
            break;
        default:
            pageId = 'home-page';
    }

    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
}

// ── Auth state ────────────────────────────────────────────────────────────────

function setAuthState(isAuth, user = null) {
    currentUser = user;
    const body  = document.body;

    if (isAuth && user) {
        body.classList.remove('not-authenticated');
        body.classList.add('authenticated');
        body.classList.toggle('is-admin', user.role === 'Admin');

        const displayName = user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName;
        document.getElementById('username-display').textContent = displayName;
    } else {
        body.classList.remove('authenticated', 'is-admin');
        body.classList.add('not-authenticated');
        currentUser = null;
    }
}

// ── Event listeners ───────────────────────────────────────────────────────────

function initializeEventListeners() {
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('simulate-verify-btn').addEventListener('click', handleVerifyEmail);

    document.getElementById('add-employee-btn').addEventListener('click', () => showEmployeeForm());
    document.getElementById('cancel-employee-btn').addEventListener('click', hideEmployeeForm);
    document.getElementById('employee-form').addEventListener('submit', handleEmployeeSubmit);

    document.getElementById('add-department-btn').addEventListener('click', () => showDepartmentForm());

    document.getElementById('add-account-btn').addEventListener('click', () => showAccountForm());
    document.getElementById('cancel-account-btn').addEventListener('click', hideAccountForm);
    document.getElementById('account-form').addEventListener('submit', handleAccountSubmit);

    document.getElementById('new-request-btn').addEventListener('click', showRequestModal);
    document.getElementById('add-item-btn').addEventListener('click', addRequestItem);
    document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);
}

// ── Auth handlers ─────────────────────────────────────────────────────────────

async function handleRegister(e) {
    e.preventDefault();

    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName  = document.getElementById('reg-lastname').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const password  = document.getElementById('reg-password').value;

    const { ok, data } = await apiCall('/register', {
        method: 'POST',
        body:   JSON.stringify({ username: email, password, firstName, lastName })
    });

    if (ok) {
        localStorage.setItem('unverified_email', email);

        // Keep localStorage in sync so other features still work
        window.db.accounts.push({
            id: generateId(), firstName, lastName,
            email, password, role: 'User', verified: false
        });
        saveToStorage();

        showToast('Account created! Please verify your email.', 'success');
        navigateTo('#/verify-email');
    } else {
        showToast(data.error || 'Registration failed', 'danger');
    }
}

async function handleVerifyEmail() {
    const email = localStorage.getItem('unverified_email');
    if (!email) {
        showToast('No pending verification', 'warning');
        return;
    }

    // Update the backend
    const { ok, data } = await apiCall('/verify-email', {
        method: 'POST',
        body:   JSON.stringify({ username: email })
    });

    if (ok) {
        // Also update localStorage to keep both in sync
        const account = window.db.accounts.find(acc => acc.email === email);
        if (account) {
            account.verified = true;
            saveToStorage();
        }

        localStorage.removeItem('unverified_email');
        localStorage.setItem('email_verified', 'true');

        showToast('Email verified successfully!', 'success');
        navigateTo('#/login');
    } else {
        showToast(data.error || 'Verification failed', 'danger');
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { ok, data } = await apiCall('/login', {
        method: 'POST',
        body:   JSON.stringify({ username: email, password })
    });

    if (ok) {
        sessionStorage.setItem('authToken', data.token);

        const account = window.db.accounts.find(acc => acc.email === email && acc.verified);
        setAuthState(true, account || {
            firstName: data.user.firstName || email,
            lastName:  data.user.lastName  || '',
            email,
            role:      data.user.role
        });

        showToast('Login successful!', 'success');
        navigateTo('#/profile');
    } else {
        showToast(data.error || 'Invalid credentials', 'danger');
    }
}

function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('authToken');
    setAuthState(false);
    showToast('Logged out successfully', 'info');
    navigateTo('#/');
}

// ── Profile ───────────────────────────────────────────────────────────────────

function renderProfile() {
    if (!currentUser) return;

    document.getElementById('profile-content').innerHTML = `
        <div class="mb-3">
            <h4>${currentUser.firstName} ${currentUser.lastName}</h4>
        </div>
        <div class="mb-2"><strong>Email:</strong> ${currentUser.email}</div>
        <div class="mb-3"><strong>Role:</strong> ${currentUser.role}</div>
        <button class="btn btn-primary" onclick="alert('Dummy button only!')">Edit Profile</button>
    `;
}

// ── Accounts ──────────────────────────────────────────────────────────────────

async function renderAccountsList() {
    const { ok, data } = await apiCall('/accounts');
    if (!ok) {
        document.getElementById('accounts-list').innerHTML =
            `<div class="alert alert-danger">${data.error || 'Failed to load accounts'}</div>`;
        return;
    }

    const accounts = data.accounts;
    if (accounts.length === 0) {
        document.getElementById('accounts-list').innerHTML =
            '<div class="alert alert-info">No accounts found.</div>';
        return;
    }

    document.getElementById('accounts-list').innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${accounts.map(acc => `
                    <tr>
                        <td>${acc.firstName} ${acc.lastName}</td>
                        <td>${acc.username}</td>
                        <td>${acc.role}</td>
                        <td>${acc.verified ? '✅' : '—'}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-primary" onclick="editAccount('${acc.id}')">Edit</button>
                            <button class="btn btn-sm btn-warning" onclick="resetPassword('${acc.id}')">Reset Password</button>
                            <button class="btn btn-sm btn-danger"  onclick="deleteAccount('${acc.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showAccountForm(account = null) {
    const container = document.getElementById('account-form-container');
    const form      = document.getElementById('account-form');

    if (account) {
        document.getElementById('acc-firstname').value  = account.firstName;
        document.getElementById('acc-lastname').value   = account.lastName;
        document.getElementById('acc-email').value      = account.username;
        document.getElementById('acc-password').value   = '';
        document.getElementById('acc-role').value       = account.role;
        document.getElementById('acc-verified').checked = !!account.verified;
        form.dataset.editId = account.id;
    } else {
        form.reset();
        delete form.dataset.editId;
    }

    container.classList.remove('d-none');
}

function hideAccountForm() {
    document.getElementById('account-form-container').classList.add('d-none');
    document.getElementById('account-form').reset();
}

async function editAccount(id) {
    const { ok, data } = await apiCall('/accounts');
    if (!ok) { showToast('Failed to load accounts', 'danger'); return; }

    const account = data.accounts.find(a => a.id === id);
    if (account) showAccountForm(account);
}

async function handleAccountSubmit(e) {
    e.preventDefault();

    const form      = document.getElementById('account-form');
    const editId    = form.dataset.editId;
    const firstName = document.getElementById('acc-firstname').value.trim();
    const lastName  = document.getElementById('acc-lastname').value.trim();
    const username  = document.getElementById('acc-email').value.trim();
    const password  = document.getElementById('acc-password').value;
    const role      = document.getElementById('acc-role').value;
    const verified  = document.getElementById('acc-verified').checked;

    if (!editId && password.length < 6) {
        showToast('Password must be at least 6 characters', 'danger');
        return;
    }

    const payload = { firstName, lastName, username, role, verified };
    if (password) payload.password = password;

    const { ok, data } = await apiCall(
        editId ? `/accounts/${editId}` : '/accounts',
        { method: editId ? 'PUT' : 'POST', body: JSON.stringify(payload) }
    );

    if (ok) {
        showToast(editId ? 'Account updated' : 'Account created', 'success');
        hideAccountForm();
        renderAccountsList();
    } else {
        showToast(data.error || 'Operation failed', 'danger');
    }
}

async function resetPassword(id) {
    const newPassword = prompt('Enter new password (minimum 6 characters):');
    if (newPassword === null) return;
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'danger');
        return;
    }

    const { ok, data } = await apiCall(`/accounts/${id}/password`, {
        method: 'PATCH',
        body:   JSON.stringify({ password: newPassword })
    });
    showToast(ok ? 'Password reset successfully' : (data.error || 'Failed'), ok ? 'success' : 'danger');
}

async function deleteAccount(id) {
    if (currentUser?.id === id) {
        showToast('Cannot delete your own account', 'danger');
        return;
    }
    if (!confirm('Delete this account? This action cannot be undone.')) return;

    const { ok, data } = await apiCall(`/accounts/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('Account deleted', 'info');
        renderAccountsList();
    } else {
        showToast(data.error || 'Delete failed', 'danger');
    }
}

// ── Departments ───────────────────────────────────────────────────────────────

async function renderDepartmentsList() {
    const { ok, data } = await apiCall('/departments');
    if (!ok) {
        document.getElementById('departments-list').innerHTML =
            `<div class="alert alert-danger">${data.error || 'Failed to load departments'}</div>`;
        return;
    }

    const { departments } = data;
    if (departments.length === 0) {
        document.getElementById('departments-list').innerHTML =
            '<div class="alert alert-info">No departments found.</div>';
        return;
    }

    document.getElementById('departments-list').innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr><th>Name</th><th>Description</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${departments.map(dept => `
                    <tr>
                        <td>${dept.name}</td>
                        <td>${dept.description}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-primary"
                                onclick="editDepartment('${dept.id}', '${dept.name}', '${dept.description}')">Edit</button>
                            <button class="btn btn-sm btn-danger"
                                onclick="deleteDepartment('${dept.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showDepartmentForm(id = null, name = '', description = '') {
    const newName = prompt('Department name:', name);
    if (newName === null) return;
    const newDesc = prompt('Description:', description);
    if (newDesc === null) return;

    if (id) updateDepartment(id, newName, newDesc);
    else    createDepartment(newName, newDesc);
}

async function createDepartment(name, description) {
    const { ok, data } = await apiCall('/departments', {
        method: 'POST',
        body:   JSON.stringify({ name, description })
    });
    showToast(ok ? 'Department created' : (data.error || 'Failed'), ok ? 'success' : 'danger');
    if (ok) renderDepartmentsList();
}

function editDepartment(id, name, description) {
    showDepartmentForm(id, name, description);
}

async function updateDepartment(id, name, description) {
    const { ok, data } = await apiCall(`/departments/${id}`, {
        method: 'PUT',
        body:   JSON.stringify({ name, description })
    });
    showToast(ok ? 'Department updated' : (data.error || 'Failed'), ok ? 'success' : 'danger');
    if (ok) renderDepartmentsList();
}

async function deleteDepartment(id) {
    if (!confirm('Delete this department?')) return;

    const { ok, data } = await apiCall(`/departments/${id}`, { method: 'DELETE' });
    showToast(ok ? 'Department deleted' : (data.error || 'Failed'), ok ? 'info' : 'danger');
    if (ok) renderDepartmentsList();
}

// ── Employees ─────────────────────────────────────────────────────────────────

async function renderEmployeesList() {
    const { ok, data } = await apiCall('/employees');
    if (!ok) {
        document.getElementById('employees-list').innerHTML =
            `<div class="alert alert-danger">${data.error || 'Failed to load employees'}</div>`;
        return;
    }

    const { employees } = data;
    if (employees.length === 0) {
        document.getElementById('employees-list').innerHTML =
            '<div class="alert alert-info">No employees found.</div>';
        return;
    }

    document.getElementById('employees-list').innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr><th>ID</th><th>Name</th><th>Position</th><th>Dept</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${employees.map(emp => `
                    <tr>
                        <td>${emp.employeeId}</td>
                        <td>${emp.userFirstName} ${emp.userLastName}</td>
                        <td>${emp.position}</td>
                        <td>${emp.departmentName}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-primary" onclick="editEmployee('${emp.id}')">Edit</button>
                            <button class="btn btn-sm btn-danger"  onclick="deleteEmployee('${emp.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function showEmployeeForm(employeeId = null) {
    const container = document.getElementById('employee-form-container');
    const form      = document.getElementById('employee-form');

    const deptRes = await apiCall('/departments');
    if (!deptRes.ok) { showToast('Failed to load departments', 'danger'); return; }

    document.getElementById('emp-department').innerHTML =
        deptRes.data.departments.map(d =>
            `<option value="${d.id}">${d.name}</option>`
        ).join('');

    if (employeeId) {
        const empRes = await apiCall('/employees');
        if (!empRes.ok) { showToast('Failed to load employee data', 'danger'); return; }

        const emp = empRes.data.employees.find(e => e.id === employeeId);
        if (emp) {
            document.getElementById('emp-id').value         = emp.employeeId;
            document.getElementById('emp-email').value      = emp.userEmail;
            document.getElementById('emp-position').value   = emp.position;
            document.getElementById('emp-department').value = emp.departmentId;
            document.getElementById('emp-hiredate').value   = emp.hireDate;
            form.dataset.editId = employeeId;
        }
    } else {
        form.reset();
        delete form.dataset.editId;
    }

    container.classList.remove('d-none');
}

function hideEmployeeForm() {
    document.getElementById('employee-form-container').classList.add('d-none');
    document.getElementById('employee-form').reset();
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();

    const form         = document.getElementById('employee-form');
    const editId       = form.dataset.editId;
    const employeeId   = document.getElementById('emp-id').value.trim();
    const userEmail    = document.getElementById('emp-email').value.trim();
    const position     = document.getElementById('emp-position').value.trim();
    const departmentId = document.getElementById('emp-department').value;
    const hireDate     = document.getElementById('emp-hiredate').value;

    const { ok, data } = await apiCall(
        editId ? `/employees/${editId}` : '/employees',
        {
            method: editId ? 'PUT' : 'POST',
            body:   JSON.stringify({ employeeId, userEmail, position, departmentId, hireDate })
        }
    );

    if (ok) {
        showToast(editId ? 'Employee updated' : 'Employee added', 'success');
        hideEmployeeForm();
        renderEmployeesList();
    } else {
        showToast(data.error || 'Operation failed', 'danger');
    }
}

function editEmployee(id) {
    showEmployeeForm(id);
}

async function deleteEmployee(id) {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    const { ok, data } = await apiCall(`/employees/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('Employee deleted', 'info');
        renderEmployeesList();
    } else {
        showToast(data.error || 'Delete failed', 'danger');
    }
}

// ── Requests ──────────────────────────────────────────────────────────────────

async function renderRequestsList() {
    const { ok, data } = await apiCall('/requests');
    if (!ok) {
        document.getElementById('requests-list').innerHTML =
            `<div class="alert alert-danger">${data.error || 'Failed to load requests'}</div>`;
        return;
    }

    const { requests } = data;
    if (requests.length === 0) {
        document.getElementById('requests-list').innerHTML = `
            <div class="alert alert-info">
                You have no requests yet.<br>
                <button class="btn btn-success mt-2" onclick="showRequestModal()">Create One</button>
            </div>
        `;
        return;
    }

    document.getElementById('requests-list').innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr><th>Date</th><th>Type</th><th>Items</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${requests.map(req => {
                    const statusClass = req.status === 'Approved' ? 'success'
                                      : req.status === 'Rejected' ? 'danger'
                                      : 'warning';
                    const itemsList = req.items.map(i => `${i.name} (${i.qty})`).join(', ');
                    return `
                        <tr>
                            <td>${req.date}</td>
                            <td>${req.type}</td>
                            <td>${itemsList}</td>
                            <td><span class="badge bg-${statusClass}">${req.status}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function showRequestModal() {
    const modal = new bootstrap.Modal(document.getElementById('requestModal'));
    document.getElementById('request-form').reset();
    document.getElementById('request-items').innerHTML = `
        <div class="input-group mb-2">
            <input type="text"   class="form-control item-name" placeholder="Item name" required>
            <input type="number" class="form-control item-qty"  placeholder="Qty" value="1" min="1" required>
            <button type="button" class="btn btn-danger remove-item" disabled>×</button>
        </div>
    `;
    modal.show();
}

function addRequestItem() {
    const container = document.getElementById('request-items');
    const newRow    = document.createElement('div');
    newRow.className = 'input-group mb-2';
    newRow.innerHTML = `
        <input type="text"   class="form-control item-name" placeholder="Item name" required>
        <input type="number" class="form-control item-qty"  placeholder="Qty" value="1" min="1" required>
        <button type="button" class="btn btn-danger remove-item">×</button>
    `;
    newRow.querySelector('.remove-item').addEventListener('click', () => newRow.remove());
    container.appendChild(newRow);
}

async function handleRequestSubmit(e) {
    e.preventDefault();

    const type     = document.getElementById('req-type').value;
    const itemRows = document.querySelectorAll('#request-items .input-group');
    const items    = [];

    itemRows.forEach(row => {
        const name = row.querySelector('.item-name').value.trim();
        const qty  = parseInt(row.querySelector('.item-qty').value);
        if (name && qty > 0) items.push({ name, qty });
    });

    if (items.length === 0) {
        showToast('Please add at least one item', 'danger');
        return;
    }

    const { ok, data } = await apiCall('/requests', {
        method: 'POST',
        body:   JSON.stringify({ type, items })
    });

    if (ok) {
        showToast('Request submitted successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
        renderRequestsList();
    } else {
        showToast(data.error || 'Failed to submit request', 'danger');
    }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 150);
    }, 2500);
}