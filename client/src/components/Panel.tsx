import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TILT_MAX = 4;
const TILT_SPRING = { stiffness: 300, damping: 28 } as const;
const GLOW_SPRING = { stiffness: 180, damping: 22 } as const;

// Entrance variants — inherited from the stagger parent (motion.main in
// Dashboard) so panels fade up in DOM order without prop plumbing.
export const panelVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

interface PanelProps {
  title: string;
  note?: string;
  wide?: boolean;
  className?: string;
  // Optional control rendered opposite the title (e.g. a refresh button).
  action?: ReactNode;
  children: ReactNode;
}

// Dashboard panel built on Kokonut UI's spotlight-card mechanics:
// subtle 3D tilt toward the cursor and a green glow that follows it.
export function Panel({ title, note, wide, className, action, children }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  const normX = useMotionValue(0.5);
  const normY = useMotionValue(0.5);

  const rawRotateX = useTransform(normY, [0, 1], [TILT_MAX, -TILT_MAX]);
  const rawRotateY = useTransform(normX, [0, 1], [-TILT_MAX, TILT_MAX]);

  const rotateX = useSpring(rawRotateX, TILT_SPRING);
  const rotateY = useSpring(rawRotateY, TILT_SPRING);
  const glowOpacity = useSpring(0, GLOW_SPRING);

  return (
    <motion.div
      variants={panelVariants}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-6",
        "border-white/[0.07] bg-white/[0.03] shadow-none backdrop-blur-sm",
        "transition-[border-color] duration-300",
        "hover:border-white/20",
        className
      )}
      onMouseEnter={() => glowOpacity.set(1)}
      onMouseLeave={() => {
        normX.set(0.5);
        normY.set(0.5);
        glowOpacity.set(0);
      }}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        normX.set((e.clientX - rect.left) / rect.width);
        normY.set((e.clientY - rect.top) / rect.height);
      }}
      ref={ref}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
      }}
    >
      {/* Hover glow layer */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          opacity: glowOpacity,
          background:
            "radial-gradient(ellipse at var(--glow-x, 30%) var(--glow-y, 30%), rgba(29,185,84,0.10), transparent 65%)",
        }}
      />

      {/* Shimmer sweep on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-linear-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%]"
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-white">
            {title}
          </h2>
          {action}
        </div>
        {note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
        <div className={cn(wide ? "mt-5" : "mt-4")}>{children}</div>
      </div>

      {/* Accent bottom line on hover */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-linear-to-r from-primary/50 to-transparent transition-all duration-500 group-hover:w-full"
      />
    </motion.div>
  );
}

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  const widths = ["95%", "88%", "60%", "78%", "70%"];
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          className="skeleton mb-2 h-3 rounded-full bg-white/10"
          key={i}
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

export function ChartEmpty({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04]">
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        </span>
      )}
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

// Suspense fallback shaped like a chart panel, so lazy-loaded charts don't
// shift the layout while their chunk loads.
export function ChartPanelSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <div className="h-72 pt-6">
        <SkeletonLines rows={6} />
      </div>
    </Panel>
  );
}
