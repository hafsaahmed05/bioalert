# ⚙️ Setup Guide — BioAlert

Follow these steps to run the project locally.

## 📦 Prerequisites

Make sure you have:

* **Python 3.8+**
* **Node.js (v16+)** → https://nodejs.org/
* **npm** (comes with Node)

## 📁 Project Structure

```
bioalert/
├── backend/
│   ├── main.py              # FastAPI backend (API routes)
│   ├── train_model.py       # Model training script
│   ├── evaluate_model.py    # Generates graphs + evaluation metrics
│   ├── predict.py           # Model inference logic (used by backend)
│   ├── requirements.txt
│
│   ├── models/              # Saved model artifacts
│   │   ├── risk_model.joblib
│   │   ├── feature_names.joblib
│   │   └── model_config.joblib
│
│   ├── outputs/             # Evaluation outputs (graphs)
│   │   ├── feature_importance.png
│   │   ├── correlation_matrix.png
│   │   └── risk_distribution.png
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       └── App.jsx          # React UI
│
├── README.md
└── SETUP.md
```


## 🔑 API Keys (Optional but Recommended)

### IUCN Red List

* https://apiv3.iucnredlist.org/
* Get a free token
* Set environment variable:

```bash
IUCN_TOKEN=your_token
```


### Anthropic (optional — for narrative insights)

```bash
ANTHROPIC_API_KEY=your_key
```


### Open APIs (no key required)

* iNaturalist
* GBIF
* Open-Meteo


## 🐍 Backend Setup

### 1. Navigate to backend

```bash
cd backend
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Train the model

```bash
python train_model.py
```

This generates:

* `risk_model.joblib`
* `feature_names.joblib`
* `model_config.joblib`


### 4. Run backend server

```bash
uvicorn main:app --reload
```

Backend runs at:

```
http://localhost:8000
```

Health check:

```
http://localhost:8000/health
```

---

## 💻 Frontend Setup

### 1. Navigate to frontend

```bash
cd ../frontend
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Run the app

```bash
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

## 🧪 Testing the App

1. Open http://localhost:5173
2. Upload or input a wildlife observation
3. Run analysis
4. View biodiversity risk score + insights

---

## 🧠 Research Components

### 1. Biodiversity Risk Model

* Random Forest regression model
* Combines ecological + environmental signals
* Outputs continuous risk score

### 2. Anomaly Detection

* Uses range anomaly + sightings
* Identifies out-of-distribution species observations


### 3. Environmental Stress Modeling

* Climate stress index (temperature + precipitation)
* Habitat fragmentation signal

---

## ⚠️ Notes

* Model currently uses **simulated ecological data**
* Designed for research + demonstration purposes
* Can be extended with real-world datasets (IUCN, GBIF)

---

## 🚀 Future Improvements

* Real-world dataset integration
* SHAP explainability
* Live API deployment
* Improved ecological modeling
