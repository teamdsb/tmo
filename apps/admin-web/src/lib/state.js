import { storageKeys } from './env';

// 读取 JSON 存储并做基础结构校验。
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

// 写入 JSON 存储（失败时静默兜底）。
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write errors
  }
};

// 删除存储键。
const removeKey = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage remove errors
  }
};

// 读取 mock 会话。
export const readMockSession = () => readJson(storageKeys.mockSession);

// 保存 mock 会话。
export const saveMockSession = (session) => {
  writeJson(storageKeys.mockSession, session);
};

// 清理 mock 会话。
export const clearMockSession = () => {
  removeKey(storageKeys.mockSession);
};

// 读取 dev 认证状态。
export const readAuthState = () => readJson(storageKeys.authState);

// 保存 dev 认证状态。
export const saveAuthState = (state) => {
  writeJson(storageKeys.authState, state);
};

// 清理 dev 认证状态。
export const clearAuthState = () => {
  removeKey(storageKeys.authState);
};

// 提取 access token（含空值保护）。
export const getAccessToken = () => {
  const state = readAuthState();
  if (!state || typeof state.accessToken !== 'string' || !state.accessToken.trim()) {
    return '';
  }
  return state.accessToken.trim();
};

// 一键清理 mock + dev 全部会话。
export const clearAllSessions = () => {
  clearMockSession();
  clearAuthState();
};
