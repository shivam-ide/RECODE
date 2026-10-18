import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Footer from '../components/common/Footer';
import PillBadge from '../components/common/PillBadge';
import BrandLogo from '../components/common/BrandLogo';

import { API_BASE_URL } from '../config/api';

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchReview() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/v1/reviews/${id}`);
        const data = await res.json();
        if (isMounted) {
          if (res.ok && data.data) {
            setReview(data.data);
          } else {
            setError(data.message || 'Review not found');
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    if (id) {
      fetchReview();
    }
    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-[#303030]">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/submit')}
              className="text-xs text-[#AAAAAA] hover:text-[#F1F1F1] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Submission</span>
            </button>
            <BrandLogo className="h-7 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-2">
            <PillBadge variant="clean" size="sm" dot>
              Review Diagnostics Ready
            </PillBadge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#181818] border border-[#303030] flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-[#02C8F0]" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#F1F1F1] tracking-tight">
          Review Diagnostic Report
        </h1>
        <p className="text-sm text-[#AAAAAA] max-w-lg mt-2 leading-relaxed">
          Static AST analysis &amp; Google Gemini diagnostics have completed for this submission.
        </p>

        {/* Review Metadata Container */}
        <div className="mt-8 p-6 bg-[#181818] border border-[#303030] rounded-xl max-w-lg w-full text-left space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#717171]">Review ID</span>
            <span className="text-xs text-[#27C93F] flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> Persisted
            </span>
          </div>

          <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 font-mono text-xs text-[#02C8F0] break-all select-all">
            <span id="reviewIdDisplay">{id}</span>
          </div>

          {review && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#212121] rounded-lg border border-[#303030]">
                <div className="text-[11px] text-[#717171] uppercase font-mono">Project</div>
                <div className="text-sm font-semibold text-[#F1F1F1] truncate mt-0.5">
                  {review.projectName || 'Re:Code Project'}
                </div>
              </div>
              <div className="p-3 bg-[#212121] rounded-lg border border-[#303030]">
                <div className="text-[11px] text-[#717171] uppercase font-mono">Health Score</div>
                <div className="text-sm font-semibold text-[#27C93F] mt-0.5">
                  {review.healthScore ?? review.health_score ?? 100}/100 ({review.grade || 'A'})
                </div>
              </div>
            </div>
          )}

          {loading && !review && (
            <div className="text-xs text-[#AAAAAA] text-center py-2 animate-pulse font-mono">
              Fetching pipeline diagnostics...
            </div>
          )}

          {error && (
            <div className="text-xs text-[#FFA116] bg-[#FFA116]/10 border border-[#FFA116]/30 p-2.5 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => navigate('/submit')}
            className="px-4 py-2.5 bg-[#212121] hover:bg-[#272727] border border-[#303030] text-xs font-medium text-[#F1F1F1] rounded-lg transition-colors cursor-pointer"
          >
            Submit Another Snippet
          </button>
          <button
            onClick={() => navigate('/preview')}
            className="px-4 py-2.5 bg-[#02C8F0]/10 hover:bg-[#02C8F0]/20 border border-[#02C8F0]/30 text-xs font-medium text-[#02C8F0] rounded-lg transition-colors cursor-pointer"
          >
            View Design System
          </button>
        </div>
      </main>

      {/* Docked Footer */}
      <Footer className="mt-auto" />
    </div>
  );
}
