import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const SHAPE_LIST = [
  {
    key: 'fantasy',
    name: '玄幻',
    label: '星尘灵脉',
    colors: ['#8b5cf6', '#38bdf8', '#f5d0fe'],
  },
  {
    key: 'magic',
    name: '魔法',
    label: '符文潮汐',
    colors: ['#a855f7', '#22d3ee', '#f97316'],
  },
  {
    key: 'tech',
    name: '科技',
    label: '神经星图',
    colors: ['#60a5fa', '#34d399', '#e5e7eb'],
  },
];

const REALM_CONFIG = {
  fantasy: {
    count: 1100,
    spread: 26,
    particleSize: 0.035,
    rotationSpeed: 0.00008,
    geometry: 'icosahedron',
    fog: '#070711',
  },
  magic: {
    count: 1250,
    spread: 24,
    particleSize: 0.03,
    rotationSpeed: 0.00012,
    geometry: 'torus',
    fog: '#07040f',
  },
  tech: {
    count: 1400,
    spread: 28,
    particleSize: 0.025,
    rotationSpeed: 0.00016,
    geometry: 'octahedron',
    fog: '#05070c',
  },
};

const REALM_TRANSITION_MS = 1800;

const getRealm = (activeRealm) =>
  SHAPE_LIST.find((item) => item.key === activeRealm) || SHAPE_LIST[0];

const createParticleField = (realm, config, isDarkMode) => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const palette = realm.colors.map((color) => new THREE.Color(color));
  const neutral = new THREE.Color(isDarkMode ? '#f8fafc' : '#111827');

  for (let i = 0; i < config.count; i += 1) {
    const radius = Math.pow(Math.random(), 0.55) * config.spread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const swirl = Math.sin(theta * 3) * 1.4;

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta) + swirl;
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.62;
    positions[i * 3 + 2] = radius * Math.cos(phi) * 0.82;

    const color = palette[i % palette.length].clone().lerp(neutral, Math.random() * 0.24);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: config.particleSize,
    vertexColors: true,
    transparent: true,
    opacity: isDarkMode ? 0.82 : 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
};

const createSignatureMesh = (realm, config) => {
  const group = new THREE.Group();
  const primary = new THREE.Color(realm.colors[0]);
  const secondary = new THREE.Color(realm.colors[1]);

  let geometry;
  if (config.geometry === 'torus') {
    geometry = new THREE.TorusKnotGeometry(2.1, 0.36, 120, 12);
  } else if (config.geometry === 'octahedron') {
    geometry = new THREE.OctahedronGeometry(2.6, 3);
  } else {
    geometry = new THREE.IcosahedronGeometry(2.7, 2);
  }

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: primary,
      wireframe: true,
      transparent: true,
      opacity: 0.42,
    })
  );

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.4, 0.012, 8, 180),
    new THREE.MeshBasicMaterial({
      color: secondary,
      transparent: true,
      opacity: 0.45,
    })
  );

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(5.4, 0.008, 8, 180),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.16,
    })
  );

  ring.rotation.x = Math.PI * 0.5;
  halo.rotation.y = Math.PI * 0.5;
  group.add(mesh, ring, halo);
  return group;
};

const forEachMaterial = (object, callback) => {
  object.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(callback);
  });
};

const rememberBaseOpacity = (object) => {
  forEachMaterial(object, (material) => {
    if (material.userData.baseOpacity === undefined) {
      material.userData.baseOpacity = material.opacity ?? 1;
    }
  });
};

const setLayerOpacity = (layer, opacity) => {
  layer.opacity = opacity;
  forEachMaterial(layer.root, (material) => {
    material.opacity = (material.userData.baseOpacity ?? 1) * opacity;
    material.needsUpdate = true;
  });
};

const disposeLayer = (layer) => {
  layer.root.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
};

