"""
Operation Three Forks - data preparation.

Reads the NASA source files stored in data/sources/ and writes js/data.js,
which is the only data file the app needs. Because the data ships as a plain
script, index.html also works when opened by double-click, offline.

Usage:
    python scripts/prepare_data.py              # use data/sources/
    python scripts/prepare_data.py --download   # re-download the sources (needs internet)

Sources (all public):
  - Depot tubes: PDS Geosciences, Mars 2020 Sample Depot (Three Forks)
    https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/
  - Rover traverse: MMGIS Mars 2020
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
  - Weather: MEDA (Mars 2020)
    https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json&ver=1.0
  - Base image: 25 cm HiRISE of Jezero on Mars Trek, layer
    JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd, zoom 17,
    rows 52098-52099, columns 187437-187439 (six 256 px tiles)
  - Tube photos: Perseverance Front Hazcam raw images taken right after each
    tube was dropped (sols listed in sample_tube_event_sols.csv);
    see data/sources/hazcam_tube_images.csv
"""
import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "data" / "sources"
OUTPUT = ROOT / "js" / "data.js"

# Exact bounds of the detailed HiRISE mosaic (Mars Trek WMTS tiles, zoom 17).
ZOOM = 17
DEG_PER_TILE = 180 / 2 ** ZOOM
COL0, COL1 = 187437, 187439
ROW0, ROW1 = 52098, 52099
BOUNDS = {
    "west": COL0 * DEG_PER_TILE - 180,
    "east": (COL1 + 1) * DEG_PER_TILE - 180,
    "north": 90 - ROW0 * DEG_PER_TILE,
    "south": 90 - (ROW1 + 1) * DEG_PER_TILE,
    "width_px": 1536,  # 3 tiles x 256 px, upscaled x2
    "height_px": 1024,
}

# Context mosaic: same HiRISE layer at zoom 15 (3 x 3 tiles), about 1.3 m/px.
CTX_ZOOM = 15
CTX_DEG = 180 / 2 ** CTX_ZOOM
CTX_COL0, CTX_ROW0, CTX_N = 46858, 13023, 3
CONTEXT_BOUNDS = {
    "west": CTX_COL0 * CTX_DEG - 180,
    "east": (CTX_COL0 + CTX_N) * CTX_DEG - 180,
    "north": 90 - CTX_ROW0 * CTX_DEG,
    "south": 90 - (CTX_ROW0 + CTX_N) * CTX_DEG,
}

MARS_RADIUS_M = 3396190  # equatorial radius used by the Mars Trek EQ layers
M_PER_DEGREE = 2 * math.pi * MARS_RADIUS_M / 360

URLS = {
    "sample_tube_locations.csv": "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_locations.csv",
    "sample_tube_event_sols.csv": "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_event_sols.csv",
}

# Sample type, from the public Mars 2020 sample descriptions.
KIND = {
    "Roubion": "atmosphere",
    "Amalik Witness": "witness tube",
    "Crosswind Lake": "regolith",
}

# New-science targets: small craters visible in the HiRISE image, off the
# rover's traverse. Position in pixels of the detailed mosaic.
TARGETS_PX = [
    {"id": "A", "name": "Crater A", "px": [1215, 395]},
    {"id": "B", "name": "Crater B", "px": [1155, 510]},
]

# Mission assumptions (not NASA data; the app labels them as such).
ASSUMPTIONS = {
    "habitat_px": [1380, 880],
    "walk_speed_m_s": 0.5,
    "min_per_tube": 6,
    "min_per_sample": 15,
    "suit_reserve_min": 240,
    "return_margin": 0.25,
    "start_time": "10:00",
}


def px_to_lonlat(x, y):
    b = BOUNDS
    lon = b["west"] + x / b["width_px"] * (b["east"] - b["west"])
    lat = b["north"] - y / b["height_px"] * (b["north"] - b["south"])
    return round(lon, 7), round(lat, 7)


def download():
    import urllib.request
    for name, url in URLS.items():
        print("Downloading", url)
        urllib.request.urlretrieve(url, SOURCES / name)
    url = "https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json&ver=1.0"
    with urllib.request.urlopen(url) as r:
        sols = json.load(r).get("sols", [])[-3:]
    (SOURCES / "meda_latest_sols.json").write_text(json.dumps(sols, indent=1), encoding="utf-8")


def read_csv(name):
    with open(SOURCES / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def slug(name):
    return name.lower().replace(" ", "_")


def main():
    if "--download" in sys.argv:
        download()

    events = {r["Sample Name"]: r for r in read_csv("sample_tube_event_sols.csv")}
    hazcam = {r["Sample Name"]: r for r in read_csv("hazcam_tube_images.csv")}
    tubes = []
    for r in sorted(read_csv("sample_tube_locations.csv"), key=lambda r: int(r["Dropoff Sol"])):
        name = r["Sample Name"]
        ev = events.get(name, {})
        hz = hazcam.get(name)
        tubes.append({
            "num": len(tubes) + 1,
            "name": name,
            "designation": r["Sample Designation"],
            "sol_collected": int(r["Sample Designation"].split("-")[1]),
            "sol_deposited": int(r["Dropoff Sol"]),
            "lat": float(r["Rover Latitude"]),
            "lon": float(r["Rover Longitude"]),
            "elev_m": float(r["Rover Elevation"]),
            "azimuth": int(r["Sample Tube Azimuth"]),
            "kind": KIND.get(name, "rock core"),
            "sol_hazcam": int(ev.get("Front Hazcam imaging sol", -1)),
            "photo": {"src": f"img/hazcam/{slug(name)}.jpg", "sol": int(hz["Sol"]), "url": hz["Image URL"]} if hz else None,
        })

    traverse = [
        {"sol": int(r["sol"]), "lon": float(r["lon"]), "lat": float(r["lat"]), "elev": float(r["elev_geoid"])}
        for r in read_csv("M20_waypoints_depot.csv")
    ]

    meda = json.loads((SOURCES / "meda_latest_sols.json").read_text(encoding="utf-8"))

    targets = []
    for t in TARGETS_PX:
        lon, lat = px_to_lonlat(*t["px"])
        targets.append({"id": t["id"], "name": t["name"], "lon": lon, "lat": lat})

    hlon, hlat = px_to_lonlat(*ASSUMPTIONS["habitat_px"])
    assumptions = {k: v for k, v in ASSUMPTIONS.items() if k != "habitat_px"}
    assumptions["habitat"] = {"lon": hlon, "lat": hlat}

    data = {
        "bounds": BOUNDS,
        "m_per_degree": M_PER_DEGREE,
        "tubes": tubes,
        "traverse": traverse,
        "meda": meda[-1],
        "targets": targets,
        "assumptions": assumptions,
        "images": {
            "hirise": "img/hirise_three_forks.jpg",
            "context": "img/hirise_context.jpg",
            "context_bounds": CONTEXT_BOUNDS,
            "final_panorama": {
                "src": "img/mastcamz_sol693.jpg",
                "caption": "The depot on sol 693, before the rover left · Mastcam-Z (PDS)",
            },
        },
    }
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(
        "// Generated by scripts/prepare_data.py - do not edit by hand.\n"
        "window.DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"Done: {OUTPUT} ({len(tubes)} tubes, {len(traverse)} rover points)")


if __name__ == "__main__":
    main()
