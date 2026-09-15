import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, stack: null }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info)
    this.setState({ error: error?.message || String(error), stack: info?.componentStack || '' })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, padding: 20, overflow: 'auto',
          background: '#0B0B14', color: '#F4F1FF',
          fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5,
        }}>
          <p style={{ color: '#EF4444', fontWeight: 800, marginBottom: 12 }}>
            Render error
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error}
          </pre>
          <p style={{ color: '#8B92A3', marginTop: 20, marginBottom: 6 }}>Component stack:</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#8B92A3' }}>
            {this.state.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null, stack: null })}
            style={{
              marginTop: 20, padding: '10px 20px', borderRadius: 999,
              background: '#7C3AED', color: '#fff', fontWeight: 700, border: 0,
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
