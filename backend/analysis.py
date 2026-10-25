import math
import statistics

from .models import MODEL_VERSION, DomainError, Series


def analyze(values: list[float]):
    if len(values) < 201 or any(not math.isfinite(p) or p <= 0 for p in values):
        raise DomainError("Mindestens 201 gültige, bereinigte Tageskurse benötigt.")
    short, medium, long = [
        (values[-1] / values[-1 - n] - 1) * 100 for n in (20, 60, 200)
    ]
    returns = [b / a - 1 for a, b in zip(values[-61:-1], values[-60:])]
    vol = statistics.pstdev(returns) * math.sqrt(252) * 100

    # Explicit bounded components: 30/35/25 momentum + 10 stability.
    def clamp(x):
        return max(0.0, min(1.0, x))

    components = {
        "short": 30 * clamp(0.5 + short / 40),
        "medium": 35 * clamp(0.5 + medium / 80),
        "long": 25 * clamp(0.5 + long / 120),
        "stability": 10 * clamp(1 - vol / 80),
    }
    return {
        "score": round(sum(components.values())),
        "short": short,
        "medium": medium,
        "long": long,
        "volatility": vol,
        "components": components,
        "model": MODEL_VERSION,
    }


def summary(series: Series):
    analysis = analyze([b.adjusted for b in series.bars])
    return dict(
        symbol=series.symbol,
        currency=series.currency,
        price=series.bars[-1].close,
        date=series.bars[-1].date,
        source=series.source,
        fetched_at=series.fetched_at,
        change=(series.bars[-1].adjusted / series.bars[-2].adjusted - 1) * 100,
        history=[{"date": b.date, "value": b.adjusted} for b in series.bars],
        **analysis,
    )


def backtest(series: Series, benchmark: Series, fee_bps: float = 10):
    """At close i execute signal computed exclusively from closes through i-1.
    Hold from close i to i+1. Adjusted prices include corporate-action returns.
    Current fixed universe is not a point-in-time universe; report that caveat.
    """
    if not 0 <= fee_bps <= 100:
        raise DomainError("Gebühren müssen zwischen 0 und 100 Basispunkten liegen.")
    bm = {b.date: b.adjusted for b in benchmark.bars}
    bars = [b for b in series.bars if b.date in bm]
    if len(bars) < 240:
        raise DomainError(
            "Mindestens 240 gemeinsame Handelstage für den Backtest benötigt."
        )
    equity = 100.0
    position = 0
    trades = 0
    curve = []
    benchmark_start = bm[bars[201].date]
    for i in range(201, len(bars) - 1):
        signal = analyze([b.adjusted for b in bars[:i]])["score"] >= 60
        if signal != bool(position):
            equity *= 1 - fee_bps / 10000
            trades += 1
        position = int(signal)
        equity *= 1 + position * (bars[i + 1].adjusted / bars[i].adjusted - 1)
        curve.append(
            {
                "date": bars[i + 1].date,
                "strategy": equity,
                "benchmark": 100 * bm[bars[i + 1].date] / benchmark_start,
            }
        )
    if position:  # explicit liquidation at final close
        equity *= 1 - fee_bps / 10000
        trades += 1
        curve[-1]["strategy"] = equity
    peak = 100.0
    drawdown = 0.0
    for point in curve:
        peak = max(peak, point["strategy"])
        drawdown = min(drawdown, point["strategy"] / peak - 1)
    return {
        "curve": curve,
        "return_pct": equity - 100,
        "benchmark_return_pct": curve[-1]["benchmark"] - 100,
        "max_drawdown_pct": drawdown * 100,
        "trades": trades,
        "fee_bps": fee_bps,
        "model": MODEL_VERSION,
        "start": bars[201].date,
        "end": bars[-1].date,
        "currency": series.currency,
        "notes": [
            "Signal vom Vortag; Ausführung zum nächsten Tagesschluss.",
            "Total-Return-Kurse berücksichtigen Dividenden und Splits; Gebühren pro Positionswechsel.",
            "USD-Betrachtung, kein FX-Effekt bei USD-Anlage und USD-Benchmark.",
            "Heute ausgewählte Einzelaktie: Survivorship- und Selektionsbias möglich.",
            "Retrospektive Simulation, kein Nachweis künftiger Prognosegüte.",
        ],
    }
