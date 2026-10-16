import React, { useState } from 'react';
import logoAsset from '../../assets/logo.svg';

/**
 * BrandLogo: Bulletproof Re:Code logo component.
 * Uses Vite asset import with public path fallbacks and an inline SVG fallback
 * to guarantee that a broken image icon is never shown.
 */
export default function BrandLogo({ className = 'h-7 w-auto', alt = 'Re:Code Logo' }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(logoAsset);

  const handleError = () => {
    if (currentSrc === logoAsset) {
      setCurrentSrc('/Logo.svg');
    } else if (currentSrc === '/Logo.svg') {
      setCurrentSrc('/logo.svg');
    } else {
      setLoadFailed(true);
    }
  };

  if (loadFailed) {
    // Beautiful inline SVG fallback representing { Re:Code }
    return (
      <div className={`flex items-center gap-1.5 font-mono font-bold select-none ${className}`}>
        <span className="text-[#02C8F0] text-xl leading-none font-semibold">{'{'}</span>
        <span className="text-[#02C8F0] tracking-tight text-base font-bold">Re</span>
        <span className="text-[#F1F1F1] tracking-tight text-base font-bold">:Code</span>
        <span className="text-[#02C8F0] text-xl leading-none font-semibold">{'}'}</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      className={`object-contain transition-opacity duration-150 ${className}`}
    />
  );
}
