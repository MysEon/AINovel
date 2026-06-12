import React, { useState, useEffect } from 'react';

const DESKTOP_MIN_WIDTH = 1024;

const DesktopOnly = ({ children }) => {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_MIN_WIDTH);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (isDesktop) {
    return children;
  }

  return (
    <div className="desktop-only-screen">
      <div className="desktop-only-panel">
        <div className="desktop-only-mark">AINovel</div>
        <h1>请在桌面端操作</h1>
        <p>
          AINovel 为桌面端沉浸写作体验设计，暂不支持移动端/平板访问。
          <br />
          请使用宽度大于 1024px 的设备访问。
        </p>
      </div>
    </div>
  );
};

export default DesktopOnly;
