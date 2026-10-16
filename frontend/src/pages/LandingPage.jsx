import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Sparkles,
  Terminal,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Code2,
  ArrowRight,
} from 'lucide-react';
import {
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  supabase,
  setGuestSession,
} from '../services/supabaseAuth';
import Footer from '../components/common/Footer';
import BrandLogo from '../components/common/BrandLogo';

/**
 * LandingPage: Re:Code's primary two-column landing & authentication portal.
 * Designed strictly to YouTube Dark Mode specification with zero blurry bleed.
 */
export default function LandingPage() {
  const navigate = useNavigate();

  // Mode: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');



  /**
   * Guest Access Handler:
   * Generates standard RFC4122 v4 UUID, stores in localStorage under 'recode_guest_session',
   * and routes user directly to /submit.
   */
  /**
   * Guest Access Handler:
   * 1. Explicitly signs out from Supabase to clear active tokens.
   * 2. Sets recode_is_guest = 'true' and sets recode_guest_session_id = 'guest_' + crypto.randomUUID().
   * 3. Removes recode_user_profile.
   * 4. Dispatches local auth event and navigates to /submit.
   */
  const handleGuestAccess = async () => {
    try {
      await setGuestSession();
    } catch (err) {
      console.error('Failed to initialize guest session:', err);
    }
    navigate('/submit');
  };

  /**
   * Switch between Sign In, Sign Up, and Forgot Password modes
   */
  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Handle Form Submission (Sign In / Sign Up / Forgot Password)
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Basic client validation
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message || 'Failed to send password reset email.');
      } else {
        setSuccessMsg('Password reset link sent! Check your inbox.');
      }
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setLoading(true);

    if (mode === 'signin') {
      // Remove guest flags before signing in
      try {
        localStorage.removeItem('recode_is_guest');
      } catch {}

      const { user, session, error } = await signInWithEmail(email, password);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message || 'Invalid email or password.');
      } else if (user) {
        try {
          localStorage.removeItem('recode_is_guest');
          localStorage.removeItem('recode_guest_session_id');
          localStorage.removeItem('recode_guest_session');
          if (session?.access_token) {
            localStorage.setItem('recode_access_token', session.access_token);
          }
          localStorage.setItem('recode_user_profile', JSON.stringify(user));
          window.dispatchEvent(new Event('recode_auth_change'));
        } catch {}
        navigate('/submit');
      }
    } else {
      // Sign Up
      try {
        localStorage.removeItem('recode_is_guest');
        localStorage.removeItem('recode_guest_session_id');
        localStorage.removeItem('recode_guest_session');
      } catch {}

      const { user, session, error } = await signUpWithEmail(email, password, fullName);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message || 'Sign up failed. Please try again.');
      } else if (session) {
        try {
          localStorage.removeItem('recode_is_guest');
          localStorage.removeItem('recode_guest_session_id');
          localStorage.removeItem('recode_guest_session');
          if (session.access_token) {
            localStorage.setItem('recode_access_token', session.access_token);
          }
          localStorage.setItem('recode_user_profile', JSON.stringify(session.user));
          window.dispatchEvent(new Event('recode_auth_change'));
        } catch {}
        navigate('/submit');
      } else if (user) {
        // Confirmation email sent
        setSuccessMsg('Account created! Please check your email to confirm registration, or sign in.');
        setMode('signin');
      }
    }
  };

  return (
    <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col font-sans selection:bg-[#02C8F0]/30 selection:text-white">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-[#303030]">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-8 flex items-center justify-between">
          {/* Brand Identity */}
          <div className="flex items-center">
            <a href="/" className="flex items-center focus:outline-none group">
              <BrandLogo className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
            </a>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="header-btn-signin"
              type="button"
              onClick={() => {
                switchMode('signin');
                document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth' });
                document.getElementById('email-input')?.focus();
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'text-[#F1F1F1] bg-[#272727] font-semibold'
                  : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#181818]'
              }`}
            >
              Sign In
            </button>
            <button
              id="header-btn-signup"
              type="button"
              onClick={() => {
                switchMode('signup');
                document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth' });
                document.getElementById('name-input')?.focus();
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'text-[#0F0F0F] bg-[#02C8F0] font-semibold'
                  : 'text-[#02C8F0] border border-[#02C8F0]/40 hover:bg-[#02C8F0]/10'
              }`}
            >
              Sign Up
            </button>
            <div className="h-4 w-px bg-[#303030] mx-0.5 hidden sm:block" />
            <button
              onClick={handleGuestAccess}
              className="text-xs font-medium text-[#AAAAAA] hover:text-[#F1F1F1] px-3 py-1.5 rounded-full border border-[#303030] hover:border-[#3F3F3F] hover:bg-[#181818] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Continue directly without logging in"
            >
              <Terminal className="w-3.5 h-3.5 text-[#02C8F0]" />
              <span className="hidden sm:inline">Try as guest</span>
              <span className="sm:hidden">Guest</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Column Content Area */}
      <main className="flex-1 flex items-center py-6 sm:py-8 lg:py-10 px-4 sm:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Product Identity, Logo, Badge, Narrative & Capabilities */}
            <div className="lg:col-span-7 flex flex-col space-y-5 sm:space-y-6 pr-0 lg:pr-6">
              
              {/* Brand Logo (Bigger & Expanded) */}
              <div className="flex items-center">
                <BrandLogo className="h-20 sm:h-24 md:h-28 w-auto object-contain" />
              </div>

              {/* Product Badge (Shifted Below Logo) */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181818] border border-[#303030] w-fit">
                <span className="w-2 h-2 rounded-full bg-[#02C8F0] animate-pulse" />
                <span className="font-mono text-xs font-medium text-[#02C8F0] tracking-wide">
                  Dual-Engine AST &amp; Gemini Code Review
                </span>
              </div>

              {/* Narrative Copy (Uniform font size throughout) */}
              <div className="max-w-xl">
                <h1 className="text-base sm:text-lg text-[#F1F1F1] font-medium leading-relaxed">
                  Paste your code or link a public GitHub repo.{' '}
                  <span className="text-[#AAAAAA] font-normal">
                    Re:Code catches syntax errors, broken code, and security vulnerabilities, explains each issue in plain language, and suggests ready-to-apply fixes.
                  </span>
                </h1>
              </div>

              {/* Two Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl">
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#181818]/60 border border-[#303030]">
                  <div className="p-2 rounded bg-[#212121] border border-[#303030] flex-shrink-0">
                    <Shield className="w-4 h-4 text-[#02C8F0]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F1F1F1]">
                      Static Security Scan
                    </div>
                    <div className="text-xs text-[#AAAAAA] mt-0.5 leading-normal">
                      Identifies OWASP risks, secret leaks, and syntax smells instantly.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#181818]/60 border border-[#303030]">
                  <div className="p-2 rounded bg-[#212121] border border-[#303030] flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-[#FFA116]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F1F1F1]">
                      Gemini AI Refinement
                    </div>
                    <div className="text-xs text-[#AAAAAA] mt-0.5 leading-normal">
                      Context-aware explanations with copyable clean code suggestions.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Flat Authentication Panel */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
              <div id="auth-card" className="w-full max-w-[420px] bg-[#181818] border border-[#303030] rounded-xl p-5 sm:p-6 lg:p-7 flex flex-col shadow-2xl relative scroll-mt-20">
                
                {/* Panel Title & Subtitle */}
                <div className="mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#F1F1F1] tracking-tight">
                    {mode === 'signin' && 'Sign in to Re:Code'}
                    {mode === 'signup' && 'Create your account'}
                    {mode === 'forgot' && 'Reset your password'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#AAAAAA] mt-1">
                    {mode === 'signin' && 'Pick up where you left off.'}
                    {mode === 'signup' && 'Start reviewing code with automated AST & AI analysis.'}
                    {mode === 'forgot' && "Enter your email and we'll send a recovery link."}
                  </p>
                </div>

                {/* Segmented Tab Switcher (Sign In vs Create account) */}
                {mode !== 'forgot' && (
                  <div className="flex p-1 bg-[#212121] border border-[#303030] rounded-lg mb-4">
                    <button
                      id="tab-sign-in"
                      type="button"
                      onClick={() => switchMode('signin')}
                      className={`flex-1 py-1.5 text-center text-xs sm:text-sm rounded font-medium transition-colors cursor-pointer ${
                        mode === 'signin'
                          ? 'bg-[#272727] text-[#F1F1F1] shadow-sm'
                          : 'text-[#AAAAAA] hover:text-[#F1F1F1]'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      id="tab-sign-up"
                      type="button"
                      onClick={() => switchMode('signup')}
                      className={`flex-1 py-1.5 text-center text-xs sm:text-sm rounded font-medium transition-colors cursor-pointer ${
                        mode === 'signup'
                          ? 'bg-[#272727] text-[#F1F1F1] shadow-sm'
                          : 'text-[#AAAAAA] hover:text-[#F1F1F1]'
                      }`}
                    >
                      Create account
                    </button>
                  </div>
                )}

                {/* Alerts: Error Banner */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-lg bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 text-[#FF4D4D] text-xs flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Alerts: Success Banner */}
                {successMsg && (
                  <div
                    role="status"
                    className="mb-4 p-3 rounded-lg bg-[#27C93F]/10 border border-[#27C93F]/30 text-[#27C93F] text-xs flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Auth Form */}
                <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name field (Create Account only) */}
                  {mode === 'signup' && (
                    <div className="space-y-1.5" id="field-name-container">
                      <label
                        htmlFor="name-input"
                        className="block text-xs font-medium text-[#AAAAAA]"
                      >
                        Full Name
                      </label>
                      <input
                        id="name-input"
                        name="name"
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ada Lovelace"
                        required
                        className="w-full h-10 px-3 bg-[#212121] border border-[#303030] rounded-lg text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:outline-none focus:border-[#3F3F3F] transition-colors"
                      />
                    </div>
                  )}

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email-input"
                      className="block text-xs font-medium text-[#AAAAAA]"
                    >
                      Email Address
                    </label>
                    <input
                      id="email-input"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      required
                      className="w-full h-10 px-3 bg-[#212121] border border-[#303030] rounded-lg text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:outline-none focus:border-[#3F3F3F] transition-colors"
                    />
                  </div>

                  {/* Password (Sign In & Sign Up) */}
                  {mode !== 'forgot' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="password-input"
                          className="text-xs font-medium text-[#AAAAAA]"
                        >
                          Password
                        </label>
                        {mode === 'signin' && (
                          <button
                            id="forgot-password-link"
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="text-xs text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="password-input"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full h-10 pl-3 pr-10 bg-[#212121] border border-[#303030] rounded-lg text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:outline-none focus:border-[#3F3F3F] transition-colors"
                        />
                        <button
                          id="toggle-password"
                          type="button"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#F1F1F1] focus:outline-none cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* High-Contrast White Primary Submit Button */}
                  <button
                    id="submit-auth-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 bg-[#F1F1F1] hover:bg-white text-[#0F0F0F] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span id="submit-text">
                          {mode === 'signin' && 'Sign In'}
                          {mode === 'signup' && 'Create Account'}
                          {mode === 'forgot' && 'Send Reset Link'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Back to sign in if in forgot password mode */}
                {mode === 'forgot' && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="text-xs text-[#02C8F0] hover:underline cursor-pointer"
                    >
                      &larr; Back to Sign In
                    </button>
                  </div>
                )}

                {/* Subtle Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#303030]" />
                  </div>
                  <span className="relative px-3 bg-[#181818] text-xs text-[#717171] uppercase">
                    or
                  </span>
                </div>

                {/* Secondary "Continue as guest" Button */}
                <button
                  id="guest-session-btn"
                  type="button"
                  onClick={handleGuestAccess}
                  className="w-full py-2.5 sm:py-3 bg-[#212121] hover:bg-[#272727] border border-[#303030] hover:border-[#3F3F3F] text-[#F1F1F1] font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <Terminal className="w-4 h-4 text-[#02C8F0] group-hover:scale-110 transition-transform" />
                  <span>Continue as guest</span>
                </button>

                {/* Informational Guidance */}
                <div className="mt-3.5 text-center">
                  <p className="text-xs text-[#717171] leading-relaxed">
                    Review code without an account. History and saved reports require an account.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Docked Footer */}
      <Footer className="mt-auto" />
    </div>
  );
}