const createRealmLayer = (realm, config, isDarkMode) => {
  const root = new THREE.Group();
  const particles = createParticleField(realm, config, isDarkMode);
  const signature = createSignatureMesh(realm, config);
  signature.position.set(5.2, -0.5, -3);
  root.add(particles, signature);
  rememberBaseOpacity(root);

  return {
    key: realm.key,
    root,
    particles,
    signature,
    config,
    opacity: 1,
    fadeFrom: 1,
    fadeStart: null,
    exiting: false,
  };
};

const ParticleBackground = ({ isDarkMode, activeRealm = 'fantasy', scrollProgress = 0 }) => {
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const activeRealmRef = useRef(activeRealm);
  const scrollRef = useRef(scrollProgress);
  activeRealmRef.current = activeRealm;
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const realm = getRealm(activeRealmRef.current);
    const config = REALM_CONFIG[realm.key];

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(config.fog, 18, 42);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 18);

    const initialLayer = createRealmLayer(realm, config, isDarkMode);
    scene.add(initialLayer.root);

    const runtime = {
      camera,
      currentKey: realm.key,
      frameId: 0,
      layers: [initialLayer],
      renderer,
      scene,
    };
    runtimeRef.current = runtime;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = (time) => {
      const scroll = scrollRef.current;
      const motion = reducedMotion ? 0 : 1;

      runtime.layers.forEach((layer) => {
        const layerConfig = layer.config;
        layer.root.rotation.y = time * layerConfig.rotationSpeed * motion + scroll * 0.5;
        layer.root.rotation.x = Math.sin(time * 0.00018) * 0.08 * motion - scroll * 0.08;
        layer.particles.rotation.z = time * layerConfig.rotationSpeed * 0.55 * motion;
        layer.signature.rotation.y = -time * layerConfig.rotationSpeed * 2.4 * motion;
        layer.signature.rotation.x = Math.sin(time * 0.00025) * 0.24 * motion;
        layer.signature.scale.setScalar(1 + scroll * 0.18);

        if (layer.fadeStart !== null) {
          const progress = Math.min((time - layer.fadeStart) / REALM_TRANSITION_MS, 1);
          const targetOpacity = layer.exiting ? 0 : 1;
          const nextOpacity = layer.fadeFrom + (targetOpacity - layer.fadeFrom) * progress;
          setLayerOpacity(layer, nextOpacity);

          if (progress >= 1 && !layer.exiting) {
            layer.fadeStart = null;
            layer.fadeFrom = 1;
          }
        }
      });

      runtime.layers
        .filter((layer) => layer.exiting && layer.opacity <= 0.01)
        .forEach((layer) => {
          runtime.scene.remove(layer.root);
          disposeLayer(layer);
        });
      runtime.layers = runtime.layers.filter((layer) => !(layer.exiting && layer.opacity <= 0.01));

      camera.position.z = 18 - scroll * 2.4;
      camera.position.y = scroll * 1.1;
      renderer.render(scene, camera);
      runtime.frameId = window.requestAnimationFrame(animate);
    };

    runtime.frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(runtime.frameId);
      window.removeEventListener('resize', resize);
      runtime.layers.forEach(disposeLayer);
      renderer.dispose();
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
    };
  }, [isDarkMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.currentKey === activeRealm) return;

    const realm = getRealm(activeRealm);
    const config = REALM_CONFIG[realm.key];
    const transitionStart = performance.now();
    const nextLayer = createRealmLayer(realm, config, isDarkMode);
    nextLayer.fadeFrom = 0;
    nextLayer.fadeStart = transitionStart;
    setLayerOpacity(nextLayer, 0);

    runtime.layers.forEach((layer) => {
      if (!layer.exiting) {
        layer.exiting = true;
        layer.fadeFrom = layer.opacity;
        layer.fadeStart = transitionStart;
      }
    });

    runtime.scene.fog = new THREE.Fog(config.fog, 18, 42);
    runtime.scene.add(nextLayer.root);
    runtime.layers.push(nextLayer);
    runtime.currentKey = realm.key;
  }, [activeRealm, isDarkMode]);

  return <canvas ref={canvasRef} className="particle-stage-canvas" aria-hidden="true" />;
};

export default ParticleBackground;
