"""Export only public market data. Never export portfolios, forecasts or DB files."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def export(destination=None):
    from backend.analysis import summary
    from backend.models import BENCHMARK, UNIVERSE, now
    from backend.provider import YahooProvider
    from backend.repository import SQLiteRepository

    repo = SQLiteRepository(str(ROOT / ".data/pages-market-cache.sqlite3"))
    provider = YahooProvider(repo)
    series = {
        symbol: provider.series(symbol) for symbol in [*UNIVERSE, BENCHMARK, "EURUSD=X"]
    }
    stocks = [
        dict(summary(series[s]), name=name, sector=sector)
        for s, (name, sector) in UNIVERSE.items()
    ]
    stocks.sort(key=lambda row: row["score"], reverse=True)
    details = {}
    for stock in stocks:
        details[stock["symbol"]] = dict(
            stock,
            fundamentals={
                "error": "In der öffentlichen Pages-Version ist keine verlässliche Fundamentaldatenquelle angebunden.",
                "source": "Keine Daten verfügbar",
                "fetched_at": now(),
            },
            opportunities=[
                ("Positiver" if stock["long"] > 0 else "Negativer")
                + " langfristiger Trend",
                ("Positives" if stock["medium"] > 0 else "Negatives")
                + " mittelfristiges Momentum",
            ],
            risks=[
                f"Historische annualisierte Volatilität: {stock['volatility']:.1f} %",
                "Einzelaktien- und USD/EUR-Währungsrisiko",
                "Historische Signale sind keine validierten Prognosen.",
            ],
        )
    result = {
        "schema": 1,
        "generated_at": now(),
        "dashboard": {
            "stocks": stocks,
            "errors": [],
            "universe": list(UNIVERSE),
            "model": "momentum-risk-v1",
            "benchmark": BENCHMARK,
            "monitoring": {"enabled": False, "reason": "Keine Hintergrundüberwachung"},
        },
        "details": details,
        "series": {s: v.dict() for s, v in series.items()},
    }
    destination = Path(destination or ROOT / "public/data/market.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")),
        encoding="utf-8",
    )
    temporary.replace(destination)
    print(
        f"Öffentlicher Datenstand exportiert: {len(stocks)} Aktien, Kurstag {stocks[0]['date']}. Keine Nutzerdaten."
    )


if __name__ == "__main__":
    export()
