import { useState, useRef, useCallback, useEffect } from "react"

const API = "http://localhost:8000"

const IUCN_COLORS = {
  EX: "#1a1a1a", EW: "#542344", CR: "#e53e3e",
  EN: "#dd6b20", VU: "#d69e2e", NT: "#68d391",
  LC: "#38a169", DD: "#a0aec0", NE: "#a0aec0",
}
const TREND_EMOJI = { Decreasing: "↘", Increasing: "↗", Stable: "→", Unknown: "?" }
const STATUS_LABELS = {
  EX: "Extinct", EW: "Extinct in Wild", CR: "Critically Endangered",
  EN: "Endangered", VU: "Vulnerable", NT: "Near Threatened",
  LC: "Least Concern", DD: "Data Deficient", NE: "Not Evaluated",
}
const RISK_COLORS = { CRITICAL: "#e53e3e", HIGH: "#dd6b20", MEDIUM: "#3182ce", LOW: "#38a169" }

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
  const actions = [], seen = new Set()
  const addAction = (a) => { if (!seen.has(a.text)) { seen.add(a.text); actions.push(a) } }
  for (const factor of risk?.top_factors || []) {
    (FACTOR_ACTIONS[factor.label] || []).slice(0, 2).forEach(addAction)
    if (actions.length >= 5) break
  }
  if (speciesInfo?.is_invasive) FACTOR_ACTIONS["Invasive species status"].forEach(addAction)
  if (["CR", "EN"].includes(iucn?.status)) FACTOR_ACTIONS["Conservation status"].forEach(addAction)
  if (actions.length === 0) FALLBACK_ACTIONS.forEach(addAction)
  return actions.slice(0, 5)
}

function getDonations(species) {
  const all = [
    { name: "WWF — World Wildlife Fund", url: "https://www.worldwildlife.org/", icon: "🐼", tags: ["all"] },
    { name: "IUCN Save Our Species", url: "https://www.iucn.org/our-work/topic/save-our-species", icon: "🌿", tags: ["all"] },
    { name: "Ocean Conservancy", url: "https://oceanconservancy.org/", icon: "🌊", tags: ["Mammalia", "Actinopterygii", "Animalia"] },
    { name: "Rainforest Alliance", url: "https://www.rainforest-alliance.org/", icon: "🌳", tags: ["Plantae", "Fungi"] },
    { name: "The Nature Conservancy", url: "https://www.nature.org/", icon: "🦋", tags: ["all"] },
    { name: "Defenders of Wildlife", url: "https://defenders.org/", icon: "🐺", tags: ["Mammalia", "Reptilia", "Amphibia"] },
    { name: "American Bird Conservancy", url: "https://abcbirds.org/", icon: "🦅", tags: ["Aves"] },
    { name: "Xerces Society", url: "https://xerces.org/", icon: "🦋", tags: ["Insecta", "Arachnida"] },
  ]
  const iconic = species?.iconic_taxon || ""
  return all.filter(d => d.tags.includes("all") || d.tags.includes(iconic)).slice(0, 4)
}

// ── 🌿 EDGE DECOR SYSTEM (clean + intentional) ───────────────────────────────

