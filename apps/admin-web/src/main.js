const form = document.querySelector('#login-form');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const roleSelect = document.querySelector('#role');
const togglePasswordButton = document.querySelector('#toggle-password');
const togglePasswordIcon = document.querySelector('#toggle-password-icon');
const SESSION_KEY = 'tmo:admin:web:session';

const readSession = () => {
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

const saveSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
};

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
  const session = readSession();
  if (session) {
    window.location.replace('/dashboard.html');
  }
}

if (togglePasswordButton && passwordInput && togglePasswordIcon) {
  togglePasswordButton.addEventListener('click', () => {
    const nextType = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = nextType;
    togglePasswordIcon.textContent = nextType === 'password' ? 'visibility_off' : 'visibility';
  });
}

if (form && usernameInput && passwordInput && roleSelect) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const username = String(usernameInput.value || '').trim();
    const password = String(passwordInput.value || '');
    const role = String(roleSelect.value || '');

    if (!username || !password) {
      window.alert('Please enter username and password.');
      return;
    }

    saveSession({
      username,
      role,
      loginAt: new Date().toISOString()
    });
    window.location.href = '/dashboard.html';
  });
}
