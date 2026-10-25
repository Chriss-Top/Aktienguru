/** GitHub Pages adapter. Only public market snapshots leave the build machine;
 * personal positions and hypotheses remain on the browser's own origin. */
import type {
  Dashboard,
  Detail,
  Portfolio,
  Prediction,
  Backtest,
  Point,
  Trade,
} from "./types";
import { UNIVERSE } from "./types";
type Bar = {
  date: string;
  close: number;
  adjusted: number;
  dividend: number;
  split: number;
};
type Series = {
  symbol: string;
  currency: string;
  bars: Bar[];
  source: string;
  fetched_at: string;
};
type Market = {
  schema: number;
  generated_at: string;
  dashboard: Dashboard;
  details: Record<string, Detail>;
  series: Record<string, Series>;
};
type Stored = Pick<
  Portfolio,
  "id" | "name" | "kind" | "active" | "created_at" | "trades" | "strategy"
> & { frozen?: Portfolio; stopped_date?: string };
type State = { schema: 1; portfolios: Stored[]; predictions: Prediction[] };
const KEY = "guru-private-browser-v1",
  CAPITAL = 100000;
let marketPromise: Promise<Market> | undefined;
let loadingMarket = false;
async function market(refresh = false) {
  if (refresh && !loadingMarket) marketPromise = undefined;
  if (!marketPromise)
    marketPromise =
      ((loadingMarket = true),
      fetch(import.meta.env.BASE_URL + "data/market.json", {
        cache: "no-cache",
      })
        .then(async (r) => {
          if (!r.ok)
            throw Error(
              "Der öffentliche Kursdatenstand ist momentan nicht verfügbar.",
            );
          const d = (await r.json()) as Market;
          if (d.schema !== 1 || !d.series?.SPY || !d.series?.["EURUSD=X"])
            throw Error("Ungültiger Kursdatenstand.");
          return d;
        })
        .catch((e) => {
          marketPromise = undefined;
          throw e;
        })
        .finally(() => {
          loadingMarket = false;
        }));
  return marketPromise;
}
function read(): State {
  const raw = localStorage.getItem(KEY);
  if (!raw)
    return {
      schema: 1,
      portfolios: [
        {
          id: "personal",
          name: "Mein Portfolio",
          kind: "personal",
          active: true,
          created_at: new Date().toISOString(),
          trades: [],
        },
      ],
      predictions: [],
    };
  try {
    const s = JSON.parse(raw);
    if (
      s.schema !== 1 ||
      !Array.isArray(s.portfolios) ||
      !Array.isArray(s.predictions)
    )
      throw Error();
    return s;
  } catch {
    throw Error(
      "Die gespeicherten Browserdaten können nicht gelesen werden. Bitte sichere sie, bevor du den Browserspeicher zurücksetzt.",
    );
  }
}
function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw Error(
      "Der Browser konnte deine Simulation nicht speichern. Speicherzugriff prüfen.",
    );
  }
}
function bar(s: Series, date: string): Bar {
  let lo = 0,
    hi = s.bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.bars[mid].date <= date) lo = mid + 1;
    else hi = mid;
  }
  const b = s.bars[lo - 1];
  if (!b || Date.parse(date) - Date.parse(b.date) > 7 * 86400000)
    throw Error(`Historischer Kurs für ${s.symbol} fehlt am ${date}.`);
  return b;
}
function fx(m: Market, currency: string, date: string) {
  if (currency === "EUR") return 1;
  if (currency !== "USD") throw Error("Währung nicht unterstützt.");
  return 1 / bar(m.series["EURUSD=X"], date).close;
}
function commonDay(m: Market, symbols: string[]) {
  return [...symbols, "SPY", "EURUSD=X"]
    .map((s) => m.series[s].bars.at(-1)!.date)
    .sort()[0];
}
function fresh(day: string) {
  if (Date.now() - Date.parse(day + "T23:59:59Z") > 5 * 86400000)
    throw Error(
      "Der öffentliche Kursdatenstand ist älter als fünf Tage. Neue Transaktionen und aktuelle Bewertungen sind gesperrt, bis der Betreiber ihn aktualisiert.",
    );
}
function replay(p: Stored, m: Market, date: string) {
  let cash = CAPITAL,
    dividends = 0,
    fees = 0;
  const holdings: Record<string, number> = {};
  const trades = p.trades.filter((t) => t.date <= date);
  if (!trades.length)
    return { cash, dividends, fees, value: cash, return_pct: 0, holdings: [] };
  const start = trades.map((t) => t.date).sort()[0];
  const events = new Map<string, { symbol: string; bar: Bar }[]>();
  for (const symbol of new Set(trades.map((t) => t.symbol))) {
    const s = m.series[symbol];
    if (s.bars[0].date > start)
      throw Error(
        "Das Kursarchiv deckt diese Portfoliohistorie nicht mehr ab.",
      );
    for (const b of s.bars) {
      if (b.date >= start && b.date <= date && (b.split !== 1 || b.dividend)) {
        const entries = events.get(b.date) ?? [];
        entries.push({ symbol, bar: b });
        events.set(b.date, entries);
      }
    }
  }
  for (const day of [
    ...new Set([...events.keys(), ...trades.map((t) => t.date)]),
  ].sort()) {
    for (const e of events.get(day) ?? []) {
      const qty = (holdings[e.symbol] ?? 0) * e.bar.split;
      holdings[e.symbol] = qty;
      const amount =
        qty * e.bar.dividend * fx(m, m.series[e.symbol].currency, day);
      cash += amount;
      dividends += amount;
    }
    for (const t of trades.filter((t) => t.date === day)) {
      const sign = t.side === "buy" ? 1 : -1;
      holdings[t.symbol] = (holdings[t.symbol] ?? 0) + sign * t.quantity;
      cash -= sign * t.quantity * t.price * t.fx + t.fee;
      fees += t.fee;
    }
  }
  const positions = Object.entries(holdings)
    .filter(([, q]) => q > 1e-8)
    .map(([symbol, quantity]) => {
      const s = m.series[symbol],
        b = bar(s, date),
        rate = fx(m, s.currency, date);
      return {
        symbol,
        quantity,
        price: b.close,
        currency: s.currency,
        fx: rate,
        value: quantity * b.close * rate,
        date: b.date,
      };
    });
  const value = cash + positions.reduce((s, p) => s + p.value, 0);
  return {
    cash,
    dividends,
    fees,
    value,
    return_pct: (value / CAPITAL - 1) * 100,
    holdings: positions,
  };
}
function curve(p: Stored, m: Market) {
  if (!p.trades.length) return [];
  const symbols = [...new Set(p.trades.map((t) => t.symbol))],
    start = p.trades.map((t) => t.date).sort()[0],
    end = p.stopped_date ?? commonDay(m, symbols),
    bm = m.series.SPY;
  const base = bar(bm, start).adjusted * fx(m, bm.currency, start);
  return bm.bars
    .filter((b) => b.date >= start && b.date <= end)
    .map((b) => ({
      date: b.date,
      strategy: replay(p, m, b.date).value,
      benchmark: (CAPITAL * b.adjusted * fx(m, bm.currency, b.date)) / base,
    }));
}
function value(p: Stored, m: Market): Portfolio {
  if (p.frozen) return { ...p.frozen };
  try {
    const day = commonDay(m, [...new Set(p.trades.map((t) => t.symbol))]);
    if (p.trades.length) fresh(day);
    return {
      ...p,
      ...replay(p, m, day),
      curve: curve(p, m),
      date: day,
      error: undefined,
    };
  } catch (e) {
    return { ...p, holdings: [], curve: [], error: (e as Error).message };
  }
}
function execute(
  p: Stored,
  m: Market,
  symbol: string,
  side: "buy" | "sell",
  quantity: number,
) {
  if (
    !UNIVERSE[symbol] ||
    !["buy", "sell"].includes(side) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 1e6
  )
    throw Error("Ungültiger virtueller Auftrag.");
  if (!p.active) throw Error("Dieses Portfolio ist beendet.");
  const day = commonDay(m, [
    ...new Set([...p.trades.map((t) => t.symbol), symbol]),
  ]);
  fresh(day);
  if (p.trades.some((t) => t.date > day))
    throw Error("Datenstand liegt vor der letzten Transaktion.");
  const state = replay(p, m, day),
    s = m.series[symbol],
    b = bar(s, day),
    rate = fx(m, s.currency, day),
    amount = quantity * b.close * rate,
    fee = Math.max(1, amount * 0.001);
  if (side === "buy" && amount + fee > state.cash + 1e-8)
    throw Error("Nicht genügend virtuelles Guthaben einschließlich Gebühren.");
  const held = state.holdings.find((h) => h.symbol === symbol)?.quantity ?? 0;
  if (side === "sell" && quantity > held + 1e-8)
    throw Error("Nicht genügend Aktien.");
  if (side === "sell" && state.cash + amount - fee < 0)
    throw Error("Verkauf deckt die Gebühr nicht.");
  const trade: Trade = {
    id: crypto.randomUUID(),
    symbol,
    side,
    quantity,
    price: b.close,
    currency: s.currency,
    fx: rate,
    fee,
    date: day,
    created_at: new Date().toISOString(),
  };
  p.trades.push(trade);
}
function analysis(p: number[]) {
  if (p.length < 201) throw Error("Mindestens 201 Handelstage benötigt.");
  const changes = [20, 60, 200].map(
    (n) => (p.at(-1)! / p[p.length - 1 - n] - 1) * 100,
  );
  const r = p
      .slice(-61)
      .slice(1)
      .map((v, i) => v / p[p.length - 61 + i] - 1),
    mean = r.reduce((s, v) => s + v, 0) / r.length;
  const vol =
      Math.sqrt(r.reduce((s, v) => s + (v - mean) ** 2, 0) / r.length) *
      Math.sqrt(252) *
      100,
    c = (x: number) => Math.max(0, Math.min(1, x));
  const sum =
    30 * c(0.5 + changes[0] / 40) +
    35 * c(0.5 + changes[1] / 80) +
    25 * c(0.5 + changes[2] / 120) +
    10 * c(1 - vol / 80);
  // Python round uses ties-to-even; keep boundary decisions identical.
  const floor = Math.floor(sum);
  return Math.abs(sum - floor - 0.5) < 1e-12
    ? floor % 2
      ? floor + 1
      : floor
    : Math.round(sum);
}
function backtest(m: Market, symbol: string, fee: number): Backtest {
  if (!UNIVERSE[symbol] || !Number.isFinite(fee) || fee < 0 || fee > 100)
    throw Error("Ungültiges Symbol oder Gebührenwert.");
  const bm = new Map(m.series.SPY.bars.map((b) => [b.date, b.adjusted])),
    bars = m.series[symbol].bars.filter((b) => bm.has(b.date));
  if (bars.length < 240) throw Error("Nicht genügend gemeinsame Handelstage.");
  let equity = 100,
    position = false,
    trades = 0;
  const points: Point[] = [],
    base = bm.get(bars[201].date)!;
  for (let i = 201; i < bars.length - 1; i++) {
    const signal = analysis(bars.slice(0, i).map((b) => b.adjusted)) >= 60;
    if (signal !== position) {
      equity *= 1 - fee / 10000;
      trades++;
    }
    position = signal;
    if (position) equity *= bars[i + 1].adjusted / bars[i].adjusted;
    points.push({
      date: bars[i + 1].date,
      strategy: equity,
      benchmark: (100 * bm.get(bars[i + 1].date)!) / base,
    });
  }
  if (position) {
    equity *= 1 - fee / 10000;
    trades++;
    points.at(-1)!.strategy = equity;
  }
  let peak = 100,
    drawdown = 0;
  for (const p of points) {
    peak = Math.max(peak, p.strategy!);
    drawdown = Math.min(drawdown, p.strategy! / peak - 1);
  }
  return {
    curve: points,
    return_pct: equity - 100,
    benchmark_return_pct: points.at(-1)!.benchmark! - 100,
    max_drawdown_pct: drawdown * 100,
    trades,
    fee_bps: fee,
    start: bars[201].date,
    end: bars.at(-1)!.date,
    notes: [
      "Signal nur bis zum Vortag; Ausführung am nächsten Tagesschluss.",
      "Bereinigte Renditen enthalten Dividenden und Splits; Gebühren je Positionswechsel.",
      "USD-Strategie gegen SPY in USD; kein FX-Effekt in dieser Betrachtung.",
      "Heutige Aktienauswahl kann Survivorship- und Selektionsbias erzeugen.",
      "Keine Aussage über zukünftige Prognosegenauigkeit.",
    ],
  };
}
export async function staticApi(
  path: string,
  input?: unknown,
): Promise<unknown> {
  if (path === "/health")
    return {
      status: "ok",
      app: "guru",
      mode: "browser-only",
      monitoring: false,
    };
  if (path === "/predictions" && input === undefined) return read().predictions;
  const m = await market(path === "/dashboard");
  if (path === "/dashboard") return m.dashboard;
  if (path.startsWith("/stocks/")) {
    const stock = m.details[path.split("/").at(-1)!];
    if (!stock) throw Error("Aktie nicht unterstützt.");
    return stock;
  }
  if (path === "/backtest") {
    const b = input as { symbol: string; fee_bps: number };
    return backtest(m, b.symbol, b.fee_bps);
  }
  if (path === "/portfolios") return read().portfolios.map((p) => value(p, m));
  const s = read(),
    b = (input ?? {}) as Record<string, unknown>;
  if (path === "/trades") {
    execute(
      s.portfolios.find((p) => p.id === "personal")!,
      m,
      String(b.symbol),
      b.side as "buy" | "sell",
      Number(b.quantity),
    );
  } else if (path === "/guru/start") {
    if (s.portfolios.some((p) => p.kind === "guru" && p.active))
      throw Error("Ein Guru-Portfolio läuft bereits.");
    const selected = m.dashboard.stocks.slice(0, 3),
      day = commonDay(m, Object.keys(UNIVERSE));
    fresh(day);
    if (
      m.dashboard.stocks.length !== 8 ||
      m.dashboard.stocks.some((x) => x.date !== day)
    )
      throw Error("Vollständige Daten auf identischem Stichtag erforderlich.");
    const p: Stored = {
      id: crypto.randomUUID(),
      name: "Guru · " + new Date().toISOString().slice(0, 10),
      kind: "guru",
      active: true,
      created_at: new Date().toISOString(),
      trades: [],
      strategy:
        "Drei höchste Scores, je ein Drittel einschließlich Gebühren. Buy-and-hold.",
    };
    for (const stock of selected) {
      const q = Math.floor(
        CAPITAL / 3 / (stock.price * fx(m, stock.currency, day) * 1.001),
      );
      if (q < 1) throw Error("Kapital reicht nicht aus.");
      execute(p, m, stock.symbol, "buy", q);
    }
    s.portfolios.push(p);
  } else if (path === "/guru/stop") {
    const p = s.portfolios.find((p) => p.id === b.id && p.kind === "guru");
    if (!p?.active) throw Error("Kein aktives Guru-Portfolio.");
    const v = value(p, m);
    if (v.error) throw Error(v.error);
    p.active = false;
    p.stopped_date = v.date;
    p.frozen = { ...v, active: false };
  } else if (path === "/predictions") {
    const symbol = String(b.symbol),
      horizon = Number(b.horizon),
      stock = m.details[symbol];
    if (!stock || ![20, 60, 200].includes(horizon))
      throw Error("Ungültige Hypothese.");
    fresh(stock.date);
    const existing = s.predictions.find(
      (p) =>
        p.symbol === symbol &&
        p.cutoff === stock.date &&
        p.model === stock.model &&
        p.horizon === horizon,
    );
    if (existing) return existing;
    s.predictions.unshift({
      id: Date.now(),
      symbol,
      created_at: new Date().toISOString(),
      cutoff: stock.date,
      horizon,
      model: stock.model,
      score: stock.score,
      direction: stock.score >= 60 ? "positive" : "neutral",
      hypothesis:
        stock.score >= 60
          ? "Positive Total-Return-Rendite und Outperformance gegenüber SPY"
          : "Keine positive Modellhypothese",
      outcome: null,
    });
  } else if (path === "/predictions/validate") {
    let evaluated = 0;
    for (const p of s.predictions) {
      if (p.outcome) continue;
      const bars = m.series[p.symbol].bars,
        start = bars.findIndex((b) => b.date === p.cutoff),
        end = start + p.horizon;
      if (start < 0 || end >= bars.length) continue;
      const actual = (bars[end].adjusted / bars[start].adjusted - 1) * 100,
        bm = m.series.SPY,
        relative =
          (bar(bm, bars[end].date).adjusted / bar(bm, p.cutoff).adjusted - 1) *
          100;
      p.outcome = {
        date: bars[end].date,
        return_pct: actual,
        benchmark_return_pct: relative,
        excess_pct: actual - relative,
        hypothesis_met:
          p.direction === "positive" ? actual > 0 && actual > relative : null,
      };
      evaluated++;
    }
    write(s);
    return { evaluated };
  } else throw Error("Diese Funktion ist im Browsermodus nicht verfügbar.");
  write(s);
  return { ok: true };
}
