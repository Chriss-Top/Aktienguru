"""Persistence boundary. Replace this adapter for Supabase; domain code uses methods only."""

import json
import sqlite3
from pathlib import Path
from typing import Protocol

from .models import now


class Repository(Protocol):
    def load(self, key: str, default=None): ...
    def save(self, key: str, value): ...
    def add_prediction(self, prediction: dict) -> dict: ...
    def predictions(self) -> list[dict]: ...
    def record_outcome(self, identifier: int, outcome: dict): ...


class SQLiteRepository:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS predictions (
              id INTEGER PRIMARY KEY, symbol TEXT NOT NULL, model TEXT NOT NULL,
              cutoff TEXT NOT NULL, horizon INTEGER NOT NULL, payload TEXT NOT NULL,
              UNIQUE(symbol, model, cutoff, horizon));
            CREATE TABLE IF NOT EXISTS outcomes (
              prediction_id INTEGER PRIMARY KEY REFERENCES predictions(id), payload TEXT NOT NULL);
            """)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def load(self, key, default=None):
        with self.connect() as db:
            row = db.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def save(self, key, value):
        with self.connect() as db:
            db.execute(
                "INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, json.dumps(value, allow_nan=False)),
            )

    def add_prediction(self, prediction):
        with self.connect() as db:
            db.execute(
                "INSERT OR IGNORE INTO predictions(symbol,model,cutoff,horizon,payload) VALUES(?,?,?,?,?)",
                (
                    prediction["symbol"],
                    prediction["model"],
                    prediction["cutoff"],
                    prediction["horizon"],
                    json.dumps(prediction),
                ),
            )
            row = db.execute(
                "SELECT id,payload FROM predictions WHERE symbol=? AND model=? AND cutoff=? AND horizon=?",
                (
                    prediction["symbol"],
                    prediction["model"],
                    prediction["cutoff"],
                    prediction["horizon"],
                ),
            ).fetchone()
        return dict(json.loads(row[1]), id=row[0])

    def predictions(self):
        with self.connect() as db:
            rows = db.execute(
                "SELECT p.id,p.payload,o.payload FROM predictions p LEFT JOIN outcomes o ON p.id=o.prediction_id ORDER BY p.id DESC"
            ).fetchall()
        return [
            dict(json.loads(p), id=i, outcome=json.loads(o) if o else None)
            for i, p, o in rows
        ]

    def record_outcome(self, identifier, outcome):
        with self.connect() as db:
            db.execute(
                "INSERT OR IGNORE INTO outcomes VALUES (?,?)",
                (identifier, json.dumps(dict(outcome, evaluated_at=now()))),
            )
