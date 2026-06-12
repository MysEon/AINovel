import React, { useRef, useEffect } from "react";

export const SHAPE_LIST = [
  { key: "ink", name: "墨点" },
  { key: "wash", name: "墨晕" },
  { key: "seal", name: "朱砂" },
  { key: "fiber", name: "纸纹" },
];

const palettes = {
  light: {
    ink: ["44,40,37", "122,110,99", "139,94,60"],
    seal: "199,91,57",
    washAlpha: 0.06,
  },
  dark: {
    ink: ["232,224,214", "212,145,92", "139,94,60"],
    seal: "212,145,92",
    washAlpha: 0.08,
  },
};

const pick = (items) => items[Math.floor(Math.random() * items.length)];

const ParticleBackground = ({ isDarkMode, enabledShapes = [] }) => {
  const canvasRef = useRef(null);
  const enabledRef = useRef(enabledShapes);
  enabledRef.current = enabledShapes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId;
    let width = 0;
    let height = 0;
    let lastTime = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const theme = isDarkMode ? palettes.dark : palettes.light;
    const count = media.matches ? 28 : isDarkMode ? 88 : 54;
    const enabled = new Set(enabledRef.current?.length ? enabledRef.current : SHAPE_LIST.map((s) => s.key));
    const particles = Array.from({ length: count }, (_, index) => {
      const isSeal = enabled.has("seal") && index % 13 === 0;
      const radius = isSeal ? Math.random() * 2.8 + 1.2 : Math.random() * (isDarkMode ? 4.5 : 3.4) + 0.8;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (isDarkMode ? 0.12 : 0.08),
        vy: (Math.random() - 0.5) * (isDarkMode ? 0.1 : 0.06),
        radius,
        drift: Math.random() * Math.PI * 2,
        color: isSeal ? theme.seal : pick(theme.ink),
        alpha: isSeal ? 0.18 : Math.random() * 0.18 + (isDarkMode ? 0.1 : 0.05),
      };
    });

    const drawWash = () => {
      if (!enabled.has("wash")) return;
      const wash = ctx.createRadialGradient(width * 0.18, height * 0.24, 0, width * 0.18, height * 0.24, Math.min(width, height) * 0.5);
      wash.addColorStop(0, `rgba(${theme.seal},${theme.washAlpha})`);
      wash.addColorStop(0.58, `rgba(${theme.seal},${theme.washAlpha * 0.35})`);
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    };

    const drawFibers = () => {
      if (!enabled.has("fiber")) return;
      ctx.save();
      ctx.globalAlpha = isDarkMode ? 0.08 : 0.14;
      ctx.strokeStyle = isDarkMode ? "rgba(232,224,214,0.22)" : "rgba(44,40,37,0.16)";
      ctx.lineWidth = 0.6;
      for (let y = 24; y < height; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(y) * 4);
        ctx.bezierCurveTo(width * 0.28, y - 5, width * 0.64, y + 8, width, y + Math.cos(y) * 5);
        ctx.stroke();
      }
      ctx.restore();
    };

    const draw = (time) => {
      const dt = Math.min(time - lastTime || 16, 40);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);
      drawWash();
      drawFibers();

      if (enabled.has("ink")) {
        particles.forEach((p) => {
          p.drift += dt * 0.00045;
          if (!media.matches) {
            p.x += p.vx + Math.cos(p.drift) * 0.035;
            p.y += p.vy + Math.sin(p.drift) * 0.03;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;

          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4.5);
          gradient.addColorStop(0, `rgba(${p.color},${p.alpha})`);
          gradient.addColorStop(0.45, `rgba(${p.color},${p.alpha * 0.4})`);
          gradient.addColorStop(1, `rgba(${p.color},0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 4.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [isDarkMode, enabledShapes]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
};

export default ParticleBackground;
