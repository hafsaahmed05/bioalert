# 🌿 BioAlert — Biodiversity Risk Detection System

BioAlert is a machine learning–powered web application designed to identify and assess environmental risk for wildlife species, with a focus on **endangered and vulnerable populations**.

The system analyzes ecological signals such as conservation status, habitat stress, and anomalous sightings to generate a **risk score (0–100)** and provide meaningful, real-time insights.

---

## 🎯 Research Focus

This project explores the question:

> *Can a machine learning system help identify species at ecological risk by combining conservation data, environmental stress indicators, and anomalous sightings?*

The goal is to move beyond simple species identification and instead provide **actionable biodiversity insight**, particularly for:

* endangered species
* species outside their natural range
* ecosystems under environmental stress

---

## 🧠 Model Overview

* Random Forest Regressor (300 trees)
* Trained on 5000 simulated ecological samples
* 10 engineered biodiversity features

Key signals include:

* IUCN conservation status
* population trends
* geographic range anomalies
* climate stress
* habitat fragmentation
* invasive species indicators

---

## 📊 Output

The model predicts a **risk score (0–100)**:

| Score Range | Risk Level |
| ----------- | ---------- |
| 0–40        | Low        |
| 40–60       | Medium     |
| 60–80       | High       |
| 80–100      | Critical   |

Higher scores indicate greater ecological concern or potential environmental disruption.

---

## 🌍 Application

* **Home Page:** Input or upload wildlife observations
* **Results Page:** Displays biodiversity risk score and interpretation

---

## ⚙️ Tech Stack

* React (frontend UI)
* Python + scikit-learn (ML model)
* joblib (model persistence)

---

## 🚀 Getting Started

See full setup instructions here:

👉 **[SETUP.md](./SETUP.md)**

---

## 🌱 Impact

BioAlert aims to support biodiversity awareness by:

* highlighting at-risk species
* detecting unusual ecological patterns
* encouraging more informed environmental observation

---

## 👩‍🔬 Author

Developed as a research-driven machine learning project exploring AI applications in biodiversity monitoring and conservation.

This project was built with the assistance of AI tools, including ChatGPT and Claude, which were used to support development, debugging, and design iteration.
