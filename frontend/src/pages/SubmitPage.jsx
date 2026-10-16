import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ArrowLeft, CheckCircle2, Copy, Check } from 'lucide-react';
import Footer from '../components/common/Footer';
import PillBadge from '../components/common/PillBadge';
import BrandLogo from '../components/common/BrandLogo';
import { GUEST_SESSION_STORAGE_KEY } from '../services/supabaseAuth';

export default function SubmitPage() {
  const navigate = useNavigate();
  const [guestSession] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GUEST_SESSION_STORAGE_KEY) || 'No active guest session';
    }
    return 'No active guest session';
  });
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (guestSession) {
      navigator.clipboard.writeText(guestSession);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-[#303030]">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-xs text-[#AAAAAA] hover:text-[#F1F1F1] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
            <BrandLogo className="h-7 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-2">
            <PillBadge variant="clean" size="sm" dot>
              Active Guest Mode
            </PillBadge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#181818] border border-[#303030] flex items-center justify-center mb-6">
          <Terminal className="w-8 h-8 text-[#02C8F0]" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#F1F1F1] tracking-tight">
          Code Submission Studio
        </h1>
        <p className="text-sm sm:text-base text-[#AAAAAA] max-w-lg mt-2 leading-relaxed">
          Welcome to Re:Code. You are currently connected with an ephemeral guest session.
        </p>

        {/* Guest Session Token Box */}
        <div className="mt-8 p-4 bg-[#181818] border border-[#303030] rounded-xl max-w-md w-full text-left">
          <div className="flex items-center justify-between text-xs text-[#717171] uppercase tracking-wider font-mono mb-2">
            <span>Stored Guest Session UUID</span>
            <span className="text-[#27C93F] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              localStorage active
            </span>
          </div>
          <div className="flex items-center justify-between bg-[#212121] border border-[#303030] rounded-lg p-2.5">
            <code id="guest-session-display" className="font-mono text-xs text-[#02C8F0] truncate mr-2 select-all">
              {guestSession}
            </code>
            <button
              onClick={copySessionId}
              className="p-1.5 rounded hover:bg-[#303030] text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors cursor-pointer flex-shrink-0"
              title="Copy session UUID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#27C93F]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-[#717171] mt-2">
            Key: <code className="text-[#AAAAAA]">localStorage['recode_guest_session']</code>
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#212121] hover:bg-[#272727] border border-[#303030] text-xs font-medium text-[#F1F1F1] rounded-lg transition-colors cursor-pointer"
          >
            Back to Sign In
          </button>
          <button
            onClick={() => navigate('/preview')}
            className="px-4 py-2 bg-[#02C8F0]/10 hover:bg-[#02C8F0]/20 border border-[#02C8F0]/30 text-xs font-medium text-[#02C8F0] rounded-lg transition-colors cursor-pointer"
          >
            View Design System Components
          </button>
        </div>
      </main>

      {/* Docked Footer */}
      <Footer />
    </div>
  );
}
