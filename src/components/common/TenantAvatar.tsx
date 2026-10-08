import React from 'react';

// Tenant picture: their real photo when one exists, otherwise their initials.
// Older tenant records all carry the same Unsplash stock photo as a
// placeholder, which made every tenant look like the same person - those are
// treated as "no photo".
export const isPlaceholderPhoto = (url?: string) => !url || url.includes('images.unsplash.com');

export const TenantAvatar: React.FC<{ name?: string; photoUrl?: string; className?: string }> = ({
  name,
  photoUrl,
  className = 'w-10 h-10 rounded-xl',
}) => {
  if (!isPlaceholderPhoto(photoUrl)) {
    return <img src={photoUrl} alt={name || 'Tenant'} className={`${className} object-cover`} />;
  }
  const initials =
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?';
  return (
    <div
      aria-label={name || 'Tenant'}
      className={`${className} bg-brand-100 text-brand-800 font-black flex items-center justify-center select-none`}
    >
      <span className="text-[0.8em] leading-none">{initials}</span>
    </div>
  );
};
