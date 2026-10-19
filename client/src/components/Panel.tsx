import type { LucideIcon } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { useContext, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DataUnavailableContext } from "@/lib/data-state";

interface PanelProps {
  title: string;
  note?: string;
  wide?: boolean;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, note, wide, className, action, children }: PanelProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const normX = useMotionValue(0.5);
  const normY = useMotionValue(0.5);
  const rawRotateX = useTransform(normY, [0, 1], [4, -4]);
  const rawRotateY = useTransform(normX, [0, 1], [-4, 4]);
  const rotateX = useSpring(rawRotateX, { stiffness: 300, damping: 28 });
  const rotateY = useSpring(rawRotateY, { stiffness: 300, damping: 28 });
  const glowOpacity = useSpring(0, { stiffness: 180, damping: 22 });
  return (
    <motion.section
      ref={ref}
      className={cn("dashboard-panel group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-card p-5 transition-[border-color] duration-300 hover:border-white/20 sm:p-6", className)}
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: reducedMotion ? 0 : rotateX, rotateY: reducedMotion ? 0 : rotateY, transformPerspective: 900 }}
      onMouseEnter={() => glowOpacity.set(1)}
      onMouseLeave={() => { normX.set(0.5); normY.set(0.5); glowOpacity.set(0); }}
      onMouseMove={(event) => {
        if (!ref.current || reducedMotion) return;
        const rect = ref.current.getBoundingClientRect();
        normX.set((event.clientX - rect.left) / rect.width);
        normY.set((event.clientY - rect.top) / rect.height);
        ref.current.style.setProperty("--glow-x", `${normX.get() * 100}%`);
        ref.current.style.setProperty("--glow-y", `${normY.get() * 100}%`);
      }}
    >
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{ opacity: glowOpacity, background: "radial-gradient(ellipse at var(--glow-x, 30%) var(--glow-y, 30%), rgba(29,185,84,0.14), transparent 65%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-linear-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%]" />
      <div className="relative z-10">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold tracking-[-0.02em] text-white">{title}</h3>
        {action}
      </div>
      {note && <p className="mt-2 max-w-[65ch] text-xs leading-relaxed text-muted-foreground">{note}</p>}
      <div className={cn(wide ? "mt-6" : "mt-5")}>{children}</div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-linear-to-r from-primary/50 to-transparent transition-all duration-500 group-hover:w-full" />
    </motion.section>
  );
}

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  const widths = ["95%", "88%", "60%", "78%", "70%"];
  return (
    <div role="status" aria-label="Loading listening data">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton mb-3 h-3 rounded bg-white/[0.07]" key={i} style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

export function ChartEmpty({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  const unavailable = useContext(DataUnavailableContext);
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-3 py-7 text-center">
      {Icon && <Icon aria-hidden="true" className="size-6 text-white/35" strokeWidth={1.4} />}
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {unavailable ? "Your data will appear here once Spotify access is restored." : children}
      </p>
    </div>
  );
}

export function ChartPanelSkeleton({ title }: { title: string }) {
  return <Panel title={title}><div className="min-h-48 pt-6"><SkeletonLines rows={6} /></div></Panel>;
}
