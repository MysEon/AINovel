import { App as AntdApp } from 'antd';
import ErrorBoundary from './components/ErrorBoundary';
import DesktopOnly from './components/DesktopOnly';
import { NotificationProvider } from './components/NotificationManager';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AntdApp>
          <NotificationProvider>
            <AuthProvider>
              <DesktopOnly>
                <AppRouter />
              </DesktopOnly>
            </AuthProvider>
          </NotificationProvider>
        </AntdApp>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
