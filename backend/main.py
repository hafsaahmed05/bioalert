from dotenv import load_dotenv
load_dotenv(dotenv_path=r"C:\Users\ahmed\source\repos\bioalert\backend\.env")

import os
import asyncio
import math
import base64
import numpy as np
import pandas as pd
import joblib
import warnings
warnings.filterwarnings("ignore")

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

INAT_TOKEN    = os.getenv("INAT_TOKEN", "")
IUCN_TOKEN    = os.getenv("IUCN_TOKEN", "")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

print("ANTHROPIC KEY LOADED:", ANTHROPIC_KEY[:20] if ANTHROPIC_KEY else "NOT FOUND")
print("INAT TOKEN LOADED:", INAT_TOKEN[:20] if INAT_TOKEN else "NOT FOUND")

# ── Load risk model ────────────────────────────────────────────────────────────
try:
    RISK_MODEL   = joblib.load("risk_model.joblib")
    FEATURES     = joblib.load("feature_names.joblib")
    MODEL_CONFIG = joblib.load("model_config.joblib")
    print(f"✅ Risk model loaded — R²={MODEL_CONFIG['r2']:.3f}, {MODEL_CONFIG['n_features']} features")
except Exception as e:
    RISK_MODEL = None
    FEATURES   = []
    MODEL_CONFIG = {}
    print(f"⚠️  Risk model not found: {e} — run train_model.py first")

