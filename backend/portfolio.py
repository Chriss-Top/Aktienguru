"""Deterministic replay ledger; split/dividend events run before end-of-day trades."""

from bisect import bisect_right

from .models import DomainError

START_CAPITAL = 100000.0
FEE_RATE = 0.001
MIN_FEE = 1.0


def asof(series, date):
    dates = [b.date for b in series.bars]
    i = bisect_right(dates, date) - 1
    if i < 0:
        raise DomainError(f"Historische Daten für {series.symbol} am {date} fehlen.")
    bar = series.bars[i]
    from datetime import date as D

    if (D.fromisoformat(date) - D.fromisoformat(bar.date)).days > 7:
        raise DomainError(f"Kurs für {series.symbol} am {date} ist zu alt.")
    return bar


def euro_rate(currency, date, fx):
    if currency == "EUR":
        return 1.0
    if currency != "USD":
        raise DomainError("Aktuell werden ausschließlich EUR und USD unterstützt.")
    return 1 / asof(fx, date).close


def replay(portfolio, series, fx, date):
    cash = START_CAPITAL
    holdings = {}
    dividends = 0.0
    fees = 0.0
    trades = [t for t in portfolio["trades"] if t["date"] <= date]
    if not trades:
        return {
            "cash": cash,
            "holdings": [],
            "dividends": 0.0,
            "fees": 0.0,
            "value": cash,
            "return_pct": 0.0,
        }
    start = min(t["date"] for t in trades)
    events = {}
    for symbol in {t["symbol"] for t in trades}:
        s = series[symbol]
        if s.bars[0].date > start:
            raise DomainError(
                "Kursarchiv deckt die Portfoliohistorie nicht vollständig ab."
            )
        for b in s.bars:
            if start <= b.date <= date and (b.split != 1 or b.dividend):
                events.setdefault(b.date, []).append((symbol, b))
    for day in sorted(set(events) | {t["date"] for t in trades}):
        for symbol, b in events.get(day, []):
            quantity = holdings.get(symbol, 0.0)
            quantity *= b.split
            holdings[symbol] = quantity
            payment = (
                quantity * b.dividend * euro_rate(series[symbol].currency, day, fx)
            )
            cash += payment
            dividends += payment
        for t in (t for t in trades if t["date"] == day):
            sign = 1 if t["side"] == "buy" else -1
            holdings[t["symbol"]] = (
                holdings.get(t["symbol"], 0.0) + sign * t["quantity"]
            )
            cash -= sign * t["quantity"] * t["price"] * t["fx"] + t["fee"]
            fees += t["fee"]
    positions = []
    for symbol, quantity in holdings.items():
        if quantity > 1e-8:
            s = series[symbol]
            bar = asof(s, date)
            rate = euro_rate(s.currency, date, fx)
            positions.append(
                {
                    "symbol": symbol,
                    "quantity": quantity,
                    "price": bar.close,
                    "currency": s.currency,
                    "fx": rate,
                    "value": quantity * bar.close * rate,
                    "date": bar.date,
                }
            )
    value = cash + sum(p["value"] for p in positions)
    return {
        "cash": cash,
        "holdings": positions,
        "dividends": dividends,
        "fees": fees,
        "value": value,
        "return_pct": (value / START_CAPITAL - 1) * 100,
    }


def performance(portfolio, series, fx, benchmark):
    dates = sorted({b.date for b in benchmark.bars})
    if not portfolio["trades"]:
        return []
    start = min(t["date"] for t in portfolio["trades"])
    stop = portfolio.get("stopped_date") or min(
        [s.bars[-1].date for s in series.values()]
        + [fx.bars[-1].date, benchmark.bars[-1].date]
    )
    base = asof(benchmark, start).adjusted * euro_rate(benchmark.currency, start, fx)
    curve = []
    for date in dates:
        if start <= date <= stop:
            state = replay(portfolio, series, fx, date)
            bm = asof(benchmark, date).adjusted * euro_rate(
                benchmark.currency, date, fx
            )
            curve.append(
                {
                    "date": date,
                    "strategy": state["value"],
                    "benchmark": START_CAPITAL * bm / base,
                }
            )
    return curve