const EdgeDecor = () => (
  <>
    {/* LEFT STRIP */}
    <div style={{
      position: "fixed",
      left: 0,
      top: 0,
      bottom: 0,
      width: 110,
      pointerEvents: "none",
      zIndex: 0,
      transform: "scale(1.25)",
      transformOrigin: "bottom left"
    }}>

      {/* hanging plant */}
      <img src="/hangingplant1.png"
        style={{
          position: "absolute",
          top: 110,
          left: 20,
          width: 130,
          transform: "scale(1.99)",
          animation: "sway 4s ease-in-out infinite",
          transformOrigin: "top center"   
        }}
      />

      <img src="/hangingplant2.png"
        style={{
          position: "absolute",
          top: 120,
          right: -800,
          width: 130,
          animation: "sway 4s ease-in-out infinite",
          transformOrigin: "top center"   
        }}
      />

      <img src="/hangingplant3.png"
        style={{
          position: "absolute",
          top: 115,
          right: -870,
          width: 130,
          transform: "scale(1.55)",
          animation: "sway 4s ease-in-out infinite",
          transformOrigin: "top center"   
        }}
      />

      {/* bottom cluster */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: 140,
        height: 120
      }}>

        {/* plant */}
        <img src="/plant2.png"
          style={{
            position: "absolute",
            bottom: 0,
            left: 10,
            width: 95,
            opacity: 0.9,
            zIndex: 1
          }}
        />

        {/* cactus */}
        <img src="/cactus.png"
          style={{
            position: "absolute",
            bottom: 0,
            left: 60,
            width: 85,
            zIndex: 2
          }}
        />

        {/* ladybug */}
        <img src="/ladybug.png"
          style={{
            position: "absolute",
            bottom: 65,
            left: 95,
            width: 40,
            zIndex: 3,
            animation: "bob 2.5s ease-in-out infinite"
          }}
        />
      </div>

    </div> {/* ✅ CLOSE LEFT STRIP */}


    {/* RIGHT STRIP */}
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: 130,
      pointerEvents: "none",
      zIndex: 0,
      transform: "scale(1.25)",
      transformOrigin: "bottom right"
    }}>

      <img src="/hangingplant2.png"
        style={{ position: "absolute", top: 0, right: 0, width: 110 }}
      />

      <img src="/bee.png"
        style={{
          position: "absolute",
          top: 230,
          right: 45,
          width: 45,
          animation: "float 3.5s ease-in-out infinite"
        }}
      />

      <img src="/frog.png"
        style={{
          position: "absolute",
          bottom: 60,
          right: 50,
          width: 85,
          animation: "bob 3s ease-in-out infinite"
        }}
      />

      <img src="/giraffe.png"
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 95
        }}
      />

      <img src="/redpanda.png"
      style={{
        position: "absolute",
        bottom: 0,
        right: 40,
        width: 140,                 // 🔥 MUCH bigger
        transform: "scale(1.2)",
        transformOrigin: "bottom right",
        zIndex: 5,                  // 🔥 above everything
        animation: "bob 3s ease-in-out infinite",
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.5))"
      }}
    />

    </div>


    {/* BOTTOM MINI SCENE */}
    <div style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%) scale(1.2)",
      width: 280,
      height: 110,
      pointerEvents: "none",
      zIndex: 0
    }}>
      <img src="/cactus2.png"
        style={{
          position: "absolute",
          bottom: 0,
          left: 105,
          width: 65,
          opacity: 0.6
        }}
      />
    </div>
  </>
)

