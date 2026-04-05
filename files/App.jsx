import { useState, useRef, useCallback } from "react"

const API = "http://localhost:8000"

const IUCN_COLORS = {
  EX: "#000000", EW: "#542344", CR: "#cc0000",
  EN: "#cc6600", VU: "#cccc00", NT: "#a0c000",
  LC: "#4fc000", DD: "#d3d3d3", NE: "#d3d3d3",
}

const TREND_EMOJI = {
  Decreasing: "📉", Increasing: "📈",
  Stable: "➡️", Unknown: "❓",
}

export default function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [location, setLocation] = useState(null)

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setStreaming(true)

      // Get GPS
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation({ lat: 39.0997, lng: -94.5786 }) // default: Kansas City
      )
    } catch (e) {
      setError("Camera access denied. Please allow camera permissions.")
    }
  }, [])

  // Capture frame and analyze
  const analyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    setLoading(true)
    setError(null)
    setResult(null)

    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0)
    const imageB64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1]

    try {
      const resp = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: location?.lat ?? 39.0997,
          lng: location?.lng ?? -94.5786,
          image_b64: imageB64,
        }),
      })
      const data = await resp.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError("Could not connect to BioAlert server. Is the backend running?")
    }
    setLoading(false)
  }, [location])

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#166534", margin: 0 }}>
          🌿 BioAlert
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "4px 0 0" }}>
          Biodiversity Threat Intelligence
        </p>
      </div>

      {/* Camera */}
      <div style={{ position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        <video
          ref={videoRef}
          style={{ width: "100%", display: "block", minHeight: 260 }}
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {!streaming && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center", background: "#111"
          }}>
            <button onClick={startCamera} style={{
              background: "#166534", color: "#fff", border: "none",
              borderRadius: 8, padding: "12px 24px", fontSize: 16, cursor: "pointer"
            }}>
              📷 Start Camera
            </button>
          </div>
        )}
      </div>

      {/* Analyze button */}
      {streaming && (
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", fontSize: 16, fontWeight: 600,
            background: loading ? "#9ca3af" : "#15803d", color: "#fff",
            border: "none", borderRadius: 10, cursor: loading ? "default" : "pointer",
            marginBottom: 16,
          }}
        >
          {loading ? "🔍 Analyzing..." : "🔬 Analyze Sighting"}
        </button>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 12, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* Results dashboard */}
      {result && <ResultDashboard result={result} />}
    </div>
  )
}

function ResultDashboard({ result }) {
  const { species, iucn, invasion, habitat, narrative } = result
  const iucnColor = IUCN_COLORS[iucn.status] ?? "#d3d3d3"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Species card */}
      <Card color="#f0fdf4" border="#86efac">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#14532d" }}>
              {species.common_name}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>
              {species.name}
            </div>
          </div>
          <div style={{ fontSize: 13, background: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: 99 }}>
            {Math.round(species.score * 100)}% match
          </div>
        </div>
      </Card>

      {/* Threat row: IUCN + Trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card color="#fff" border="#e5e7eb">
          <Label>IUCN Status</Label>
          <div style={{ fontSize: 22, fontWeight: 800, color: iucnColor }}>
            {iucn.status}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            {STATUS_LABELS[iucn.status] ?? "Not Evaluated"}
          </div>
        </Card>
        <Card color="#fff" border="#e5e7eb">
          <Label>Population Trend</Label>
          <div style={{ fontSize: 22 }}>{TREND_EMOJI[iucn.trend] ?? "❓"}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{iucn.trend}</div>
        </Card>
      </div>

      {/* Invasion front alert */}
      <Card
        color={invasion.is_new_territory ? "#fef2f2" : "#f0fdf4"}
        border={invasion.is_new_territory ? "#fca5a5" : "#86efac"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24 }}>{invasion.is_new_territory ? "🚨" : "✅"}</span>
          <div>
            <div style={{ fontWeight: 700, color: invasion.is_new_territory ? "#991b1b" : "#166534" }}>
              {invasion.is_new_territory ? "NEW TERRITORY ALERT" : "Within Known Range"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Nearest known sighting: <b>{invasion.nearest_known_km} km away</b>
              {" · "}{invasion.total_known_sightings} total recorded sightings
            </div>
          </div>
        </div>
      </Card>

      {/* Habitat threat score */}
      <Card color="#fff" border="#e5e7eb">
        <Label>Habitat Threat Score</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <ScoreBar score={habitat.threat_score} />
          <div>
            <div style={{
              fontWeight: 700, fontSize: 16,
              color: habitat.threat_level === "HIGH" ? "#dc2626" : habitat.threat_level === "MEDIUM" ? "#d97706" : "#16a34a"
            }}>
              {habitat.threat_level}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {habitat.avg_temp_c}°C · {habitat.avg_precip_mm}mm precip
            </div>
          </div>
        </div>
      </Card>

      {/* LLM Narrative */}
      <Card color="#fffbeb" border="#fcd34d">
        <Label>🤖 AI Assessment</Label>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
          {narrative}
        </p>
      </Card>

      {/* Sighting heatmap placeholder */}
      <Card color="#f0f9ff" border="#7dd3fc">
        <Label>📍 Known Sightings ({result.occurrences.length} loaded)</Label>
        <div style={{ fontSize: 12, color: "#0369a1", marginTop: 4 }}>
          Open full map to see invasion spread →
        </div>
      </Card>
    </div>
  )
}

function Card({ children, color, border }) {
  return (
    <div style={{
      background: color, border: `1px solid ${border}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>
}

function ScoreBar({ score }) {
  const color = score > 66 ? "#dc2626" : score > 33 ? "#d97706" : "#16a34a"
  return (
    <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 99, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${score}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.5s" }} />
    </div>
  )
}

const STATUS_LABELS = {
  EX: "Extinct", EW: "Extinct in Wild", CR: "Critically Endangered",
  EN: "Endangered", VU: "Vulnerable", NT: "Near Threatened",
  LC: "Least Concern", DD: "Data Deficient", NE: "Not Evaluated",
}
