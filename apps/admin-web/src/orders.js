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

const logoutLink = document.querySelector('#logout-link');
if (logoutLink) {
  logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    clearSessionAndBackToLogin();
  });
}
