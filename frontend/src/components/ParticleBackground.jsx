import React, { useRef, useEffect } from "react";

// ============ Constants ============
const PARTICLE_COUNT = 150;
const TIMINGS = { FREE: 5000, FORMING: 2000, HOLDING: 4000, DISSOLVING: 1500 };

// ============ Easing ============
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============ 3D Rotation ============
function rotateX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
function rotateY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

// ============ Shape Generators ============
function distributeOnEdges(vertices, edges, count) {
  const lengths = edges.map(([a, b]) => {
    const d = [vertices[b].x - vertices[a].x, vertices[b].y - vertices[a].y, vertices[b].z - vertices[a].z];
    return Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
  });
  const total = lengths.reduce((s, l) => s + l, 0);
  const points = [];
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const n = Math.max(1, Math.round(count * lengths[i] / total));
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? 0.5 : j / n;
      points.push({
        x: vertices[a].x + t * (vertices[b].x - vertices[a].x),
        y: vertices[a].y + t * (vertices[b].y - vertices[a].y),
        z: vertices[a].z + t * (vertices[b].z - vertices[a].z),
      });
    }
  }
  while (points.length > count) points.pop();
  while (points.length < count) {
    const src = points[Math.floor(Math.random() * points.length)];
    points.push({ x: src.x + (Math.random() - 0.5) * 4, y: src.y + (Math.random() - 0.5) * 4, z: src.z + (Math.random() - 0.5) * 4 });
  }
  return points;
}

function genCube(n, S) {
  const v = [
    { x: -S, y: -S, z: -S }, { x: S, y: -S, z: -S }, { x: S, y: S, z: -S }, { x: -S, y: S, z: -S },
    { x: -S, y: -S, z: S }, { x: S, y: -S, z: S }, { x: S, y: S, z: S }, { x: -S, y: S, z: S },
  ];
  const e = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  return distributeOnEdges(v, e, n);
}

function genSphere(n, S) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    points.push({ x: Math.cos(theta) * r * S, y: y * S, z: Math.sin(theta) * r * S });
  }
  return points;
}

function genTetrahedron(n, S) {
  const v = [{ x: S, y: S, z: S }, { x: S, y: -S, z: -S }, { x: -S, y: S, z: -S }, { x: -S, y: -S, z: S }];
  const e = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  return distributeOnEdges(v, e, n);
}

function genOctahedron(n, S) {
  const v = [
    { x: 0, y: S, z: 0 }, { x: 0, y: -S, z: 0 },
    { x: S, y: 0, z: 0 }, { x: -S, y: 0, z: 0 },
    { x: 0, y: 0, z: S }, { x: 0, y: 0, z: -S },
  ];
  const e = [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];
  return distributeOnEdges(v, e, n);
}

function genTorus(n, S) {
  const R = S * 0.8, r = S * 0.35;
  const points = [];
  const cols = Math.ceil(Math.sqrt(n * R / r));
  for (let i = 0; i < n; i++) {
    const u = (i % cols) / cols * Math.PI * 2;
    const v = Math.floor(i / cols) / Math.ceil(n / cols) * Math.PI * 2;
    points.push({
      x: (R + r * Math.cos(v)) * Math.cos(u),
      y: r * Math.sin(v),
      z: (R + r * Math.cos(v)) * Math.sin(u),
    });
  }
  return points;
}

function genHelix(n, S) {
  const points = [];
  const half = Math.floor(n / 2);
  const h = S * 2, r = S * 0.5, turns = 2;
  for (let i = 0; i < half; i++) {
    const t = i / (half - 1);
    const a = t * Math.PI * 2 * turns;
    const y = (t - 0.5) * h;
    points.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
    points.push({ x: Math.cos(a + Math.PI) * r, y, z: Math.sin(a + Math.PI) * r });
  }
  while (points.length > n) points.pop();
  while (points.length < n) points.push({ x: 0, y: (Math.random() - 0.5) * h, z: 0 });
  return points;
}

function genDiamond(n, S) {
  const v = [
    { x: 0, y: S * 1.3, z: 0 },
    { x: S, y: 0, z: S }, { x: S, y: 0, z: -S }, { x: -S, y: 0, z: -S }, { x: -S, y: 0, z: S },
    { x: 0, y: -S * 1.3, z: 0 },
  ];
  const e = [[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1],[5,1],[5,2],[5,3],[5,4]];
  return distributeOnEdges(v, e, n);
}

