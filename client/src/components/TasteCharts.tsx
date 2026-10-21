import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { SoundRow } from "@/lib/your-sound";
import type { MusicEra } from "@/lib/music-eras";

const COLORS = ["#1ed760", "#74d8bd", "#b5d98c", "#e3c777", "#8bbad9", "#d5aa91", "#b8b0de", "#b5c7a0", "#ded4a0", "#83c8ce"];
const countConfig = { count: { color: COLORS[0], label: "Top tracks" } } satisfies ChartConfig;
const eraColor = (decade: string) => COLORS[(Math.floor(Number.parseInt(decade, 10) / 10)) % COLORS.length];

export function SoundBubbles({ rows, unit }: { rows: SoundRow[]; unit: "artist" | "top track" }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const selected = rows.find(row => row.label === selectedLabel) ?? rows[0];
  const largestCount = Math.max(1, ...rows.map(row => row.count));
  const describe = (row: SoundRow) => `${row.count} ${unit}${row.count === 1 ? "" : "s"}`;

  return (
    <figure className="sound-bubble-chart" aria-label={`Bubble chart of ${unit} counts. Bubble area represents the count.`}>
      <ul className="sound-bubble-grid">
        {rows.map((row, index) => (
          <li className="min-w-0" key={row.label}>
            <button className="sound-bubble-button" type="button" aria-label={`${row.label}: ${describe(row)}`} aria-pressed={selected?.label === row.label} onClick={() => setSelectedLabel(row.label)} onMouseEnter={() => setSelectedLabel(row.label)} onFocus={() => setSelectedLabel(row.label)}>
              <svg viewBox="0 0 100 100" className="sound-bubble-svg" aria-hidden="true">
                <circle cx="50" cy="50" r={42 * Math.sqrt(row.count / largestCount)} fill={COLORS[index % COLORS.length]} stroke={selected?.label === row.label ? "#f3f5f3" : "transparent"} strokeWidth="1.5" />
                <text x="50" y="50" dy="0.35em" textAnchor="middle" fill="#112118" fontSize="18" fontWeight="600">{row.count}</text>
              </svg>
              <span className="sound-bubble-name">{row.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Bubble area represents counts. Select a bubble for its full label.</p>
      {selected && <figcaption className="sound-bubble-detail" aria-live="polite" aria-atomic="true"><span>{selected.label}</span><span>{describe(selected)}</span></figcaption>}
    </figure>
  );
}

export function MusicErasDonut({ eras, total }: { eras: MusicEra[]; total: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <figure className="eras-chart-wrap mt-4" aria-label="Share of dated top tracks by album release decade">
      <div className="eras-visual">
        <div className="eras-donut">
          <ChartContainer className="aspect-square h-56 w-full" config={countConfig} aria-hidden="true">
            <PieChart accessibilityLayer={false}>
              <Pie data={eras} dataKey="count" nameKey="decade" innerRadius="62%" outerRadius="86%" paddingAngle={eras.length > 1 ? 3 : 0} stroke="var(--card)" strokeWidth={3} isAnimationActive={!reducedMotion} animationDuration={450} animationEasing="ease-out">
                {eras.map(era => <Cell key={era.decade} fill={eraColor(era.decade)} />)}
              </Pie>
              <ChartTooltip content={({ active, payload }) => {
                if (!(active && payload?.length)) return null;
                const era = payload[0].payload as MusicEra;
                return <div className="rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-xl"><div className="font-semibold">{era.decade}</div><div className="mt-1 text-muted-foreground">{era.count} of {total} dated tracks · {Math.round(era.count / total * 100)}%</div></div>;
              }} />
            </PieChart>
          </ChartContainer>
          <div className="eras-donut-center" aria-hidden="true"><span>{total}</span><span>dated {total === 1 ? "track" : "tracks"}</span></div>
        </div>
        <ul className="eras-legend">
          {eras.map(era => (
            <li key={era.decade}>
              <span className="eras-legend-name"><span className="eras-swatch" style={{ backgroundColor: eraColor(era.decade) }} aria-hidden="true" />{era.decade}</span>
              <span className="eras-legend-count">{era.count}<span className="sr-only"> {era.count === 1 ? "track" : "tracks"}, </span><span><span aria-hidden="true"> · </span>{Math.round(era.count / total * 100)}%</span></span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
