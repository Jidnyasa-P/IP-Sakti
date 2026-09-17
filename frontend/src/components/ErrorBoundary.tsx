import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Root cause of the "blank page on Generate" bug: several views (Product
 * Analyzer, TK & ABS, IPR Navigator) set `result` straight from
 * `await res.json()` without checking `res.ok` first. When the API call
 * fails — most commonly a 401 because the request wasn't authenticated —
 * `result` ends up holding an error payload like `{ detail: "..." }`
 * instead of the real shape. The results view then does something like
 * `result.product_information.product_name`, which throws
 * "Cannot read properties of undefined" during render. With no error
 * boundary anywhere in the app, React unmounts the entire tree on any
 * uncaught render error — hence a fully blank page, not just a broken
 * section.
 *
 * This component is the safety net: it catches any render error in its
 * subtree and shows a recoverable message instead of blanking the screen.
 * It does NOT fix the underlying cause on its own — see PATCHES.md for the
 * actual fixes (authFetch + res.ok checks) in the three affected views.
 * Both matter: the real fixes stop the error from happening; this stops
 * *any* future/unexpected error (here or anywhere else you add later) from
 * taking down the whole app.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught a render error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="w-full px-4 py-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Something went wrong loading this page</h2>
          <p className="text-sm text-slate-600 max-w-md">
            {this.state.error.message || 'An unexpected error occurred.'} This has been logged to the
            browser console — if it keeps happening, check that you're logged in and try again.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
