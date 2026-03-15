async function login(username, password) {
  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Save token in memory (or sessionStorage for page refresh)
      sessionStorage.setItem('authToken', data.token);
      showDashboard(data.user);
    } else {
      alert('Login failed: ' + data.error);
    }
  } catch (err) {
    alert('Network error');
  }
}

function getAuthHeader() {
  const token = sessionStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Example: Fetch admin data
async function loadAdminDashboard() {
  const res = await fetch('http://localhost:3000/api/admin/dashboard', {
    headers: getAuthHeader()
  });

  if (res.ok) {
    const data = await res.json();
    document.getElementById('content').innerText = data.message;
  } else {
    document.getElementById('content').innerText = 'Access denied!';
  }
}