"use client";
import { useState } from "react";

/** Gráficos sencillos en SVG (sin librerías) con cuadro flotante al pasar el mouse o tocar. */
import { KPI_COLORS } from "@/lib/kpi-colors";
const GREEN = KPI_COLORS.green, RED = KPI_COLORS.red;

type Tip = { x: number; y: number; title: string; lines: { color?: string; text: string }[] } | null;
function Tooltip({ tip, W, H }: { tip: Tip; W: number; H: number }) {
  if (!tip) return null;
  const left = (tip.x / W) * 100, top = (tip.y / H) * 100;
  return (
    <div role="status" className="pointer-events-none absolute z-10 min-w-[9rem] rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${left > 60 ? "-105%" : "5%"}, -50%)` }}>
      <p className="mb-1 font-bold text-slate-800">{tip.title}</p>
      {tip.lines.map((l, i) => (
        <p key={i} className="flex items-center gap-1.5 text-slate-700">
          {l.color && <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />}{l.text}
        </p>
      ))}
    </div>
  );
}

export function Donut({ parts, hole = 0.52, label }: { parts: { value: number; color: string; name?: string }[]; hole?: number; label: string }) {
  const [tip, setTip] = useState<Tip>(null);
  const total = parts.reduce((a, p) => a + p.value, 0);
  const R = 90, C = 100;
  let acc = 0;
  const arcs = total > 0 ? parts.filter((p) => p.value > 0).map((p) => {
    const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += p.value;
    const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const pt = (a: number, r: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
    const full = p.value >= total;
    const r2 = R * hole;
    const d = full
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} ${hole > 0 ? `L ${C - 0.01} ${C - r2} A ${r2} ${r2} 0 1 0 ${C} ${C - r2} Z` : "Z"}`
      : `M ${pt(a0, R)} A ${R} ${R} 0 ${large} 1 ${pt(a1, R)} ${hole > 0 ? `L ${pt(a1, r2)} A ${r2} ${r2} 0 ${large} 0 ${pt(a0, r2)} Z` : `L ${C} ${C} Z`}`;
    const mid = (a0 + a1) / 2, pct = (p.value / total) * 100;
    const show = () => setTip({ x: C + R * 0.75 * Math.cos(mid), y: C + R * 0.75 * Math.sin(mid), title: p.name ?? "Detalle", lines: [{ color: p.color, text: `${nf(p.value)} · ${pct.toFixed(1).replace(".", ",")}%` }] });
    return <path key={p.color} d={d} fill={p.color} fillRule="evenodd" tabIndex={0} onPointerEnter={show} onPointerDown={show} onFocus={show} onBlur={() => setTip(null)} style={{ cursor: "pointer", outline: "none" }} />;
  }) : <circle cx={C} cy={C} r={R} fill="#e5e7eb" />;
  return (
    <div className="relative mx-auto h-48 w-48" onPointerLeave={() => setTip(null)}>
      <svg viewBox="0 0 200 200" role="img" aria-label={label} className="h-48 w-48">{arcs}</svg>
      <Tooltip tip={tip} W={200} H={200} />
    </div>
  );
}

const nf = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
/** Escala con marcas en múltiplos redondos que siempre incluye el cero. */
function scale(minV: number, maxV: number, target = 4) {
  const lo0 = Math.min(0, minV), hi0 = Math.max(0, maxV);
  const raw = (hi0 - lo0 || 1000) / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
  const lo = Math.floor(lo0 / step) * step, hi = Math.max(Math.ceil(hi0 / step) * step, lo + step);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

function Axis({ ticks, lo, hi, W, H, L, T, B }: { ticks: number[]; lo: number; hi: number; W: number; H: number; L: number; T: number; B: number }) {
  return (
    <g fontSize="11" fill="#64748b">
      {ticks.map((v) => {
        const y = H - B - ((H - B - T) * (v - lo)) / (hi - lo);
        return (
          <g key={v}>
            <line x1={L} x2={W - 8} y1={y} y2={y} stroke={v === 0 ? "#94a3b8" : "#e2e8f0"} />
            <text x={L - 6} y={y + 4} textAnchor="end">{nf(v)}</text>
          </g>
        );
      })}
    </g>
  );
}

export function LineChart({ labels, a, b, label, names = ["Ingresos", "Gastos"] }: { labels: string[]; a: number[]; b: number[]; label: string; names?: [string, string] | string[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 560, H = 260, L = 78, T = 12, B = 30;
  const sc = scale(Math.min(0, ...a, ...b), Math.max(0, ...a, ...b));
  const n = labels.length;
  const x = (i: number) => L + (n <= 1 ? (W - L - 16) / 2 : ((W - L - 16) * i) / (n - 1));
  const y = (v: number) => H - B - ((H - B - T) * (v - sc.lo)) / (sc.hi - sc.lo);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");
  const band = (W - L - 16) / Math.max(n - 1, 1);
  const tip: Tip = hi === null ? null : { x: x(hi), y: Math.min(y(a[hi]), y(b[hi])), title: labels[hi], lines: [
    { color: GREEN, text: `${names[0]}: ${nf(a[hi])}` }, { color: RED, text: `${names[1]}: ${nf(b[hi])}` }, { text: `Resultado: ${nf(a[hi] - b[hi])}` }] };
  return (
    <div className="relative" onPointerLeave={() => setHi(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
      <Axis ticks={sc.ticks} lo={sc.lo} hi={sc.hi} W={W} H={H} L={L} T={T} B={B} />
      {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="#94a3b8" strokeDasharray="4 3" />}
      {labels.map((l, i) => <text key={l} x={x(i)} y={H - 8} fontSize="11" fill="#64748b" textAnchor="middle">{l}</text>)}
      <path d={`${path(a)} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={GREEN} opacity="0.1" />
      <path d={path(a)} fill="none" stroke={GREEN} strokeWidth="2.5" />
      <path d={path(b)} fill="none" stroke={RED} strokeWidth="2.5" />
      {a.map((v, i) => <circle key={`a${i}`} cx={x(i)} cy={y(v)} r="3.5" fill="#fff" stroke={GREEN} strokeWidth="2" />)}
      {b.map((v, i) => <circle key={`b${i}`} cx={x(i)} cy={y(v)} r="3.5" fill="#fff" stroke={RED} strokeWidth="2" />)}
      {labels.map((l, i) => <rect key={`h${l}`} x={x(i) - band / 2} y={T} width={band} height={H - B - T} fill="transparent" tabIndex={0}
        onPointerEnter={() => setHi(i)} onPointerDown={() => setHi(i)} onFocus={() => setHi(i)} style={{ outline: "none" }} />)}
    </svg>
    <Tooltip tip={tip} W={W} H={H} />
    </div>
  );
}

export function BarChart({ labels, values, label }: { labels: string[]; values: number[]; label: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 560, H = 260, L = 78, T = 12, B = 30;
  const sc = scale(Math.min(0, ...values), Math.max(0, ...values));
  const y = (v: number) => H - B - ((H - B - T) * (v - sc.lo)) / (sc.hi - sc.lo);
  const n = labels.length, slot = (W - L - 12) / Math.max(n, 1), bw = Math.min(46, slot * 0.6);
  const tip: Tip = hi === null ? null : { x: L + slot * hi + slot / 2, y: y(values[hi]), title: labels[hi], lines: [{ color: values[hi] >= 0 ? GREEN : RED, text: `Balance: ${nf(values[hi])}` }] };
  return (
    <div className="relative" onPointerLeave={() => setHi(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
      <Axis ticks={sc.ticks} lo={sc.lo} hi={sc.hi} W={W} H={H} L={L} T={T} B={B} />
      {labels.map((l, i) => {
        const cx = L + slot * i + slot / 2;
        const v = values[i];
        return (
          <g key={l} tabIndex={0} onPointerEnter={() => setHi(i)} onPointerDown={() => setHi(i)} onFocus={() => setHi(i)} style={{ outline: "none", cursor: "pointer" }}>
            <rect x={cx - slot / 2} y={T} width={slot} height={H - B - T} fill={hi === i ? "#f1f5f9" : "transparent"} />
            <rect x={cx - bw / 2} y={Math.min(y(v), y(0))} width={bw} height={Math.max(1, Math.abs(y(v) - y(0)))} rx="3" fill={v >= 0 ? GREEN : RED} opacity="0.85" />
            <text x={cx} y={H - 8} fontSize="11" fill="#64748b" textAnchor="middle">{l}</text>
          </g>
        );
      })}
    </svg>
    <Tooltip tip={tip} W={W} H={H} />
    </div>
  );
}
