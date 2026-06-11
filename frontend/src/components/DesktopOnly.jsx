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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-foreground p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">💻</div>
        <h1 className="text-2xl font-bold mb-3">请在 PC 端操作</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          AINovel 为桌面端沉浸写作体验设计，暂不支持移动端/平板访问。
          <br />
          请使用宽度大于 1024px 的设备访问。
        </p>
      </div>
    </div>
  );
};

export default DesktopOnly;
