'use client';

import { useEffect, useRef } from 'react';

// Misma idea que la versión anterior (puntos suaves + líneas de
// constelación, respiración lenta) pero reescrita en Canvas2D nativo en
// vez de three.js/WebGL — el costo real no estaba en la escena (70 puntos
// es barato en cualquier tecnología), estaba en la LIBRERÍA: three.js
// sumaba ~131KB gzip al bundle de estas 2 páginas. Canvas2D no necesita
// ninguna dependencia — el navegador ya trae la API. Pedido explícito del
// usuario 2026-08-18: "reduce el costo aunque tengas que cambiar la
// animación por algo más barato".
const COUNT = 40;

interface Dot {
  x: number; // 0..1, relativo al tamaño del canvas
  y: number;
  phase: number;
  baseRadius: number;
  driftX: number;
  driftY: number;
}

function buildDots(): Dot[] {
  return Array.from({ length: COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    phase: Math.random() * Math.PI * 2,
    baseRadius: 10 + Math.random() * 14,
    driftX: (Math.random() - 0.5) * 0.02,
    driftY: (Math.random() - 0.5) * 0.02,
  }));
}

const LINK_DIST = 0.16; // distancia máxima (relativa) para dibujar una línea entre dos puntos

// Íconos reales (public/images/icons/*.webp, recortados de src/assets/icons/
// y con el fondo vuelto transparente — los originales traían ruido de IA
// repartido por todo el lienzo, se aisló cada silueta con un umbral de
// contraste sobre la versión difuminada). Cada uno con su propio tamaño y
// tenuidad — pedido explícito del usuario 2026-08-18: "todos los iconos
// deben ser de diferentes tenualidades".
interface IconDef {
  src: string;
  aspect: number; // ancho/alto
  heightRatio: number; // alto relativo al alto del panel
  opacity: number; // tenuidad base, cada ícono la suya
}

const ICON_DEFS: IconDef[] = [
  { src: '/images/icons/head-icon.webp', aspect: 139 / 183, heightRatio: 0.238, opacity: 0.15 },
  { src: '/images/icons/cacao-icon.webp', aspect: 73 / 81, heightRatio: 0.09, opacity: 0.12 },
  { src: '/images/icons/cube-icon.webp', aspect: 67 / 71, heightRatio: 0.1197, opacity: 0.09 },
  { src: '/images/icons/peje-icon.webp', aspect: 132 / 101, heightRatio: 0.153, opacity: 0.13 },
  { src: '/images/icons/tablet-icon.webp', aspect: 118 / 137, heightRatio: 0.198, opacity: 0.07 },
  { src: '/images/icons/keyboard-icon.webp', aspect: 118 / 94, heightRatio: 0.1368, opacity: 0.11 },
  { src: '/images/icons/wifi-icon.webp', aspect: 76 / 69, heightRatio: 0.0972, opacity: 0.10 },
];

const ICON_SPEED = 14; // px/s — despacio a propósito, mismo espíritu "fantasma" que antes

interface FloatingIcon {
  img: HTMLImageElement;
  x: number; y: number; // px, espacio del canvas — NaN hasta el primer resize (init perezoso)
  vx: number; vy: number; // px/s
  w: number; h: number; // tamaño en px, recalculado en cada resize
  heightRatio: number;
  aspect: number;
  opacity: number;
  phase: number;
  rotation: number; // rad — solo cambia por rebotes, no gira solo
  angularVelocity: number; // rad/s
}

function buildIcons(): FloatingIcon[] {
  return ICON_DEFS.map((def) => {
    const img = new Image();
    img.src = def.src;
    const angle = Math.random() * Math.PI * 2;
    return {
      img,
      x: NaN,
      y: NaN,
      vx: Math.cos(angle) * ICON_SPEED,
      vy: Math.sin(angle) * ICON_SPEED,
      w: 0,
      h: 0,
      heightRatio: def.heightRatio,
      aspect: def.aspect,
      opacity: def.opacity,
      phase: Math.random() * Math.PI * 2,
      rotation: 0,
      angularVelocity: 0,
    };
  });
}

// Cuánto giro (rad/s) le suma cada rebote — ligero a propósito, un golpecito
// nada más, no un trompo. ANGULAR_DAMPING frena el giro entre rebotes para
// que no se acumule indefinidamente con cada choque.
const BOUNCE_SPIN = 0.6; // -menos violento que antes (era 1.4), pedido explícito 2026-08-18
const ANGULAR_DAMPING = 0.985;

/**
 * Fondo decorativo tenue para el panel de marca de /auth/login y
 * /auth/registro — puntos suaves respirando despacio + líneas finas de
 * constelación + íconos reales que flotan por toda la card y rebotan entre
 * sí y contra los bordes. Canvas2D puro, sin dependencias.
 */
