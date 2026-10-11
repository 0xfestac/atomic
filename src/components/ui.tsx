import type { ReactNode } from "react";
import type { RiskLevel } from "@/lib/atomic/types";

const RISK_STYLES: Record<RiskLevel, { cls: string; dot: string }> = {
  low: { cls: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300", dot: "bg-emerald-400" },
  medium: { cls: "border-amber-900/60 bg-amber-950/40 text-amber-300", dot: "bg-amber-400" },
  high: { cls: "border-orange-900/60 bg-orange-950/40 text-orange-300", dot: "bg-orange-400" },
  critical: { cls: "border-red-900/60 bg-red-950/40 text-red-300", dot: "bg-red-400" },
};

export function RiskBadge({ level, small }: { level: RiskLevel; small?: boolean }) {
  const s = RISK_STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border capitalize ${s.cls} ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "cyan" | "green" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    neutral: "border-ink-600 bg-ink-800 text-mist",
    cyan: "border-cyan-900/60 bg-cyan-950/40 text-cyan-300",
    green: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
    red: "border-red-900/60 bg-red-950/40 text-red-300",
    amber: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel panel-pad ${className}`}>{children}</div>;
}

export function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-white">{title}</h2>
        {sub && <p className="mt-1 text-xs text-mist-dim">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="label-mono mb-2">{eyebrow}</div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-mist">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "green" | "red" | "cyan" }) {
  const toneCls = tone === "green" ? "text-emerald-400" : tone === "red" ? "text-red-400" : tone === "cyan" ? "text-cyan-300" : "text-white";
  return (
    <div className="panel panel-pad">
      <div className="label-mono">{label}</div>
      <div className={`mt-2 font-mono text-xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-mist-dim">{sub}</div>}
    </div>
  );
}

export function Sparkline({ data, width = 120, height = 32, color = "#22d3ee" }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "#34d399" : "#f87171";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color === "auto" ? stroke : color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function RiskGauge({ score, level, size = 120 }: { score: number; level: RiskLevel; size?: number }) {
  const colors: Record<RiskLevel, string> = { low: "#34d399", medium: "#fbbf24", high: "#fb923c", critical: "#f87171" };
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half circle
  const filled = (score / 100) * circumference;
  return (
    <svg width={size} height={size * 0.68} viewBox={`0 0 ${size} ${size * 0.68}`}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#1a2133"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={colors[level]}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" className="font-mono" fill="#ffffff" fontSize="22" fontWeight="600">
        {score}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="font-mono" fill="#5b6378" fontSize="9" letterSpacing="2">
        RISK / 100
      </text>
    </svg>
  );
}

export function CheckStatusIcon({ status }: { status: "pass" | "warn" | "fail" | "info" }) {
  const map = {
    pass: { glyph: "✓", cls: "text-emerald-400 border-emerald-900/60" },
    warn: { glyph: "!", cls: "text-amber-400 border-amber-900/60" },
    fail: { glyph: "✕", cls: "text-red-400 border-red-900/60" },
    info: { glyph: "i", cls: "text-mist border-ink-600" },
  }[status];
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${map.cls}`}>
      {map.glyph}
    </span>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-600 py-12 text-center">
      <p className="text-sm text-mist-bright">{title}</p>
      {sub && <p className="mt-1 text-xs text-mist-dim">{sub}</p>}
    </div>
  );
}

export function ChainDot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
}
