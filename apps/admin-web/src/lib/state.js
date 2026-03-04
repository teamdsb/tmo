import { storageKeys } from './env';

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write errors
  }
};

const removeKey = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage remove errors
  }
};

export const readMockSession = () => readJson(storageKeys.mockSession);

export const saveMockSession = (session) => {
  writeJson(storageKeys.mockSession, session);
};

export const clearMockSession = () => {
  removeKey(storageKeys.mockSession);
};

export const readAuthState = () => readJson(storageKeys.authState);

export const saveAuthState = (state) => {
  writeJson(storageKeys.authState, state);
};

export const clearAuthState = () => {
  removeKey(storageKeys.authState);
};

export const getAccessToken = () => {
  const state = readAuthState();
  if (!state || typeof state.accessToken !== 'string' || !state.accessToken.trim()) {
    return '';
  }
  return state.accessToken.trim();
};

export const clearAllSessions = () => {
  clearMockSession();
  clearAuthState();
};
