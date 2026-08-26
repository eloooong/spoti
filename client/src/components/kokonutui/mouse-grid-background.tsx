"use client";

/**
 * Adapted from Kokonut UI's "Mouse Effect Card"
 * @author: @dorianbaffier
 * @license: MIT
 * @website: https://kokonutui.com
 *
 * SpotiStats version: full-page fixed backdrop. The original renders one
 * motion.div per dot (fine for a small card, thousands of DOM nodes for a
 * page), so this redraws the same repel/spring physics on a single canvas.
 *
 * - Transparent canvas over the page background (#121212)
 * - Dots drift away from the cursor with spring return
 * - Dots near the cursor brighten and tint Spotify green
 * - Loop pauses when the tab is hidden
 */

import { useEffect, useRef } from "react";

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  // Per-dot idle brightness variation so the grid doesn't look flat.
  baseAlpha: number;
}

const SPACING = 28;
const DOT_RADIUS = 1.1;
const REPULSION_RADIUS = 120;
const REPULSION_STRENGTH = 26;

// Spring return: fraction of remaining distance covered each frame.
const STIFFNESS = 0.12;

// Idle dot brightness (very subtle over #121212), green tint near cursor.
const BASE_ALPHA_MAX = 0.09;
const CURSOR_COLOR = { r: 30, g: 215, b: 96 }; // #1ed760
const BASE_COLOR = { r: 255, g: 255, b: 255 };

export default function MouseGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let animId = 0;
    let running = true;
    let mouseX = Number.POSITIVE_INFINITY;
    let mouseY = Number.POSITIVE_INFINITY;

    function buildDots() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const cols = Math.ceil(width / SPACING);
      const rows = Math.ceil(height / SPACING);
      // Offset alternate rows by half a cell for an organic staggered grid.
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= cols; col++) {
          const x = col * SPACING + (row % 2 === 0 ? 0 : SPACING / 2);
          const y = row * SPACING;
          if (x > width || y > height) continue;
          dots.push({
            baseX: x,
            baseY: y,
            x,
            y,
            baseAlpha: 0.35 + ((row * 7 + col * 13) % 10) / 22,
          });
        }
      }
    }

    function render() {
      ctx!.clearRect(0, 0, width, height);

      for (const dot of dots) {
        let targetX = dot.baseX;
        let targetY = dot.baseY;
        let proximity = 0;

        if (
          Number.isFinite(mouseX) &&
          Number.isFinite(mouseY)
        ) {
          const dx = dot.baseX - mouseX;
          const dy = dot.baseY - mouseY;
          const distance = Math.hypot(dx, dy);
          const maxDistance = REPULSION_RADIUS * 1.4;

          if (distance < REPULSION_RADIUS) {
            const force =
              (1 - distance / REPULSION_RADIUS) * REPULSION_STRENGTH;
            const angle = Math.atan2(dy, dx);
            targetX += Math.cos(angle) * force;
            targetY += Math.sin(angle) * force;
          }

          if (distance < maxDistance) {
            proximity = 1 - distance / maxDistance;
          }
        }

        // Spring back toward target (exponential smoothing settles fast
        // without oscillating).
        dot.x += (targetX - dot.x) * STIFFNESS * 2;
        dot.y += (targetY - dot.y) * STIFFNESS * 2;

        const alpha = dot.baseAlpha * BASE_ALPHA_MAX * (1 + proximity * 3.5);

        if (proximity > 0.02) {
          const t = proximity;
          const r = BASE_COLOR.r + (CURSOR_COLOR.r - BASE_COLOR.r) * t;
          const g = BASE_COLOR.g + (CURSOR_COLOR.g - BASE_COLOR.g) * t;
          const b = BASE_COLOR.b + (CURSOR_COLOR.b - BASE_COLOR.b) * t;
          ctx!.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
        } else {
          ctx!.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        }

        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (running) {
        animId = requestAnimationFrame(render);
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const onMouseLeave = () => {
      mouseX = Number.POSITIVE_INFINITY;
      mouseY = Number.POSITIVE_INFINITY;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animId);
      } else if (!running) {
        running = true;
        animId = requestAnimationFrame(render);
      }
    };

    buildDots();
    window.addEventListener("resize", buildDots);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    animId = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", buildDots);
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      ref={canvasRef}
    />
  );
}
