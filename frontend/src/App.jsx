import { useState, useRef, useCallback, useEffect } from "react"

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
  const fileInputRef = useRef(null)
  const [mode, setMode] = useState(null) // "camera" | "upload"
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [location, setLocation] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploadedB64, setUploadedB64] = useState(null)

  // Get GPS on load
  useState(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ lat: 39.0997, lng: -94.5786 })
    )
  }, [])

  // Start webcam
  const startCamera = useCallback(async () => {
    setMode("camera")
    setResult(null)
    setPreview(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setStreaming(true)
    } catch (e) {
      setError("Camera access denied.")
    }
  }, [])

  // Handle file upload
  const handleUpload = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    setMode("upload")
    setResult(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setPreview(dataUrl)
      setUploadedB64(dataUrl.split(",")[1])
    }
    reader.readAsDataURL(file)
  }, [])

  // Analyze — works for both camera and upload
  const analyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    let imageB64 = uploadedB64

    // If camera mode, capture frame
    if (mode === "camera" && videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0)
      imageB64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1]
    }

    if (!imageB64) {
      setError("No image to analyze.")
      setLoading(false)
      return
    }

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
  }, [mode, uploadedB64, location])

  const readyToAnalyze = (mode === "camera" && streaming) || (mode === "upload" && uploadedB64)

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

      {/* Mode selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <button onClick={startCamera} style={{
          padding: "12px", fontSize: 15, fontWeight: 600, borderRadius: 10, cursor: "pointer",
          background: mode === "camera" ? "#166534" : "#f0fdf4",
          color: mode === "camera" ? "#fff" : "#166534",
          border: "2px solid #86efac",
        }}>
          📷 Use Camera
        </button>
        <button onClick={() => fileInputRef.current.click()} style={{
          padding: "12px", fontSize: 15, fontWeight: 600, borderRadius: 10, cursor: "pointer",
          background: mode === "upload" ? "#166534" : "#f0fdf4",
          color: mode === "upload" ? "#fff" : "#166534",
          border: "2px solid #86efac",
        }}>
          🖼️ Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </div>

      {/* Camera view */}
      {mode === "camera" && (
        <div style={{ position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
          <video ref={videoRef} style={{ width: "100%", display: "block", minHeight: 260 }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      )}

      {/* Upload preview */}
      {mode === "upload" && preview && (
        <div style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", border: "2px solid #86efac" }}>
          <img src={preview} alt="Upload preview" style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "cover" }} />
        </div>
      )}

      {/* Analyze button */}
      {readyToAnalyze && (
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
