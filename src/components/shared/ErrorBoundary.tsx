import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches render errors in child components.
 * Displays a user-friendly error message with retry functionality.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error details to console with full component stack
    console.error(`[ErrorBoundary] Error in ${this.props.fallbackName}:`, error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--danger)]/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Something went wrong
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {this.props.fallbackName} encountered an error
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
                <p className="text-sm text-[var(--text-muted)] font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <p className="text-sm text-[var(--text-muted)] mb-4">
              Try refreshing the component. If the problem persists, please reload the page.
            </p>

            <button
              onClick={this.handleRetry}
              className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inline error banner component for displaying errors within a component.
 * Use this for recoverable errors that don't require unmounting the component.
 */
interface InlineErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function InlineErrorBanner({ message, onDismiss }: InlineErrorBannerProps): ReactNode {
  return (
    <div className="mb-4 p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--danger)] font-medium">Error</p>
        <p className="text-sm text-[var(--text-muted)] break-words">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-lg leading-none"
        aria-label="Dismiss error"
      >
        &times;
      </button>
    </div>
  );
}
