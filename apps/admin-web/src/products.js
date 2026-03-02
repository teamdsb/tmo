const SESSION_KEY = 'tmo:admin:web:session';

const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const clearSessionAndBackToLogin = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  window.location.href = '/';
};

const session = getSession();
if (!session) {
  window.location.href = '/';
}

const userNameEl = document.querySelector('#user-name');
const userRoleEl = document.querySelector('#user-role');
const logoutButton = document.querySelector('#logout-btn');

const roleLabels = {
  admin: 'Administrator',
  sales: 'Sales Manager',
  support: 'Customer Service',
  logistics: 'Logistics Coordinator'
};

if (session && userNameEl) {
  const username = typeof session.username === 'string' ? session.username : '';
  userNameEl.textContent = username || 'Admin User';
}

if (session && userRoleEl) {
  const role = typeof session.role === 'string' ? session.role : '';
  userRoleEl.textContent = roleLabels[role] || 'Admin';
}

if (logoutButton) {
  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    clearSessionAndBackToLogin();
  });
}
