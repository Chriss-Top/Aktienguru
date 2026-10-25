export type Point = {
  date: string;
  value?: number;
  strategy?: number;
  benchmark?: number;
};
export type Analysis = {
  score: number;
  short: number;
  medium: number;
  long: number;
  volatility: number;
  components: Record<string, number>;
  model: string;
};
export type Stock = Analysis & {
  symbol: string;
  name: string;
  sector: string;
  currency: string;
  price: number;
  date: string;
  source: string;
  fetched_at: string;
  change: number;
  history: Point[];
};
export type Detail = Stock & {
  fundamentals: Record<string, number | string | null>;
  opportunities: string[];
  risks: string[];
};
export type Dashboard = {
  stocks: Stock[];
  errors: { symbol: string; message: string }[];
  universe: string[];
  model: string;
  benchmark: string;
  monitoring: { enabled: boolean; reason: string };
};
export type Trade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  fx: number;
  fee: number;
  date: string;
  created_at: string;
};
export type Portfolio = {
  id: string;
  name: string;
  kind: "personal" | "guru";
  active: boolean;
  created_at: string;
  date?: string;
  cash?: number;
  value?: number;
  return_pct?: number;
  fees?: number;
  dividends?: number;
  holdings: {
    symbol: string;
    quantity: number;
    price: number;
    currency: string;
    value: number;
    date: string;
    fx: number;
  }[];
  trades: Trade[];
  curve: Point[];
  error?: string;
  strategy?: string;
};
export type Prediction = {
  id: number;
  symbol: string;
  created_at: string;
  cutoff: string;
  horizon: number;
  model: string;
  score: number;
  hypothesis: string;
  direction: string;
  outcome: null | {
    date: string;
    return_pct: number;
    benchmark_return_pct: number;
    excess_pct: number;
    hypothesis_met: boolean | null;
  };
};
export type Backtest = {
  curve: Point[];
  return_pct: number;
  benchmark_return_pct: number;
  max_drawdown_pct: number;
  trades: number;
  fee_bps: number;
  start: string;
  end: string;
  notes: string[];
};
export const UNIVERSE: Record<string, string> = {
  MSFT: "Microsoft",
  AAPL: "Apple",
  NVDA: "NVIDIA",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  META: "Meta Platforms",
  JPM: "JPMorgan Chase",
  JNJ: "Johnson & Johnson",
};