const ResultDecor = () => (
  <>
    {/* 🌿 TOP HANGING PLANTS */}
    <img src="/hangingplant1.png"
      style={{
        position: "fixed",
        top: -5,
        left: 10,
        width: 120,
        animation: "sway 6s ease-in-out infinite",
        transformOrigin: "top center",
        transform: "scale(4.0)",
        opacity: 0.8,
        pointerEvents: "none"
      }}
    />

    <img src="/hangingplant3.png"
        style={{
          position: "fixed",
          top: -5,
          right: 120,
          width: 130,
          transform: "scale(1.55)",
          animation: "sway 4s ease-in-out infinite",
          transformOrigin: "top center"   
        }}
    />

    <img src="/hangingplant2.png"
      style={{
        position: "fixed",
        top: -5,
        right: 55,
        width: 110,
        animation: "sway 7s ease-in-out infinite",
        transformOrigin: "top center",
        opacity: 0.8,
        pointerEvents: "none"
      }}
    />

    {/* 🌿 LEFT CLUSTER */}
    <div style={{
      position: "fixed",
      left: 20,
      bottom: 0,
      width: 180,
      height: 120,
      pointerEvents: "none"
    }}>
      <img src="/plant2.png"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 90,
          zIndex: 1
        }}
      />

      <img src="/cactus.png"
        style={{
          position: "absolute",
          bottom: 20,
          left: 70,
          width: 80,
          zIndex: 2
        }}
      />

      <img src="/plant3.png"
        style={{
          position: "absolute",
          bottom: 20,
          left: 140,
          width: 80,
          zIndex: 2
        }}
      />

    </div>

    {/* 🐼 PANDA */}
    <img src="/redpanda.png"
      style={{
        position: "fixed",
        right: 30,
        bottom: 0,
        width: 130,
        animation: "bob 3s ease-in-out infinite",
        zIndex: 5,
        transform: "scale(1.1)"
      }}
    />

    {/* 🐍 SNAKE */}
    <img src="/snake.png"
      style={{
        position: "fixed",
        right: 10,
        bottom: 20,
        width: 75,
        opacity: 0.85,
        zIndex: 2,
        transform: "scale(0.8)",
        transform: "rotate(10deg)",
        animation: "bob 4s ease-in-out infinite",
        pointerEvents: "none"
      }}
    />

    <img src="/turtle.png"
      style={{
        position: "fixed",
        right: 100,
        bottom: 0,
        width: 130,
        animation: "bob 3s ease-in-out infinite",
        zIndex: 5,
        transform: "scale(1.1)"
      }}
    />

    {/* 🐝 BEE */}
    <img src="/bee.png"
      style={{
        position: "fixed",
        top: 20,
        right: 130,
        width: 30,
        opacity: 0.7,
        animation: "float 3.5s ease-in-out infinite",
        pointerEvents: "none"
      }}
    />
  </>
)

