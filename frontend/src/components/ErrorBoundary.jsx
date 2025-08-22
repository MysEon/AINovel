import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // 可以将错误日志上报给服务器
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // 这里可以发送错误信息到日志服务
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.log('Error logged:', errorData);
    
    // 保存到本地存储以便调试
    try {
      const existingErrors = JSON.parse(localStorage.getItem('ainovel_errors') || '[]');
      existingErrors.push(errorData);
      // 只保留最近10个错误
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10);
      }
      localStorage.setItem('ainovel_errors', JSON.stringify(existingErrors));
    } catch (e) {
      console.warn('Failed to save error to localStorage:', e);
    }
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReset = () => {
    // 清除所有应用状态并重新开始
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '600px',
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              😵
            </div>
            
            <h1 style={{
              color: '#ff4d4f',
              marginBottom: '16px',
              fontSize: '24px'
            }}>
              应用出现了错误
            </h1>
            
            <p style={{
              color: '#666',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              很抱歉，应用遇到了一个意外错误。我们已经记录了这个问题，您可以尝试以下操作：
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <button
                onClick={this.handleRetry}
                style={{
                  background: '#1890ff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                重试 {this.state.retryCount > 0 && `(${this.state.retryCount})`}
              </button>
              
              <button
                onClick={this.handleReset}
                style={{
                  background: '#52c41a',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                重置应用
              </button>
            </div>

            {/* 开发环境下显示错误详情 */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                textAlign: 'left',
                backgroundColor: '#f8f9fa',
                padding: '16px',
                borderRadius: '6px',
                marginTop: '20px'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: '500',
                  marginBottom: '10px'
                }}>
                  错误详情（开发模式）
                </summary>
                
                <div style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#d73a49',
                  marginBottom: '10px'
                }}>
                  <strong>错误信息:</strong> {this.state.error.message}
                </div>
                
                <div style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#586069',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  <strong>调用栈:</strong>
                  {this.state.error.stack}
                </div>
                
                {this.state.errorInfo && (
                  <div style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#586069',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '200px',
                    overflow: 'auto',
                    marginTop: '10px'
                  }}>
                    <strong>组件栈:</strong>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;