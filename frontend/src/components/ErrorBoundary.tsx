import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-100 gap-4 p-8">
          <p className="text-red-400 font-mono text-sm font-semibold">Render error</p>
          <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap max-w-xl text-center">
            {error.message}
          </pre>
          <button
            className="px-4 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
