import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('All Ears root caught error:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('allears_lessons_v3');
    localStorage.removeItem('allears_user');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center p-6 text-center text-slate-900 font-sans">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-2xl mb-4 shadow-md">
            🎧
          </div>
          <h1 className="text-xl font-bold mb-2">All Ears</h1>
          <p className="text-sm text-slate-600 max-w-md mb-4 leading-relaxed">
            The application encountered a loading issue while initializing. Click below to refresh with standard default settings.
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs max-w-md mb-6 font-mono text-left overflow-auto max-h-32">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            onClick={this.handleReset}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Reload All Ears
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
