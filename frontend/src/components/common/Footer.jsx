import React from 'react';
import BrandLogo from './BrandLogo';

/**
 * Footer: Docked footer with Re:Code brand identity, college project attribution,
 * and GitHub & LinkedIn links (in place of year copyright).
 * Formatted with YouTube Dark Mode tokens and matte aesthetics.
 */
export default function Footer({
  creator = 'Shivam Vishwakarma',
  githubUrl = 'https://github.com/shivam-ide',
  linkedinUrl = 'https://linkedin.com',
  className = '',
}) {
  return (
    <footer
      className={`w-full bg-[#0F0F0F] border-t border-[#303030] text-xs py-2 sm:py-2.5 px-4 sm:px-8 select-none transition-colors shrink-0 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
        {/* Left Side: Brand Identity */}
        <div className="flex items-center">
          <BrandLogo className="h-5 w-auto object-contain opacity-85 hover:opacity-100 transition-opacity" />
        </div>

        {/* Right Side: College Project Attribution & GitHub / LinkedIn Logos */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-[#717171] text-[11px] sm:text-xs">
          <span>
            A College Project by <strong className="text-[#F1F1F1] font-medium">{creator}</strong>
          </span>
          <span className="hidden sm:inline text-[#303030]">•</span>
          
          {/* Social Links (Replacing @2026) */}
          <div className="flex items-center gap-3">
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121] transition-colors"
              title="GitHub"
              aria-label="GitHub Profile"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>

            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-[#AAAAAA] hover:text-[#02C8F0] hover:bg-[#212121] transition-colors"
              title="LinkedIn"
              aria-label="LinkedIn Profile"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.65 1.65 0 1 0 0-3.3 1.65 1.65 0 0 0 0 3.3m1.39 9.74v-8.37H5.07v8.37h2.78z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