function genIcosahedron(n, S) {
  const t = (1 + Math.sqrt(5)) / 2; // golden ratio
  const s = S / Math.sqrt(1 + t * t); // normalize to fit in S
  const v = [
    { x: -s, y: t * s, z: 0 }, { x: s, y: t * s, z: 0 },
    { x: -s, y: -t * s, z: 0 }, { x: s, y: -t * s, z: 0 },
    { x: 0, y: -s, z: t * s }, { x: 0, y: s, z: t * s },
    { x: 0, y: -s, z: -t * s }, { x: 0, y: s, z: -t * s },
    { x: t * s, y: 0, z: -s }, { x: t * s, y: 0, z: s },
    { x: -t * s, y: 0, z: -s }, { x: -t * s, y: 0, z: s },
  ];
  const e = [
    [0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],
    [2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],
    [4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],
    [7,8],[7,10],[8,9],[10,11],
  ];
  return distributeOnEdges(v, e, n);
}

function genMobius(n, S) {
  const points = [];
  const R = S * 0.8;
  for (let i = 0; i < n; i++) {
    const u = (i / n) * Math.PI * 2;
    const v = ((i * 7) % n) / n - 0.5; // pseudo-random spread across width
    const half = u / 2;
    const w = v * S * 0.4;
    points.push({
      x: (R + w * Math.cos(half)) * Math.cos(u),
      y: (R + w * Math.cos(half)) * Math.sin(u) * 0.3,
      z: w * Math.sin(half),
    });
  }
  return points;
}

function genTrefoilKnot(n, S) {
  const points = [];
  const r = S * 0.6;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    points.push({
      x: (Math.sin(t) + 2 * Math.sin(2 * t)) * r * 0.45,
      y: (Math.cos(t) - 2 * Math.cos(2 * t)) * r * 0.45,
      z: -Math.sin(3 * t) * r * 0.5,
    });
  }
  return points;
}

function genHeart(n, S) {
  const points = [];
  const scale = S * 0.065;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const z = (Math.sin(t * 3) + Math.cos(t * 2)) * 2;
    points.push({ x: x * scale, y: y * scale, z: z * scale });
  }
  return points;
}

export const SHAPE_LIST = [
  { key: 'cube', name: '立方体', gen: genCube },
  { key: 'sphere', name: '球体', gen: genSphere },
  { key: 'tetrahedron', name: '四面体', gen: genTetrahedron },
  { key: 'octahedron', name: '八面体', gen: genOctahedron },
  { key: 'torus', name: '圆环', gen: genTorus },
  { key: 'helix', name: '螺旋', gen: genHelix },
  { key: 'diamond', name: '钻石', gen: genDiamond },
  { key: 'icosahedron', name: '二十面体', gen: genIcosahedron },
  { key: 'mobius', name: '莫比乌斯环', gen: genMobius },
  { key: 'trefoil', name: '三叶结', gen: genTrefoilKnot },
  { key: 'heart', name: '心形', gen: genHeart },
];

const ALL_GENS = SHAPE_LIST.map(s => s.gen);

