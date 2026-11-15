"""
Operación Three Forks — preparación de datos.

Lee los archivos reales de la NASA guardados en datos/fuentes/ y genera
js/datos.js, que es lo único que la app necesita (así funciona incluso
abriendo index.html con doble clic, sin servidor y sin internet).

Uso:
    python scripts/preparar_datos.py              # usa datos/fuentes/
    python scripts/preparar_datos.py --descargar  # vuelve a bajar las fuentes (requiere internet)

Fuentes (todas públicas):
  - Tubos del depósito: PDS Geosciences, Mars 2020 Sample Depot (Three Forks)
    https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/
  - Recorrido del rover: MMGIS Mars 2020
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
  - Clima: MEDA (Mars 2020)
    https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json&ver=1.0
  - Imagen base: HiRISE 25 cm de Jezero en Mars Trek, capa
    JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd, zoom 17,
    filas 52098-52099, columnas 187437-187439 (6 mosaicos de 256 px)
"""
import csv
import json
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTES = RAIZ / "datos" / "fuentes"
SALIDA = RAIZ / "js" / "datos.js"

# Límites exactos del mosaico HiRISE (mosaicos WMTS de Mars Trek, zoom 17).
Z = 17
GRADOS_POR_MOSAICO = 180 / 2 ** Z
COL0, COL1 = 187437, 187439
FIL0, FIL1 = 52098, 52099
LIMITES = {
    "oeste": COL0 * GRADOS_POR_MOSAICO - 180,
    "este": (COL1 + 1) * GRADOS_POR_MOSAICO - 180,
    "norte": 90 - FIL0 * GRADOS_POR_MOSAICO,
    "sur": 90 - (FIL1 + 1) * GRADOS_POR_MOSAICO,
    "ancho_px": 1536,  # 3 mosaicos x 256 px, ampliado x2
    "alto_px": 1024,
}
# Mosaico de contexto: misma capa HiRISE a zoom 15 (3 x 3 mosaicos), ~1.3 m/px.
Z_CTX = 15
G_CTX = 180 / 2 ** Z_CTX
CTX_COL0, CTX_FIL0, CTX_N = 46858, 13023, 3
CONTEXTO = {
    "oeste": CTX_COL0 * G_CTX - 180,
    "este": (CTX_COL0 + CTX_N) * G_CTX - 180,
    "norte": 90 - CTX_FIL0 * G_CTX,
    "sur": 90 - (CTX_FIL0 + CTX_N) * G_CTX,
}
RADIO_MARTE_M = 3396190  # radio ecuatorial usado por las capas EQ de Mars Trek
M_POR_GRADO = 2 * math.pi * RADIO_MARTE_M / 360

URLS = {
    "sample_tube_locations.csv": "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_locations.csv",
    "sample_tube_event_sols.csv": "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_event_sols.csv",
}

# Tipo de muestra (descripciones públicas de la misión Mars 2020).
TIPO = {
    "Roubion": "atmósfera",
    "Amalik Witness": "tubo testigo",
    "Crosswind Lake": "regolito",
}

# Objetivos de ciencia nueva: cráteres pequeños que se ven en la imagen HiRISE
# y que no están sobre el recorrido del rover. Posición en píxeles del mosaico.
OBJETIVOS_PX = [
    {"id": "A", "nombre": "Cráter A", "px": [1215, 395],
     "que_hacer": "Muestra de suelo del borde y foto del interior del cráter"},
    {"id": "B", "nombre": "Cráter B", "px": [1155, 510],
     "que_hacer": "Muestra de suelo del borde y foto del interior del cráter"},
]

# Supuestos de la misión (no son datos de la NASA; se muestran como tales).
SUPUESTOS = {
    "habitat_px": [1380, 880],
    "velocidad_m_s": 0.5,
    "min_por_tubo": 6,
    "min_por_muestra": 15,
    "duracion_eva_min": 240,
    "margen_regreso": 0.25,
    "hora_salida": "10:00",
}


def px_a_lonlat(x, y):
    L = LIMITES
    lon = L["oeste"] + x / L["ancho_px"] * (L["este"] - L["oeste"])
    lat = L["norte"] - y / L["alto_px"] * (L["norte"] - L["sur"])
    return round(lon, 7), round(lat, 7)


