"""Synthetic test fixtures only. The running application never imports test data."""

import copy
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from backend.analysis import analyze, backtest
from backend.models import UNIVERSE, Bar, DomainError, Series, now
from backend.portfolio import replay
from backend.provider import YahooProvider
from backend.repository import SQLiteRepository
from backend.service import GuruService


class FixtureProvider:
    def __init__(self):
        start = date.today() - timedelta(days=499)
        self.data = {}
        for j, symbol in enumerate([*UNIVERSE, "SPY", "EURUSD=X"]):
            self.data[symbol] = Series(
                symbol,
                "USD",
                [
                    Bar(
                        (start + timedelta(days=i)).isoformat(),
                        2 if symbol == "EURUSD=X" else 100 + i * (0.15 + j * 0.01),
                        2 if symbol == "EURUSD=X" else 100 + i * (0.15 + j * 0.01),
                    )
                    for i in range(500)
                ],
                now(),
                "TEST FIXTURE — NOT MARKET DATA",
            )

    def series(self, symbol):
        return copy.deepcopy(self.data[symbol])

    def fundamentals(self, symbol):
        return {"error": "test fixture: unavailable"}


class AnalysisTests(unittest.TestCase):
    def test_exact_horizons_and_score_bounds(self):
        p = [100 + i for i in range(300)]
        a = analyze(p)
        self.assertAlmostEqual(a["short"], (399 / 379 - 1) * 100)
        self.assertAlmostEqual(a["medium"], (399 / 339 - 1) * 100)
        self.assertAlmostEqual(a["long"], (399 / 199 - 1) * 100)
        self.assertTrue(0 <= a["score"] <= 100)
        self.assertEqual(a["score"], round(sum(a["components"].values())))

    def test_insufficient_or_invalid_data_rejected(self):
        for values in ([1] * 200, [0] * 300, [float("nan")] * 300):
            with self.assertRaises(DomainError):
                analyze(values)

    def test_backtest_has_one_day_signal_delay(self):
        provider = FixtureProvider()
        s = provider.series("MSFT")
        b = provider.series("SPY")
        with patch("backend.analysis.analyze", return_value={"score": 99}) as fn:
            result = backtest(s, b, 0)
            first_inputs = fn.call_args_list[0].args[0]
            self.assertEqual(len(first_inputs), 201)
            self.assertEqual(first_inputs[-1], s.bars[200].adjusted)
            self.assertAlmostEqual(
                result["curve"][0]["strategy"],
                100 * s.bars[202].adjusted / s.bars[201].adjusted,
            )

    def test_future_prices_do_not_change_past_backtest(self):
        p = FixtureProvider()
        original = p.series("MSFT")
        changed = copy.deepcopy(original)
        for bar in changed.bars[400:]:
            bar.adjusted *= 0.1
        a = backtest(original, p.series("SPY"))
        b = backtest(changed, p.series("SPY"))
        self.assertEqual(a["curve"][:190], b["curve"][:190])

    def test_fees_and_terminal_liquidation(self):
        p = FixtureProvider()
        with patch("backend.analysis.analyze", return_value={"score": 99}):
            free = backtest(p.series("MSFT"), p.series("SPY"), 0)
            paid = backtest(p.series("MSFT"), p.series("SPY"), 10)
        self.assertEqual(paid["trades"], 2)
        self.assertLess(paid["return_pct"], free["return_pct"])
        self.assertAlmostEqual(
            paid["curve"][-1]["strategy"], free["curve"][-1]["strategy"] * 0.999**2
        )
        with self.assertRaises(DomainError):
            backtest(p.series("MSFT"), p.series("SPY"), float("nan"))