export function BrandParticles() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // El panel padre es `hidden lg:flex` — sin este chequeo, en móvil se
    // gastarían ciclos de render en un <canvas> que nadie ve.
    const mq = window.matchMedia('(min-width: 1024px)');
    if (!mq.matches) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots = buildDots();
    const icons = buildIcons();
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      for (const icon of icons) {
        icon.h = height * icon.heightRatio;
        icon.w = icon.h * icon.aspect;
        // Init perezoso: la primera vez que ya hay tamaño real de canvas,
        // se coloca en una posición aleatoria válida dentro de los bordes.
        if (Number.isNaN(icon.x)) {
          icon.x = icon.w / 2 + Math.random() * (width - icon.w);
          icon.y = icon.h / 2 + Math.random() * (height - icon.h);
        }
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Avanza posiciones, rebota contra los bordes de la card y entre
    // íconos entre sí (colisión elástica simple, masas iguales: se
    // intercambia la componente normal de la velocidad). Cada rebote le
    // suma un giro ligero al ícono — pedido explícito del usuario
    // 2026-08-18: "quiero que los rebotes provoquen giros ligeros".
    function stepPhysics(dtSec: number) {
      for (const icon of icons) {
        if (Number.isNaN(icon.x)) continue;
        icon.x += icon.vx * dtSec;
        icon.y += icon.vy * dtSec;
        icon.rotation += icon.angularVelocity * dtSec;
        icon.angularVelocity *= ANGULAR_DAMPING;

        const halfW = icon.w / 2;
        const halfH = icon.h / 2;
        if (icon.x < halfW) {
          icon.x = halfW; icon.vx = Math.abs(icon.vx);
          icon.angularVelocity += (Math.random() < 0.5 ? -1 : 1) * BOUNCE_SPIN;
        } else if (icon.x > width - halfW) {
          icon.x = width - halfW; icon.vx = -Math.abs(icon.vx);
          icon.angularVelocity += (Math.random() < 0.5 ? -1 : 1) * BOUNCE_SPIN;
        }
        if (icon.y < halfH) {
          icon.y = halfH; icon.vy = Math.abs(icon.vy);
          icon.angularVelocity += (Math.random() < 0.5 ? -1 : 1) * BOUNCE_SPIN;
        } else if (icon.y > height - halfH) {
          icon.y = height - halfH; icon.vy = -Math.abs(icon.vy);
          icon.angularVelocity += (Math.random() < 0.5 ? -1 : 1) * BOUNCE_SPIN;
        }
      }

      for (let i = 0; i < icons.length; i++) {
        for (let j = i + 1; j < icons.length; j++) {
          const a = icons[i], b = icons[j];
          if (Number.isNaN(a.x) || Number.isNaN(b.x)) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const minDist = (a.w + a.h + b.w + b.h) / 4; // radio aproximado promedio de cada ícono
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const avn = a.vx * nx + a.vy * ny;
            const bvn = b.vx * nx + b.vy * ny;
            // Masas iguales: se intercambia la componente normal.
            a.vx += (bvn - avn) * nx; a.vy += (bvn - avn) * ny;
            b.vx += (avn - bvn) * nx; b.vy += (avn - bvn) * ny;
            // Separa para que no queden pegados/temblando.
            const overlap = (minDist - dist) / 2;
            a.x -= nx * overlap; a.y -= ny * overlap;
            b.x += nx * overlap; b.y += ny * overlap;
            // Giro en direcciones opuestas — se "empujan" al chocar.
            a.angularVelocity -= BOUNCE_SPIN;
            b.angularVelocity += BOUNCE_SPIN;
          }
        }
      }
    }

    function draw(time: number) {
      if (!ctx || width === 0 || height === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const t = time * 0.000647; // ritmo lento a propósito — +10%, +20% y +40% sobre el original (0.00035)

      const points = dots.map((d) => {
        const px = ((d.x + d.driftX * Math.sin(t + d.phase) + 1) % 1) * width;
        const py = ((d.y + d.driftY * Math.cos(t + d.phase) + 1) % 1) * height;
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + d.phase);
        return { px, py, pulse, r: d.baseRadius * pulse };
      });

      // Líneas entre vecinos cercanos, muy tenues.
      ctx.strokeStyle = 'rgba(255,255,255,0.072)';
      ctx.lineWidth = 1;
      const linkDistPx = LINK_DIST * Math.max(width, height);
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].px - points[j].px;
          const dy = points[i].py - points[j].py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDistPx) {
            ctx.beginPath();
            ctx.moveTo(points[i].px, points[i].py);
            ctx.lineTo(points[j].px, points[j].py);
            ctx.stroke();
          }
        }
      }

      // Íconos flotantes — transparencia "fantasma" casi constante por
      // ícono (cada uno con su propia tenuidad, ver ICON_DEFS), solo una
      // respiración larguísima y apenas perceptible, nada de parpadeo.
      for (const icon of icons) {
        if (Number.isNaN(icon.x) || !icon.img.complete || icon.img.naturalWidth === 0) continue;
        const pulse = 0.9 + 0.1 * Math.sin(t * 0.1 + icon.phase);
        ctx.globalAlpha = icon.opacity * pulse;
        ctx.save();
        ctx.translate(icon.x, icon.y);
        ctx.rotate(icon.rotation);
        ctx.drawImage(icon.img, -icon.w / 2, -icon.h / 2, icon.w, icon.h);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // Puntos: radial gradient para un borde suave tipo resplandor, no
      // un círculo duro.
      for (const p of points) {
        const gradient = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, p.r);
        gradient.addColorStop(0, `rgba(255,255,255,${0.144 * p.pulse})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let frameId = 0;
    let lastTime = 0;
    let visible = document.visibilityState === 'visible';
    function onVisibility() {
      visible = document.visibilityState === 'visible';
      if (visible && !reducedMotion) { lastTime = 0; frameId = requestAnimationFrame(tick); }
    }
    document.addEventListener('visibilitychange', onVisibility);

    function tick(time: number) {
      if (!visible) return;
      // dt clamp — evita saltos grandes de físicas si el tab estuvo
      // congelado/en background (throttling del navegador) y regresa con
      // un timestamp muy adelantado.
      const dtSec = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      stepPhysics(dtSec);
      draw(time);
      frameId = requestAnimationFrame(tick);
    }

    if (reducedMotion) {
      draw(0); // un solo cuadro estático — respeta prefers-reduced-motion
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      container.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
