from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any, Iterable

import fastf1
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "api-gateway" / ".env")
load_dotenv(ROOT / ".env")

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI") or "mongodb://127.0.0.1:27017/f1sim"

cache_dir = Path(os.getenv("FASTF1_CACHE") or (Path(__file__).resolve().parent / ".fastf1-cache")).expanduser()
cache_dir.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(cache_dir))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed lap data from FastF1.")
    parser.add_argument("--season", type=int, default=None, help="Season year, e.g. 2023")
    parser.add_argument("--round", type=int, default=None, help="Round number, e.g. 1")
    parser.add_argument("--limit", type=int, default=None, help="Limit total laps per race")
    return parser.parse_args()


def td_to_s(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value.total_seconds())


def int_or_none(value: Any) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def batch(iterable: Iterable[dict], size: int = 1000):
    buf = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def build_docs(laps: pd.DataFrame, race_id: str, season: int, round_no: int, event_name: str, limit: int | None):
    count = 0
    for _, row in laps.iterrows():
        doc = {
            "raceId": race_id,
            "season": season,
            "round": round_no,
            "eventName": event_name,
            "driver": row.get("Driver"),
            "driverNumber": int_or_none(row.get("DriverNumber")),
            "team": row.get("Team"),
            "lapNumber": int_or_none(row.get("LapNumber")),
            "lapTime_s": td_to_s(row.get("LapTime")),
            "sector1_s": td_to_s(row.get("Sector1Time")),
            "sector2_s": td_to_s(row.get("Sector2Time")),
            "sector3_s": td_to_s(row.get("Sector3Time")),
            "compound": row.get("Compound"),
            "stint": int_or_none(row.get("Stint")),
            "tyreLife": int_or_none(row.get("TyreLife")),
            "freshTyre": bool(row.get("FreshTyre")) if row.get("FreshTyre") is not None else None,
            "trackStatus": row.get("TrackStatus"),
            "isAccurate": bool(row.get("IsAccurate")) if row.get("IsAccurate") is not None else None,
            "pitInTime_s": td_to_s(row.get("PitInTime")),
            "pitOutTime_s": td_to_s(row.get("PitOutTime")),
        }
        yield doc
        count += 1
        if limit and count >= limit:
            break


def main() -> None:
    args = parse_args()

    client = MongoClient(MONGO_URL)
    db = client.get_database()
    races = db["races"]
    lap_data = db["lap_data"]
    lap_data.create_index("raceId")
    lap_data.create_index("season")

    query: dict[str, Any] = {}
    if args.season:
        query["season"] = args.season
    if args.round:
        query["round"] = args.round

    race_list = list(races.find(query).sort([("season", 1), ("round", 1)]))
    if not race_list and args.season:
        schedule = fastf1.get_event_schedule(args.season)
        schedule = schedule[schedule["RoundNumber"] > 0]
        race_list = [
            {
                "raceId": f"{args.season}-{int(row.RoundNumber)}",
                "season": args.season,
                "round": int(row.RoundNumber),
                "raceName": row.EventName,
            }
            for _, row in schedule.iterrows()
        ]

    if not race_list:
        print("[laps] no races found. Run seed_races.py first.")
        client.close()
        return

    processed = 0
    for race in race_list:
        season = int(race["season"])
        round_no = int(race["round"])
        race_id = race.get("raceId") or f"{season}-{round_no}"
        event_name = race.get("raceName") or race.get("eventName") or f"Round {round_no}"

        print(f"[laps] loading {event_name} {season} (round {round_no})")
        session = fastf1.get_session(season, round_no, "R")
        session.load(laps=True, telemetry=False, weather=False, messages=False)

        laps = session.laps
        lap_data.delete_many({"raceId": race_id})

        docs_iter = build_docs(laps, race_id, season, round_no, event_name, args.limit)
        inserted = 0
        for chunk in batch(docs_iter):
            if chunk:
                lap_data.insert_many(chunk, ordered=False)
                inserted += len(chunk)

        processed += 1
        print(f"[laps] stored {inserted} laps for {event_name}")

    print(f"[laps] done. Races processed: {processed}")
    client.close()


if __name__ == "__main__":
    main()
