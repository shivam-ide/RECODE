import React, { useState } from 'react';
import logoPng from '../../assets/logo.png';
import logoSvg from '../../assets/logo.svg';

/**
 * BrandLogo: Bulletproof Re:Code logo component.
 * Uses official SVG logo (/Logo.svg) with PNG and inline SVG fallbacks.
 */
export default function BrandLogo({ className = 'h-7 w-auto', alt = 'Re:Code Logo', src = '/Logo.svg' }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src || '/Logo.svg');

  const handleError = () => {
    if (currentSrc === '/Logo.svg') {
      setCurrentSrc(logoPng);
    } else if (currentSrc === logoPng) {
      setCurrentSrc('/logo.png');
    } else if (currentSrc === '/logo.png') {
      setCurrentSrc(logoSvg);
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
      className={`object-contain object-left transition-opacity duration-150 ${className}`}
    />
  );
}