app = FastAPI(title="BioAlert API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── IUCN encoding helpers ──────────────────────────────────────────────────────
IUCN_SCORE_MAP = {"CR": 5, "EN": 4, "VU": 3, "NT": 2, "LC": 1, "NE": 0, "DD": 0}
TREND_SCORE_MAP = {"Decreasing": 2, "Unknown": 1, "Stable": 1, "Increasing": 0}
TAXON_MAP = {"Mammalia": 1, "Aves": 2, "Reptilia": 3, "Amphibia": 3,
             "Actinopterygii": 3, "Insecta": 4, "Plantae": 4, "Fungi": 4}

FEATURE_LABELS = {
    "iucn_score":          "Conservation status",
    "trend_score":         "Population decline rate",
    "range_anomaly_log":   "Outside natural habitat range",
    "sighting_density":    "Historical observation density",
    "habitat_threat":      "Habitat stress level",
    "taxon_type":          "Species classification",
    "is_invasive":         "Invasive species status",
    "sighting_trend":      "Recent sighting decline",
    "climate_stress":      "Climate change pressure",
    "range_fragmentation": "Habitat fragmentation",
}

# ── 1. Species ID ──────────────────────────────────────────────────────────────
async def identify_species(image_bytes: bytes) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.inaturalist.org/v1/computervision/score_image",
            files={"image": ("photo.jpg", image_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {INAT_TOKEN}"},
        )
        print("iNat response:", resp.status_code, resp.text[:300])
        data = resp.json()
    results = data.get("results", [])
    if not results:
        return {}
    top = results[0]
    return {
        "taxon_id":    top["taxon"]["id"],
        "name":        top["taxon"]["name"],
        "common_name": top["taxon"].get("preferred_common_name", "Unknown"),
        "score":       top.get("combined_score", top.get("vision_score", 0)) / 100,
        "iconic_taxon": top["taxon"].get("iconic_taxon_name", ""),
    }

# ── 2. Wikipedia + photo ───────────────────────────────────────────────────────
async def get_species_info(taxon_id: int) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.inaturalist.org/v1/taxa/{taxon_id}",
                headers={"Authorization": f"Bearer {INAT_TOKEN}"},
            )
            data = resp.json()
        import re
        taxon   = data.get("results", [{}])[0]
        summary = taxon.get("wikipedia_summary", "") or taxon.get("description", "")
        summary = re.sub(r'<[^>]+>', '', summary)
        photo   = ""
        if taxon.get("default_photo"):
            photo = taxon["default_photo"].get("medium_url", "")
        photos = []
        for p in taxon.get("taxon_photos", [])[:4]:
            url = p.get("photo", {}).get("medium_url", "")
            if url:
                photos.append(url)
        is_invasive = bool(taxon.get("threatened", False)) or \
                      any(c.get("establishment_means") == "introduced"
                          for c in taxon.get("conservation_statuses", []))
        return {
            "wikipedia_url": taxon.get("wikipedia_url", ""),
            "summary":       summary[:800] if summary else "",
            "photo_url":     photo,
            "photos":        photos,
            "is_invasive":   is_invasive,
        }
    except Exception as e:
        print(f"Species info error: {e}")
        return {"wikipedia_url": "", "summary": "", "photo_url": "", "photos": [], "is_invasive": False}

# ── 3. IUCN lookup ────────────────────────────────────────────────────────────
IUCN_DATA = {
    "Delphinapterus leucas":   {"status": "VU", "trend": "Decreasing", "year_assessed": "2017"},
    "Panthera leo":            {"status": "VU", "trend": "Decreasing", "year_assessed": "2021"},
    "Panthera tigris":         {"status": "EN", "trend": "Stable",     "year_assessed": "2022"},
    "Ailuropoda melanoleuca":  {"status": "VU", "trend": "Increasing", "year_assessed": "2021"},
    "Rhincodon typus":         {"status": "EN", "trend": "Decreasing", "year_assessed": "2022"},
    "Chelonia mydas":          {"status": "EN", "trend": "Increasing", "year_assessed": "2020"},
    "Gorilla gorilla":         {"status": "CR", "trend": "Decreasing", "year_assessed": "2018"},
    "Pongo pygmaeus":          {"status": "CR", "trend": "Decreasing", "year_assessed": "2016"},
    "Ursus maritimus":         {"status": "VU", "trend": "Decreasing", "year_assessed": "2015"},
    "Elephas maximus":         {"status": "EN", "trend": "Decreasing", "year_assessed": "2008"},
    "Diceros bicornis":        {"status": "CR", "trend": "Increasing", "year_assessed": "2020"},
    "Spheniscus demersus":     {"status": "EN", "trend": "Decreasing", "year_assessed": "2018"},
    "Balaenoptera musculus":   {"status": "EN", "trend": "Increasing", "year_assessed": "2018"},
    "Carcharodon carcharias":  {"status": "VU", "trend": "Decreasing", "year_assessed": "2018"},
    "Lynx pardinus":           {"status": "EN", "trend": "Increasing", "year_assessed": "2015"},
    "Ara macao":               {"status": "LC", "trend": "Decreasing", "year_assessed": "2018"},
    "Panthera onca":           {"status": "NT", "trend": "Decreasing", "year_assessed": "2018"},
    "Hippocampus hippocampus": {"status": "LC", "trend": "Unknown",    "year_assessed": "2017"},
    "Aquila chrysaetos":       {"status": "LC", "trend": "Stable",     "year_assessed": "2021"},
    "Grus americana":          {"status": "EN", "trend": "Increasing", "year_assessed": "2020"},
    "Puma concolor":           {"status": "LC", "trend": "Decreasing", "year_assessed": "2015"},
    "Trichechus manatus":      {"status": "VU", "trend": "Decreasing", "year_assessed": "2015"},
    "Tursiops truncatus":      {"status": "LC", "trend": "Unknown",    "year_assessed": "2019"},
}

async def get_iucn_status(species_name: str) -> dict:
    return IUCN_DATA.get(species_name, {"status": "NE", "trend": "Unknown", "year_assessed": "N/A"})

# ── 4. GBIF occurrences ───────────────────────────────────────────────────────
async def get_gbif_occurrences(species_name: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={"scientificName": species_name, "limit": 200, "hasCoordinate": True},
        )
        data = resp.json()
    return [
        {"lat": r["decimalLatitude"], "lng": r["decimalLongitude"]}
        for r in data.get("results", [])
        if "decimalLatitude" in r and "decimalLongitude" in r
    ]

# ── 5. Invasion front detection ───────────────────────────────────────────────
def detect_invasion_front(occurrences: list[dict], user_lat: float, user_lng: float) -> dict:
    if not occurrences:
        return {"is_new_territory": False, "nearest_known_km": None,
                "total_known_sightings": 0, "range_fragmentation": 0.0}
    lats = [o["lat"] for o in occurrences]
    lngs = [o["lng"] for o in occurrences]
    mean_lat = sum(lats) / len(lats)
    mean_lng = sum(lngs) / len(lngs)
    std_lat  = (sum((l - mean_lat) ** 2 for l in lats) / len(lats)) ** 0.5
    std_lng  = (sum((l - mean_lng) ** 2 for l in lngs) / len(lngs)) ** 0.5
    is_new   = abs(user_lat - mean_lat) > 2 * std_lat or abs(user_lng - mean_lng) > 2 * std_lng
    # Range fragmentation = avg std of lat/lng (how spread out sightings are)
    range_fragmentation = float((std_lat + std_lng) / 2)

    def haversine(lat1, lng1, lat2, lng2):
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * \
            math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
        return R * 2 * math.asin(a**0.5)

    nearest_km = min(haversine(user_lat, user_lng, o["lat"], o["lng"]) for o in occurrences)
    return {
        "is_new_territory":    is_new,
        "nearest_known_km":    round(nearest_km, 1),
        "known_range_center":  {"lat": round(mean_lat, 4), "lng": round(mean_lng, 4)},
        "total_known_sightings": len(occurrences),
        "range_fragmentation": round(range_fragmentation, 2),
    }

# ── 6. Habitat score ──────────────────────────────────────────────────────────
async def get_habitat_score(lat: float, lng: float) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lng,
                    "daily": "temperature_2m_max,precipitation_sum", "forecast_days": 7},
        )
        data = resp.json()
    daily  = data.get("daily", {})
    temps  = daily.get("temperature_2m_max", [])
    precip = daily.get("precipitation_sum", [])
    avg_temp   = sum(temps)  / len(temps)  if temps  else 20
    avg_precip = sum(precip) / len(precip) if precip else 5
    threat_score  = min(100, max(0, int((avg_temp - 15) * 2 + (5 - avg_precip) * 3)))
    # Climate stress index (0-1)
    temp_anomaly   = max(0, avg_temp - 20) / 15
    precip_deficit = max(0, 5 - avg_precip) / 10
    climate_stress = float(np.clip(temp_anomaly * 0.6 + precip_deficit * 0.4, 0, 1))
    return {
        "threat_score":  threat_score,
        "threat_level":  "HIGH" if threat_score > 66 else "MEDIUM" if threat_score > 33 else "LOW",
        "avg_temp_c":    round(avg_temp, 1),
        "avg_precip_mm": round(avg_precip, 1),
        "climate_stress": climate_stress,
    }

