export type AvatarModel = {
  avatarUrl?: string;
  fallbackLetter: string;
};

const EMPTY_FALLBACK_LETTER = '?';

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const isValidAvatarUrl = (value: string) => {
  if (!value) {
    return false;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return true;
  }
  if (value.startsWith('/')) {
    return true;
  }
  if (value.startsWith('data:image/')) {
    return true;
  }
  return false;
};

const resolveFallbackLetter = (displayName: string) => {
  if (!displayName || displayName === '-') {
    return EMPTY_FALLBACK_LETTER;
  }
  const [firstChar] = Array.from(displayName);
  if (!firstChar) {
    return EMPTY_FALLBACK_LETTER;
  }
  return firstChar.toUpperCase();
};

// 统一头像来源解析：优先 avatarUrl，缺失时回退 displayName 首字母。
export const resolveAvatarModel = (user: unknown): AvatarModel => {
  const record = (user && typeof user === 'object') ? user as Record<string, unknown> : null;
  const displayName = normalizeText(record?.displayName ?? record?.name);
  const rawAvatarUrl = normalizeText(record?.avatarUrl ?? record?.avatarURL);
  const avatarUrl = isValidAvatarUrl(rawAvatarUrl) ? rawAvatarUrl : undefined;

  return {
    avatarUrl,
    fallbackLetter: resolveFallbackLetter(displayName)
  };
};

