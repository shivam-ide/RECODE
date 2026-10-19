import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
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
  patchReady = true,
  isApplied = false,
  className = '',
}) {
  // Sanitize both diff branches and truncate lines exceeding 120 characters
  const safeBefore = sanitizeCodeSnippet(diffBefore);
  const safeAfter = sanitizeCodeSnippet(diffAfter);

  const truncateLine = (line) => (line && line.length > 120 ? line.slice(0, 117) + '...' : line);
  const beforeLines = safeBefore.split('\n').map(truncateLine);
  const afterLines = safeAfter.split('\n').map(truncateLine);

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
        {isApplied ? (
          <span className="text-[#27C93F] font-medium text-[11px] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Patch Applied In-Memory
          </span>
        ) : patchReady ? (
          <span className="text-[#02C8F0] font-medium text-[11px] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            1-Click Patch Available
          </span>
        ) : null}
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
            {/* Semantic text container: pre & code with word-break break-all and white-space pre-wrap */}
            <pre className="m-0 p-0 inline font-mono font-semibold whitespace-pre-wrap break-all overflow-x-auto text-[#FF9999]">
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
            {/* Semantic text container: pre & code with word-break break-all and white-space pre-wrap */}
            <pre className="m-0 p-0 inline font-mono font-semibold whitespace-pre-wrap break-all overflow-x-auto text-[#86EFAC]">
              <code>{lineText}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
