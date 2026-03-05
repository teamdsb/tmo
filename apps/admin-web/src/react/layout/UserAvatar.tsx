import { useEffect, useState } from 'react';

type UserAvatarProps = {
  avatarUrl?: string;
  fallbackLetter: string;
  className?: string;
  textClassName?: string;
};

const joinClasses = (...classes: Array<string | undefined>) => {
  return classes.filter(Boolean).join(' ');
};

// 统一头像渲染：优先图片，加载失败自动回退首字母。
export const UserAvatar = ({ avatarUrl, fallbackLetter, className, textClassName }: UserAvatarProps) => {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [avatarUrl]);

  const shouldShowImage = Boolean(avatarUrl) && !imageLoadFailed;

  return (
    <div
      className={joinClasses(
        'flex items-center justify-center overflow-hidden rounded-full bg-slate-200 text-primary dark:bg-slate-700 dark:text-slate-100',
        className
      )}
    >
      {shouldShowImage ? (
        <img
          alt="用户头像"
          className="h-full w-full object-cover"
          onError={() => setImageLoadFailed(true)}
          src={avatarUrl}
        />
      ) : (
        <span className={joinClasses('select-none text-base font-semibold leading-none', textClassName)}>
          {fallbackLetter || '?'}
        </span>
      )}
    </div>
  );
};