export default function App() {
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const fileInputRef  = useRef(null)
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
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => setLocation({ lat: 39.0997, lng: -94.5786 })
    )
  }, [])

  const startCamera = useCallback(async () => {
    setMode("camera"); setResult(null); setPreview(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setStreaming(true)
    } catch { setError("Camera access denied.") }
  }, [])

  const handleUpload = useCallback(e => {
    const file = e.target.files[0]
    if (!file) return
    setMode("upload"); setResult(null); setError(null)
    const reader = new FileReader()
    reader.onload = ev => { setPreview(ev.target.result); setUploadedB64(ev.target.result.split(",")[1]) }
    reader.readAsDataURL(file)
  }, [])

  const analyze = useCallback(async () => {
    setLoading(true); setError(null); setResult(null); setShowModal(false)
    let imageB64 = uploadedB64
    if (mode === "camera" && videoRef.current && canvasRef.current) {
      const c = canvasRef.current
      c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight
      c.getContext("2d").drawImage(videoRef.current, 0, 0)
      imageB64 = c.toDataURL("image/jpeg", 0.8).split(",")[1]
    }
    if (!imageB64) { setError("No image to analyze."); setLoading(false); return }
    try {
      const resp = await fetch(`${API}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: location?.lat ?? 39.0997, lng: location?.lng ?? -94.5786, image_b64: imageB64 }),
      })
      const data = await resp.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch { setError("Could not connect to BioAlert server. Is the backend running?") }
    setLoading(false)
  }, [mode, uploadedB64, location])

  const openModal = (tab = 0) => { setActiveTab(tab); setShowModal(true) }
  const readyToAnalyze = (mode === "camera" && streaming) || (mode === "upload" && uploadedB64)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chewy&family=Boogaloo&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a1f12; font-family: 'Boogaloo', sans-serif; }
        @keyframes bob   { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-14px)} }
        @keyframes sway  { 0%,100%{transform:rotate(-4deg)}   50%{transform:rotate(4deg)} }
        @keyframes float { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-18px) rotate(5deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
        .hover-lift { transition: transform 0.2s, box-shadow 0.2s; }
        .hover-lift:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(56,161,105,0.3); }
        .upload-zone { transition: all 0.2s; cursor: pointer; }
        .upload-zone:hover { border-color: #68d391 !important; background: rgba(104,211,145,0.08) !important; transform: scale(1.01); }
        .tab-btn { transition: all 0.18s; }
        .fade-in   { animation: fadeUp 0.4s ease both; }
        .fade-in-2 { animation: fadeUp 0.4s ease 0.08s both; }
        .fade-in-3 { animation: fadeUp 0.4s ease 0.16s both; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a4731; border-radius: 99px; }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 30% 10%, #1a4731 0%, #0a1f12 55%, #060f0a 100%)", zIndex: -2 }} />
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle, rgba(104,211,145,0.035) 1px, transparent 1px)", backgroundSize: "28px 28px", zIndex: -1 }} />

      {!result && <EdgeDecor />}
      {result && <ResultDecor />}

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 140px 180px", position: "relative", zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: result ? 24 : 44 }} className="fade-in">
          <h1 style={{ fontFamily: "'Chewy', cursive", fontSize: 72, fontWeight: 800, color: "#68d391", letterSpacing: -1, lineHeight: 1, marginBottom: 8 }}>
            BioAlert
          </h1>
          <p style={{ fontFamily: "'Chewy', cursive", color: "#9ae6b4", fontSize: 24, fontWeight: 600 }}>
            Snap a photo · Discover the species · Protect our world
          </p>
        </div>

        {/* ── Upload hero ── */}
        <div style={{ width: "100%", maxWidth: 560, marginBottom: 32 }} className="fade-in-2">

          {/* Mode buttons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, background: "rgba(255,255,255,0.03)", borderRadius: 18, padding: 6, border: "1px solid #1a4731" }}>
            {[["📷", "Use Camera", "camera", startCamera], ["🖼️", "Upload Photo", "upload", () => fileInputRef.current.click()]].map(([icon, label, m, action]) => (
              <button key={m} onClick={action} className="tab-btn"
                style={{ flex: 1, padding: "13px", fontSize: 16, fontWeight: 600, borderRadius: 14, cursor: "pointer", fontFamily: "'Boogaloo', sans-serif", border: "none",
                  background: mode === m ? "linear-gradient(135deg, #38a169, #276749)" : "transparent",
                  color: mode === m ? "#fff" : "#68d391",
                  boxShadow: mode === m ? "0 4px 16px rgba(56,161,105,0.35)" : "none",
                }}>
                {icon} {label}
              </button>
            ))}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
          </div>

          {mode === "camera" && (
            <div style={{ borderRadius: 20, overflow: "hidden", border: "2px solid #2d6a4f", marginBottom: 14, background: "#000" }}>
              <video ref={videoRef} style={{ width: "100%", display: "block", maxHeight: 360 }} playsInline muted />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          )}

          {mode === "upload" && preview && (
            <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 14, border: "2px solid #68d391", boxShadow: "0 0 0 5px rgba(104,211,145,0.1)" }}>
              <img src={preview} alt="preview" style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover" }} />
            </div>
          )}

          {!mode && (
            <div className="upload-zone" onClick={() => fileInputRef.current.click()}
              style={{ border: "2px dashed #2d6a4f", borderRadius: 20, padding: "52px 24px", textAlign: "center", background: "rgba(45,106,79,0.05)", marginBottom: 14 }}>
              <img src="/turtle.png" alt="" style={{ width: 72, marginBottom: 14, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))", animation: "bob 3s ease-in-out infinite" }} />
              <div style={{ fontFamily: "'Chewy', cursive", fontSize: 26, fontWeight: 700, color: "#68d391", marginBottom: 6 }}>Drop a photo or click to upload</div>
              <div style={{ fontSize: 15, color: "#4a9c6d", fontWeight: 500 }}>Works with any animal, plant, or fungi — even rare species</div>
            </div>
          )}

          {readyToAnalyze && (
            <button className="hover-lift" onClick={analyze} disabled={loading}
              style={{ width: "100%", padding: "17px", fontSize: 18, fontWeight: 700, fontFamily: "'Boogaloo', sans-serif",
                background: loading ? "#1a4731" : "linear-gradient(135deg, #38a169 0%, #276749 100%)",
                color: "#fff", border: "none", borderRadius: 16, cursor: loading ? "default" : "pointer",
                boxShadow: loading ? "none" : "0 6px 24px rgba(56,161,105,0.4)",
              }}>
              {loading
                ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
                    Identifying species...
                  </span>
                : "Identify & Learn"}
            </button>
          )}

          {error && (
            <div style={{ background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.4)", borderRadius: 12, padding: "12px 16px", marginTop: 12, color: "#fc8181", fontSize: 15, fontWeight: 500 }}>
              {error}
            </div>
          )}
        </div>

        {result && <ResultDashboard result={result} userLocation={location} onOpenModal={openModal} />}
      </div>

      {showModal && result && (
        <SpeciesModal result={result} activeTab={activeTab} setActiveTab={setActiveTab} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

function ResultDashboard({ result, userLocation, onOpenModal }) {
  const { species, iucn, invasion, habitat, risk, species_info } = result
  const iucnColor = IUCN_COLORS[iucn.status] ?? "#a0aec0"
  const riskColor = RISK_COLORS[risk?.level] ?? "#38a169"

  useEffect(() => {
    if (!result.occurrences?.length) return
    const load = () => {
      if (window._bioMap) { window._bioMap.remove(); window._bioMap = null }
      const map = window.L.map("bioalert-map").setView([result.occurrences[0].lat, result.occurrences[0].lng], 2)
      window._bioMap = map
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map)
      result.occurrences.forEach(o => window.L.circleMarker([o.lat, o.lng], { radius: 5, fillColor: "#e53e3e", color: "#e53e3e", fillOpacity: 0.6, weight: 1 }).addTo(map))
      window.L.circleMarker([userLocation?.lat ?? 39.0997, userLocation?.lng ?? -94.5786], { radius: 10, fillColor: "#68d391", color: "#276749", fillOpacity: 0.9, weight: 2 }).bindPopup("Your location").openPopup().addTo(map)
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

  const SLabel = ({ children }) => (
    <div style={{ fontFamily: "'Chewy', cursive", fontSize: 16, fontWeight: 700, color: "#4a9c6d", marginBottom: 6, letterSpacing: 0.3 }}>{children}</div>
  )

  return (
    <div style={{ width: "100%", maxWidth: 1120, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Species hero */}
      <div className="fade-in" style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.35), rgba(15,40,25,0.7))", border: "1px solid #2d6a4f", borderRadius: 24, padding: "22px 26px", display: "flex", alignItems: "center", gap: 22 }}>
        {species_info?.photo_url && (
          <img src={species_info.photo_url} alt={species.common_name}
            style={{ width: 100, height: 100, borderRadius: 16, objectFit: "cover", border: "3px solid #68d391", flexShrink: 0, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Chewy', cursive", fontSize: 36, fontWeight: 800, color: "#68d391", lineHeight: 1.1 }}>{species.common_name}</div>
          <div style={{ fontSize: 15, color: "#9ae6b4", fontStyle: "italic", marginBottom: 14, fontWeight: 400 }}>{species.name}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "About",       tab: 0, bg: "linear-gradient(135deg,#38a169,#276749)", color: "#fff",    border: "none" },
              { label: "Risk Analysis", tab: 1, bg: "transparent", color: "#dd6b20", border: "1.5px solid #dd6b20" },
              { label: "How to Help",   tab: 2, bg: "transparent", color: "#63b3ed", border: "1.5px solid #3182ce" },
            ].map(({ label, tab, bg, color, border }) => (
              <button key={tab} className="hover-lift tab-btn" onClick={() => onOpenModal(tab)}
                style={{ fontFamily: "'Boogaloo', sans-serif", fontSize: 14, fontWeight: 600, background: bg, color, border, borderRadius: 99, padding: "8px 22px", cursor: "pointer",
                  boxShadow: tab === 0 ? "0 4px 12px rgba(56,161,105,0.3)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {species.id_source && (
          <div style={{ fontFamily: "'Chewy', cursive", fontSize: 14, fontWeight: 600, color: "#4a9c6d", background: "rgba(104,211,145,0.08)", border: "1px solid #1a4731", borderRadius: 99, padding: "5px 14px", flexShrink: 0, alignSelf: "flex-start" }}>
            via {species.id_source}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="fade-in-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Risk Score",  value: risk?.score ?? "—", sub: risk?.level, color: riskColor },
          { label: "IUCN Status", value: iucn.status,        sub: STATUS_LABELS[iucn.status], color: iucnColor },
          { label: "Population",  value: TREND_EMOJI[iucn.trend] ?? "?", sub: iucn.trend, color: "#9ae6b4" },
          { label: "Sightings",   value: invasion.total_known_sightings,
            sub: invasion.is_new_territory ? "Outside range" : "Within range",
            color: invasion.is_new_territory ? "#e53e3e" : "#38a169" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(104,211,145,0.12)", borderRadius: 18, padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Chewy', cursive", fontSize: 16, fontWeight: 700, color: "#4a9c6d", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, color: "#4a9c6d", marginTop: 5, fontWeight: 500 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Bottom row */}
      <div className="fade-in-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(104,211,145,0.12)", borderRadius: 18, padding: "18px 20px" }}>
            <SLabel>Habitat Threat</SLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${habitat.threat_score}%`, height: "100%", borderRadius: 99, transition: "width 1s ease",
                  background: habitat.threat_score > 66 ? "#e53e3e" : habitat.threat_score > 33 ? "#dd6b20" : "#38a169" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 52, color: habitat.threat_level === "HIGH" ? "#e53e3e" : habitat.threat_level === "MEDIUM" ? "#dd6b20" : "#38a169" }}>
                {habitat.threat_level}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#4a9c6d", marginTop: 8, fontWeight: 500 }}>{habitat.avg_temp_c}°C · {habitat.avg_precip_mm}mm precipitation</div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(104,211,145,0.12)", borderRadius: 18, padding: "18px 20px", flex: 1 }}>
            <SLabel>AI Assessment</SLabel>
            <p style={{ fontSize: 14, color: "#9ae6b4", lineHeight: 1.75, fontWeight: 400 }}>{result.narrative}</p>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(104,211,145,0.12)", borderRadius: 18, padding: "18px 20px", display: "flex", flexDirection: "column" }}>
          <SLabel>Known Sightings — {result.occurrences.length} locations</SLabel>
          <div style={{ fontSize: 12, color: "#2d6a4f", marginBottom: 10, fontWeight: 500 }}>Red = known sightings · Green = your location</div>
          <div id="bioalert-map" style={{ flex: 1, minHeight: 260, borderRadius: 14, overflow: "hidden" }} />
        </div>
      </div>
    </div>
  )
}

