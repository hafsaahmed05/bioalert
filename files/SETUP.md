# BioAlert — Setup Guide

## Project Structure
```
bioalert/
├── backend/
│   ├── main.py          ← FastAPI backend (all ML + API logic)
│   └── requirements.txt
└── frontend/
    └── src/
        └── App.jsx      ← React webcam + dashboard UI
```

## Step 1 — Get your free API keys (15 mins)

### iNaturalist (species ID)
- No key needed! Their CV API is open.

### IUCN Red List (extinction status)
- Go to: https://apiv3.iucnredlist.org/
- Click "Get a token" — free, instant
- Add to backend: set env var IUCN_TOKEN=your_token

### Anthropic (LLM narrative)
- You already have this from your bot-detector project
- Set env var: ANTHROPIC_API_KEY=your_key

### GBIF (occurrence data)
- No key needed! Open API.

### Open-Meteo (habitat/climate data)
- No key needed! Fully open.

---

## Step 2 — Run the backend

```bash
cd bioalert/backend
pip install -r requirements.txt
IUCN_TOKEN=your_token ANTHROPIC_API_KEY=your_key uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
Test it: http://localhost:8000/health

---

## Step 3 — Run the frontend

```bash
# From bioalert/frontend
npm create vite@latest . -- --template react
# Replace src/App.jsx with our file
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Step 4 — Test with a real image

1. Open http://localhost:5173
2. Click "Start Camera"
3. Allow camera + location permissions
4. Point at any plant, insect, or animal
5. Click "Analyze Sighting"
6. See the full threat dashboard appear

---

## Research Contributions (for your poster)

### ML Contribution 1 — Invasion Front Detector
- Algorithm: Statistical range anomaly detection (mean + 2σ on GBIF occurrences)
- Research Q: Does location fall outside known species range?
- Metric: % of sightings correctly flagged as new territory vs. known range

### ML Contribution 2 — Extinction Risk Tracker  
- Data: IUCN Red List API + population trend
- Research Q: What is the conservation status + trajectory of observed species?
- Metric: Status distribution across your test sightings

### ML Contribution 3 — Habitat Threat Score
- Algorithm: Climate stress heuristic (temp + precip features)
- Upgrade path: Replace with NASA NDVI satellite features for poster
- Research Q: Does habitat stress correlate with invasive species presence?
- Metric: Correlation between threat score and known invasion zones

---

## Poster Research Question
"Can a multimodal citizen science tool combining computer vision species 
identification, geospatial invasion front detection, and habitat threat 
modeling provide actionable biodiversity threat intelligence in real time — 
and does sighting location anomaly score correlate with habitat degradation?"

---

## Demo Script (for judges)
1. "Current apps like iNaturalist just tell you what something is"
2. Point camera at plant/insect → get species ID
3. "But BioAlert tells you what it MEANS"
4. Show invasion alert → "This species has never been recorded here"
5. Show IUCN status → "It's Endangered, population declining"
6. Show habitat score → "And the ecosystem it's in is under HIGH stress"
7. Show AI narrative → plain English summary
8. "We're turning every citizen into a conservation sensor"
