import React from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';

/**
 * SeverityChip: Matte colored tag for Critical, High, Medium, Low, Info, and Clean statuses.
 * Engineered for Re:Code AST security engine diagnostics with strict matte finishes (zero blur/glow).
 */
export default function SeverityChip({
  severity = 'info', // 'critical' | 'high' | 'medium' | 'med' | 'low' | 'info' | 'clean'
  label,
  count,
  variant = 'matte', // 'matte' | 'solid' | 'outline'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = true,
  className = '',
  onClick,
  ...props
}) {
  const normalizedSeverity = (severity || 'info').toLowerCase();
  const key = normalizedSeverity === 'med' ? 'medium' : normalizedSeverity;

  const severityConfigs = {
    critical: {
      defaultLabel: 'Critical',
      color: '#FF4D4D',
      bgMatte: 'bg-[#261515]',
      borderMatte: 'border-[#5C2323]',
      textMatte: 'text-[#FF4D4D]',
      bgSolid: 'bg-[#FF4D4D]',
      textSolid: 'text-[#0F0F0F]',
      icon: ShieldAlert,
    },
    high: {
      defaultLabel: 'High',
      color: '#FFA116',
      bgMatte: 'bg-[#291D13]',
      borderMatte: 'border-[#613C16]',
      textMatte: 'text-[#FFA116]',
      bgSolid: 'bg-[#FFA116]',
      textSolid: 'text-[#0F0F0F]',
      icon: AlertTriangle,
    },
    medium: {
      defaultLabel: 'Medium',
      color: '#FFD600',
      bgMatte: 'bg-[#292612]',
      borderMatte: 'border-[#635716]',
      textMatte: 'text-[#FFD600]',
      bgSolid: 'bg-[#FFD600]',
      textSolid: 'text-[#0F0F0F]',
      icon: AlertCircle,
    },
    low: {
      defaultLabel: 'Low',
      color: '#78DFFF',
      bgMatte: 'bg-[#142329]',
      borderMatte: 'border-[#214D5C]',
      textMatte: 'text-[#78DFFF]',
      bgSolid: 'bg-[#78DFFF]',
      textSolid: 'text-[#0F0F0F]',
      icon: Info,
    },
    info: {
      defaultLabel: 'Info',
      color: '#02C8F0',
      bgMatte: 'bg-[#122429]',
      borderMatte: 'border-[#1C4E59]',
      textMatte: 'text-[#02C8F0]',
      bgSolid: 'bg-[#02C8F0]',
      textSolid: 'text-[#0F0F0F]',
      icon: Info,
    },
    clean: {
      defaultLabel: 'Clean',
      color: '#27C93F',
      bgMatte: 'bg-[#142617]',
      borderMatte: 'border-[#1E5728]',
      textMatte: 'text-[#27C93F]',
      bgSolid: 'bg-[#27C93F]',
      textSolid: 'text-[#0F0F0F]',
      icon: CheckCircle2,
    },
  };

  const config = severityConfigs[key] || severityConfigs.info;
  const displayLabel = label !== undefined ? label : config.defaultLabel;
  const IconComponent = config.icon;

  const sizeStyles = {
    sm: 'text-[11px] font-semibold px-2 py-0.5 gap-1.5 rounded',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5 rounded-md',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2 rounded-md',
  }[size] || 'text-xs font-semibold px-2.5 py-1 gap-1.5 rounded-md';

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size] || 'w-3.5 h-3.5';

  let variantStyle = '';
  if (variant === 'solid') {
    variantStyle = `${config.bgSolid} ${config.textSolid} border border-transparent font-bold`;
  } else if (variant === 'outline') {
    variantStyle = `bg-transparent ${config.textMatte} border border-current`;
  } else {
    // Matte (default)
    variantStyle = `${config.bgMatte} ${config.textMatte} border ${config.borderMatte}`;
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-mono tracking-tight leading-none select-none transition-colors duration-150 ${sizeStyles} ${variantStyle} ${
        onClick ? 'cursor-pointer hover:brightness-110 active:brightness-95' : ''
      } ${className}`}
      onClick={onClick}
      {...props}
    >
      {icon && (
        <span className="flex-shrink-0 inline-flex items-center">
          {typeof icon === 'boolean' ? (
            <IconComponent className={iconSizes} strokeWidth={2.2} />
          ) : (
            icon
          )}
        </span>
      )}
      <span className="uppercase">{displayLabel}</span>
      {count !== undefined && (
        <span
          className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            variant === 'solid'
              ? 'bg-black/25 text-inherit'
              : 'bg-black/40 text-inherit border border-current/30'
          }`}
        >
          {count}
        </span>
      )}
    </span>
  );
}