function SpeciesModal({ result, activeTab, setActiveTab, onClose }) {
  const { species, iucn, risk, species_info, species_facts = {}, fun_facts = [] } = result
  const photos    = species_info?.photos || (species_info?.photo_url ? [species_info.photo_url] : [])
  const actions   = getActions(species, iucn, risk, species_info)
  const donations = getDonations(species)
  const iucnColor = IUCN_COLORS[iucn.status] ?? "#a0aec0"
  const riskColor = RISK_COLORS[risk?.level] ?? "#38a169"

  const SLabel = ({ children }) => (
    <div style={{ fontFamily: "'Chewy', cursive", fontSize: 16, fontWeight: 700, color: "#4a9c6d", marginBottom: 8, letterSpacing: 0.3 }}>{children}</div>
  )

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "linear-gradient(160deg, #111f16, #0a1f12)", borderRadius: 28, width: "100%", maxWidth: 820, maxHeight: "90vh", overflowY: "auto", border: "1px solid #2d6a4f", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "popIn 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}>

        {/* Side critters in modal */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, pointerEvents: "none" }}>
          <img src="/snake.png"   alt="" style={{ position: "absolute", right: -20, top: 60,  width: 70, transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))", animation: "bob 3s ease-in-out infinite" }} />
          <img src="/frog.png"    alt="" style={{ position: "absolute", left: -20,  top: 80,  width: 65, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))", animation: "bob 3.5s ease-in-out infinite 0.5s" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "26px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Chewy', cursive", fontSize: 34, fontWeight: 800, color: "#68d391" }}>{species.common_name}</div>
            <div style={{ fontSize: 14, color: "#9ae6b4", fontStyle: "italic", fontWeight: 400 }}>{species.name}</div>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2d6a4f", color: "#68d391", borderRadius: 99, width: 38, height: 38, fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: "'Boogaloo', sans-serif" }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, padding: "18px 28px 0" }}>
          {[{ label: "About", id: 0 }, { label: "Risk", id: 1 }, { label: "How to Help", id: 2 }].map(tab => (
            <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, padding: "11px 0", fontFamily: "'Boogaloo', sans-serif", fontSize: 15, fontWeight: 600, borderRadius: 14, cursor: "pointer",
                background: activeTab === tab.id ? "linear-gradient(135deg,#38a169,#276749)" : "rgba(255,255,255,0.03)",
                color: activeTab === tab.id ? "#fff" : "#4a9c6d",
                border: activeTab === tab.id ? "none" : "1px solid #1a4731",
                boxShadow: activeTab === tab.id ? "0 4px 14px rgba(56,161,105,0.3)" : "none",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "22px 28px 28px" }}>

          {/* ── Tab 0: About ── */}
          {activeTab === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {photos[0] && (
                  <div style={{ borderRadius: 18, overflow: "hidden", height: 230 }}>
                    <img src={photos[0]} alt={species.common_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { label: "IUCN", value: iucn.status, sub: STATUS_LABELS[iucn.status], color: iucnColor },
                    { label: "Trend", value: TREND_EMOJI[iucn.trend] ?? "?", sub: iucn.trend, color: "#9ae6b4" },
                    { label: "Risk", value: risk?.score, sub: risk?.level, color: riskColor },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${color}40`, borderRadius: 14, padding: "10px", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Chewy', cursive", fontSize: 14, color: "#4a9c6d", fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
                      <div style={{ fontSize: 11, color: "#4a9c6d", marginTop: 2, fontWeight: 500 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                {photos.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {photos.slice(1, 5).map((url, i) => (
                      <div key={i} style={{ borderRadius: 12, overflow: "hidden", height: 96 }}>
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {Object.keys(species_facts).length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a4731", borderRadius: 18, overflow: "hidden", flex: 1 }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a4731", background: "rgba(104,211,145,0.05)" }}>
                      <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, fontWeight: 700, color: "#68d391" }}>Species Profile</div>
                    </div>
                    {[
                      ["Common Name",     species_facts.common_name],
                      ["Scientific Name", species_facts.scientific_name],
                      ["Type",            species_facts.type],
                      ["Diet",            species_facts.diet],
                      ["Group Name",      species_facts.group_name],
                      ["Lifespan",        species_facts.lifespan],
                      ["Size",            species_facts.size],
                      ["Weight",          species_facts.weight],
                      ["Habitat",         species_facts.habitat],
                      ["Range",           species_facts.range],
                    ].filter(([, v]) => v).map(([label, val], i, arr) => (
                      <div key={label} style={{ padding: "9px 16px", borderBottom: i < arr.length - 1 ? "1px solid #0a1f12" : "none", background: i % 2 === 0 ? "transparent" : "rgba(104,211,145,0.02)" }}>
                        <div style={{ fontFamily: "'Chewy', cursive", fontSize: 13, fontWeight: 700, color: "#4a9c6d", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, color: "#c6f6d5", fontWeight: 500, fontStyle: label === "Scientific Name" ? "italic" : "normal" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                )}

                {fun_facts.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, fontWeight: 700, color: "#68d391", marginBottom: 10 }}>Fun Facts</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {fun_facts.map((fact, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a4731", borderRadius: 12, padding: "11px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <img src={["/bee.png","/frog.png","/turtle.png","/ladybug.png","/snake.png"][i % 5]} alt="" style={{ width: 28, flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
                          <span style={{ fontSize: 13, color: "#9ae6b4", lineHeight: 1.6, fontWeight: 400 }}>{fact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {species_info?.wikipedia_url && (
                  <a href={species_info.wikipedia_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid #1a4731", color: "#68d391", borderRadius: 14, padding: "13px", fontSize: 15, fontWeight: 600, textDecoration: "none", fontFamily: "'Boogaloo', sans-serif" }}>
                    Learn More on Wikipedia →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 1: Risk ── */}
          {activeTab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: `linear-gradient(135deg,${riskColor}14,${riskColor}06)`, border: `1px solid ${riskColor}40`, borderRadius: 20, padding: "24px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, color: "#4a9c6d", fontWeight: 700, marginBottom: 8 }}>Biodiversity Risk Score</div>
                <div style={{ fontSize: 76, fontWeight: 700, color: riskColor, lineHeight: 1 }}>{risk?.score}</div>
                <div style={{ fontSize: 18, color: riskColor, fontWeight: 600, marginTop: 6, fontFamily: "'Boogaloo', sans-serif" }}>{risk?.level} RISK</div>
                <div style={{ fontSize: 13, color: "#4a9c6d", marginTop: 10, fontWeight: 500 }}>
                  Confidence: {risk?.confidence} · ±{risk?.uncertainty} pts · IUCN baseline: {risk?.baseline_score}/100
                </div>
              </div>

              {risk?.top_factors?.length > 0 && <>
                <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, fontWeight: 700, color: "#dd6b20" }}>Risk Drivers</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {risk.top_factors.map((factor, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a4731", borderRadius: 14, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: "#c6f6d5", fontWeight: 600, flex: 1, paddingRight: 8 }}>{factor.label}</span>
                        <span style={{ fontSize: 14, color: "#dd6b20", fontWeight: 700 }}>{factor.pct}%</span>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${factor.pct}%`, background: "linear-gradient(90deg,#dd6b20,#e53e3e)", height: "100%", borderRadius: 99, transition: "width 0.8s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>}

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a4731", borderRadius: 16, padding: 18 }}>
                <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, fontWeight: 700, color: "#4a9c6d", marginBottom: 14 }}>Model Info</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["Model","RandomForest (300 trees)"],["Training samples","5,000"],["Features","10 ecological signals"],["R² score","0.90"],["Improvement vs baseline","94.3%"]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'Chewy', cursive", fontSize: 13, color: "#4a9c6d", fontWeight: 700 }}>{k}</div>
                      <div style={{ fontSize: 13, color: "#c6f6d5", fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 2: Help ── */}
          {activeTab === 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, fontWeight: 700, color: "#63b3ed", marginBottom: 12 }}>Actions You Can Take</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {actions.map((action, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a4731", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{action.icon}</span>
                      <span style={{ fontSize: 13, color: "#9ae6b4", lineHeight: 1.5, fontWeight: 400 }}>{action.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Chewy', cursive", fontSize: 18, fontWeight: 700, color: "#63b3ed", marginBottom: 12 }}>Support Conservation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {donations.map((org, i) => (
                    <a key={i} href={org.url} target="_blank" rel="noopener noreferrer"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a4731", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", textDecoration: "none" }}>
                      <span style={{ fontSize: 20 }}>{org.icon}</span>
                      <span style={{ fontSize: 13, color: "#63b3ed", fontWeight: 600 }}>{org.name}</span>
                      <span style={{ marginLeft: "auto", color: "#2d6a4f" }}>→</span>
                    </a>
                  ))}
                </div>
                {/* Cute animal at bottom of help tab */}
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <img src="/redpanda.png" alt="" style={{ width: 90, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))", animation: "bob 3s ease-in-out infinite" }} />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}