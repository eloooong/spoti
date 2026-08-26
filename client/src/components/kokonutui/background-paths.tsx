"use client";

/**
 * @author: @dorianbaffier
 * @description: Background Paths
 * @version: 1.1.0
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adapted for SpotiStats:
 * - Spotify-green gradient instead of purple/pink/blue
 * - Pure backdrop (no built-in title/layout)
 * - Fixed flicker: removed scale animations (SVG paths scaled from the
 *   canvas origin, making paths visibly jump), and moved per-path opacity
 *   out of `style` into the animation target so React and Motion stop
 *   fighting over the attribute.
 */

import { motion } from "motion/react";
import { memo, useMemo } from "react";

interface Point {
  x: number;
  y: number;
}

interface PathData {
  id: string;
  d: string;
  opacity: number;
  width: number;
  bobY: number;
  bobDuration: number;
}

function generateAestheticPath(
  index: number,
  position: number,
  type: "primary" | "secondary" | "accent"
): string {
  const baseAmplitude =
    type === "primary" ? 150 : type === "secondary" ? 100 : 60;
  const phase = index * 0.2;
  const points: Point[] = [];
  const segments = type === "primary" ? 10 : type === "secondary" ? 8 : 6;

  const startX = 2400;
  const startY = 800;
  const endX = -2400;
  const endY = -800 + index * 25;

  for (let i = 0; i <= segments; i++) {
    const progress = i / segments;
    const eased = 1 - (1 - progress) ** 2;

    const baseX = startX + (endX - startX) * eased;
    const baseY = startY + (endY - startY) * eased;

    const amplitudeFactor = 1 - eased * 0.3;
    const wave1 =
      Math.sin(progress * Math.PI * 3 + phase) *
      (baseAmplitude * 0.7 * amplitudeFactor);
    const wave2 =
      Math.cos(progress * Math.PI * 4 + phase) *
      (baseAmplitude * 0.3 * amplitudeFactor);
    const wave3 =
      Math.sin(progress * Math.PI * 2 + phase) *
      (baseAmplitude * 0.2 * amplitudeFactor);

    points.push({
      x: baseX * position,
      y: baseY + wave1 + wave2 + wave3,
    });
  }

  const pathCommands = points.map((point: Point, i: number) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const prevPoint = points[i - 1];
    const tension = 0.4;
    const cp1x = prevPoint.x + (point.x - prevPoint.x) * tension;
    const cp1y = prevPoint.y;
    const cp2x = prevPoint.x + (point.x - prevPoint.x) * (1 - tension);
    const cp2y = point.y;
    return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
  });

  return pathCommands.join(" ");
}

// Index-based ids are stable across re-renders (Math.random-based ids
// changed every mount, forcing unnecessary path re-creation).
const makePaths = (
  prefix: string,
  count: number,
  position: number,
  type: "primary" | "secondary" | "accent",
  opacityBase: number,
  opacityStep: number,
  widthBase: number,
  widthStep: number
): PathData[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    d: generateAestheticPath(i, position, type),
    opacity: opacityBase + i * opacityStep,
    width: widthBase + i * widthStep,
    // Stagger the bobbing so waves don't move in lockstep.
    bobY: type === "primary" ? -15 : type === "secondary" ? -10 : -5,
    bobDuration: 6 + ((i * 7) % 5),
  }));

const FloatingPaths = memo(function FloatingPaths({
  position,
}: {
  position: number;
}) {
  const primaryPaths = useMemo(
    () => makePaths("primary", 12, position, "primary", 0.15, 0.02, 4, 0.3),
    [position]
  );

  const secondaryPaths = useMemo(
    () => makePaths("secondary", 15, position, "secondary", 0.12, 0.015, 3, 0.25),
    [position]
  );

  const accentPaths = useMemo(
    () => makePaths("accent", 10, position, "accent", 0.08, 0.12, 2, 0.2),
    [position]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="h-full w-full"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="-2400 -800 4800 1600"
      >
        <title>Background Paths</title>
        <defs>
          {/* SpotiStats palette: Spotify green tones */}
          <linearGradient id="sharedGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(29, 185, 84, 0.45)" />
            <stop offset="50%" stopColor="rgba(30, 215, 96, 0.35)" />
            <stop offset="100%" stopColor="rgba(46, 160, 92, 0.45)" />
          </linearGradient>
        </defs>

        {[primaryPaths, secondaryPaths, accentPaths].map((group, groupIndex) => (
          <g
            key={`group-${groupIndex}`}
            style={{ opacity: [1, 0.8, 0.6][groupIndex] }}
          >
            {group.map((path, i) => (
              <motion.path
                animate={{
                  opacity: path.opacity,
                  y: [0, path.bobY, 0],
                }}
                d={path.d}
                initial={{ opacity: 0 }}
                key={path.id}
                stroke="url(#sharedGradient)"
                strokeLinecap="round"
                strokeWidth={path.width}
                transition={{
                  opacity: {
                    duration: 1.2,
                    delay: i * 0.05,
                    ease: "easeOut",
                  },
                  y: {
                    duration: path.bobDuration,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "reverse",
                  },
                }}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
});

export default memo(function BackgroundPaths({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <FloatingPaths position={1} />
    </div>
  );
});
