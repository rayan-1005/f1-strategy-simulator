from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

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
    parser = argparse.ArgumentParser(description="Seed race list from FastF1.")
    parser.add_argument("--start", type=int, default=2018, help="Start season (inclusive).")
    parser.add_argument("--end", type=int, default=2024, help="End season (inclusive).")
    return parser.parse_args()


def to_iso(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "to_pydatetime"):
        return value.to_pydatetime().isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def main() -> None:
    args = parse_args()

    client = MongoClient(MONGO_URL)
    db = client.get_database()
    races = db["races"]
    races.create_index("raceId", unique=True)

    total = 0
    for season in range(args.start, args.end + 1):
        schedule = fastf1.get_event_schedule(season)
        schedule = schedule[schedule["RoundNumber"] > 0]

        season_count = 0
        for _, row in schedule.iterrows():
            race_id = f"{season}-{int(row.RoundNumber)}"
            doc = {
                "raceId": race_id,
                "season": season,
                "round": int(row.RoundNumber),
                "raceName": row.EventName,
                "officialName": row.get("OfficialEventName"),
                "eventDate": to_iso(row.get("EventDate")),
                "eventFormat": row.get("EventFormat"),
                "location": row.get("Location"),
                "country": row.get("Country"),
            }
            races.update_one({"raceId": race_id}, {"$set": doc}, upsert=True)
            season_count += 1

        total += season_count
        print(f"[races] {season}: upserted {season_count} races")

    print(f"[races] done. Total upserted: {total}")
    client.close()


if __name__ == "__main__":
    main()
