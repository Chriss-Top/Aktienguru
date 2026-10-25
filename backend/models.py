from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Protocol

MODEL_VERSION = "momentum-risk-v1"
UNIVERSE = {
    "MSFT": ("Microsoft", "Technologie"),
    "AAPL": ("Apple", "Technologie"),
    "NVDA": ("NVIDIA", "Halbleiter"),
    "GOOGL": ("Alphabet", "Kommunikation"),
    "AMZN": ("Amazon", "Konsum"),
    "META": ("Meta Platforms", "Kommunikation"),
    "JPM": ("JPMorgan Chase", "Finanzen"),
    "JNJ": ("Johnson & Johnson", "Gesundheit"),
}
BENCHMARK = "SPY"
SOURCE = "Yahoo Finance Chart API (inoffiziell)"


def now():
    return datetime.now(UTC).isoformat()


@dataclass
class Bar:
    date: str
    close: float
    adjusted: float
    dividend: float = 0.0
    split: float = 1.0


@dataclass
class Series:
    symbol: str
    currency: str
    bars: list[Bar]
    fetched_at: str
    source: str = SOURCE

    def dict(self):
        return asdict(self)


class MarketProvider(Protocol):
    def series(self, symbol: str) -> Series: ...
    def fundamentals(self, symbol: str) -> dict: ...


class DomainError(ValueError):
    pass
