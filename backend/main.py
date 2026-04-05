from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import base64
import json
from typing import Optional
import os

app = FastAPI(title="BioAlert API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 1. iNaturalist species identification ──────────────────────────────────────
async def identify_species(image_bytes: bytes) -> dict:
    """Send image to iNaturalist CV API and get species suggestions."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.inaturalist.org/v1/computervision/score_image",
            files={"image": ("photo.jpg", image_bytes, "image/jpeg")},
        )
        print("iNat response:", resp.status_code, resp.text[:300])
        data = resp.json()
    results = data.get("results", [])
    if not results:
        return {}
    top = results[0]
    return {
        "taxon_id": top["taxon"]["id"],
        "name": top["taxon"]["name"],
        "common_name": top["taxon"].get("preferred_common_name", "Unknown"),
        "score": top["score"],
        "iconic_taxon": top["taxon"].get("iconic_taxon_name", ""),
    }


# ── 2. IUCN Red List threat status ─────────────────────────────────────────────
IUCN_TOKEN = os.getenv("IUCN_TOKEN", "YOUR_IUCN_TOKEN_HERE")

async def get_iucn_status(species_name: str) -> dict:
    """Fetch IUCN Red List status and population trend."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://apiv3.iucnredlist.org/api/v3/species/{species_name}",
            params={"token": IUCN_TOKEN},
        )
        data = resp.json()
    results = data.get("result", [])
    if not results:
        return {"status": "Not Evaluated", "trend": "Unknown", "category": "NE"}
    r = results[0]
    return {
        "status": r.get("category", "NE"),
        "trend": r.get("population_trend", "Unknown"),
        "year_assessed": r.get("assessment_date", "N/A"),
    }


# ── 3. GBIF occurrence data + invasion front detection ─────────────────────────
async def get_gbif_occurrences(species_name: str) -> list[dict]:
    """Get last 200 known sightings from GBIF."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={
                "scientificName": species_name,
                "limit": 200,
                "hasCoordinate": True,
            },
        )
        data = resp.json()
    return [
        {"lat": r["decimalLatitude"], "lng": r["decimalLongitude"]}
        for r in data.get("results", [])
        if "decimalLatitude" in r and "decimalLongitude" in r
    ]


def detect_invasion_front(
    occurrences: list[dict], user_lat: float, user_lng: float
) -> dict:
    """
    ML contribution #1:
    Check if user's location is outside the known range of this species.
    Uses a simple convex-hull / bounding-box approach as baseline,
    then flags anomaly if user coords fall outside + 1-std buffer.
    """
    if not occurrences:
        return {"is_new_territory": False, "nearest_known_km": None}

    import math

    lats = [o["lat"] for o in occurrences]
    lngs = [o["lng"] for o in occurrences]

    mean_lat = sum(lats) / len(lats)
    mean_lng = sum(lngs) / len(lngs)
    std_lat = (sum((l - mean_lat) ** 2 for l in lats) / len(lats)) ** 0.5
    std_lng = (sum((l - mean_lng) ** 2 for l in lngs) / len(lngs)) ** 0.5

    # Flag if user is more than 2 std deviations from known centroid
    lat_diff = abs(user_lat - mean_lat)
    lng_diff = abs(user_lng - mean_lng)
    is_new = lat_diff > 2 * std_lat or lng_diff > 2 * std_lng

    # Haversine distance to nearest known sighting
    def haversine(lat1, lng1, lat2, lng2):
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * \
            math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
        return R * 2 * math.asin(a**0.5)

    nearest_km = min(
        haversine(user_lat, user_lng, o["lat"], o["lng"]) for o in occurrences
    )

    return {
        "is_new_territory": is_new,
        "nearest_known_km": round(nearest_km, 1),
        "known_range_center": {"lat": round(mean_lat, 4), "lng": round(mean_lng, 4)},
        "total_known_sightings": len(occurrences),
    }


# ── 4. Habitat threat score from Open-Meteo + land use proxy ──────────────────
async def get_habitat_score(lat: float, lng: float) -> dict:
    """
    ML contribution #3:
    Uses Open-Meteo climate anomaly data as a proxy for habitat stress.
    In production you'd swap this for NASA NDVI satellite data.
    Returns a 0-100 habitat threat score.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lng,
                "daily": "temperature_2m_max,precipitation_sum",
                "forecast_days": 7,
            },
        )
        data = resp.json()

    daily = data.get("daily", {})
    temps = daily.get("temperature_2m_max", [])
    precip = daily.get("precipitation_sum", [])

    avg_temp = sum(temps) / len(temps) if temps else 20
    avg_precip = sum(precip) / len(precip) if precip else 5

    # Simple heuristic threat score (replace with trained model)
    # High temp + low precip = higher habitat stress
    threat_score = min(100, max(0, int((avg_temp - 15) * 2 + (5 - avg_precip) * 3)))

    return {
        "threat_score": threat_score,
        "threat_level": "HIGH" if threat_score > 66 else "MEDIUM" if threat_score > 33 else "LOW",
        "avg_temp_c": round(avg_temp, 1),
        "avg_precip_mm": round(avg_precip, 1),
    }


# ── 5. LLM threat narrative ────────────────────────────────────────────────────
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

async def generate_narrative(species: dict, iucn: dict, invasion: dict, habitat: dict) -> str:
    """Generate plain-English threat summary using Claude."""
    if not ANTHROPIC_KEY:
        return "Set ANTHROPIC_API_KEY to enable AI narrative."

    prompt = f"""You are a conservation scientist. Given this biodiversity threat data, write 2-3 sentences
in plain English for a citizen scientist explaining what they found and what it means.
Be specific, urgent where warranted, and end with one concrete action they can take.

Species: {species.get('common_name')} ({species.get('name')})
IUCN Status: {iucn.get('status')} | Population trend: {iucn.get('trend')}
New territory alert: {invasion.get('is_new_territory')} | Nearest known sighting: {invasion.get('nearest_known_km')} km away
Habitat threat level: {habitat.get('threat_level')} (score: {habitat.get('threat_score')}/100)"""

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        data = resp.json()
    return data["content"][0]["text"]


# ── Main endpoint ──────────────────────────────────────────────────────────────
class SightingRequest(BaseModel):
    lat: float
    lng: float
    image_b64: str  # base64 encoded image from webcam


@app.post("/analyze")
async def analyze_sighting(req: SightingRequest):
    image_bytes = base64.b64decode(req.image_b64)

    # Run all layers
    species = await identify_species(image_bytes)
    if not species:
        return {"error": "Could not identify species. Try a clearer photo."}

    iucn, occurrences, habitat = await asyncio.gather(
        get_iucn_status(species["name"]),
        get_gbif_occurrences(species["name"]),
        get_habitat_score(req.lat, req.lng),
    )

    invasion = detect_invasion_front(occurrences, req.lat, req.lng)
    narrative = await generate_narrative(species, iucn, invasion, habitat)

    return {
        "species": species,
        "iucn": iucn,
        "invasion": invasion,
        "habitat": habitat,
        "occurrences": occurrences[:50],  # send 50 for heatmap
        "narrative": narrative,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


import asyncio
