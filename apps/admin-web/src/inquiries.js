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

if (!getSession()) {
  window.location.href = '/';
}
