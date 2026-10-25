import { useState } from "react";
import { Clock3, FlaskConical } from "lucide-react";
import { api, date, percent } from "../api";
import { Chart, Empty, ErrorBox, Loading, Stat } from "../components";
import type { Backtest } from "../types";
import { UNIVERSE } from "../types";
export function BacktestPage() {
  const [symbol, setSymbol] = useState("MSFT"),
    [fee, setFee] = useState(10),
    [result, setResult] = useState<Backtest | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api<Backtest>("/backtest", { symbol, fee_bps: fee }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              <FlaskConical size={18} />
              Historischer Strategietest
            </h2>
            <p>
              Eine Aktie, eine offene Regel, ein nachvollziehbarer Vergleich.
            </p>
          </div>
          <span className="pill">RESEARCH · KEIN GÜTENACHWEIS</span>
        </div>
        <div className="backtest-form">
          <label>
            Unternehmen
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {Object.entries(UNIVERSE).map(([s, n]) => (
                <option key={s} value={s}>
                  {n} · {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gebühren pro Wechsel (Basispunkte)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
            />
          </label>
          <button className="button primary" disabled={busy} onClick={run}>
            <FlaskConical size={16} />
            {busy ? "Backtest läuft …" : "Backtest ausführen"}
          </button>
        </div>
        <div className="info-strip">
          <Clock3 size={18} />
          <p>
            <strong>Kein Blick in die Zukunft:</strong> Score ≥ 60 bedeutet
            investiert, sonst Cash. Das Signal verwendet ausschließlich Daten
            bis zum Vortag; die Ausführung erfolgt zum darauffolgenden
            Tagesschluss. Renditen entstehen erst danach. Cash wird nicht
            verzinst.
          </p>
        </div>
      </section>
      {error && <ErrorBox message={error} />}{" "}
      {busy ? (
        <Loading text="Historische Daten und Strategie werden geprüft …" />
      ) : result ? (
        <>
          <div className="dashboard-stats">
            <Stat
              label="Strategierendite"
              value={percent(result.return_pct)}
              foot={`${date(result.start)} bis ${date(result.end)}`}
            />
            <Stat
              label="SPY · Buy & Hold"
              value={percent(result.benchmark_return_pct)}
              foot="USD · Total Return"
            />
            <Stat
              label="Maximaler Rückgang"
              value={percent(result.max_drawdown_pct)}
              foot="Vom jeweils bisherigen Höchststand"
            />
            <Stat
              label="Positionswechsel"
              value={String(result.trades)}
              foot={`${result.fee_bps} Basispunkte je Wechsel, inkl. Schlussverkauf`}
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Strategie vs. Markt</h2>
              <span className="muted">Startwert 100 · USD-Betrachtung</span>
            </div>
            <Chart points={result.curve} comparison />
          </section>
          <section className="panel">
            <h2>So sind die Ergebnisse einzuordnen</h2>
            <ul className="risks">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="panel">
          <Empty
            title="Erst prüfen. Dann Schlüsse ziehen."
            text="Der Test verwendet echte, bereinigte Kurshistorien. Ohne verfügbare Marktdaten wird kein Ergebnis erzeugt."
          />
        </section>
      )}
    </>
  );
}
