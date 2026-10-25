import copy
import math
import threading
import uuid
from datetime import date

from .analysis import analyze, backtest, summary
from .models import BENCHMARK, MODEL_VERSION, UNIVERSE, DomainError, now
from .monitoring import MONITORING_ENABLED
from .portfolio import FEE_RATE, MIN_FEE, asof, euro_rate, performance, replay


class GuruService:
    def __init__(self, repository, provider):
        self.repository = repository
        self.provider = provider
        self.lock = threading.RLock()
        if repository.load("portfolios") is None:
            repository.save(
                "portfolios",
                [
                    {
                        "id": "personal",
                        "name": "Mein Portfolio",
                        "kind": "personal",
                        "created_at": now(),
                        "trades": [],
                        "active": True,
                    }
                ],
            )

    def dashboard(self):
        rows = []
        errors = []
        # Stop after one common provider outage rather than exhausting an API quota.
        for symbol, (name, sector) in UNIVERSE.items():
            try:
                rows.append(
                    dict(
                        summary(self.provider.series(symbol)), name=name, sector=sector
                    )
                )
            except DomainError as e:
                errors.append({"symbol": symbol, "message": str(e)})
                if not rows:
                    break
        return {
            "stocks": sorted(rows, key=lambda r: r["score"], reverse=True),
            "errors": errors,
            "universe": list(UNIVERSE),
            "model": MODEL_VERSION,
            "benchmark": BENCHMARK,
            "monitoring": {
                "enabled": MONITORING_ENABLED,
                "reason": "Autonome Hintergrundüberwachung ist für eine spätere Phase vorgesehen.",
            },
        }

    def detail(self, symbol):
        if symbol not in UNIVERSE:
            raise DomainError("Aktie nicht im unterstützten Universum.")
        series = self.provider.series(symbol)
        result = dict(
            summary(series),
            name=UNIVERSE[symbol][0],
            sector=UNIVERSE[symbol][1],
            fundamentals=self.provider.fundamentals(symbol),
        )
        result["opportunities"] = [
            "Positiver 200-Tage-Trend"
            if result["long"] > 0
            else "Kein positiver langfristiger Trend",
            "Positiver 60-Tage-Trend"
            if result["medium"] > 0
            else "Mittelfristiges Momentum ist negativ",
        ]
        result["risks"] = [
            f"Historische annualisierte Volatilität: {result['volatility']:.1f} %",
            "Einzelaktien- und USD/EUR-Währungsrisiko",
            "Momentum kann abrupt drehen; Fundamentaldaten gehen nicht in den Score ein.",
        ]
        return result

    def _market(self, p):
        symbols = {t["symbol"] for t in p["trades"]}
        series = {s: self.provider.series(s) for s in symbols}
        fx = self.provider.series("EURUSD=X")
        bm = self.provider.series(BENCHMARK)
        day = min(
            [s.bars[-1].date for s in series.values()]
            + [fx.bars[-1].date, bm.bars[-1].date]
        )
        if (date.today() - date.fromisoformat(day)).days > 5:
            raise DomainError(
                "Kursdaten älter als fünf Kalendertage. Bewertung und Handel gesperrt."
            )
        return series, fx, bm, day

    def portfolios(self):
        result = []
        for p in self.repository.load("portfolios", []):
            item = copy.deepcopy(p)
            if p.get("frozen"):
                item.update(p["frozen"])
                item["error"] = None
            elif not p["trades"]:
                item.update(
                    cash=100000.0,
                    value=100000.0,
                    holdings=[],
                    return_pct=0.0,
                    fees=0.0,
                    dividends=0.0,
                    curve=[],
                    error=None,
                )
            else:
                try:
                    series, fx, bm, day = self._market(p)
                    item.update(replay(p, series, fx, day))
                    item["curve"] = performance(p, series, fx, bm)
                    item["date"] = day
                    item["error"] = None
                except DomainError as e:
                    item.update(error=str(e), holdings=[], curve=[])
            result.append(item)
        return result

    def _execute(self, p, symbol, side, quantity):
        if symbol not in UNIVERSE or side not in ("buy", "sell"):
            raise DomainError("Ungültige Aktie oder Auftragsart.")
        if (
            not isinstance(quantity, (int, float))
            or isinstance(quantity, bool)
            or not math.isfinite(quantity)
            or not 0 < quantity <= 1e6
        ):
            raise DomainError(
                "Stückzahl muss positiv und endlich sein (max. 1.000.000)."
            )
        if not p["active"]:
            raise DomainError("Dieses Portfolio ist beendet.")
        series, fx, bm, day = self._market(
            dict(p, trades=p["trades"] + [{"symbol": symbol}])
        )
        # _market only reads symbol fields; the execution date uses common complete days.
        if p["trades"] and day < max(t["date"] for t in p["trades"]):
            raise DomainError("Kursdaten liegen vor der letzten Transaktion.")
        state = replay(p, series, fx, day)
        s = series[symbol]
        bar = asof(s, day)
        rate = euro_rate(s.currency, day, fx)
        amount = quantity * bar.close * rate
        fee = max(MIN_FEE, amount * FEE_RATE)
        if side == "buy" and amount + fee > state["cash"] + 1e-8:
            raise DomainError(
                "Nicht genügend virtuelles Guthaben einschließlich Gebühren."
            )
        held = next(
            (x["quantity"] for x in state["holdings"] if x["symbol"] == symbol), 0
        )
        if side == "sell" and quantity > held + 1e-8:
            raise DomainError("Nicht genügend Aktien. Leerverkäufe sind deaktiviert.")
        if side == "sell" and amount - fee + state["cash"] < 0:
            raise DomainError("Verkauf deckt die Mindestgebühr nicht.")
        p["trades"].append(
            {
                "id": str(uuid.uuid4()),
                "symbol": symbol,
                "side": side,
                "quantity": quantity,
                "price": bar.close,
                "currency": s.currency,
                "fx": rate,
                "fee": fee,
                "date": day,
                "created_at": now(),
                "source": s.source,
            }
        )

    def trade(self, symbol, side, quantity):
        with self.lock:
            portfolios = self.repository.load("portfolios")
            p = next(p for p in portfolios if p["id"] == "personal")
            self._execute(p, symbol, side, quantity)
            self.repository.save("portfolios", portfolios)
        return {"ok": True}

    def guru_start(self):
        with self.lock:
            portfolios = self.repository.load("portfolios")
            if any(p["kind"] == "guru" and p["active"] for p in portfolios):
                raise DomainError("Es läuft bereits ein Guru-Portfolio.")
            dashboard = self.dashboard()
            if len(dashboard["stocks"]) != len(UNIVERSE):
                raise DomainError(
                    "Für die Guru-Auswahl werden vollständige Daten aller acht Aktien benötigt."
                )
            selected = dashboard["stocks"][:3]
            p = {
                "id": str(uuid.uuid4()),
                "name": "Guru · " + date.today().isoformat(),
                "kind": "guru",
                "active": True,
                "created_at": now(),
                "trades": [],
                "model": MODEL_VERSION,
                "strategy": "Drei höchste Scores; je ein Drittel Startkapital einschließlich 0,1 % Gebühr; Buy-and-hold ohne Umschichtung.",
            }
            all_series = {
                stock["symbol"]: self.provider.series(stock["symbol"])
                for stock in selected
            }
            fx = self.provider.series("EURUSD=X")
            bm = self.provider.series(BENCHMARK)
            common_day = min(
                [s.bars[-1].date for s in all_series.values()]
                + [fx.bars[-1].date, bm.bars[-1].date]
            )
            if any(stock["date"] != common_day for stock in dashboard["stocks"]):
                raise DomainError(
                    "Guru-Auswahl benötigt denselben vollständigen Kurstag für alle Aktien, FX und Benchmark."
                )
            for stock in selected:
                rate = euro_rate(stock["currency"], common_day, fx)
                price = asof(all_series[stock["symbol"]], common_day).close
                quantity = math.floor((100000 / 3) / (price * rate * (1 + FEE_RATE)))
                if quantity < 1:
                    raise DomainError(
                        "Kapital reicht für die regelbasierte Auswahl nicht aus."
                    )
                self._execute(p, stock["symbol"], "buy", quantity)
            portfolios.append(p)
            self.repository.save("portfolios", portfolios)
        return {"ok": True, "id": p["id"]}

    def guru_stop(self, identifier):
        with self.lock:
            portfolios = self.repository.load("portfolios")
            p = next(
                (
                    p
                    for p in portfolios
                    if p["id"] == identifier and p["kind"] == "guru"
                ),
                None,
            )
            if not p or not p["active"]:
                raise DomainError("Kein aktives Guru-Portfolio gefunden.")
            series, fx, bm, day = self._market(p)
            p["stopped_date"] = day
            p["stopped_at"] = now()
            p["active"] = False
            p["frozen"] = dict(
                replay(p, series, fx, day),
                curve=performance(p, series, fx, bm),
                date=day,
            )
            self.repository.save("portfolios", portfolios)
        return {"ok": True}

    def forecast(self, symbol, horizon):
        if symbol not in UNIVERSE or horizon not in (20, 60, 200):
            raise DomainError("Ungültige Aktie oder Prognosehorizont.")
        s = self.provider.series(symbol)
        a = analyze([b.adjusted for b in s.bars])
        prediction = {
            "symbol": symbol,
            "model": MODEL_VERSION,
            "cutoff": s.bars[-1].date,
            "created_at": now(),
            "horizon": horizon,
            "score": a["score"],
            "direction": "positive" if a["score"] >= 60 else "neutral",
            "hypothesis": "Positive Total-Return-Rendite und Outperformance gegenüber SPY"
            if a["score"] >= 60
            else "Keine positive Modellhypothese; Beobachtung ohne Kaufthese",
            "source": s.source,
            "status": "unvalidated",
            "input": {
                k: a[k] for k in ("short", "medium", "long", "volatility", "components")
            },
        }
        return self.repository.add_prediction(prediction)

    def validate(self):
        checked = 0
        for p in self.repository.predictions():
            if p["outcome"]:
                continue
            s = self.provider.series(p["symbol"])
            bm = self.provider.series(BENCHMARK)
            dates = [b.date for b in s.bars]
            if p["cutoff"] not in dates:
                continue
            start = dates.index(p["cutoff"])
            end = start + p["horizon"]
            if end >= len(dates):
                continue
            realized = (s.bars[end].adjusted / s.bars[start].adjusted - 1) * 100
            relative = (
                asof(bm, dates[end]).adjusted / asof(bm, p["cutoff"]).adjusted - 1
            ) * 100
            self.repository.record_outcome(
                p["id"],
                {
                    "date": dates[end],
                    "return_pct": realized,
                    "benchmark_return_pct": relative,
                    "excess_pct": realized - relative,
                    "hypothesis_met": realized > 0 and realized > relative
                    if p["direction"] == "positive"
                    else None,
                },
            )
            checked += 1
        return {"evaluated": checked}

    def backtest(self, symbol, fee_bps):
        if symbol not in UNIVERSE:
            raise DomainError("Ungültiges Symbol.")
        return backtest(
            self.provider.series(symbol), self.provider.series(BENCHMARK), fee_bps
        )