// ============ Component ============
const ParticleBackground = ({ isDarkMode, enabledShapes }) => {
  const canvasRef = useRef(null);
  const enabledRef = useRef(enabledShapes);
  enabledRef.current = enabledShapes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;
    let width, height;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking
    let mouseX = -9999, mouseY = -9999;
    const onMouse = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const onLeave = () => { mouseX = -9999; mouseY = -9999; };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("mouseleave", onLeave);

    // Particles
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
        baseX: 0, baseY: 0,
        size: Math.random() * 5 + 2,
        opacity: Math.random() * 0.4 + 0.3,
      });
    }

    // State machine
    let state = "FREE", stateTimer = 0, lastTime = 0;
    const getActiveGens = () => {
      const keys = enabledRef.current;
      if (!keys || keys.length === 0) return ALL_GENS;
      const filtered = SHAPE_LIST.filter(s => keys.includes(s.key)).map(s => s.gen);
      return filtered.length > 0 ? filtered : ALL_GENS;
    };
    let activeGens = getActiveGens();
    let shapeIdx = Math.floor(Math.random() * activeGens.length);
    let targets = [];
    let connections = []; // precomputed pairs based on 3D distance
    let rotX = 0, rotY = 0;
    const color = () => isDarkMode ? "255,255,255" : "0,0,0";

    // Project 3D point to screen center
    const project = (p) => ({ x: width / 2 + p.x, y: height / 2 + p.y });

    // Animation loop
    const animate = (time) => {
      if (!lastTime) lastTime = time;
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      stateTimer += dt;

      ctx.clearRect(0, 0, width, height);
      const c = color();

      // State transitions
      if (state === "FREE" && stateTimer >= TIMINGS.FREE) {
        state = "FORMING";
        stateTimer = 0;
        const scale = Math.min(width, height) * 0.35;
        activeGens = getActiveGens();
        shapeIdx = shapeIdx % activeGens.length;
        targets = activeGens[shapeIdx](PARTICLE_COUNT, scale);
        // Precompute connections using 3D distance (stable across rotation)
        connections = [];
        const connDist3D = scale * 0.7;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          for (let j = i + 1; j < PARTICLE_COUNT; j++) {
            const dx = targets[i].x - targets[j].x;
            const dy = targets[i].y - targets[j].y;
            const dz = targets[i].z - targets[j].z;
            if (dx * dx + dy * dy + dz * dz < connDist3D * connDist3D) {
              connections.push([i, j]);
            }
          }
        }
        particles.forEach((p) => { p.baseX = p.x; p.baseY = p.y; });
      } else if (state === "FORMING" && stateTimer >= TIMINGS.FORMING) {
        state = "HOLDING";
        stateTimer = 0;
        rotX = 0; rotY = 0;
      } else if (state === "HOLDING" && stateTimer >= TIMINGS.HOLDING) {
        state = "DISSOLVING";
        stateTimer = 0;
        particles.forEach((p) => {
          p.baseX = p.x; p.baseY = p.y;
          p.vx = (Math.random() - 0.5) * 2.5;
          p.vy = (Math.random() - 0.5) * 2.5;
        });
      } else if (state === "DISSOLVING" && stateTimer >= TIMINGS.DISSOLVING) {
        state = "FREE";
        stateTimer = 0;
        shapeIdx = (shapeIdx + 1) % getActiveGens().length;
      }

      // Update particles based on state
      updateParticles(dt, c);

      animId = requestAnimationFrame(animate);
    };

    const updateParticles = (dt, c) => {
      const blend = easeInOutCubic(Math.min(stateTimer / TIMINGS[state === "FORMING" ? "FORMING" : "DISSOLVING"], 1));

      // Update rotation once per frame, not per particle
      if (state === "HOLDING") {
        rotY += dt * 0.0008;
        rotX += dt * 0.0004;
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        if (state === "FREE") {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          p.x = Math.max(0, Math.min(width, p.x));
          p.y = Math.max(0, Math.min(height, p.y));
          const dx = p.x - mouseX, dy = p.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            p.x += (dx / dist) * 3;
            p.y += (dy / dist) * 3;
          }
        } else if (state === "FORMING") {
          const rot = rotateY(rotateX(targets[i], 0), 0);
          const proj = project(rot);
          p.x = p.baseX + (proj.x - p.baseX) * blend;
          p.y = p.baseY + (proj.y - p.baseY) * blend;
        } else if (state === "HOLDING") {
          const rot = rotateY(rotateX(targets[i], rotX), rotY);
          const proj = project(rot);
          p.x = proj.x; p.y = proj.y;
        } else if (state === "DISSOLVING") {
          const rot = rotateY(rotateX(targets[i], rotX), rotY);
          const proj = project(rot);
          p.x = proj.x + (proj.x + p.vx * 80 - proj.x) * blend;
          p.y = proj.y + (proj.y + p.vy * 80 - proj.y) * blend;
        }
      }

      // Draw connections when forming/holding shape
      if (state !== "FREE" && connections.length > 0) {
        const connAlpha = state === "HOLDING" ? 0.45 : state === "FORMING" ? 0.45 * blend : 0.45 * (1 - blend);
        ctx.strokeStyle = `rgba(${c},${connAlpha})`;
        ctx.lineWidth = 1;
        for (let k = 0; k < connections.length; k++) {
          const [i, j] = connections[k];
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }

      // Draw particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c},${p.opacity})`;
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none",
      }}
    />
  );
};

export default ParticleBackground;
