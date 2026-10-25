import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, RefreshCw } from "lucide-react";
import { api, date, percent } from "../api";
import { Empty, ErrorBox, Loading, Stat } from "../components";
import type { Prediction } from "../types";
import { UNIVERSE } from "../types";
export function PredictionPage() {
  const [items, setItems] = useState<Prediction[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  async function load() {
    try {
      setItems(await api<Prediction[]>("/predictions"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function validate() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ evaluated: number }>("/predictions/validate", {});
      setNote(
        `${r.evaluated} fällige Hypothesen ausgewertet. Nicht abgelaufene Horizonte bleiben offen.`,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const done = items.filter((x) => x.outcome);
  return (
    <>
      {error && <ErrorBox message={error} />}
      <div className="dashboard-stats">
        <Stat
          label="Gespeicherte Hypothesen"
          value={String(items.length)}
          foot="Mit Modellversion und Datenstichtag"
        />
        <Stat
          label="Objektiv ausgewertet"
          value={String(done.length)}
          foot="Nur nach Ablauf des Handelstagehorizonts"
        />
        <Stat
          label="Noch nicht fällig"
          value={String(items.length - done.length)}
          foot="Offene Beobachtungen"
        />
        <Stat
          label="Validierte Genauigkeit"
          value="Nicht belegt"
          foot="Keine belastbare Stichprobe behauptet"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Dein Prognosejournal</h2>
            <p>Gespeicherte Hypothesen werden nicht nachträglich angepasst.</p>
          </div>
          <button
            className="button secondary"
            onClick={validate}
            disabled={busy}
          >
            <RefreshCw size={15} className={busy ? "spin" : ""} />
            Fällige Ergebnisse prüfen
          </button>
        </div>
        {note && (
          <p role="status" className="inline-success">
            {note}
          </p>
        )}
        {loading ? (
          <Loading />
        ) : items.length ? (
          <div className="prediction-list">
            {items.map((p) => (
              <article key={p.id} className="prediction">
                <div>
                  <a href={"#stock/" + p.symbol}>{UNIVERSE[p.symbol]}</a>
                  <span className={"pill " + (p.outcome ? "green" : "")}>
                    {p.outcome ? "AUSGEWERTET" : "OFFEN · UNVALIDIERT"}
                  </span>
                </div>
                <p>{p.hypothesis}</p>
                <div className="prediction-meta">
                  <span>Erstellt {date(p.created_at)}</span>
                  <span>Daten bis {date(p.cutoff)}</span>
                  <span>{p.horizon} Handelstage</span>
                  <span>{p.model}</span>
                  <span>Score {p.score}/100</span>
                </div>
                {p.outcome && (
                  <div className="outcome">
                    <strong>
                      Tatsächliche Rendite: {percent(p.outcome.return_pct)}
                    </strong>
                    <span>
                      SPY {percent(p.outcome.benchmark_return_pct)} · Differenz{" "}
                      {percent(p.outcome.excess_pct)}
                    </span>
                    <span>
                      {p.outcome.hypothesis_met === null
                        ? "Keine gerichtete Hypothese bewertet"
                        : p.outcome.hypothesis_met
                          ? "Hypothese eingetreten"
                          : "Hypothese nicht eingetreten"}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Vorhersagen brauchen ein Gedächtnis."
            text="Speichere auf einer Aktiendetailseite eine Modellhypothese. Erstellungszeitpunkt, Datenstichtag, Horizont und Modellversion bleiben nachvollziehbar."
            action={
              <a className="button secondary" href="#dashboard">
                Zur Aktienanalyse <ArrowRight size={14} />
              </a>
            }
          />
        )}
      </section>
      <div className="info-strip">
        <BookOpen size={18} />
        <p>
          Die Auswertung verwendet Total-Return-Renditen in USD und SPY auf
          demselben Horizont. Das ist eine Modellvalidierung ohne
          Transaktionskosten, keine Portfolio-Rendite. Keine automatische
          Überwachung; die Auswertung wird hier manuell gestartet.
        </p>
      </div>
    </>
  );
}
