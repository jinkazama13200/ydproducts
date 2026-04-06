import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console (in production, send to error reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p className="error-message">
            We're sorry, but something unexpected happened. Please try again.
          </p>
          {this.state.error && (
            <details className="error-details">
              <summary>Error Details</summary>
              <p><strong>Error:</strong> {this.state.error.toString()}</p>
              <pre>{this.state.errorInfo?.componentStack}</pre>
            </details>
          )}
          <button 
            className="retry-button" 
            onClick={this.handleRetry}
            type="button"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
