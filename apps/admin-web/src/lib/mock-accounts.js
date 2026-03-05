import { adminWebMockAccounts, buildPermissionListForRole } from '../../../../packages/shared/src/mock-data/auth.js';

const cloneMockAccount = (account) => {
  const role = String(account?.role || '').trim().toUpperCase();
  return {
    ...account,
    role,
    permissions: buildPermissionListForRole(role)
  };
};

export const listMockAccounts = () => {
  return adminWebMockAccounts.map((account) => cloneMockAccount(account));
};

export const resolveMockAccount = (username, password) => {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  if (!normalizedUsername || !rawPassword) {
    return null;
  }

  const matched = adminWebMockAccounts.find(
    (account) => account.username === normalizedUsername && account.password === rawPassword
  );
  if (!matched) {
    return null;
  }
  return cloneMockAccount(matched);
};
