import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, date, money, percent } from "../api";
import { Chart, Empty, ErrorBox, Loading, Stat } from "../components";
import type { Portfolio } from "../types";
import { UNIVERSE } from "../types";
export function PortfolioPage({
  kind,
  revision,
  onTrade,
}: {
  kind: "personal" | "guru";
  revision: number;
  onTrade: (symbol: string, side: "buy" | "sell") => void;
}) {
  const [items, setItems] = useState<Portfolio[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [local, setLocal] = useState(0),
    [selected, setSelected] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Portfolio[]>("/portfolios")
      .then((p) => {
        if (alive) {
          setItems(p.filter((x) => x.kind === kind));
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, revision, local]);
  const p = items.find((x) => x.id === selected) ?? items.at(-1);
  async function guruAction() {
    setBusy(true);
    setError("");
    try {
      await api(
        kind === "guru" && p?.active ? "/guru/stop" : "/guru/start",
        p?.active ? { id: p.id } : {},
      );
      setLocal((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const last = p?.curve.at(-1),
    benchmarkReturn =
      last?.benchmark !== undefined
        ? (last.benchmark / 100000 - 1) * 100
        : undefined;
  return (
    <>
      {error && <ErrorBox message={error} />}
      <div className="portfolio-toolbar">
        <div>
          <span className="pill">
            {kind === "guru"
              ? "REGELBASIERT · BUY & HOLD"
              : "PAPER TRADING · EUR"}
          </span>
          {kind === "guru" && items.length > 1 && (
            <select
              aria-label="Guru-Experiment auswählen"
              value={p?.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.active ? "aktiv" : "beendet"}
                </option>
              ))}
            </select>
          )}
        </div>
        {kind === "guru" ? (
          <button
            className="button primary"
            disabled={busy || loading}
            onClick={guruAction}
          >
            <Sparkles size={16} />
            {busy
              ? "Wird geprüft …"
              : p?.active
                ? "Experiment beenden"
                : "Guru-Portfolio erstellen"}
          </button>
        ) : (
          <button
            className="button primary"
            onClick={() => onTrade("MSFT", "buy")}
          >
            <Plus size={16} />
            Transaktion anlegen
          </button>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : p ? (
        <>
          {p.error && <ErrorBox message={p.error} />}
          <div className="dashboard-stats">
            <Stat
              label="Portfoliowert"
              value={money(p.error ? undefined : p.value)}
              foot={
                p.date
                  ? "Bewertet zum " + date(p.date)
                  : "100.000 € virtuelles Startkapital"
              }
            />
            <Stat
              label="Gesamtrendite"
              value={percent(p.error ? undefined : p.return_pct)}
              foot="Inklusive Dividenden, Gebühren & FX"
            />
            <Stat
              label="Vergleich · SPY in EUR"
              value={percent(p.error ? undefined : benchmarkReturn)}
              foot="Ab erster Transaktion · Total Return"
            />
            <Stat
              label="Verfügbares Guthaben"
              value={money(p.error ? undefined : p.cash)}
              foot={`Gebühren ${money(p.fees)} · Dividenden ${money(p.dividends)}`}
              accent
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {p.name}{" "}
                  {kind === "guru" && (
                    <span className="pill">
                      {p.active ? "AKTIV" : "BEENDET"}
                    </span>
                  )}
                </h2>
                <p>
                  {kind === "guru"
                    ? p.strategy
                    : "Deine Entwicklung gegenüber einem S&P-500-ETF, jeweils in EUR."}
                </p>
              </div>
            </div>
            <Chart points={p.curve} comparison moneyValues />
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                Deine Positionen{" "}
                <span className="count">{p.holdings.length}</span>
              </h2>
              <span className="muted">
                Beträge in EUR, Kurse in Heimatwährung
              </span>
            </div>
            {p.holdings.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>UNTERNEHMEN</th>
                      <th>STÜCK</th>
                      <th>KURS</th>
                      <th>WERT IN EUR</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {p.holdings.map((h, i) => (
                      <tr key={h.symbol}>
                        <td>
                          <a className="company" href={"#stock/" + h.symbol}>
                            <span className={"ticker-logo logo-" + i}>
                              {h.symbol[0]}
                            </span>
                            <span>
                              <strong>{UNIVERSE[h.symbol]}</strong>
                              <small>{h.symbol}</small>
                            </span>
                          </a>
                        </td>
                        <td>
                          {h.quantity.toLocaleString("de-DE", {
                            maximumFractionDigits: 6,
                          })}
                        </td>
                        <td>{money(h.price, h.currency)}</td>
                        <td>
                          <strong>{money(h.value)}</strong>
                        </td>
                        <td>
                          {kind === "personal" && (
                            <button
                              className="button secondary small"
                              onClick={() => onTrade(h.symbol, "sell")}
                            >
                              Verkaufen
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title={
                  p.error
                    ? "Bewertung wartet auf echte Daten"
                    : "Platz für deine erste Investmentidee."
                }
                text={
                  p.error
                    ? "Gespeicherte Transaktionen bleiben erhalten. Es werden keine Ersatzkurse verwendet."
                    : "Beginne mit einem virtuellen Kauf und beobachte, wie sich deine Strategie entwickelt."
                }
                action={
                  !p.error && (
                    <a href="#dashboard" className="button secondary">
                      Aktien entdecken <ArrowRight size={14} />
                    </a>
                  )
                }
              />
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Transaktionsjournal</h2>
              <span className="muted">
                {p.trades.length} Aufträge · dauerhaft gespeichert
              </span>
            </div>
            {p.trades.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>DATUM / KURSTAG</th>
                      <th>AUFTRAG</th>
                      <th>STÜCK</th>
                      <th>KURS</th>
                      <th>FX · EUR PRO USD</th>
                      <th>GEBÜHR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...p.trades].reverse().map((t) => (
                      <tr key={t.id}>
                        <td>
                          {date(t.created_at)}
                          <small className="cell-date">
                            Kurstag {date(t.date)}
                          </small>
                        </td>
                        <td>
                          <span className={"trade-side " + t.side}>
                            {t.side === "buy" ? (
                              <ArrowDownLeft size={13} />
                            ) : (
                              <ArrowUpRight size={13} />
                            )}{" "}
                            {t.side === "buy" ? "Kauf" : "Verkauf"} {t.symbol}
                          </span>
                        </td>
                        <td>
                          {t.quantity.toLocaleString("de-DE", {
                            maximumFractionDigits: 6,
                          })}
                        </td>
                        <td>{money(t.price, t.currency)}</td>
                        <td>{t.fx.toFixed(6)}</td>
                        <td>{money(t.fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Noch keine virtuellen Transaktionen.</p>
            )}
          </section>
        </>
      ) : (
        <section className="panel">
          <Empty
            title="Eine Strategie, die sich messen lässt."
            text="Guru wählt die drei höchsten Scores aus dem vollständigen Universum. Je ein Drittel des Startkapitals, einschließlich Gebühren, wird eingesetzt. Keine automatische Umschichtung oder Hintergrundüberwachung."
          />
        </section>
      )}
      <div className="info-strip">
        <ShieldCheck size={18} />
        <p>
          Dividenden werden vereinfacht am Ex-Tag gutgeschrieben, Splits im
          Bestand verarbeitet. SPY ist ein S&P-500-ETF als Benchmark-Proxy.
          Keine Steuer- oder Slippage-Simulation. Bewertungsfehler werden
          angezeigt, statt durch Ersatzwerte verdeckt.
        </p>
      </div>
    </>
  );
}
