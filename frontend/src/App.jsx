import { useState, useRef, useCallback, useEffect } from "react"

const API = "http://localhost:8000"

const IUCN_COLORS = {
  EX: "#000000", EW: "#542344", CR: "#cc0000",
  EN: "#cc6600", VU: "#cccc00", NT: "#a0c000",
  LC: "#4fc000", DD: "#d3d3d3", NE: "#d3d3d3",
}
const TREND_EMOJI = { Decreasing: "📉", Increasing: "📈", Stable: "➡️", Unknown: "❓" }
const STATUS_LABELS = {
  EX: "Extinct", EW: "Extinct in Wild", CR: "Critically Endangered",
  EN: "Endangered", VU: "Vulnerable", NT: "Near Threatened",
  LC: "Least Concern", DD: "Data Deficient", NE: "Not Evaluated",
}
const RISK_COLORS = { CRITICAL: "#dc2626", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#4ade80" }

// ── Action bank keyed by risk factor label ────────────────────────────────────
const FACTOR_ACTIONS = {
  "Population decline rate": [
    { icon: "🧬", text: "Support captive breeding and species recovery programs" },
    { icon: "🚫", text: "Avoid products linked to habitat destruction (palm oil, unsustainable timber)" },
    { icon: "📢", text: "Advocate for stronger wildlife protection laws in your region" },
  ],
  "Conservation status": [
    { icon: "💚", text: "Donate to species-specific conservation funds like WWF or IUCN" },
    { icon: "📜", text: "Sign petitions supporting endangered species protections" },
    { icon: "🏛️", text: "Contact your representatives to support conservation legislation" },
  ],
  "Outside natural habitat range": [
    { icon: "📍", text: "Report this sighting with exact location to iNaturalist or EDDMapS" },
    { icon: "🚫", text: "Do not relocate or transport this species further" },
    { icon: "🔬", text: "Document behavior — unusual range sightings are scientifically valuable" },
  ],
  "Invasive species status": [
    { icon: "🚫", text: "Do not transport or intentionally spread this species" },
    { icon: "🌱", text: "Replace invasive plants in your garden with native species" },
    { icon: "📱", text: "Report sightings to EDDMapS Early Detection system" },
  ],
  "Habitat stress level": [
    { icon: "🌳", text: "Support local habitat restoration and reforestation initiatives" },
    { icon: "♻️", text: "Reduce pollution and waste that degrades natural habitats" },
    { icon: "🏞️", text: "Volunteer with local conservation groups on habitat cleanup" },
  ],
  "Climate change pressure": [
    { icon: "⚡", text: "Switch to renewable energy sources at home" },
    { icon: "🚗", text: "Reduce transportation emissions — bike, carpool, or use public transit" },
    { icon: "🌍", text: "Support climate policy organizations working on habitat protection" },
  ],
  "Habitat fragmentation": [
    { icon: "🌉", text: "Support wildlife corridor initiatives that connect fragmented habitats" },
    { icon: "🏗️", text: "Advocate against development in critical habitat zones" },
    { icon: "🌻", text: "Create wildlife-friendly spaces in your yard or community" },
  ],
  "Recent sighting decline": [
    { icon: "📊", text: "Contribute observations to citizen science platforms like iNaturalist" },
    { icon: "🔭", text: "Participate in wildlife monitoring programs in your area" },
    { icon: "💰", text: "Fund field research studying this species population trends" },
  ],
  "Historical observation density": [
    { icon: "📷", text: "Document and submit wildlife photos to global biodiversity databases" },
    { icon: "🗺️", text: "Help map species distribution by reporting verified sightings" },
  ],
  "Climate stress index": [
    { icon: "🌡️", text: "Support organizations monitoring climate impacts on wildlife" },
    { icon: "♻️", text: "Reduce your carbon footprint to slow climate-driven habitat loss" },
  ],
}

const FALLBACK_ACTIONS = [
  { icon: "🔬", text: "Contribute to citizen science via iNaturalist observations" },
  { icon: "💰", text: "Donate to IUCN Save Our Species fund" },
  { icon: "📚", text: "Learn more and spread awareness about biodiversity loss" },
  { icon: "🌍", text: "Support local and global conservation organizations" },
]

function getActions(species, iucn, risk, speciesInfo) {
  const actions = []
  const seen = new Set()
  const addAction = (a) => {
    if (!seen.has(a.text)) { seen.add(a.text); actions.push(a) }
  }
  const topFactors = risk?.top_factors || []
  for (const factor of topFactors) {
    const factorActions = FACTOR_ACTIONS[factor.label] || []
    factorActions.slice(0, 2).forEach(addAction)
    if (actions.length >= 5) break
  }
  if (speciesInfo?.is_invasive) FACTOR_ACTIONS["Invasive species status"].forEach(addAction)
  if (["CR", "EN"].includes(iucn?.status)) FACTOR_ACTIONS["Conservation status"].forEach(addAction)
  if (actions.length === 0) FALLBACK_ACTIONS.forEach(addAction)
  return actions.slice(0, 5)
}

function getDonations(species, iucn) {
  const all = [
    { name: "WWF — World Wildlife Fund", url: "https://www.worldwildlife.org/", icon: "🐼", tags: ["all"] },
    { name: "IUCN Save Our Species", url: "https://www.iucn.org/our-work/topic/save-our-species", icon: "🌿", tags: ["all"] },
    { name: "Ocean Conservancy", url: "https://oceanconservancy.org/", icon: "🌊", tags: ["Mammalia", "Actinopterygii", "Animalia"] },
    { name: "Rainforest Alliance", url: "https://www.rainforest-alliance.org/", icon: "🌳", tags: ["Plantae", "Fungi"] },
    { name: "The Nature Conservancy", url: "https://www.nature.org/", icon: "🦋", tags: ["all"] },
    { name: "Defenders of Wildlife", url: "https://defenders.org/", icon: "🐺", tags: ["Mammalia", "Reptilia", "Amphibia"] },
    { name: "American Bird Conservancy", url: "https://abcbirds.org/", icon: "🦅", tags: ["Aves"] },
    { name: "Xerces Society (Invertebrates)", url: "https://xerces.org/", icon: "🦋", tags: ["Insecta", "Arachnida"] },
  ]
  const iconic = species?.iconic_taxon || ""
  return all.filter(d => d.tags.includes("all") || d.tags.includes(iconic)).slice(0, 5)
}

export default function App() {
  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)
  const fileInputRef = useRef(null)
  const [mode, setMode]               = useState(null)
  const [streaming, setStreaming]     = useState(false)
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState(null)
  const [location, setLocation]       = useState(null)
  const [preview, setPreview]         = useState(null)
  const [uploadedB64, setUploadedB64] = useState(null)
  const [showModal, setShowModal]     = useState(false)
  const [activeTab, setActiveTab]     = useState(0)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ lat: 39.0997, lng: -94.5786 })
    )
  }, [])

  const startCamera = useCallback(async () => {
    setMode("camera"); setResult(null); setPreview(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setStreaming(true)
    } catch (e) { setError("Camera access denied.") }
  }, [])

  const handleUpload = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    setMode("upload"); setResult(null); setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setPreview(dataUrl)
      setUploadedB64(dataUrl.split(",")[1])
    }
    reader.readAsDataURL(file)
  }, [])

  const analyze = useCallback(async () => {
    setLoading(true); setError(null); setResult(null); setShowModal(false)
    let imageB64 = uploadedB64
    if (mode === "camera" && videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width  = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0)
      imageB64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1]
    }
    if (!imageB64) { setError("No image to analyze."); setLoading(false); return }
    try {
      const resp = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: location?.lat ?? 39.0997, lng: location?.lng ?? -94.5786, image_b64: imageB64 }),
      })
      const data = await resp.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) { setError("Could not connect to BioAlert server. Is the backend running?") }
    setLoading(false)
  }, [mode, uploadedB64, location])

  const openModal = (tab = 0) => { setActiveTab(tab); setShowModal(true) }
  const readyToAnalyze = (mode === "camera" && streaming) || (mode === "upload" && uploadedB64)

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 520, margin: "0 auto", padding: 16, background: "#0f172a", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 24, paddingTop: 12 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#4ade80", margin: 0, letterSpacing: -1 }}>🌿 BioAlert</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "6px 0 0" }}>Explore Wildlife & Conservation</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <button onClick={startCamera} style={{ padding: "13px", fontSize: 15, fontWeight: 600, borderRadius: 10, cursor: "pointer", background: mode === "camera" ? "#166534" : "#1e293b", color: mode === "camera" ? "#fff" : "#4ade80", border: `2px solid ${mode === "camera" ? "#4ade80" : "#334155"}` }}>
          📷 Use Camera
        </button>
        <button onClick={() => fileInputRef.current.click()} style={{ padding: "13px", fontSize: 15, fontWeight: 600, borderRadius: 10, cursor: "pointer", background: mode === "upload" ? "#166534" : "#1e293b", color: mode === "upload" ? "#fff" : "#4ade80", border: `2px solid ${mode === "upload" ? "#4ade80" : "#334155"}` }}>
          🖼️ Upload Image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
      </div>

      {mode === "camera" && (
        <div style={{ background: "#000", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
          <video ref={videoRef} style={{ width: "100%", display: "block", minHeight: 260 }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      )}

      {mode === "upload" && preview && (
        <div style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", border: "2px solid #4ade80" }}>
          <img src={preview} alt="preview" style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "cover" }} />
        </div>
      )}

      {readyToAnalyze && (
        <button onClick={analyze} disabled={loading} style={{ width: "100%", padding: "15px", fontSize: 16, fontWeight: 700, background: loading ? "#334155" : "#166534", color: "#fff", border: "none", borderRadius: 10, cursor: loading ? "default" : "pointer", marginBottom: 16 }}>
          {loading ? "🔍 Identifying species..." : "🔍 Identify & Learn"}
        </button>
      )}

      {error && <div style={{ background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: 12, marginBottom: 12, color: "#fca5a5" }}>{error}</div>}
      {result && <ResultDashboard result={result} userLocation={location} onOpenModal={openModal} />}
      {showModal && result && (
        <SpeciesModal result={result} activeTab={activeTab} setActiveTab={setActiveTab} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

function ResultDashboard({ result, userLocation, onOpenModal }) {
  const { species, iucn, invasion, habitat, risk, species_info } = result
  const iucnColor = IUCN_COLORS[iucn.status] ?? "#d3d3d3"
  const riskColor = RISK_COLORS[risk?.level] ?? "#4ade80"

  useEffect(() => {
    if (!result.occurrences?.length) return
    const load = () => {
      if (window._bioMap) { window._bioMap.remove(); window._bioMap = null }
      const map = window.L.map("bioalert-map").setView([result.occurrences[0].lat, result.occurrences[0].lng], 2)
      window._bioMap = map
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map)
      result.occurrences.forEach(o => window.L.circleMarker([o.lat, o.lng], { radius: 5, fillColor: "#dc2626", color: "#dc2626", fillOpacity: 0.6, weight: 1 }).addTo(map))
      window.L.circleMarker([userLocation?.lat ?? 39.0997, userLocation?.lng ?? -94.5786], { radius: 10, fillColor: "#4ade80", color: "#166534", fillOpacity: 0.9, weight: 2 }).bindPopup("📍 Your location").openPopup().addTo(map)
    }
    if (window.L) { load(); return }
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link"); l.id = "leaflet-css"; l.rel = "stylesheet"
      l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l)
    }
    if (!document.getElementById("leaflet-js")) {
      const s = document.createElement("script"); s.id = "leaflet-js"
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = load; document.head.appendChild(s)
    }
  }, [result])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <Card color="#052e16" border="#166534">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80" }}>{species.common_name}</div>
            <div style={{ fontSize: 13, color: "#86efac", fontStyle: "italic", marginBottom: 10 }}>{species.name}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => onOpenModal(0)} style={{ fontSize: 12, fontWeight: 700, background: "#166534", color: "#4ade80", border: "1px solid #4ade80", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
                🦋 About
              </button>
              <button onClick={() => onOpenModal(1)} style={{ fontSize: 12, fontWeight: 700, background: "#1e293b", color: "#f59e0b", border: "1px solid #f59e0b", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
                ⚠️ Risk Analysis
              </button>
              <button onClick={() => onOpenModal(2)} style={{ fontSize: 12, fontWeight: 700, background: "#1e293b", color: "#60a5fa", border: "1px solid #60a5fa", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
                🌍 How to Help
              </button>
            </div>
          </div>
          {species_info?.photo_url && (
            <img src={species_info.photo_url} alt={species.common_name} onClick={() => onOpenModal(0)}
              style={{ width: 75, height: 75, borderRadius: 10, objectFit: "cover", border: "2px solid #4ade80", cursor: "pointer", flexShrink: 0 }} />
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Card color="#1e293b" border={`${riskColor}44`}>
          <Label>Risk Score</Label>
          <div style={{ fontSize: 24, fontWeight: 800, color: riskColor, marginTop: 4 }}>{risk?.score ?? "—"}</div>
          <div style={{ fontSize: 11, color: riskColor, marginTop: 2 }}>{risk?.level}</div>
        </Card>
        <Card color="#1e293b" border="#334155">
          <Label>IUCN Status</Label>
          <div style={{ fontSize: 22, fontWeight: 800, color: iucnColor, marginTop: 4 }}>{iucn.status}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{STATUS_LABELS[iucn.status]}</div>
        </Card>
        <Card color="#1e293b" border="#334155">
          <Label>Population</Label>
          <div style={{ fontSize: 22, marginTop: 4 }}>{TREND_EMOJI[iucn.trend] ?? "❓"}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", marginTop: 2 }}>{iucn.trend}</div>
        </Card>
      </div>

      <Card color={invasion.is_new_territory ? "#450a0a" : "#052e16"} border={invasion.is_new_territory ? "#dc2626" : "#166534"}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{invasion.is_new_territory ? "🚨" : "✅"}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: invasion.is_new_territory ? "#fca5a5" : "#4ade80" }}>
              {invasion.is_new_territory ? "Outside Known Range" : "Within Known Range"}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Nearest sighting: <b style={{ color: "#e2e8f0" }}>{invasion.nearest_known_km} km</b>
              {" · "}{invasion.total_known_sightings} recorded sightings
            </div>
          </div>
        </div>
      </Card>

      <Card color="#1e293b" border="#334155">
        <Label>Habitat Threat Score</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <ScoreBar score={habitat.threat_score} />
          <div style={{ minWidth: 80 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: habitat.threat_level === "HIGH" ? "#dc2626" : habitat.threat_level === "MEDIUM" ? "#f59e0b" : "#4ade80" }}>
              {habitat.threat_level}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{habitat.avg_temp_c}°C · {habitat.avg_precip_mm}mm</div>
          </div>
        </div>
      </Card>

      <Card color="#1c1917" border="#92400e">
        <Label>🤖 AI Conservation Assessment</Label>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#d6d3d1", lineHeight: 1.6 }}>{result.narrative}</p>
      </Card>

      <Card color="#1e293b" border="#334155">
        <Label>🗺️ Known Sightings Map — {result.occurrences.length} locations</Label>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, marginTop: 2 }}>🔴 Known sightings · 🟢 Your location</div>
        <div id="bioalert-map" style={{ height: 300, borderRadius: 8, overflow: "hidden" }} />
      </Card>

    </div>
  )
}

function SpeciesModal({ result, activeTab, setActiveTab, onClose }) {
  const { species, iucn, risk, species_info, species_facts = {}, fun_facts = [] } = result
  const photos    = species_info?.photos || (species_info?.photo_url ? [species_info.photo_url] : [])
  const actions   = getActions(species, iucn, risk, species_info)
  const donations = getDonations(species, iucn)
  const iucnColor = IUCN_COLORS[iucn.status] ?? "#d3d3d3"
  const riskColor = RISK_COLORS[risk?.level] ?? "#4ade80"

  const TABS = [
    { label: "🦋 About", id: 0 },
    { label: "⚠️ Risk",  id: 1 },
    { label: "🌍 Help",  id: 2 },
  ]

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f172a", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", border: "1px solid #334155", borderBottom: "none" }}>

        <div style={{ width: 40, height: 4, background: "#334155", borderRadius: 99, margin: "16px auto 0" }} />

        <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>{species.common_name}</div>
            <div style={{ fontSize: 13, color: "#86efac", fontStyle: "italic" }}>{species.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 99, width: 32, height: 32, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 20px 0" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer",
              background: activeTab === tab.id ? "#166534" : "#1e293b",
              color: activeTab === tab.id ? "#fff" : "#64748b",
              border: activeTab === tab.id ? "1px solid #4ade80" : "1px solid #334155",
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px" }}>

          {/* ── Tab 0: About ── */}
          {activeTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Hero photo */}
              {photos[0] && (
                <div style={{ borderRadius: 16, overflow: "hidden", height: 220 }}>
                  <img src={photos[0]} alt={species.common_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              {/* IUCN / Trend / Risk badges */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ background: "#1e293b", border: `1px solid ${iucnColor}`, borderRadius: 10, padding: "8px 14px", flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>IUCN</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: iucnColor }}>{iucn.status}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{STATUS_LABELS[iucn.status]}</div>
                </div>
                <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "8px 14px", flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Trend</div>
                  <div style={{ fontSize: 20 }}>{TREND_EMOJI[iucn.trend] ?? "❓"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{iucn.trend}</div>
                </div>
                <div style={{ background: "#1e293b", border: `1px solid ${riskColor}44`, borderRadius: 10, padding: "8px 14px", flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Risk</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: riskColor }}>{risk?.score}</div>
                  <div style={{ fontSize: 11, color: riskColor }}>{risk?.level}</div>
                </div>
              </div>

              {/* Species profile — Nat Geo style */}
              {Object.keys(species_facts).length > 0 && (
                <div style={{ background: "#1e293b", borderRadius: 14, overflow: "hidden", border: "1px solid #334155" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #334155" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: 1 }}>
                      🐾 Species Profile
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {[
                      ["Common Name",    species_facts.common_name],
                      ["Scientific Name", species_facts.scientific_name],
                      ["Type",           species_facts.type],
                      ["Diet",           species_facts.diet],
                      ["Group Name",     species_facts.group_name],
                      ["Lifespan",       species_facts.lifespan],
                      ["Size",           species_facts.size],
                      ["Weight",         species_facts.weight],
                      ["Habitat",        species_facts.habitat],
                      ["Range",          species_facts.range],
                    ]
                      .filter(([, val]) => val)
                      .map(([label, val], i, arr) => (
                        <div key={label} style={{
                          display: "flex",
                          flexDirection: "column",
                          padding: "10px 16px",
                          borderBottom: i < arr.length - 1 ? "1px solid #0f172a" : "none",
                          background: i % 2 === 0 ? "#1e293b" : "#162032",
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
                            {label}
                          </div>
                          <div style={{
                            fontSize: 14, color: "#e2e8f0",
                            fontWeight: label === "Scientific Name" ? 400 : 500,
                            fontStyle: label === "Scientific Name" ? "italic" : "normal",
                          }}>
                            {val}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Fun facts */}
              {fun_facts.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                    ✨ Fun Facts
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {fun_facts.map((fact, i) => (
                      <div key={i} style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid #334155" }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                          {["🌊", "🧬", "🌍", "⚡", "🦴"][i % 5]}
                        </span>
                        <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{fact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo grid */}
              {photos.length > 1 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>📸 Photos</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {photos.slice(1, 5).map((url, i) => (
                      <div key={i} style={{ borderRadius: 10, overflow: "hidden", height: 120 }}>
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learn More */}
              {species_info?.wikipedia_url && (
                <a href={species_info.wikipedia_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                  <span style={{ fontSize: 18 }}>📖</span>
                  Learn More on Wikipedia →
                </a>
              )}

            </div>
          )}

          {/* ── Tab 1: Risk Analysis ── */}
          {activeTab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div style={{ background: "#1e293b", border: `1px solid ${riskColor}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Biodiversity Risk Score</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{risk?.score}</div>
                <div style={{ fontSize: 14, color: riskColor, fontWeight: 700, marginTop: 4 }}>{risk?.level} RISK</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                  Model confidence: {risk?.confidence} · ±{risk?.uncertainty} pts uncertainty
                  {risk?.confidence === "MEDIUM" && " · Limited sightings data in this region"}
                  {risk?.confidence === "LOW" && " · Sparse data — treat score as estimate"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                  IUCN-only baseline: {risk?.baseline_score}/100 → our model: {risk?.score}/100
                </div>
              </div>

              {risk?.top_factors?.length > 0 && (
                <div style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📈 Risk Drivers Summary</div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Primary driver</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>{risk.top_factors[0]?.label}</div>
                  </div>
                  {risk.top_factors[1] && (
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Secondary driver</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", opacity: 0.7 }}>{risk.top_factors[1]?.label}</div>
                    </div>
                  )}
                </div>
              )}

              {risk?.top_factors?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>⚠️ Why this is risky</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {risk.top_factors.map((factor, i) => (
                      <div key={i} style={{ background: "#1e293b", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{factor.label}</span>
                          <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>{factor.pct}%</span>
                        </div>
                        <div style={{ background: "#0f172a", borderRadius: 99, height: 6, overflow: "hidden" }}>
                          <div style={{ width: `${factor.pct}%`, background: "#f59e0b", height: "100%", borderRadius: 99, transition: "width 0.8s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 14, border: "1px solid #334155" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🧠 Model Info</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    ["Model", "RandomForest (300 trees)"],
                    ["Training samples", "5,000"],
                    ["Features", "10 ecological signals"],
                    ["R² score", "0.90"],
                    ["Improvement over baseline", "94.3%"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{k}</span>
                      <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 2: How to Help ── */}
          {activeTab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>🌍 Actions You Can Take</div>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>Dynamically generated based on dominant risk factors</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {actions.map((action, i) => (
                    <div key={i} style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{action.icon}</span>
                      <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{action.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>💚 Support Conservation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {donations.map((org, i) => (
                    <a key={i} href={org.url} target="_blank" rel="noopener noreferrer"
                      style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", textDecoration: "none", border: "1px solid #334155" }}>
                      <span style={{ fontSize: 20 }}>{org.icon}</span>
                      <span style={{ fontSize: 13, color: "#60a5fa", fontWeight: 600 }}>{org.name}</span>
                      <span style={{ marginLeft: "auto", color: "#334155" }}>→</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}

function Card({ children, color, border }) {
  return <div style={{ background: color, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>{children}</div>
}
function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{children}</div>
}
function ScoreBar({ score }) {
  const color = score > 66 ? "#dc2626" : score > 33 ? "#f59e0b" : "#4ade80"
  return (
    <div style={{ flex: 1, background: "#334155", borderRadius: 99, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${score}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.8s ease" }} />
    </div>
  )
}