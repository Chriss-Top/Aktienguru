import json
import math
import os
import ssl
import time
from datetime import UTC, datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .models import Bar, DomainError, Series, now
from .repository import Repository


class YahooProvider:
    """Free unofficial endpoint. Persist real responses; never synthesize missing data."""

    def __init__(self, repository: Repository):
        self.repository = repository
        self.failures = {}

    def _json(self, url):
        context = ssl.create_default_context(cafile=os.getenv("SSL_CERT_FILE") or None)
        try:
            with urlopen(
                Request(url, headers={"User-Agent": "Guru/1.0 personal research"}),
                timeout=12,
                context=context,
            ) as response:
                return json.load(response)
        except HTTPError as e:
            raise DomainError(
                f"Yahoo Finance: HTTP {e.code}. "
                + (
                    "Abruflimit erreicht. Bitte später erneut versuchen."
                    if e.code == 429
                    else "Zugriff aktuell nicht möglich."
                )
            ) from e
        except (URLError, TimeoutError) as e:
            raise DomainError(
                "Kursanbieter nicht erreichbar. Netzwerkzugang und TLS-Konfiguration prüfen."
            ) from e

    def series(self, symbol):
        cached = self.repository.load("market:" + symbol)
        if (
            cached
            and time.time() - datetime.fromisoformat(cached["fetched_at"]).timestamp()
            < 3600
        ):
            return Series(**{**cached, "bars": [Bar(**b) for b in cached["bars"]]})
        failure = self.failures.get(symbol)
        if failure and time.monotonic() - failure[0] < 120:
            raise DomainError(failure[1])
        try:
            payload = self._json(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}?range=5y&interval=1d&events=div%2Csplits"
            )
            result = payload.get("chart", {}).get("result")
            if not result:
                raise DomainError("Keine Kurshistorie vom Anbieter erhalten.")
            series = self.normalize(symbol, result[0])
            self.repository.save("market:" + symbol, series.dict())
            return series
        except (DomainError, KeyError, TypeError, ValueError) as e:
            message = (
                str(e)
                if isinstance(e, DomainError)
                else "Ungültige Antwort des Kursanbieters."
            )
            self.failures[symbol] = (time.monotonic(), message)
            # Do not silently offer stale cached data as fresh executable prices.
            raise DomainError(message) from e

    @staticmethod
    def normalize(symbol, result):
        timestamps = result["timestamp"]
        prices = result["indicators"]["quote"][0]["close"]
        adjusted = result["indicators"].get("adjclose", [{}])[0].get("adjclose")
        if not adjusted or len(adjusted) != len(timestamps):
            raise DomainError(
                "Bereinigte Kurse fehlen; Total-Return-Analyse ist nicht möglich."
            )
        events = result.get("events", {})

        def day(t):
            return datetime.fromtimestamp(t, UTC).date().isoformat()

        splits = {
            day(x["date"]): float(x["numerator"]) / float(x["denominator"])
            for x in events.get("splits", {}).values()
        }
        dividends = {
            day(x["date"]): float(x["amount"])
            for x in events.get("dividends", {}).values()
        }
        bars = []
        for t, close, adj in zip(timestamps, prices, adjusted):
            if close is None or adj is None:
                continue
            if not all(math.isfinite(v) and v > 0 for v in (close, adj)):
                continue
            date = day(t)
            # Yahoo close and dividends are normalized for subsequent splits. Undo
            # those factors for the historical execution/holdings ledger.
            factor = math.prod(r for d, r in splits.items() if d > date)
            bars.append(
                Bar(
                    date,
                    close * factor,
                    adj,
                    dividends.get(date, 0) * factor,
                    splits.get(date, 1),
                )
            )
        # Never execute against a partly formed daily candle.
        last = datetime.fromtimestamp(result["timestamp"][-1], UTC)
        session_end = (
            result.get("meta", {})
            .get("currentTradingPeriod", {})
            .get("regular", {})
            .get("end", 0)
        )
        if (
            bars
            and last.date() == datetime.now(UTC).date()
            and time.time() < session_end
        ):
            bars = [b for b in bars if b.date != last.date().isoformat()]
        if len(bars) < 210:
            raise DomainError("Weniger als 210 vollständige Handelstage verfügbar.")
        return Series(symbol, result["meta"]["currency"], bars, now())

    def fundamentals(self, symbol):
        cached = self.repository.load("fundamentals:" + symbol)
        if (
            cached
            and time.time() - datetime.fromisoformat(cached["fetched_at"]).timestamp()
            < 86400
        ):
            return cached
        try:
            result = self._json(
                f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={quote(symbol)}"
            )["quoteResponse"]["result"][0]
            fields = {
                k: result.get(k)
                for k in [
                    "marketCap",
                    "trailingPE",
                    "forwardPE",
                    "priceToBook",
                    "dividendYield",
                    "epsTrailingTwelveMonths",
                ]
            }
            value = dict(
                fields, source="Yahoo Finance Quote API", fetched_at=now(), error=None
            )
        except (DomainError, KeyError, IndexError, TypeError) as e:
            value = {
                "error": str(e),
                "source": "Yahoo Finance Quote API",
                "fetched_at": now(),
            }
        self.repository.save("fundamentals:" + symbol, value)
        return value
