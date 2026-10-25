import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  Database,
  Plus,
} from "lucide-react";
import { api, date, money, percent } from "../api";
import { Chart, Change, ErrorBox, Loading, Score, Stat } from "../components";
import type { Detail } from "../types";
export function DetailPage({
  symbol,
  onTrade,
}: {
  symbol: string;
  onTrade: (s: string) => void;
}) {
  const [stock, setStock] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [horizon, setHorizon] = useState(60);
  useEffect(() => {
    let active = true;
    api<Detail>("/stocks/" + symbol)
      .then((s) => {
        if (active) setStock(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [symbol]);
  async function save() {
    setBusy(true);
    setNotice("");
    try {
      await api("/predictions", { symbol, horizon });
      setNotice(
        __GURU_STATIC__
          ? "Hypothese lokal in diesem Browser gespeichert. Noch nicht validiert."
          : "Hypothese unveränderlich gespeichert. Noch nicht validiert.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="back-link" href="#dashboard">
        <ChevronLeft size={15} />
        Zur Marktübersicht
      </a>
      {error ? (
        <ErrorBox message={error} />
      ) : !stock ? (
        <Loading />
      ) : (
        <>
          <div className="stock-heading">
            <div className="company">
              <span className="ticker-logo big">{symbol[0]}</span>
              <div>
                <h2>{stock.name}</h2>
                <small>
                  {symbol} · {stock.sector} · {stock.currency}
                </small>
              </div>
            </div>
            <div className="stock-heading-right">
              <div>
                <strong>{money(stock.price, stock.currency)}</strong>
                <Change value={stock.change} />
              </div>
              <button
                className="button primary"
                onClick={() => onTrade(symbol)}
              >
                <Plus size={16} />
                Virtuell handeln
              </button>
            </div>
          </div>
          <div className="source-line">
            <i className="status-dot" />
            Letzter vollständiger Tageskurs: {date(stock.date)} · {stock.source}{" "}
            · Abruf {new Date(stock.fetched_at).toLocaleString("de-DE")}
          </div>
          <div className="dashboard-stats">
            <Stat
              label="Guru-Score"
              value={stock.score + "/100"}
              foot="Transparentes Momentum-Risiko-Modell"
            />
            <Stat
              label="Kurzfristig · 20 Handelstage"
              value={percent(stock.short)}
              foot="Historischer Total Return"
            />
            <Stat
              label="Mittelfristig · 60 Handelstage"
              value={percent(stock.medium)}
              foot="Historischer Total Return"
            />
            <Stat
              label="Langfristig · 200 Handelstage"
              value={percent(stock.long)}
              foot="Historischer Total Return"
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Kursentwicklung</h2>
                <p>
                  Bereinigte Kursreihe in {stock.currency} · keine
                  Zukunftsprojektion
                </p>
              </div>
              <span className="pill">HISTORISCHE DATEN</span>
            </div>
            <Chart points={stock.history} />
          </section>
          <div className="detail-columns">
            <section className="panel">
              <div className="panel-heading">
                <h2>Das steckt im Score</h2>
                <Score value={stock.score} />
              </div>
              {[
                ["short", "Kurzfristiges Momentum", 30],
                ["medium", "Mittelfristiges Momentum", 35],
                ["long", "Langfristiges Momentum", 25],
                ["stability", "Stabilität", 10],
              ].map(([key, label, max]) => (
                <div className="factor" key={key}>
                  <div>
                    <span>{label}</span>
                    <strong>
                      {stock.components[key].toFixed(1)} / {max}
                    </strong>
                  </div>
                  <div className="factor-track">
                    <i
                      style={{
                        width:
                          (stock.components[key] / Number(max)) * 100 + "%",
                      }}
                    />
                  </div>
                </div>
              ))}
              <a className="subtle-link" href="#method">
                Formel & Einschränkungen <ArrowUpRight size={13} />
              </a>
            </section>
            <section className="panel">
              <h2>Fundamentale Kennzahlen</h2>
              {stock.fundamentals.error ? (
                <div className="inline-note">
                  <Database size={20} />
                  <p>
                    Der Anbieter stellt fundamentale Daten derzeit nicht bereit.
                    Kurs-Gewinn-Verhältnis, Marktkapitalisierung und
                    Dividendenrendite bleiben leer.
                    <br />
                    <small>{String(stock.fundamentals.error)}</small>
                  </p>
                </div>
              ) : (
                <dl className="fundamentals">
                  {[
                    ["marketCap", "Marktkapitalisierung"],
                    ["trailingPE", "KGV (historisch)"],
                    ["forwardPE", "KGV (erwartet)"],
                    ["priceToBook", "Kurs-Buchwert"],
                    ["dividendYield", "Dividendenrendite"],
                    ["epsTrailingTwelveMonths", "Gewinn je Aktie"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {typeof stock.fundamentals[key] === "number"
                          ? key === "marketCap"
                            ? money(stock.fundamentals[key], stock.currency)
                            : stock.fundamentals[key].toLocaleString("de-DE", {
                                maximumFractionDigits: 2,
                              }) + (key === "dividendYield" ? " %" : "")
                          : "Nicht verfügbar"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="fineprint">
                Quelle: {String(stock.fundamentals.source)} · Abruf{" "}
                {date(String(stock.fundamentals.fetched_at))}. Keine
                historischen Fundamentaldaten im Backtest.
              </p>
            </section>
          </div>
          <div className="detail-columns">
            <section className="panel">
              <h2>Chancen aus dem Modell</h2>
              <ul className="opportunities">
                {stock.opportunities.map((s) => (
                  <li key={s}>
                    <ArrowUpRight size={15} />
                    {s}
                  </li>
                ))}
              </ul>
              <h3>Risiken & Einschränkungen</h3>
              <ul className="risks">
                {stock.risks.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
            <section className="panel forecast-box">
              <span className="eyebrow">PROGNOSE ≠ ERGEBNIS</span>
              <h2>Eine überprüfbare Hypothese</h2>
              <p>
                {stock.score >= 60
                  ? "Das Modell formuliert bei diesem Score die Hypothese einer positiven Rendite und Outperformance gegenüber SPY."
                  : "Das Modell formuliert bei diesem Score keine positive Kaufthese. Du kannst das Signal dennoch zur Beobachtung speichern."}{" "}
                Es gibt keine validierte Trefferquote.
              </p>
              <label>
                Prognosehorizont
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                >
                  <option value={20}>20 Handelstage</option>
                  <option value={60}>60 Handelstage</option>
                  <option value={200}>200 Handelstage</option>
                </select>
              </label>
              <button className="button primary" disabled={busy} onClick={save}>
                <BookOpen size={15} />
                {busy ? "Speichert …" : "Hypothese im Journal speichern"}
              </button>
              {notice && <p role="status">{notice}</p>}
            </section>
          </div>
        </>
      )}
    </>
  );
}
