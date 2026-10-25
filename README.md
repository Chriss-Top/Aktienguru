# Aktienguru

Browserbasierter Aktienratgeber als erste lauffähige Version. Node.js 24.5+ empfohlen; keine externen npm-Abhängigkeiten.

## Start

```sh
cd /workspace/Aktienguru
npm start
```

Standard: Port 3000, nur Loopback. `HOST` und `PORT` konfigurierbar. `npm test` prüft Trendberechnung und HTTP-Verhalten. `npm run dev` startet mit automatischem Neustart.

## Funktionen und Grenzen

- Deutsche responsive Marktübersicht mit acht Aktien, Charts, Trend-Score und Trends über 20/60/200 Handelstage.
- Standardmäßig **synthetische Demodaten**. Handel und Guru-Start sind damit gesperrt.
- `MARKET_MODE=live NODE_USE_ENV_PROXY=1 npm start` lädt die letzten verfügbaren Tageskurse von Yahoo Finance. Benötigt HTTPS-Zugang zu `query1.finance.yahoo.com`. Kein API-Key erforderlich; Verfügbarkeit und Nutzungsbedingungen des Anbieters sind vor produktiver Nutzung zu prüfen. Ein vollständiger erfolgreicher Abruf aller acht Aktien schaltet den Live-Modus frei. Kein Anspruch auf Echtzeitdaten.
- EUR-Simulationsportfolio mit 100.000 € Startkapital, Käufen, Verkäufen, Transaktionen und Bewertung. USD-Handel bleibt bis zur Implementierung echter Wechselkurse gesperrt. Keine Gebühren, Steuern oder Slippage.
- Guru: vier Aktien mit höchsten Trend-Scores, je 25 % Startgewicht, Renditebewertung in Heimatwährungen ohne Wechselkurse. Keine validierte Prognose oder Optimierung. Stoppen friert die gespeicherte Bewertung ein; ein neuer Start ersetzt das bisherige Experiment.
- Daten liegen in `.data/portfolio.json` (mit `DATA_DIR` änderbar). Ein Serverprozess für einen Nutzer; keine Anmeldung oder Mehrbenutzerfähigkeit. Nicht ohne Authentifizierung öffentlich bereitstellen.
- Marktabruf alle 15 Minuten bei laufendem Server. Guru speichert höchstens einen Snapshot pro UTC-Tag. Laufende Prozesse überleben keinen Umgebungsneustart; zum fortgesetzten Tracking Server erneut starten. Verpasste Tage werden nicht nachgetragen. Bei Abruffehlern bleiben die letzten Daten sichtbar und werden mit Zeitstempel und Fehlerhinweis gekennzeichnet.
- Mehrjähriges autonomes Tracking braucht dauerhaftes Hosting, Prozessüberwachung, Backups und eine verlässlich lizenzierte Datenquelle.

## Was noch fehlt

Walk-forward-Backtests auf echten historischen Daten, Out-of-sample-Auswertung, Benchmarkvergleich, statistische Unsicherheiten, robuste Unternehmensuniversen ohne Survivorship Bias sowie Handelskosten. Die Anwendung nennt ihre Scores deshalb ausdrücklich **Trends**, nicht validierte Vorhersagen. Kein Anlageberatungs- oder Renditeversprechen.

## Cloud

Im Cloud-Netzwerk muss `query1.finance.yahoo.com` freigegeben sein. Ein verweigerter Zugriff lässt die Anwendung im Demo-Modus. Keine TLS-Prüfung deaktivieren. Installation erfordert keine Downloads; Node muss vorhanden sein. Vor Nutzung echter Daten `MARKET_MODE=live NODE_USE_ENV_PROXY=1` setzen und Dashboardquelle sowie Zeitstempel prüfen.
