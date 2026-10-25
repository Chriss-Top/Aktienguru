import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Database,
  FlaskConical,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { date, money } from "../api";
import { Change, Loading, Score, Stat, Empty } from "../components";
import type { Dashboard } from "../types";
import { UNIVERSE } from "../types";
export function DashboardPage({
  data,
  loading,
  query,
  setQuery,
  onTrade,
}: {
  data: Dashboard | null;
  loading: boolean;
  query: string;
  setQuery: (s: string) => void;
  onTrade: (s: string) => void;
}) {
  const [sort, setSort] = useState("score"),
    [sector, setSector] = useState("Alle Sektoren");
  const stocks = data?.stocks ?? [];
  const filtered = stocks
    .filter(
      (s) =>
        (s.name + " " + s.symbol).toLowerCase().includes(query.toLowerCase()) &&
        (sector === "Alle Sektoren" || s.sector === sector),
    )
    .sort((a, b) =>
      sort === "score"
        ? b.score - a.score
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : b.long - a.long,
    );
  const available = stocks.length > 0,
    top = stocks[0];
  return (
    <>
      <div className="dashboard-stats">
        <Stat
          label="Analysiertes Universum"
          value={`${stocks.length} / 8`}
          foot="Ausgewählte US-Unternehmen"
        />
        <Stat
          label="Stärkstes Trend-Signal"
          value={top?.name ?? "Noch keine Daten"}
          foot={
            top
              ? `Guru-Score ${top.score}/100 · keine Kaufempfehlung`
              : "Echte Kursdaten erforderlich"
          }
        />
        <Stat
          label="Langfristig im Aufwärtstrend"
          value={
            available
              ? `${stocks.filter((s) => s.long > 0).length} Aktien`
              : "—"
          }
          foot="Total Return über 200 Handelstage"
        />
        <Stat
          label="Dein virtuelles Startkapital"
          value="100.000 €"
          foot="Lernen ohne echtes Kapitalrisiko"
          accent
        />
      </div>
      {available && !!data?.errors.length && (
        <div className="info-strip">
          <Database size={17} />
          <p>
            Ranking unvollständig: Für{" "}
            {data.errors.map((e) => e.symbol).join(", ")} fehlen Daten.{" "}
            {data.errors[0].message}
          </p>
        </div>
      )}
      <div className="dashboard-layout">
        <div className="primary-column">
          <section className="panel ranking-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <span className="heading-icon">
                    <Activity size={17} />
                  </span>
                  Aktien im Fokus <span className="count">{stocks.length}</span>
                </h2>
                <p>Ein Ranking mit Gründen. Keine Versprechen.</p>
              </div>
              <a href="#method" className="subtle-link">
                So entsteht der Score <ArrowUpRight size={13} />
              </a>
            </div>
            <div className="filters">
              <label className="search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Unternehmen oder Symbol suchen …"
                  aria-label="Aktien suchen"
                />
              </label>
              <select
                aria-label="Sektor filtern"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                {[
                  "Alle Sektoren",
                  ...new Set(
                    Object.keys(UNIVERSE)
                      .map((s) => stocks.find((x) => x.symbol === s)?.sector)
                      .filter(Boolean),
                  ),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Ranking sortieren"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="score">Guru-Score ↓</option>
                <option value="name">Name A–Z</option>
                <option value="long">Langfristiger Trend ↓</option>
              </select>
            </div>
            {loading ? (
              <Loading text="Echte Kurshistorien werden abgerufen …" />
            ) : available ? (
              <div className="table-wrap">
                <table className="ranking">
                  <thead>
                    <tr>
                      <th>UNTERNEHMEN</th>
                      <th>KURS</th>
                      <th>GURU-SCORE</th>
                      <th>1 MONAT</th>
                      <th>~10 MONATE</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={s.symbol}>
                        <td>
                          <a className="company" href={"#stock/" + s.symbol}>
                            <span className="rank">{i + 1}</span>
                            <span className={"ticker-logo logo-" + i}>
                              {s.symbol.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{s.name}</strong>
                              <small>
                                {s.symbol} <i /> {s.sector}
                              </small>
                            </span>
                          </a>
                        </td>
                        <td>
                          <strong className="price">
                            {money(s.price, s.currency)}
                          </strong>
                          <small className="cell-date">{date(s.date)}</small>
                        </td>
                        <td>
                          <Score value={s.score} />
                        </td>
                        <td>
                          <Change value={s.short} />
                        </td>
                        <td>
                          <Change value={s.long} />
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            title={`${s.name} virtuell kaufen`}
                            aria-label={`${s.name} virtuell kaufen`}
                            onClick={() => onTrade(s.symbol)}
                          >
                            <Plus size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <Empty
                    title="Keine Treffer"
                    text="Probiere ein anderes Symbol oder einen anderen Sektor."
                  />
                )}
              </div>
            ) : (
              <>
                <div className="data-unavailable">
                  <div className="data-icon">
                    <Database size={25} />
                  </div>
                  <div>
                    <h3>Klare Analyse braucht echte Daten.</h3>
                    <p>
                      {data?.errors[0]?.message ??
                        "Kursdaten konnten noch nicht geladen werden."}
                    </p>
                    <span>
                      Wir zeigen keine erfundenen Kurse oder Rankings. Versuche
                      den Abruf später erneut.
                    </span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>BEOBACHTETE UNTERNEHMEN</th>
                        <th>DATENSTATUS</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(UNIVERSE)
                        .slice(0, 5)
                        .map(([s, n], i) => (
                          <tr key={s}>
                            <td>
                              <a className="company" href={"#stock/" + s}>
                                <span className={"ticker-logo logo-" + i}>
                                  {s[0]}
                                </span>
                                <span>
                                  <strong>{n}</strong>
                                  <small>{s}</small>
                                </span>
                              </a>
                            </td>
                            <td>
                              <span className="pending-label">
                                <i />
                                Kurs ausstehend
                              </span>
                            </td>
                            <td>
                              <a
                                className="icon-button"
                                href={"#stock/" + s}
                                aria-label={n + " analysieren"}
                              >
                                <ArrowUpRight size={17} />
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="panel-foot">
              <span>
                <Clock3 size={12} />
                Tageskurse · Quelle: Yahoo Finance
              </span>
              <span>Score: momentum-risk-v1</span>
            </div>
          </section>
          <section className="insight-banner">
            <div className="insight-symbol">
              <FlaskConical size={25} />
            </div>
            <div>
              <span className="eyebrow">
                AUS EINER IDEE WIRD EINE HYPOTHESE
              </span>
              <h3>Würde deine Strategie den Markt schlagen?</h3>
              <p>
                Prüfe historische Ergebnisse mit Gebühren und einem zeitlich
                verzögerten Signal.
              </p>
            </div>
            <a className="button secondary" href="#backtest">
              Backtest starten <ArrowRight size={15} />
            </a>
          </section>
        </div>
        <div className="secondary-column">
          <section className="guru-card">
            <div className="guru-card-top">
              <span className="guru-orb">
                <Sparkles size={22} />
              </span>
              <span className="light-badge">REGELBASIERT</span>
            </div>
            <p className="eyebrow">WENIGER BAUCHGEFÜHL. MEHR SYSTEM.</p>
            <h2>
              Dein Guru.
              <br />
              Seine Strategie.
              <br />
              <em>Alles überprüfbar.</em>
            </h2>
            <p>
              Ein eigenes Modellportfolio – nach klaren Regeln zusammengestellt
              und separat bewertet.
            </p>
            <div className="guru-features">
              <span>
                <Check size={14} />
                Drei Aktien · gleiche Startbudgets
              </span>
              <span>
                <Check size={14} />
                Vergleich mit dem S&P 500 ETF
              </span>
              <span>
                <Check size={14} />
                Jederzeit manuell beendbar
              </span>
            </div>
            <a href="#guru" className="button light">
              Guru-Portfolio entdecken <ArrowUpRight size={16} />
            </a>
            <span className="guru-disclaimer">
              Virtuell. Ohne Renditeversprechen.
            </span>
          </section>
          <section className="panel signals">
            <h3>
              <Target size={17} />
              Was der Guru-Score misst
            </h3>
            {[
              ["01", "Momentum", "Trends über 20, 60 und 200 Handelstage."],
              [
                "02",
                "Stabilität",
                "Historische Schwankungen als Risikoindikator.",
              ],
              [
                "03",
                "Nachvollziehbarkeit",
                "Offene Formel statt einer undurchsichtigen Prognose.",
              ],
            ].map(([n, t, d]) => (
              <div className="signal" key={n}>
                <span>{n}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <a className="subtle-link" href="#method">
              Die vollständige Methodik <ArrowRight size={13} />
            </a>
          </section>
          <div className="validation-note">
            <ShieldCheck size={17} />
            <p>
              Ein hoher Score beschreibt historische Signale. Er ist keine
              validierte Vorhersage zukünftiger Gewinne.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
