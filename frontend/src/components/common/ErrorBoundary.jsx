import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronRight, Bug } from 'lucide-react';

/**
 * Re:Code — React Error Boundary Component
 *
 * Catches JavaScript runtime and render errors anywhere in child component tree,
 * logs the error, and displays a graceful, premium fallback UI instead of a blank screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[Re:Code ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected runtime error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-[#0F0F0F] text-[#F1F1F1] flex flex-col items-center justify-center p-6 select-none">
          <div className="w-full max-w-xl bg-[#181818] border border-[#303030] rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
            {/* Warning Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 flex items-center justify-center mb-5 text-[#FF4D4D] shadow-[0_0_24px_rgba(255,77,77,0.15)]">
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Title & Description */}
            <h1 className="font-heading text-xl font-semibold text-[#F1F1F1] mb-2">
              Workspace Encountered an Error
            </h1>
            <p className="text-sm text-[#AAAAAA] leading-relaxed max-w-md mb-6">
              A temporary issue interrupted the submission workspace. You can retry rendering or return to the landing page.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full mb-6">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#02C8F0] text-[#000000] font-semibold text-xs uppercase tracking-wider hover:bg-[#02C8F0]/90 transition-all cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry View</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#272727] border border-[#3F3F3F] text-[#F1F1F1] font-semibold text-xs uppercase tracking-wider hover:bg-[#303030] transition-all cursor-pointer"
              >
                <span>Reload Page</span>
              </button>

              <a
                href="/"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-transparent border border-[#303030] text-[#AAAAAA] hover:text-[#F1F1F1] hover:border-[#3F3F3F] font-semibold text-xs uppercase tracking-wider transition-all"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </a>
            </div>

            {/* Collapsible Error Diagnostics */}
            <div className="w-full text-left pt-4 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="flex items-center justify-between w-full text-xs text-[#717171] hover:text-[#AAAAAA] transition-colors py-1 cursor-pointer bg-transparent"
              >
                <span className="flex items-center gap-1.5 font-mono">
                  <Bug className="w-3.5 h-3.5 text-[#02C8F0]" />
                  <span>Technical Diagnostics</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    this.state.showDetails ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3.5 rounded-lg bg-[#0F0F0F] border border-[#2E2E2E] font-mono text-[11px] text-[#FF4D4D] overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap break-all">
                  <div className="font-semibold mb-1 text-[#F1F1F1]">Error: {errorMessage}</div>
                  {componentStack && (
                    <div className="text-[#717171] text-[10px] mt-2 pt-2 border-t border-[#262626]">
                      {componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
