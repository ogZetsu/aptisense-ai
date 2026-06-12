import React from 'react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error, info) {
    // Keep this in console for local diagnostics.
    console.error('AppErrorBoundary caught a render error:', error, info);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#0b1020', color: '#e2e8f0' }}>
          <div style={{ maxWidth: 640, width: '100%', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.45)', background: 'rgba(239, 68, 68, 0.08)', padding: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Application error</h2>
            <p style={{ marginTop: '0.75rem', lineHeight: 1.6 }}>
              Unable to load session data
            </p>
            <p style={{ marginTop: '0.5rem', color: '#fecaca', fontSize: '0.95rem' }}>
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{ marginTop: '1rem', border: 'none', borderRadius: '0.6rem', background: '#22d3ee', color: '#082f49', padding: '0.65rem 1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
