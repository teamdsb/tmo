import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchRbacPermissions, fetchRbacRoles, replaceRbacRolePermissions } from '../../../lib/api';
import { isAllowedAdminWebRole } from '../../../lib/admin-role-policy';

type RbacScope = 'SELF' | 'OWNED' | 'ALL';

type RbacPermission = {
  code: string;
  scope: RbacScope;
};

type RbacRole = {
  code: string;
  userType: 'customer' | 'staff' | 'admin';
  description?: string;
  permissions: RbacPermission[];
};

type PermissionCatalogItem = {
  code: string;
};

const RBAC_SCOPES: RbacScope[] = ['SELF', 'OWNED', 'ALL'];

const isScope = (value: unknown): value is RbacScope => {
  return RBAC_SCOPES.includes(String(value || '').toUpperCase() as RbacScope);
};

const parseRolePermissions = (value: unknown): RbacPermission[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = item as { code?: unknown; scope?: unknown };
      const code = String(record?.code || '').trim();
      const rawScope = String(record?.scope || '').toUpperCase();
      if (!code || !isScope(rawScope)) {
        return null;
      }
      return {
        code,
        scope: rawScope
      } as RbacPermission;
    })
    .filter(Boolean) as RbacPermission[];
};

const parseRoles = (value: unknown): RbacRole[] => {
  const items = (value as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const record = item as {
        code?: unknown;
        userType?: unknown;
        description?: unknown;
        permissions?: unknown[];
      };
      const code = String(record?.code || '').trim().toUpperCase();
      if (!code) {
        return null;
      }
      const userType = String(record?.userType || 'staff').toLowerCase();
      const normalizedUserType: RbacRole['userType'] =
        userType === 'admin' || userType === 'customer' || userType === 'staff' ? userType : 'staff';

      return {
        code,
        userType: normalizedUserType,
        description: typeof record?.description === 'string' ? record.description : '',
        permissions: parseRolePermissions(record?.permissions)
      } as RbacRole;
    })
    .filter(Boolean) as RbacRole[];
};

const filterAllowedRoles = (roles: RbacRole[]) => {
  return roles.filter((role) => isAllowedAdminWebRole(role.code));
};

const parsePermissionCatalog = (value: unknown): PermissionCatalogItem[] => {
  const items = (value as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const record = item as { code?: unknown };
      const code = String(record?.code || '').trim();
      if (!code) {
        return null;
      }
      return { code };
    })
    .filter(Boolean) as PermissionCatalogItem[];
};

const clonePermissions = (permissions: RbacPermission[]) => {
  return permissions.map((permission) => ({ ...permission }));
};

const buildDraftByRole = (roles: RbacRole[]): Record<string, RbacPermission[]> => {
  const nextDrafts: Record<string, RbacPermission[]> = {};
  roles.forEach((role) => {
    nextDrafts[role.code] = clonePermissions(role.permissions);
  });
  return nextDrafts;
};

const userTypeLabel: Record<RbacRole['userType'], string> = {
  admin: '管理员',
  customer: '客户',
  staff: '员工'
};

const extractResponseMessage = (response: unknown) => {
  const message = (response as { data?: { message?: unknown } })?.data?.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }
  return '';
};

const responseErrorText = (status: number, fallback: string, serverMessage?: string) => {
  const message = serverMessage || '';
  if (status === 401) {
    return '登录已过期或无效，请重新登录后重试。';
  }
  if (status === 403) {
    return '当前账号没有 RBAC 管理权限（rbac:manage）。';
  }
  if (status >= 500) {
    return message || '服务端错误，请稍后重试。';
  }
  return message || fallback;
};

const validatePermissions = (permissions: RbacPermission[]) => {
  const seen = new Set<string>();
  for (const permission of permissions) {
    const code = String(permission.code || '').trim();
    if (!code) {
      return '权限 code 不能为空。';
    }
    if (!isScope(permission.scope)) {
      return `权限 ${code} 的 scope 非法：${String(permission.scope)}。`;
    }
    if (seen.has(code)) {
      return `存在重复权限 code：${code}。`;
    }
    seen.add(code);
  }
  return '';
};

