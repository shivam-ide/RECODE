import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Zap, Copy, Check } from 'lucide-react';
import { sanitizeCodeSnippet } from '../../utils/sanitizer';

/**
 * Re:Code Code Diff Viewer Component
 *
 * Renders vulnerable vs remediation code diffs strictly inside semantic
 * text containers (<pre> and <code>) with complete XSS immunity.
 * Adheres to Re:Code YouTube Dark Mode design system tokens (#0F0F0F, #181818, #303030).
 */
export default function DiffViewer({
  diffBefore = '',
  diffAfter = '',
  filePath = 'source.js',
  lineNumber = 1,
  ruleId = '',
  patchReady = true,
  isApplied = false,
  onApply = null,
  onCopy = null,
  className = '',
}) {
  const [internalCopied, setInternalCopied] = useState(false);

  // Sanitize both diff branches
  const safeBefore = sanitizeCodeSnippet(diffBefore);
  const safeAfter = sanitizeCodeSnippet(diffAfter);

  const beforeLines = safeBefore.split('\n');
  const afterLines = safeAfter.split('\n');

  const handleCopy = (e) => {
    if (onCopy) {
      onCopy(e);
    } else {
      navigator.clipboard?.writeText(safeAfter || safeBefore);
      setInternalCopied(true);
      setTimeout(() => setInternalCopied(false), 2000);
    }
  };

  return (
    <div
      className={`diff-viewer-container bg-[#0F0F0F] border border-[#303030] rounded-lg font-mono text-xs overflow-hidden select-text ${className}`}
      data-testid="diff-viewer"
    >
      {/* Diff Header */}
      <div className="bg-[#1C1C1C] border-b border-[#303030] px-3 py-2 text-[#AAAAAA] flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-[#F1F1F1] font-medium">
            {filePath} (Line {lineNumber})
          </span>
          <span className="text-[#717171]">• Diff View: Vulnerable vs Remediation</span>
        </span>
        {patchReady && (
          <span className="text-[#02C8F0] font-medium text-[11px] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            1-Click Patch Available
          </span>
        )}
      </div>

      {/* Diff Content Lines Container */}
      <div className="divide-y divide-[#303030]/50 text-xs font-mono leading-relaxed overflow-x-auto">
        {/* Removed Lines (-) in Red */}
        {beforeLines.map((lineText, bIdx) => (
          <div
            key={`before-${bIdx}`}
            className="flex items-start px-3 py-1.5 bg-[#FF4D4D]/18 border-l-2 border-[#FF4D4D] text-[#FF9999]"
          >
            <span className="w-10 text-right pr-4 text-[#FF4D4D] select-none font-bold shrink-0">
              {lineNumber + bIdx}
            </span>
            <span className="w-4 select-none font-bold text-[#FF4D4D] shrink-0">-</span>
            {/* Semantic text container: pre & code guarantees safe text node rendering without XSS */}
            <pre className="m-0 p-0 inline font-mono font-semibold whitespace-pre overflow-x-auto text-[#FF9999]">
              <code>{lineText}</code>
            </pre>
          </div>
        ))}

        {/* Added Replacement Lines (+) in Green */}
        {afterLines.map((lineText, aIdx) => (
          <div
            key={`after-${aIdx}`}
            className="flex items-start px-3 py-1.5 bg-[#27C93F]/18 border-l-2 border-[#27C93F] text-[#86EFAC]"
          >
            <span className="w-10 text-right pr-4 text-[#27C93F] select-none font-bold shrink-0">
              {lineNumber + aIdx}
            </span>
            <span className="w-4 select-none font-bold text-[#27C93F] shrink-0">+</span>
            {/* Semantic text container: pre & code guarantees safe text node rendering without XSS */}
            <pre className="m-0 p-0 inline font-mono font-semibold whitespace-pre overflow-x-auto text-[#86EFAC]">
              <code>{lineText}</code>
            </pre>
          </div>
        ))}
      </div>

      {/* Action Toolbar (if callbacks or ruleId provided) */}
      {(onApply || onCopy || ruleId) && (
        <div className="bg-[#141414] border-t border-[#303030] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onApply && (
              <button
                type="button"
                onClick={onApply}
                className={`patch-apply-btn flex items-center gap-1.5 px-2.5 py-1 font-bold rounded font-mono text-[11px] transition-colors cursor-pointer ${
                  isApplied
                    ? 'bg-[#27C93F] text-[#0F0F0F]'
                    : 'bg-[#02C8F0] hover:bg-[#38D4F4] text-[#0F0F0F]'
                }`}
              >
                {isApplied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Patch Applied</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Apply Patch</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="copy-fix-btn flex items-center gap-1.5 px-2.5 py-1 bg-[#212121] border border-[#303030] hover:bg-[#272727] text-[#F1F1F1] rounded font-mono text-[11px] transition-colors cursor-pointer"
            >
              {internalCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#02C8F0]" />
                  <span className="text-[#02C8F0]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Fix</span>
                </>
              )}
            </button>
          </div>

          {ruleId && (
            <span className="font-mono text-[11px] text-[#717171]">
              Rule: {ruleId}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