# ── 7. Biodiversity Risk Model ────────────────────────────────────────────────
def compute_risk_score(
    iucn: dict, invasion: dict, habitat: dict,
    species_info: dict, species: dict, occurrences: list
) -> dict:
    if RISK_MODEL is None:
        return {"score": 0, "level": "UNKNOWN", "confidence": "LOW",
                "uncertainty": 0, "top_factors": [], "baseline_score": 0}

    iucn_score   = IUCN_SCORE_MAP.get(iucn.get("status", "NE"), 0)
    trend_score  = TREND_SCORE_MAP.get(iucn.get("trend", "Unknown"), 1)
    range_km     = invasion.get("nearest_known_km") or 0
    n_sightings  = max(1, invasion.get("total_known_sightings", 1))
    hab_threat   = habitat.get("threat_score", 50)
    taxon        = TAXON_MAP.get(species.get("iconic_taxon", ""), 4)
    is_invasive  = float(species_info.get("is_invasive", False))
    climate_str  = habitat.get("climate_stress", 0.3)
    range_frag   = min(15, invasion.get("range_fragmentation", 3.0))

    # Sighting trend: compare if we have enough data
    sight_trend = 0.0
    if len(occurrences) > 10:
        recent = occurrences[:len(occurrences)//2]
        older  = occurrences[len(occurrences)//2:]
        sight_trend = float(np.clip((len(recent) - len(older)) / max(1, len(older)), -1, 1))

    feat_vals = [
        iucn_score,
        trend_score,
        float(np.log1p(range_km)),
        float(np.log1p(n_sightings)),
        hab_threat,
        taxon,
        is_invasive,
        sight_trend,
        climate_str,
        range_frag,
    ]

    x = pd.DataFrame([feat_vals], columns=FEATURES)
    score       = float(np.clip(RISK_MODEL.predict(x)[0], 0, 100))
    uncertainty = float(np.std([tree.predict(x)[0] for tree in RISK_MODEL.estimators_]))
    thresholds  = MODEL_CONFIG.get("uncertainty_thresholds", {"high": 8, "medium": 15})
    confidence  = "HIGH" if uncertainty < thresholds["high"] else \
                  "MEDIUM" if uncertainty < thresholds["medium"] else "LOW"
    level       = "CRITICAL" if score > 80 else "HIGH" if score > 60 else \
                  "MEDIUM" if score > 40 else "LOW"

    # Feature importance × feature value for "why this is risky"
    importances = RISK_MODEL.feature_importances_
    raw_vals    = [
        iucn_score / 5,
        trend_score / 2,
        float(np.log1p(range_km)) / 10,
        1 / float(np.log1p(n_sightings) + 1),
        hab_threat / 100,
        taxon / 4,
        is_invasive,
        max(0, sight_trend),
        climate_str,
        range_frag / 15,
    ]
    contributions = [(FEATURE_LABELS[f], float(imp * val * 100))
                     for f, imp, val in zip(FEATURES, importances, raw_vals)]
    top_factors = sorted(contributions, key=lambda x: -x[1])[:4]
    total       = sum(c for _, c in top_factors) or 1
    top_factors = [{"label": label, "pct": round(c / total * 100)}
                   for label, c in top_factors if c > 0]

    baseline = iucn_score * 20
    return {
        "score":          round(score),
        "level":          level,
        "confidence":     confidence,
        "uncertainty":    round(uncertainty, 1),
        "top_factors":    top_factors,
        "baseline_score": baseline,
    }

# ── 8. LLM narrative ──────────────────────────────────────────────────────────
async def generate_narrative(species: dict, iucn: dict, invasion: dict,
                              habitat: dict, risk: dict) -> str:
    if not ANTHROPIC_KEY:
        return f"Identified: {species.get('common_name')}. IUCN Status: {iucn.get('status')}. Risk: {risk.get('score')}/100."
    try:
        top_factors = ", ".join(f["label"] for f in risk.get("top_factors", [])[:3])
        prompt = f"""You are a conservation educator. Write 2-3 engaging sentences explaining this species and its conservation story in plain English. Focus on why this species matters to the ecosystem, what threatens it, and one thing the reader can do to help.

Species: {species.get('common_name')} ({species.get('name')})
IUCN Status: {iucn.get('status')} | Population trend: {iucn.get('trend')}
Biodiversity Risk Score: {risk.get('score')}/100 ({risk.get('level')})
Top risk factors: {top_factors}
Habitat threat: {habitat.get('threat_level')}"""

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": "claude-sonnet-4-20250514", "max_tokens": 200,
                      "messages": [{"role": "user", "content": prompt}]},
            )
            print("Anthropic response:", resp.status_code, resp.text[:200])
            data = resp.json()
        return data["content"][0]["text"]
    except Exception as e:
        print(f"Narrative error: {e}")
        return f"Identified: {species.get('common_name')}. Risk Score: {risk.get('score')}/100. Status: {iucn.get('status')}."

# ── Main endpoint ─────────────────────────────────────────────────────────────
class SightingRequest(BaseModel):
    lat: float
    lng: float
    image_b64: str

@app.post("/analyze")
async def analyze_sighting(req: SightingRequest):
    image_bytes = base64.b64decode(req.image_b64)
    species = await identify_species(image_bytes)
    if not species:
        return {"error": "Could not identify species. Try a clearer photo."}

    iucn, occurrences, habitat, species_info = await asyncio.gather(
        get_iucn_status(species["name"]),
        get_gbif_occurrences(species["name"]),
        get_habitat_score(req.lat, req.lng),
        get_species_info(species["taxon_id"]),
    )

    invasion  = detect_invasion_front(occurrences, req.lat, req.lng)
    risk      = compute_risk_score(iucn, invasion, habitat, species_info, species, occurrences)
    narrative = await generate_narrative(species, iucn, invasion, habitat, risk)

    return {
        "species":      species,
        "iucn":         iucn,
        "invasion":     invasion,
        "habitat":      habitat,
        "species_info": species_info,
        "risk":         risk,
        "occurrences":  occurrences[:50],
        "narrative":    narrative,
    }

@app.get("/health")
def health():
    return {"status": "ok"}