export const RbacPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState('');
  const [catalogCodes, setCatalogCodes] = useState<string[]>([]);
  const [draftByRole, setDraftByRole] = useState<Record<string, RbacPermission[]>>({});
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([fetchRbacRoles(), fetchRbacPermissions()]);

      if (rolesResponse.status !== 200) {
        setError(responseErrorText(rolesResponse.status, '加载角色失败。', extractResponseMessage(rolesResponse)));
        return;
      }
      if (permissionsResponse.status !== 200) {
        setError(responseErrorText(permissionsResponse.status, '加载权限目录失败。', extractResponseMessage(permissionsResponse)));
        return;
      }

      const nextRoles = filterAllowedRoles(parseRoles(rolesResponse.data));
      const nextCatalog = parsePermissionCatalog(permissionsResponse.data);

      setRoles(nextRoles);
      setCatalogCodes(nextCatalog.map((item) => item.code));
      setDraftByRole(buildDraftByRole(nextRoles));
      setDirtyRoles(new Set());
      setSelectedRoleCode((previous) => {
        if (previous && nextRoles.some((role) => role.code === previous)) {
          return previous;
        }
        return nextRoles[0]?.code || '';
      });
    } catch {
      setError('加载 RBAC 数据失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRoles = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return roles;
    }
    return roles.filter((role) => {
      const inCode = role.code.toLowerCase().includes(keyword);
      const inDesc = String(role.description || '').toLowerCase().includes(keyword);
      const inType = role.userType.toLowerCase().includes(keyword);
      return inCode || inDesc || inType;
    });
  }, [roles, searchKeyword]);

  const selectedRole = useMemo(() => {
    return roles.find((role) => role.code === selectedRoleCode) || null;
  }, [roles, selectedRoleCode]);

  const selectedDraft = useMemo(() => {
    if (!selectedRoleCode) {
      return [] as RbacPermission[];
    }
    return draftByRole[selectedRoleCode] ? clonePermissions(draftByRole[selectedRoleCode]) : [];
  }, [draftByRole, selectedRoleCode]);

  const selectedCodeOptions = useMemo(() => {
    const options = new Set<string>(catalogCodes);
    selectedDraft.forEach((item) => {
      if (item.code) {
        options.add(item.code);
      }
    });
    return Array.from(options);
  }, [catalogCodes, selectedDraft]);

  const markRoleDirty = useCallback((roleCode: string, nextPermissions: RbacPermission[]) => {
    setDraftByRole((previous) => ({
      ...previous,
      [roleCode]: clonePermissions(nextPermissions)
    }));
    setDirtyRoles((previous) => {
      const next = new Set(previous);
      next.add(roleCode);
      return next;
    });
    setSaveMessage('');
    setError('');
  }, []);

  const updatePermissionCode = useCallback(
    (index: number, nextCode: string) => {
      if (!selectedRoleCode) {
        return;
      }
      const current = draftByRole[selectedRoleCode] ? clonePermissions(draftByRole[selectedRoleCode]) : [];
      if (!current[index]) {
        return;
      }
      current[index] = {
        ...current[index],
        code: nextCode
      };
      markRoleDirty(selectedRoleCode, current);
    },
    [draftByRole, markRoleDirty, selectedRoleCode]
  );

  const updatePermissionScope = useCallback(
    (index: number, nextScope: string) => {
      if (!selectedRoleCode || !isScope(nextScope)) {
        return;
      }
      const current = draftByRole[selectedRoleCode] ? clonePermissions(draftByRole[selectedRoleCode]) : [];
      if (!current[index]) {
        return;
      }
      current[index] = {
        ...current[index],
        scope: nextScope
      };
      markRoleDirty(selectedRoleCode, current);
    },
    [draftByRole, markRoleDirty, selectedRoleCode]
  );

  const removePermission = useCallback(
    (index: number) => {
      if (!selectedRoleCode) {
        return;
      }
      const current = draftByRole[selectedRoleCode] ? clonePermissions(draftByRole[selectedRoleCode]) : [];
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      markRoleDirty(selectedRoleCode, next);
    },
    [draftByRole, markRoleDirty, selectedRoleCode]
  );

  const addPermission = useCallback(() => {
    if (!selectedRoleCode) {
      return;
    }

    const current = draftByRole[selectedRoleCode] ? clonePermissions(draftByRole[selectedRoleCode]) : [];
    const usedCodes = new Set(current.map((item) => item.code));
    const candidateCode = catalogCodes.find((code) => !usedCodes.has(code));
    if (!candidateCode) {
      setError('可选权限已全部添加，无法继续新增。');
      return;
    }

    const next: RbacPermission[] = [
      ...current,
      {
        code: candidateCode,
        scope: 'SELF'
      }
    ];
    markRoleDirty(selectedRoleCode, next);
  }, [catalogCodes, draftByRole, markRoleDirty, selectedRoleCode]);

  const discardChanges = useCallback(() => {
    if (saving) {
      return;
    }
    setSaveMessage('');
    void loadData();
  }, [loadData, saving]);

  const saveChanges = useCallback(async () => {
    if (saving) {
      return;
    }
    setError('');
    setSaveMessage('');

    const dirtyInOrder = roles.map((role) => role.code).filter((code) => dirtyRoles.has(code));
    if (dirtyInOrder.length === 0) {
      setSaveMessage('没有需要保存的变更。');
      return;
    }

    for (const roleCode of dirtyInOrder) {
      const permissions = draftByRole[roleCode] ? clonePermissions(draftByRole[roleCode]) : [];
      const validationError = validatePermissions(permissions);
      if (validationError) {
        setError(`[${roleCode}] ${validationError}`);
        return;
      }
    }

    setSaving(true);
    try {
      for (const roleCode of dirtyInOrder) {
        const permissions = draftByRole[roleCode] ? clonePermissions(draftByRole[roleCode]) : [];
        const response = await replaceRbacRolePermissions(roleCode, permissions);
        if (response.status !== 204) {
          const fallback = `保存角色 ${roleCode} 失败。`;
          const message = responseErrorText(response.status, fallback, extractResponseMessage(response));
          setError(`[${roleCode}] ${message}`);
          return;
        }
      }

      await loadData();
      setSaveMessage('所有变更已保存。');
    } catch {
      setError('保存失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  }, [dirtyRoles, draftByRole, loadData, roles, saving]);

  return (
    <main className="flex h-screen flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border-light bg-surface-light px-8 py-5 dark:border-border-dark dark:bg-surface-dark">
        <div>
          <h1 className="text-2xl font-bold text-text-main dark:text-white">角色与权限</h1>
        </div>
        <div className="flex gap-3">
          <button
            className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-surface-dark dark:text-white dark:hover:bg-gray-800"
            disabled={loading || saving}
            onClick={discardChanges}
            type="button"
          >
            取消
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || saving}
            onClick={() => {
              void saveChanges();
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {saving ? '保存中...' : `保存变更${dirtyRoles.size > 0 ? ` (${dirtyRoles.size})` : ''}`}
          </button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-8 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              className="rounded border border-red-300 px-2 py-1 text-xs font-medium transition-colors hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/40"
              onClick={() => {
                void loadData();
              }}
              type="button"
            >
              重试
            </button>
          </div>
        </div>
      ) : null}

      {saveMessage ? (
        <div className="border-b border-green-200 bg-green-50 px-8 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
          {saveMessage}
        </div>
      ) : null}

      <div className="flex flex-1 flex-row overflow-hidden">
        <div className="flex w-80 flex-col overflow-y-auto border-r border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
          <div className="sticky top-0 z-10 border-b border-border-light bg-surface-light/60 p-4 backdrop-blur-sm dark:border-border-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">角色</h2>
              <span className="rounded-full border border-border-light px-2 py-0.5 text-xs text-text-secondary dark:border-border-dark">
                {roles.length}
              </span>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute top-2.5 left-2.5 text-lg text-text-secondary">search</span>
              <input
                className="w-full rounded-lg border border-border-light bg-white py-2 pr-3 pl-9 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-surface-dark"
                onChange={(event) => {
                  setSearchKeyword(event.target.value);
                }}
                placeholder="搜索角色..."
                type="text"
                value={searchKeyword}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3">
            {!loading && filteredRoles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-light bg-white p-4 text-sm text-text-secondary dark:border-border-dark dark:bg-surface-dark">
                未找到可管理的角色。
              </div>
            ) : null}

            {filteredRoles.map((role) => {
              const active = role.code === selectedRoleCode;
              const isDirty = dirtyRoles.has(role.code);
              return (
                <button
                  className={`rounded-lg border p-3 text-left transition-all ${
                    active
                      ? 'border-primary bg-white shadow-sm ring-1 ring-primary/20 dark:bg-surface-dark'
                      : 'border-transparent hover:border-border-light hover:bg-white dark:hover:border-border-dark dark:hover:bg-surface-dark'
                  }`}
                  key={role.code}
                  onClick={() => {
                    setSelectedRoleCode(role.code);
                    setSaveMessage('');
                  }}
                  type="button"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-main dark:text-white">{role.code}</h3>
                    <span className={`mt-0.5 h-2 w-2 rounded-full ${isDirty ? 'bg-amber-500' : active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary">{userTypeLabel[role.userType]}</p>
                  {role.description ? <p className="mt-1 text-xs leading-relaxed text-text-secondary">{role.description}</p> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-light p-8 dark:bg-surface-dark">
          {loading ? (
            <div className="rounded-xl border border-border-light bg-white p-6 text-sm text-text-secondary shadow-sm dark:border-border-dark dark:bg-surface-dark">
              正在加载 RBAC 配置...
            </div>
          ) : null}

          {!loading && roles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-light bg-white p-8 text-center text-sm text-text-secondary shadow-sm dark:border-border-dark dark:bg-surface-dark">
              当前平台无可管理角色（仅支持 ADMIN / BOSS / MANAGER / CS）。
            </div>
          ) : null}

          {!loading && selectedRole ? (
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex items-start justify-between border-b border-border-light pb-6 dark:border-border-dark">
                <div>
                  <h2 className="text-xl font-bold text-text-main dark:text-white">{selectedRole.code} 配置</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    用户类型：<span className="font-medium uppercase">{userTypeLabel[selectedRole.userType]}</span>
                  </p>
                  {selectedRole.description ? <p className="mt-1 text-sm text-text-secondary">{selectedRole.description}</p> : null}
                </div>
                <button
                  className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-gray-50 dark:border-border-dark dark:text-white dark:hover:bg-gray-800"
                  onClick={addPermission}
                  type="button"
                >
                  新增权限
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-surface-dark">
                <div className="grid grid-cols-12 gap-3 border-b border-border-light bg-background-light px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary dark:border-border-dark dark:bg-background-dark">
                  <div className="col-span-7">权限编码</div>
                  <div className="col-span-3">范围</div>
                  <div className="col-span-2 text-right">操作</div>
                </div>

                {selectedDraft.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-text-secondary">当前角色未分配权限。</div>
                ) : (
                  <div className="divide-y divide-border-light dark:divide-border-dark">
                    {selectedDraft.map((permission, index) => (
                      <div className="grid grid-cols-12 gap-3 px-4 py-3" key={`${permission.code}-${index}`}>
                        <div className="col-span-7">
                          <select
                            className="form-select w-full rounded-md border-border-light bg-white py-2 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            onChange={(event) => {
                              updatePermissionCode(index, event.target.value);
                            }}
                            value={permission.code}
                          >
                            {selectedCodeOptions.map((code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <select
                            className="form-select w-full rounded-md border-border-light bg-white py-2 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            onChange={(event) => {
                              updatePermissionScope(index, event.target.value);
                            }}
                            value={permission.scope}
                          >
                            {RBAC_SCOPES.map((scope) => (
                              <option key={scope} value={scope}>
                                {scope}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                            onClick={() => {
                              removePermission(index);
                            }}
                            type="button"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
};
