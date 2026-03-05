import { useEffect, useState } from 'react';

import { getCurrentSession, getDisplayProfile, getRoleLabel, logout } from '../../../lib/auth';
import { fetchMe } from '../../../lib/api';
import { isDevMode } from '../../../lib/env';
import { AdminTopbar } from '../../layout/AdminTopbar';

type ProfileViewModel = {
  displayName: string;
  roleLabel: string;
  username: string;
  userId: string;
  userType: string;
  createdAt: string;
  phone: string;
  status: string;
};

type RealProfileViewModel = ProfileViewModel;

type ProfileLoadState = 'loading' | 'ready' | 'error';

const EMPTY_VALUE = '-';

const normalizeText = (value: unknown, fallback = EMPTY_VALUE) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const formatDateTime = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return EMPTY_VALUE;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

const formatUserType = (value: unknown) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'admin') return '管理员';
  if (normalized === 'staff') return '员工';
  if (normalized === 'customer') return '客户';
  return EMPTY_VALUE;
};

const formatStatus = (value: unknown) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'active') return '启用';
  if (normalized === 'disabled') return '禁用';
  return EMPTY_VALUE;
};

const resolveRoleCodeFromMe = (me: Record<string, unknown>) => {
  const priority = ['BOSS', 'MANAGER', 'ADMIN', 'CS', 'SALES', 'CUSTOMER'];
  const roles = Array.isArray(me.roles)
    ? me.roles.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)
    : [];

  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }

  if (roles.length > 0) {
    return roles[0];
  }

  const userType = String(me.userType || '').toLowerCase();
  if (userType === 'admin') return 'ADMIN';
  if (userType === 'customer') return 'CUSTOMER';
  if (userType === 'staff') return 'CS';
  return '';
};

const buildRealProfileData = (meRaw: unknown): RealProfileViewModel => {
  const me = (meRaw && typeof meRaw === 'object') ? meRaw as Record<string, unknown> : {};
  const roleCode = resolveRoleCodeFromMe(me);

  return {
    displayName: normalizeText(me.displayName),
    roleLabel: roleCode ? getRoleLabel(roleCode) : EMPTY_VALUE,
    username: EMPTY_VALUE,
    userId: normalizeText(me.id),
    userType: formatUserType(me.userType),
    createdAt: formatDateTime(me.createdAt),
    phone: normalizeText(me.phone),
    status: formatStatus(me.status)
  };
};

const buildMockProfileData = (session: unknown): ProfileViewModel => {
  const displayProfile = getDisplayProfile();
  const sessionRecord = (session && typeof session === 'object') ? session as Record<string, unknown> : null;
  const sessionUser = (sessionRecord?.user && typeof sessionRecord.user === 'object')
    ? sessionRecord.user as Record<string, unknown>
    : null;

  const primaryRole = String(sessionRecord?.currentRole || (Array.isArray(sessionUser?.roles) ? sessionUser.roles[0] : '') || '').trim();

  return {
    displayName: normalizeText(sessionUser?.displayName, normalizeText(displayProfile?.name)),
    roleLabel: normalizeText(displayProfile?.role, primaryRole ? getRoleLabel(primaryRole) : EMPTY_VALUE),
    username: normalizeText(sessionRecord?.username),
    userId: normalizeText(sessionUser?.id),
    userType: formatUserType(sessionUser?.userType),
    createdAt: formatDateTime(sessionUser?.createdAt),
    phone: normalizeText(sessionUser?.phone),
    status: formatStatus(sessionUser?.status)
  };
};

const emptyRealProfile: RealProfileViewModel = {
  displayName: EMPTY_VALUE,
  roleLabel: EMPTY_VALUE,
  username: EMPTY_VALUE,
  userId: EMPTY_VALUE,
  userType: EMPTY_VALUE,
  createdAt: EMPTY_VALUE,
  phone: EMPTY_VALUE,
  status: EMPTY_VALUE
};

const DataRow = ({ label, value, note }: { label: string; value: string; note?: string }) => {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <div className="text-right">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
        {note ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{note}</p> : null}
      </div>
    </div>
  );
};

// 个人资料页：mock 使用本地会话，dev(real) 严格使用 /me 后端数据。
export const ProfilePage = () => {
  const isRealMode = isDevMode;
  const [profile, setProfile] = useState<ProfileViewModel>(() => {
    if (isRealMode) {
      return emptyRealProfile;
    }
    return buildMockProfileData(getCurrentSession());
  });
  const [loadState, setLoadState] = useState<ProfileLoadState>(isRealMode ? 'loading' : 'ready');

  useEffect(() => {
    if (!isRealMode) {
      setLoadState('ready');
      return;
    }

    let alive = true;

    const loadRealProfile = async () => {
      setLoadState('loading');

      try {
        const response = await fetchMe();
        if (!alive) {
          return;
        }

        if (response.status === 200 && response.data) {
          setProfile(buildRealProfileData(response.data));
          setLoadState('ready');
          return;
        }

        if (response.status === 401 || response.status === 403) {
          logout();
          return;
        }

        setProfile(emptyRealProfile);
        setLoadState('error');
      } catch {
        if (!alive) {
          return;
        }

        setProfile(emptyRealProfile);
        setLoadState('error');
      }
    };

    void loadRealProfile();

    return () => {
      alive = false;
    };
  }, [isRealMode]);

  const statusText = isRealMode
    ? (loadState === 'loading'
      ? '正在同步实时信息...'
      : loadState === 'ready'
        ? '已加载后端实时资料'
        : '实时资料拉取失败，请稍后重试')
    : '已加载当前账号资料';

  return (
    <>
      <AdminTopbar
        leftSlot={<div className="text-sm font-semibold text-slate-900 dark:text-white">个人资料</div>}
        searchPlaceholder="搜索..."
      />
      <main className="flex-1 min-h-0 overflow-y-auto bg-background-light p-6 dark:bg-background-dark">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">个人资料</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{statusText}</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {profile.roleLabel}
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                {profile.displayName.slice(0, 1) || EMPTY_VALUE}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{profile.displayName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{profile.userType}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 px-4 dark:border-slate-800">
              <DataRow
                label="账号"
                note={isRealMode ? '后端暂未提供账号字段' : undefined}
                value={profile.username}
              />
              <DataRow label="用户 ID" value={profile.userId} />
              <DataRow label="手机号" value={profile.phone} />
              <DataRow label="状态" value={profile.status} />
              <DataRow label="创建时间" value={profile.createdAt} />
            </div>
          </section>
        </div>
      </main>
    </>
  );
};
