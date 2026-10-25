import { Database, ShieldCheck, Wallet, Zap } from "lucide-react";
export function MethodPage() {
  return (
    <div className="method-page">
      <section className="panel">
        <span className="eyebrow">MOMENTUM-RISK-V1</span>
        <h2>Eine offene Formel. Keine geheimen Versprechen.</h2>
        <p>
          Der Guru-Score beschreibt historische Trends und Schwankungen. Er ist
          weder eine Gewinnwahrscheinlichkeit noch ein berechnetes Kursziel.
        </p>
        <div className="formula">
          <code>
            Score = 30 × clamp(0,5 + R20 / 40)
            <br /> + 35 × clamp(0,5 + R60 / 80)
            <br /> + 25 × clamp(0,5 + R200 / 120)
            <br /> + 10 × clamp(1 − Volatilität / 80)
          </code>
          <p>
            R20, R60 und R200 sind Total-Return-Renditen in Prozent.
            Volatilität: Standardabweichung der letzten 60 Tagesrenditen × √252
            × 100. clamp begrenzt jeden Anteil auf 0 bis 1. Der Gesamtscore wird
            auf eine ganze Zahl gerundet.
          </p>
        </div>
      </section>
      <div className="detail-columns">
        <section className="panel">
          <h2>
            <Database size={18} />
            Daten & Grenzen
          </h2>
          <ul className="risks">
            <li>
              Yahoo Finance Chart API, kostenloser inoffizieller Zugang ohne
              API-Key. Keine garantierte Verfügbarkeit; Nutzungsbedingungen des
              Anbieters beachten.
            </li>
            <li>
              Vollständige Tageskurse statt Echtzeit. Quelle, Kurstag und
              Abrufzeit werden angezeigt. Ein Stunden-Cache reduziert Anfragen.
            </li>
            <li>
              Fundamentaldaten sind separat und können vom Anbieter verweigert
              werden. Fehlende Daten werden niemals erfunden.
            </li>
            <li>
              Das Universum enthält acht heute ausgewählte US-Unternehmen. Kein
              vollständiger oder historisch unverzerrter Marktquerschnitt.
            </li>
            <li>
              Bei Ausfällen oder zu alten Daten werden Käufe und Bewertungen
              gesperrt.
            </li>
          </ul>
        </section>
        <section className="panel">
          <h2>
            <Wallet size={18} />
            Simulation & Vergleich
          </h2>
          <ul className="risks">
            <li>
              Startkapital: 100.000 EUR. USD-Positionen und Dividenden werden
              zum EUR/USD-Tageskurs umgerechnet.
            </li>
            <li>
              Gebühr: 0,1 % je Auftrag, mindestens 1 EUR. Keine Steuern oder
              Slippage.
            </li>
            <li>
              Splits ändern die Stückzahl. Dividenden werden vereinfacht am
              Ex-Tag gutgeschrieben; spätere echte Auszahlungstermine werden
              nicht modelliert.
            </li>
            <li>
              SPY als S&P-500-ETF-Proxy wird ab der ersten Transaktion inklusive
              Wiederanlage und FX bewertet. Die Portfolios halten Dividenden
              dagegen in Cash.
            </li>
            <li>
              Virtuelle Ausführung zum letzten vollständigen gemeinsamen
              Schlusskurs ist ein Lernmodell, keine realistische
              Börsenausführung.
            </li>
          </ul>
        </section>
      </div>
      <section className="panel">
        <h2>
          <ShieldCheck size={18} />
          Verifikation vor Vertrauen
        </h2>
        <p>
          Backtests treffen jede Entscheidung mit einem Tag Verzögerung und
          verwenden keine zukünftigen Kurse für Signale. Bereinigte Preise
          bilden Dividenden und Splits ab. Fundamentaldaten werden nicht
          rückwirkend verwendet. Die heutige Aktienauswahl, Parameterwahl und
          Datenrevisionen können Ergebnisse trotzdem verzerren.
        </p>
        <p>
          Hypothesen werden unveränderlich mit Zeitstempel, Stichtag,
          Modellversion und Horizont gespeichert. Reale Ergebnisse werden erst
          nach Ablauf des Horizonts separat ergänzt. Es wird keine
          Prognosegenauigkeit behauptet.
        </p>
        <div className="info-strip">
          <Zap size={18} />
          <p>
            Autonome Hintergrundüberwachung ist architektonisch vorbereitet,
            aber deaktiviert. Kursabrufe und Validierung erfolgen ausschließlich
            auf Anfrage. Keine Broker-Anbindung, keine kostenpflichtigen
            Dienste.
          </p>
        </div>
      </section>
    </div>
  );
}
