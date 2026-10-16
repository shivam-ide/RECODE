import React from 'react';

/**
 * PillBadge: Flat rounded chip for language, step, and status tags.
 * Designed strictly to YouTube Dark Mode specification with no blurry glow or bleed.
 */
export default function PillBadge({
  children,
  label,
  variant = 'default', // 'default' | 'language' | 'step' | 'status' | 'cyan' | 'clean' | 'muted'
  size = 'md', // 'sm' | 'md' | 'lg'
  dot = false,
  dotColor,
  icon: Icon,
  className = '',
  onClick,
  ...props
}) {
  const content = label || children;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs font-medium px-2.5 py-1 gap-2',
    lg: 'text-sm font-medium px-3 py-1.5 gap-2.5',
  }[size] || 'text-xs font-medium px-2.5 py-1 gap-2';

  const variantClasses = {
    default: 'bg-[#212121] text-[#F1F1F1] border border-[#303030]',
    language: 'bg-[#181818] text-[#F1F1F1] border border-[#303030] font-mono tracking-wide',
    step: 'bg-[#212121] text-[#AAAAAA] border border-[#3F3F3F]',
    status: 'bg-[#181818] text-[#F1F1F1] border border-[#303030]',
    cyan: 'bg-[#02C8F0]/10 text-[#02C8F0] border border-[#02C8F0]/30',
    clean: 'bg-[#27C93F]/10 text-[#27C93F] border border-[#27C93F]/30',
    muted: 'bg-[#181818] text-[#717171] border border-[#303030]',
  }[variant] || 'bg-[#212121] text-[#F1F1F1] border border-[#303030]';

  const defaultDotColor = {
    clean: '#27C93F',
    cyan: '#02C8F0',
    status: '#27C93F',
    step: '#AAAAAA',
    language: '#02C8F0',
  }[variant] || '#AAAAAA';

  const effectiveDotColor = dotColor || defaultDotColor;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full leading-none select-none transition-colors duration-150 ${sizeClasses} ${variantClasses} ${
        onClick ? 'cursor-pointer hover:border-[#3F3F3F] hover:bg-[#252525]' : ''
      } ${className}`}
      onClick={onClick}
      {...props}
    >
      {Icon && (
        <span className="flex-shrink-0 inline-flex items-center">
          {typeof Icon === 'function' || typeof Icon === 'object' ? <Icon className="w-3.5 h-3.5" /> : Icon}
        </span>
      )}
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: effectiveDotColor }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{content}</span>
    </span>
  );
}
