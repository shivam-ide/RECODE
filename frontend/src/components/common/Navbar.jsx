import React, { useState } from 'react';
import { Menu, X, ExternalLink, Terminal, LogOut, LogIn } from 'lucide-react';
import PillBadge from './PillBadge';
import BrandLogo from './BrandLogo';
import UserSessionPill from './UserSessionPill';
import { useAuth } from '../../services/useAuth';

/**
 * Navbar: Fixed 56px height top bar strictly engineered to YouTube Dark Mode specification.
 * Features official logo, engine status pill, navigation links, and profile trigger.
 */
export default function Navbar({
  brandTitle = 'Re:Code',
  statusText = 'AST Engine Operational',
  activeRoute = 'preview',
  onRouteChange,
  user: propUser,
  links = [
    { id: 'scanner', label: 'Scanner', path: '/scanner' },
    { id: 'diagnostics', label: 'AI Diagnostics', path: '/diagnostics' },
    { id: 'rules', label: 'AST Rules', path: '/rules' },
    { id: 'preview', label: 'Components', path: '/preview' },
  ],
}) {
  const { user: authUser, isGuest, logout } = useAuth();
  const currentUser = propUser || authUser;
  const isActuallyGuest = isGuest || !currentUser;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLinkClick = (link, e) => {
    if (onRouteChange) {
      e.preventDefault();
      onRouteChange(link.id);
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[56px] bg-[#0F0F0F] border-b border-[#303030] px-4 select-none">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
        {/* Left Section: Logo & Status */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => onRouteChange && (e.preventDefault(), onRouteChange('home'))}
            className="flex items-center gap-2.5 focus:outline-none group"
            title={`${brandTitle} — Read. Review. Refine.`}
          >
            <BrandLogo className="h-8 w-auto object-contain transition-transform duration-150 group-hover:scale-105" />
          </a>

          {/* Status Pill */}
          <div className="hidden sm:inline-flex">
            <PillBadge
              variant="status"
              size="sm"
              dot={true}
              dotColor="#27C93F"
              className="font-mono text-[11px]"
            >
              {statusText}
            </PillBadge>
          </div>
        </div>

        {/* Center / Navigation Links (Desktop) */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = activeRoute === link.id;
            return (
              <a
                key={link.id}
                href={link.path}
                onClick={(e) => handleLinkClick(link, e)}
                className={`px-3 py-1.5 rounded text-xs font-medium tracking-wide transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#212121] text-[#F1F1F1] border border-[#3F3F3F]'
                    : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#181818] border border-transparent'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        {/* Right Section: Action Utilities & Profile */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center text-xs font-mono text-[#717171] bg-[#181818] px-2.5 py-1 rounded border border-[#303030]">
            <Terminal className="w-3.5 h-3.5 mr-1.5 text-[#02C8F0]" />
            <span>v1.0.0-mod2</span>
          </div>

          {/* Profile Session Pill with Dropdown */}
          <div className="relative">
            <UserSessionPill
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
            />

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-[#181818] border border-[#303030] rounded-md shadow-2xl py-2 z-50 text-xs"
                onClick={() => setProfileDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-[#303030]">
                  <p className="font-semibold text-[#F1F1F1] truncate">
                    {isActuallyGuest
                      ? 'Guest Session'
                      : (currentUser?.user_metadata?.full_name || currentUser?.email || 'User')}
                  </p>
                  <p className="text-[11px] text-[#AAAAAA] truncate">
                    {isActuallyGuest
                      ? 'Temporary Audit Access'
                      : (currentUser?.email || 'Authenticated User')}
                  </p>
                </div>
                <div className="py-1">
                  {isActuallyGuest ? (
                    <a
                      href="/"
                      onClick={(e) => onRouteChange && (e.preventDefault(), onRouteChange('home'))}
                      className="flex items-center gap-2 px-3 py-2 text-[#02C8F0] hover:bg-[#212121]"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In or Sign Up</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logout && logout()}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[#FF4D4D] hover:bg-[#212121]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2 text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121]"
                  >
                    <span>GitHub Monorepo</span>
                    <ExternalLink className="w-3 h-3 text-[#717171]" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onRouteChange && onRouteChange('preview')}
                    className="w-full text-left px-3 py-2 text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121]"
                  >
                    Component Library
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded bg-[#181818] border border-[#303030] text-[#AAAAAA] hover:text-[#F1F1F1]"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[56px] left-0 right-0 bg-[#0F0F0F] border-b border-[#303030] p-4 flex flex-col gap-2 z-40">
          <div className="pb-2 border-b border-[#303030] flex items-center justify-between">
            <PillBadge variant="status" size="sm" dot={true} dotColor="#27C93F">
              {statusText}
            </PillBadge>
            <span className="text-[11px] font-mono text-[#717171]">v1.0.0-mod2</span>
          </div>
          {links.map((link) => {
            const isActive = activeRoute === link.id;
            return (
              <a
                key={link.id}
                href={link.path}
                onClick={(e) => handleLinkClick(link, e)}
                className={`px-3 py-2 rounded text-xs font-medium ${
                  isActive
                    ? 'bg-[#212121] text-[#F1F1F1] border border-[#3F3F3F]'
                    : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#181818]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
