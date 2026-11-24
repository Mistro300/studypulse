import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/core/observability/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  scope?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('React ErrorBoundary caught error', {
      scope: this.props.scope ?? 'app',
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="sp-card mx-auto my-8 max-w-md p-6 text-start"
        >
          <h2 className="text-lg font-bold text-text-primary">
            حدث خطأ غير متوقع / Something went wrong
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            تم عزل هذا الخطأ لحماية بقية التطبيق. يمكنك إعادة المحاولة الآن.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="sp-tactile-control mt-4 bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            إعادة المحاولة / Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