class LedgerTests(unittest.TestCase):
    def test_splits_dividends_fees_and_currency_effects(self):
        bars = [Bar("2024-01-01", 100, 49), Bar("2024-01-02", 50, 50, 1, 2)]
        s = Series("MSFT", "USD", bars, now())
        fx = Series(
            "EURUSD=X", "USD", [Bar("2024-01-01", 2, 2), Bar("2024-01-02", 1, 1)], now()
        )
        portfolio = {
            "trades": [
                {
                    "symbol": "MSFT",
                    "date": "2024-01-01",
                    "side": "buy",
                    "quantity": 10,
                    "price": 100,
                    "fx": 0.5,
                    "fee": 1,
                }
            ]
        }
        result = replay(portfolio, {"MSFT": s}, fx, "2024-01-02")
        self.assertEqual(result["holdings"][0]["quantity"], 20)
        self.assertEqual(result["dividends"], 20)
        self.assertEqual(result["fees"], 1)
        self.assertEqual(result["cash"], 99519)
        self.assertEqual(result["value"], 100519)

    def test_ex_date_buy_does_not_receive_prior_dividend(self):
        s = Series("MSFT", "USD", [Bar("2024-01-01", 100, 100, 3)], now())
        fx = Series("EURUSD=X", "USD", [Bar("2024-01-01", 1, 1)], now())
        p = {
            "trades": [
                {
                    "symbol": "MSFT",
                    "date": "2024-01-01",
                    "side": "buy",
                    "quantity": 2,
                    "price": 100,
                    "fx": 1,
                    "fee": 1,
                }
            ]
        }
        self.assertEqual(replay(p, {"MSFT": s}, fx, "2024-01-01")["dividends"], 0)

    def test_yahoo_split_normalization_does_not_double_split(self):
        dates = [1704067200 + i * 86400 for i in range(220)]
        r = {
            "timestamp": dates,
            "meta": {"currency": "USD"},
            "indicators": {
                "quote": [{"close": [50.0] * 220}],
                "adjclose": [{"adjclose": [49.0] * 220}],
            },
            "events": {
                "splits": {"s": {"date": dates[100], "numerator": 2, "denominator": 1}},
                "dividends": {"d": {"date": dates[50], "amount": 0.5}},
            },
        }
        s = YahooProvider.normalize("MSFT", r)
        self.assertEqual(s.bars[0].close, 100)
        self.assertEqual(s.bars[100].close, 50)
        self.assertEqual(s.bars[50].dividend, 1)
        self.assertEqual(s.bars[100].split, 2)

    def test_missing_adjusted_prices_not_synthesized(self):
        with self.assertRaises(DomainError):
            YahooProvider.normalize(
                "MSFT", {"timestamp": [], "indicators": {"quote": [{"close": []}]}}
            )


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = SQLiteRepository(str(Path(self.tmp.name) / "guru.db"))
        self.provider = FixtureProvider()
        self.service = GuruService(self.db, self.provider)

    def tearDown(self):
        self.tmp.cleanup()

    def test_buy_sell_and_restart(self):
        self.service.trade("MSFT", "buy", 2)
        p = self.service.portfolios()[0]
        self.assertEqual(p["holdings"][0]["quantity"], 2)
        self.assertEqual(p["fees"], 1)
        self.assertLess(p["value"], 100000)
        with self.assertRaises(DomainError):
            self.service.trade("MSFT", "sell", 3)
        for qty in (-1, 0, float("inf"), float("nan"), True):
            with self.assertRaises(DomainError):
                self.service.trade("MSFT", "buy", qty)
        self.service.trade("MSFT", "sell", 1)
        restarted = GuruService(SQLiteRepository(self.db.path), self.provider)
        p = restarted.portfolios()[0]
        self.assertEqual(p["holdings"][0]["quantity"], 1)
        self.assertEqual(len(p["trades"]), 2)

    def test_failed_provider_creates_no_transaction(self):
        with patch.object(self.provider, "series", side_effect=DomainError("offline")):
            with self.assertRaises(DomainError):
                self.service.trade("MSFT", "buy", 1)
        self.assertEqual(self.db.load("portfolios")[0]["trades"], [])

    def test_guru_start_stop_keeps_history(self):
        self.service.guru_start()
        p = self.service.portfolios()[-1]
        self.assertEqual(len(p["holdings"]), 3)
        with self.assertRaises(DomainError):
            self.service.guru_start()
        self.service.guru_stop(p["id"])
        frozen = self.service.portfolios()[-1]["value"]
        for b in self.provider.data["MSFT"].bars:
            b.close *= 2
        self.assertEqual(self.service.portfolios()[-1]["value"], frozen)
        self.service.guru_start()
        self.assertEqual(len(self.service.portfolios()), 3)

    def test_forecasts_are_immutable_deduplicated_and_not_prematurely_validated(self):
        first = self.service.forecast("MSFT", 20)
        for b in self.provider.data["MSFT"].bars[-10:]:
            b.adjusted *= 0.1
        second = self.service.forecast("MSFT", 20)
        self.assertEqual(first, second)
        self.assertEqual(self.service.validate()["evaluated"], 0)
        self.assertEqual(len(self.db.predictions()), 1)

    def test_validation_records_separate_actual_outcome(self):
        s = self.provider.series("MSFT")
        idx = 400
        self.db.add_prediction(
            {
                "symbol": "MSFT",
                "model": "momentum-risk-v1",
                "cutoff": s.bars[idx].date,
                "horizon": 20,
                "direction": "positive",
                "created_at": now(),
                "hypothesis": "test",
                "score": 80,
            }
        )
        self.assertEqual(self.service.validate()["evaluated"], 1)
        p = self.db.predictions()[0]
        expected = (s.bars[idx + 20].adjusted / s.bars[idx].adjusted - 1) * 100
        self.assertAlmostEqual(p["outcome"]["return_pct"], expected)
        self.assertEqual(p["score"], 80)
        self.assertEqual(self.service.validate()["evaluated"], 0)

    def test_eur_benchmark_starts_on_same_date(self):
        self.service.trade("MSFT", "buy", 1)
        p = self.service.portfolios()[0]
        self.assertAlmostEqual(p["curve"][0]["benchmark"], 100000)
        self.assertEqual(p["curve"][0]["date"], p["trades"][0]["date"])


if __name__ == "__main__":
    unittest.main()
