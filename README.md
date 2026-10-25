# Guru

Moderne lokale Plattform für transparente Aktienanalyse und **ausschließlich virtuelle** Portfolios. Neu aufgebaut mit React, TypeScript, Vite und Python. Keine erfundenen Marktkurse, kein Echtgeldhandel, keine kostenpflichtigen Dienste.

## Einfach starten: Mac-Download

1. **[Guru für Mac herunterladen](https://github.com/Chriss-Top/Aktienguru/raw/refs/heads/main/Guru-Mac.zip)**.
2. ZIP-Datei entpacken und im Ordner `Guru` die Datei **`Guru starten.command` doppelklicken**.
3. Guru öffnet deinen Browser automatisch. Das geöffnete Terminalfenster laufen lassen; zum Beenden `Ctrl+C` drücken.

Im Mac-Paket ist die gebaute Oberfläche enthalten. Du brauchst **kein Git, Node.js oder npm**. Nur **Python 3.11+** muss einmalig installiert sein. Fehlt es, öffnet der Starter die offizielle Python-Downloadseite und erklärt den nächsten Schritt. Nach der Installation den Starter erneut doppelklicken.

macOS kann heruntergeladene Skripte zunächst blockieren. Öffne die Datei in diesem Fall per Rechtsklick → „Öffnen“. Falls macOS weiterhin blockiert, die Hinweise unter Systemeinstellungen → Datenschutz & Sicherheit für genau diese Datei beachten; keine allgemeinen Sicherheitseinstellungen abschalten. Der Starter installiert nichts im Hintergrund und benötigt keine Administratorrechte.

Portfolios werden im entpackten Ordner unter `.data` gespeichert. Beim Wechsel auf einen neuen Download den bisherigen Datenordner sichern und übernehmen; bestehende Ordner nicht blind überschreiben. Das Paket enthält keinerlei Portfolio- oder Cache-Daten aus der Entwicklungsumgebung.

### Mac-Paket aktualisieren (Entwicklung)

```sh
npm ci
npm run build
python3 scripts/package_mac.py
```

`Guru-Mac.zip` enthält ausschließlich die gebaute Oberfläche, Python-Quellcode, den Starter und die Anleitung. Es bündelt keinen Python-Interpreter und ist keine signierte macOS-App.

## Auf deinem Mac starten

Voraussetzungen: **Node.js 22+**, **Python 3.11+**, Internetzugang. Es werden keine Python-Pakete benötigt; das Backend verwendet die Standardbibliothek einschließlich SQLite. Node/Python können beispielsweise über ihre offiziellen Installer installiert werden.

```sh
git clone https://github.com/Chriss-Top/Aktienguru.git
cd Aktienguru
npm ci
npm run build
npm start
```

Im Browser **http://127.0.0.1:8000** öffnen. Der Python-Server liefert API und gebautes Frontend aus. Mit `Ctrl+C` beenden. Die Browseradresse gilt für den eigenen Mac; das GitHub-Repository allein ist kein Website-Hosting.

### Entwicklung mit Hot Reload

Zwei Terminals im Projektverzeichnis:

```sh
# Terminal 1: Python-API auf Port 8000
npm run dev:api

# Terminal 2: React/Vite auf Port 5173 mit API-Proxy
npm run dev
```

Dann **http://127.0.0.1:5173** öffnen. Nach Python-Änderungen den API-Prozess neu starten. In einer Cloud-Umgebung `npm ci --cache /tmp/guru-npm-cache` nutzen, falls das Home-Verzeichnis nicht beschreibbar ist. `PORT` ändert den Backend-Port; den Vite-Proxy bei abweichendem Port entsprechend konfigurieren.

## Was die erste Version kann

- Ranking von acht US-Aktien (MSFT, AAPL, NVDA, GOOGL, AMZN, META, JPM, JNJ), Guru-Score 0–100, Suche, Sektorfilter und Sortierung.
- Echte tägliche Kursdaten über die kostenlose **inoffizielle Yahoo Finance Chart API**, fünfjährige Historie, Quelle/Kurstag/Abrufzeit. Keine Schlüssel erforderlich. Bei API-Fehlern werden Fehlerzustände statt Ersatzdaten angezeigt. Cache: eine Stunde; kurze Fehlerpause vermeidet Anfragewiederholungen.
- Aktiendetails mit interaktivem Chart (Maus, Touch und Pfeiltasten), Zeitraumwahl, Trendhorizonten, Score-Beiträgen, modellbasierten Chancen und Risiken. Fundamentale Kennzahlen werden separat über die Quote API angefragt. Wenn Yahoo diese verweigert, werden sie ausdrücklich als nicht verfügbar angezeigt. Es gibt keine vollständige oder garantierte Fundamentaldatenversorgung.
- Persönliches Simulationsportfolio: 100.000 EUR Startkapital, Käufe, Verkäufe, Transaktionsjournal, laufende Bewertung **bei manuellen Abrufen**, EUR-Performance und Vergleich mit SPY.
- Separates Guru-Portfolio: drei höchste Scores im vollständigen Universum, je ein Drittel Startbudget einschließlich Gebühren, ganze Stückzahlen, Rest als Cash. Buy-and-hold, keine automatischen Umschichtungen. Ein manuelles Stoppen friert die Bewertung ein; weitere Experimente erhalten eigene IDs und bleiben neben alten erhalten.
- Historischer **Einzelaktien**-Backtest für die Regel „Score ≥ 60: investiert, sonst Cash“, ein Tag Signalverzögerung, Gebühren und SPY-Vergleich. Dies ist nicht derselbe Test wie eine historische Top-3-Universumsstrategie; deren Backtest bleibt ein späterer Ausbauschritt.
- Unveränderliches Prognosejournal mit Erstellungsdatum, Datenstichtag, Modellversion und 20/60/200 Handelstagen Horizont. Eine positive Richtungshypothese wird nur ab Score 60 formuliert. Tatsächliche Ergebnisse kommen nach Ablauf des Horizonts in eine getrennte Tabelle. Die Auswertung wird manuell ausgelöst. Keine behauptete Prognosegenauigkeit.

## Daten, Berechnungen und Grenzen

### Guru-Score `momentum-risk-v1`

Für Total-Return-bereinigte Schlusskurse:

```text
R_n = 100 × (Kurs_heute / Kurs_vor_n_Handelstagen − 1)
Vol = Standardabweichung der letzten 60 Tagesrenditen × √252 × 100
clamp(x) = max(0, min(1, x))
Score = rund(
  30 × clamp(0.5 + R_20 / 40)
+ 35 × clamp(0.5 + R_60 / 80)
+ 25 × clamp(0.5 + R_200 / 120)
+ 10 × clamp(1 − Vol / 80)
)
```

Mindestens 201 gültige Kurstage sind mathematisch erforderlich, der Anbieteradapter verlangt 210. Fundamentals fließen **nicht** in diesen Score ein. Der Score ist eine historische Zustandsbeschreibung, weder Gewinnwahrscheinlichkeit noch Kursziel. Gewichte und Schwellen sind dokumentierte Startannahmen, nicht empirisch optimierte oder validierte Parameter.

### Portfolio-Rechnung

- Ausführung zum **letzten vollständigen gemeinsamen Tageskurs** von Aktie, EUR/USD und SPY, kein Zugriff auf Broker. Die letzte Tageskerze wird während der regulären Börsensitzung ausgeschlossen.
- Das ist ein vereinfachtes Lernmodell: Eine nachträgliche Order zum schon bekannten Schlusskurs wäre im echten Handel nicht garantiert ausführbar. Die Backtest-Engine verwendet deshalb explizit verzögerte Ausführung.
- Gebühren pro Auftrag: **0,1 % des EUR-Auftragswerts, mindestens 1 EUR**. Keine Steuern, Spreads, Slippage oder Zinsen auf Cash. Bruchstücke sind im persönlichen Portfolio zulässig; Leerverkäufe sind gesperrt.
- Reale Split-Ereignisse verändern die Stückzahl; reale Dividenden werden in Cash umgerechnet. Dividendengutschrift vereinfacht am **Ex-Tag**, nicht am späteren Zahltag; keine automatische Wiederanlage im Portfolio. Käufe am Ex-Tag erhalten diese Dividende nicht.
- Yahoo normalisiert historische Rohkurse und Dividenden für spätere Splits. Der Adapter rekonstruiert die damaligen Ausführungskurse, damit die Bestandsbuchhaltung Splits nicht doppelt berücksichtigt. Bereinigte Kurse werden nur für Total-Return-Analyse verwendet.
- USD-Werte und Dividenden werden mit **EURUSD=X** (USD je EUR) in EUR umgerechnet. FX-Effekte sind Bestandteil der EUR-Performance. Fehlende oder mehr als sieben Kalendertage entfernte historische Daten blockieren die Bewertung.
- Benchmark: **SPY als investierbarer S&P-500-ETF-Proxy**, ab der ersten Transaktion, inklusive Dividendenwiederanlage und USD/EUR-Effekt. SPY hat keine zusätzlichen simulierten Handelsgebühren; Unterschiede zum Cash-Dividendenportfolio sind zu beachten. Die Benchmark ist angesichts des konzentrierten US-Universums sinnvoll, aber kein identisches Risikoprofil.
- Mehr als fünf Kalendertage alte gemeinsame Schlusskurse sperren aktuelle Bewertung und Handel. Bei Datenfehlern bleiben gespeicherte Aufträge erhalten. Das verfügbare Fünfjahresarchiv begrenzt die spätere Rekonstruktion; für längere Nutzung ist ein dauerhaft gepflegtes Kursarchiv zu ergänzen.

### Backtesting und Prognosevalidierung

Der Score für eine Ausführung am Tag `i` verwendet ausschließlich Kurse **bis `i−1`**. Ausgeführt wird zum Schlusskurs von `i`; der folgende Return ist `i → i+1`. Der Test beginnt nach 201 gemeinsamen Historientagen. Dividenden/Splits sind in den bereinigten Renditen enthalten. Je Positionswechsel werden konfigurierbare Basispunktgebühren abgezogen; am letzten Tag wird eine offene Position mit Gebühr liquidiert. Der Backtest läuft in **USD** gegen SPY in USD, also ohne FX-Effekt. Er verwendet keine rückwirkenden Fundamentals.

Keine künftigen Kurse fließen in Signale ein. Dennoch bestehen **Selektions-/Survivorship-Bias** durch heutige Aktienauswahl, Parameterwahl und mögliche Datenrevisionen. Yahoo-Daten sind kein Point-in-time-Archiv historischer Veröffentlichungen. Die Tests beweisen die zeitliche Trennung im Algorithmus, nicht historische Datenrevisionsfreiheit oder künftige Renditen.

Prognosen sind prospektiv gespeicherte Richtungshypothesen, keine extrapolierten Fantasiepreise. Nach Ablauf von N tatsächlichen Aktien-Handelstagen wird die echte Total-Return-Rendite mit SPY verglichen. Eine positive Hypothese gilt nur bei positiver Rendite **und** Outperformance als eingetreten. Neutral gespeicherte Signale erhalten keine Trefferbewertung. Diese Auswertung beinhaltet keine Portfolio-Handelskosten. Ein kleines oder ausstehendes Sample begründet keine behauptete Genauigkeit.

## Architektur

```text
src/                      React/TypeScript, responsive Oberfläche, interaktive Charts
backend/models.py         Domänentypen, Modellversion, Provider-Protokoll
backend/provider.py       Yahoo-Adapter, Normalisierung, Cache, Fehlerbehandlung
backend/analysis.py       Score, verzögerter Backtest, Drawdown
backend/portfolio.py      Replay-Ledger, Corporate Actions, FX, Benchmarkkurven
backend/service.py        Anwendungsfälle, Guru-Regeln, Prognosevalidierung
backend/monitoring.py     Deaktivierte Schnittstelle für einen späteren Worker
backend/repository.py     Repository-Protokoll + SQLite-Adapter
backend/app.py            Lokale JSON-API und Frontend-Hosting
tests/test_core.py        Isolierte Tests (nur dort synthetische Fixtures)
```

SQLite speichert Kurscache, Portfolios und Transaktionen sowie getrennte `predictions`- und `outcomes`-Tabellen. Die Repository-Schnittstelle ist die Austauschgrenze für eine spätere Supabase-Implementierung; **Supabase ist noch nicht integriert**. Ein zukünftiger Adapter muss die Eindeutigkeit von Prognosen, atomare Portfolio-Updates und konkurrierende Schreibzugriffe absichern. Aktuell ist ausschließlich **ein lokaler Serverprozess für einen Nutzer** vorgesehen.

### Datenablage

Standard: `.data/guru.sqlite3`, mit `GURU_DB=/absoluter/pfad/guru.sqlite3` änderbar. Datenbank, Cache und lokale Nutzerdaten werden nicht committed. Bestehende `.data/portfolio.json` aus dem früheren Prototyp wird nicht verändert oder automatisch importiert. Für ein Backup Server beenden und `.data` sichern. Kein automatisches Löschen von Experimenten oder Prognosen.

## Tests und Prüfung

```sh
npm test              # Python unittest: Berechnung, Zukunftstrennung, Ledger, Persistenz
npm run build         # striktes TypeScript + Produktionsbuild
```

Die Tests nutzen ausschließlich isolierte, ausdrücklich synthetische Fixtures in temporären Datenbanken; die Anwendung lädt diese niemals. Externer Datenzugriff ist kein Bestandteil der deterministischen Tests. Live-Funktion separat prüfen: `/api/dashboard` muss echte Aktien mit Kurstag und Quelle liefern; `/api/health` allein beweist keine Datenversorgung.

## Betrieb, Kosten und nächste Schritte

- Kein bezahlter Dienst und keine API-Schlüssel erforderlich. Für produktive Nutzung Verfügbarkeit, Lizenz und Bedingungen der Datenquelle prüfen; die inoffizielle API kann 401/403/429 liefern. Es wird kein Abo automatisch abgeschlossen.
- Lokal an `127.0.0.1` gebunden. **Keine Anmeldung oder Mehrbenutzerfähigkeit**; nicht als öffentlichen Dienst freigeben. Schreibzugriffe von fremden Browser-Ursprüngen werden abgewiesen. Für Hosting sind Authentifizierung, Rate Limits und ein geeigneter Produktionsserver erforderlich.
- HTTPS-Ziel: `query1.finance.yahoo.com`. Proxy und TLS-Verifikation beibehalten. Auf macOS bei TLS-Fehlern den offiziellen Python-Zertifikatsinstaller nutzen; die Prüfung nicht abschalten.
- **Keine autonomen Hintergrundjobs.** Die Provider-/Service-Schnittstellen und persistierten Hypothesen ermöglichen später einen Scheduler. Zeitplanung, dauerhafte Kursarchivierung, Benachrichtigungen und automatische Beobachtung sind bewusst nicht implementiert.
- Geplante Ausbaustufen: lizenzierte Fundamentals, historisches Universum, historischer Guru-Top-3-Backtest, robuste Out-of-sample-Validierung, Supabase-Adapter und optional später Hintergrundüberwachung.

Keine Anlageberatung. Vergangene Ergebnisse garantieren keine zukünftigen Erträge.
