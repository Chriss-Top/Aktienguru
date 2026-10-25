import { useId, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import type { Point } from "./types";
import { money, percent, date } from "./api";
export function Loading({
  text = "Daten werden geladen …",
}: {
  text?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={23} className="spin" />
      <span>{text}</span>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <TriangleAlert size={20} />
      <div>
        <strong>Daten momentan nicht verfügbar</strong>
        <p>{message}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Erneut versuchen →
          </button>
        )}
      </div>
    </div>
  );
}
export function Change({ value }: { value: number | undefined }) {
  return (
    <span
      className={
        value === undefined ? "muted" : value >= 0 ? "positive" : "negative"
      }
    >
      {value !== undefined &&
        (value >= 0 ? (
          <ArrowUpRight size={13} />
        ) : (
          <ArrowDownRight size={13} />
        ))}
      {percent(value)}
    </span>
  );
}
export function Stat({
  label,
  value,
  foot,
  accent = false,
}: {
  label: string;
  value: string;
  foot: string;
  accent?: boolean;
}) {
  return (
    <div className={"stat " + (accent ? "stat-accent" : "")}>
      <div className="stat-label">
        {label}
        <Info size={13} />
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ChartNoAxesCombined size={29} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Score({ value }: { value: number | undefined }) {
  return (
    <span
      className={
        "score " +
        (value === undefined
          ? "score-empty"
          : value >= 60
            ? "score-high"
            : "score-mid")
      }
    >
      {value ?? "—"}
      <span>/100</span>
    </span>
  );
}
export function Chart({
  points,
  comparison = false,
  moneyValues = false,
}: {
  points: Point[];
  comparison?: boolean;
  moneyValues?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [period, setPeriod] = useState(252),
    [hover, setHover] = useState<number | null>(null);
  const p = points.slice(-period),
    all = p.flatMap((x) => [
      x.value ?? x.strategy ?? 0,
      ...(comparison ? [x.benchmark ?? 0] : []),
    ]),
    lo = Math.min(...all),
    hi = Math.max(...all),
    range = hi - lo || 1;
  const x = (i: number) => 54 + (i * 816) / Math.max(1, p.length - 1),
    y = (v: number) => 220 - ((v - lo) / range) * 180;
  const line = (key: "value" | "strategy" | "benchmark") =>
    p.map((v, i) => `${x(i)},${y(v[key] ?? 0)}`).join(" ");
  const selected = p[hover ?? p.length - 1];
  return (
    <div className="chart">
      <div className="chart-toolbar">
        <div className="chart-legend">
          <span>
            <i />
            {comparison ? "Portfolio / Strategie" : "Bereinigter Kurs"}
          </span>
          {comparison && (
            <span>
              <i className="benchmark-dot" />
              SPY
            </span>
          )}
        </div>
        <div className="segments" aria-label="Chartzeitraum">
          {[
            [21, "1M"],
            [63, "3M"],
            [126, "6M"],
            [252, "1J"],
            [2000, "Alle"],
          ].map(([n, label]) => (
            <button
              key={n}
              className={period === n ? "active" : ""}
              onClick={() => {
                setPeriod(Number(n));
                setHover(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!p.length ? (
        <Empty
          title="Noch keine Zeitreihe"
          text="Sobald echte Daten verfügbar sind, erscheint hier der interaktive Verlauf."
        />
      ) : (
        <>
          <div className="chart-readout">
            <strong>
              {moneyValues
                ? money(selected?.value ?? selected?.strategy)
                : (selected?.value ?? selected?.strategy ?? 0).toLocaleString(
                    "de-DE",
                    { maximumFractionDigits: 2 },
                  )}
            </strong>
            <span>
              {date(selected?.date)}
              {comparison && selected?.benchmark !== undefined
                ? " · SPY: " +
                  (moneyValues
                    ? money(selected.benchmark)
                    : selected.benchmark.toFixed(2))
                : ""}
            </span>
          </div>
          <svg
            viewBox="0 0 900 265"
            role="img"
            aria-label="Interaktiver historischer Kursverlauf"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                setHover((i) =>
                  Math.max(
                    0,
                    Math.min(
                      p.length - 1,
                      (i ?? p.length - 1) + (e.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
                );
              }
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(
                Math.max(
                  0,
                  Math.min(
                    p.length - 1,
                    Math.round(
                      ((((e.clientX - rect.left) / rect.width) * 900 - 54) /
                        816) *
                        (p.length - 1),
                    ),
                  ),
                ),
              );
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#13a185" stopOpacity=".16" />
                <stop offset="1" stopColor="#13a185" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="54"
                  x2="870"
                  y1={40 + i * 60}
                  y2={40 + i * 60}
                  stroke="#e9eeeb"
                  strokeDasharray="4 5"
                />
                <text x="0" y={44 + i * 60} className="axis-label">
                  {(hi - (i * range) / 3).toLocaleString("de-DE", {
                    maximumFractionDigits: 0,
                  })}
                </text>
              </g>
            ))}
            <polygon
              points={`54,225 ${line(p[0].value === undefined ? "strategy" : "value")} ${x(p.length - 1)},225`}
              fill={`url(#${id})`}
            />
            {comparison && (
              <polyline
                points={line("benchmark")}
                fill="none"
                stroke="#9eabb9"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )}
            <polyline
              points={line(p[0].value === undefined ? "strategy" : "value")}
              fill="none"
              stroke="#10997c"
              strokeWidth="2.5"
            />
            {hover !== null && selected && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1="30"
                  y2="225"
                  stroke="#69968b"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={x(hover)}
                  cy={y(selected.value ?? selected.strategy ?? 0)}
                  r="5"
                  fill="#10997c"
                  stroke="white"
                  strokeWidth="2"
                />
              </g>
            )}
            <text x="54" y="255" className="axis-label">
              {date(p[0].date)}
            </text>
            <text x="870" y="255" textAnchor="end" className="axis-label">
              {date(p.at(-1)?.date)}
            </text>
          </svg>
          <p className="chart-hint">
            Mit Maus, Touch oder Pfeiltasten erkunden ·{" "}
            {comparison
              ? "Vergleich auf identischer Zeitbasis"
              : "Total-Return-bereinigt: Dividenden und Splits enthalten; kein handelbarer Rohkurs"}
          </p>
        </>
      )}
    </div>
  );
}