def descargar():
    import urllib.request
    for nombre, url in URLS.items():
        print("Descargando", url)
        urllib.request.urlretrieve(url, FUENTES / nombre)
    url = "https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json&ver=1.0"
    with urllib.request.urlopen(url) as r:
        soles = json.load(r).get("sols", [])[-3:]
    (FUENTES / "meda_ultimos_soles.json").write_text(json.dumps(soles, indent=1), encoding="utf-8")


def leer_csv(nombre):
    with open(FUENTES / nombre, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    if "--descargar" in sys.argv:
        descargar()

    eventos = {r["Sample Name"]: r for r in leer_csv("sample_tube_event_sols.csv")}
    tubos = []
    for r in sorted(leer_csv("sample_tube_locations.csv"), key=lambda r: int(r["Dropoff Sol"])):
        nombre = r["Sample Name"]
        ev = eventos.get(nombre, {})
        tubos.append({
            "num": len(tubos) + 1,
            "nombre": nombre,
            "designacion": r["Sample Designation"],
            "sol_toma": int(r["Sample Designation"].split("-")[1]),
            "sol_deposito": int(r["Dropoff Sol"]),
            "lat": float(r["Rover Latitude"]),
            "lon": float(r["Rover Longitude"]),
            "elev_m": float(r["Rover Elevation"]),
            "azimut": int(r["Sample Tube Azimuth"]),
            "tipo": TIPO.get(nombre, "núcleo de roca"),
            "sol_navcam": int(ev.get("Navcam imaging sol", -1)),
            "sol_mastcamz": int(ev.get("Mastcam-Z imaging sol", -1)),
        })

    recorrido = [
        {"sol": int(r["sol"]), "lon": float(r["lon"]), "lat": float(r["lat"]), "elev": float(r["elev_geoid"])}
        for r in leer_csv("M20_waypoints_depot.csv")
    ]

    meda = json.loads((FUENTES / "meda_ultimos_soles.json").read_text(encoding="utf-8"))

    objetivos = []
    for o in OBJETIVOS_PX:
        lon, lat = px_a_lonlat(*o["px"])
        objetivos.append({**{k: v for k, v in o.items() if k != "px"}, "lon": lon, "lat": lat})

    hlon, hlat = px_a_lonlat(*SUPUESTOS["habitat_px"])
    supuestos = {k: v for k, v in SUPUESTOS.items() if k != "habitat_px"}
    supuestos["habitat"] = {"lon": hlon, "lat": hlat}

    datos = {
        "limites": LIMITES,
        "m_por_grado": M_POR_GRADO,
        "tubos": tubos,
        "recorrido": recorrido,
        "meda": meda[-1],
        "objetivos": objetivos,
        "supuestos": supuestos,
        "imagenes": {
            "hirise": "img/hirise_three_forks.jpg",
            "contexto": "img/hirise_contexto.jpg",
            "contexto_limites": CONTEXTO,
            # Panorámicas Mastcam-Z del propio paquete PDS del depósito (browse/mosaics)
            "panoramas": [
                {"src": "img/mastcamz_sol670.jpg", "sol": "670", "hasta_sol": 670,
                 "texto": "El depósito el sol 670, con los primeros tubos ya en el suelo"},
                {"src": "img/mastcamz_sol690_692.jpg", "sol": "690–692", "hasta_sol": 690,
                 "texto": "El depósito los soles 690–692, con los 10 tubos ya en el suelo"},
                {"src": "img/mastcamz_sol693.jpg", "sol": "693", "hasta_sol": 9999,
                 "texto": "Vista final del depósito antes de que el rover se fuera (sol 693)"},
            ],
            "credito_rover": "NASA/JPL-Caltech/ASU/MSSS · Mastcam-Z (PDS Geosciences)",
        },
    }
    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(
        "// Generado por scripts/preparar_datos.py — no editar a mano.\n"
        "window.DATOS = " + json.dumps(datos, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"Listo: {SALIDA} ({len(tubos)} tubos, {len(recorrido)} puntos del rover)")


if __name__ == "__main__":
    main()
