import { adminWebMockAccounts, buildPermissionListForRole } from '../../../../packages/shared/src/mock-data/auth.js';
import { isAllowedAdminWebRole } from './admin-role-policy';

// 克隆并补齐权限清单，避免污染共享源对象。
const cloneMockAccount = (account) => {
  const role = String(account?.role || '').trim().toUpperCase();
  return {
    ...account,
    role,
    permissions: buildPermissionListForRole(role)
  };
};

// 返回可登录的 mock 账号列表（含权限）。
export const listMockAccounts = () => {
  return adminWebMockAccounts
    .map((account) => cloneMockAccount(account))
    .filter((account) => isAllowedAdminWebRole(account.role));
};

// 按用户名密码匹配 mock 账号。
export const resolveMockAccount = (username, password) => {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  if (!normalizedUsername || !rawPassword) {
    return null;
  }

  const matched = listMockAccounts().find((account) => {
    return account.username === normalizedUsername && account.password === rawPassword;
  });
  if (!matched) {
    return null;
  }
  return cloneMockAccount(matched);
};
