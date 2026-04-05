"""
BioAlert Biodiversity Risk Model v3
10 features, 5000 samples, RandomForest
New features: is_invasive, sighting_trend, climate_stress, range_fragmentation
Run once: python train_model.py
"""

import time
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import warnings
warnings.filterwarnings("ignore")

def progress(step, total, msg, start_time=None):
    pct = int((step/total)*40)
    bar = "█" * pct + "░" * (40-pct)
    elapsed = time.time() - start_time if start_time else 0
    eta = (elapsed/step * (total-step)) if step > 0 else 0
    eta_str = f"ETA: {eta:.0f}s" if step < total else f"✅ Done in {elapsed:.1f}s"
    print(f"\r  [{bar}] {step}/{total} {msg:<40} {eta_str}", end="", flush=True)
    if step == total:
        print()

print("\n" + "="*58)
print("  🌿 BioAlert Biodiversity Risk Model Trainer v3")
print("="*58 + "\n")

start = time.time()
TOTAL = 6

# ── Step 1: Generate 5000 samples with 10 features ────────────────────────────
progress(0, TOTAL, "Generating dataset (10 features)...", start)
time.sleep(0.2)

np.random.seed(42)
N = 5000

# Original 6 features
iucn_scores    = np.random.choice([0,1,2,3,4,5], N, p=[0.05,0.25,0.20,0.20,0.15,0.15])
trend_scores   = np.random.choice([0,1,2], N, p=[0.35,0.35,0.30])
range_anomaly  = np.random.exponential(scale=800, size=N).clip(0, 10000)
sighting_count = np.random.exponential(scale=150, size=N).clip(1, 2000)
habitat_threat = np.random.uniform(10, 90, N)
taxon_type     = np.random.choice([1,2,3,4], N)

# NEW Feature 1: is_invasive (binary)
# Invasive species that are far outside range = much higher risk
is_invasive = np.random.choice([0, 1], N, p=[0.75, 0.25])

# NEW Feature 2: sighting_trend
# Ratio of recent sightings vs older sightings
# -1 = rapidly declining, 0 = stable, 1 = increasing
sighting_trend = np.random.uniform(-1, 1, N)
# Correlated with trend_score (declining species tend to have negative sighting trend)
sighting_trend = sighting_trend - (trend_scores - 1) * 0.4
sighting_trend = sighting_trend.clip(-1, 1)

# NEW Feature 3: climate_stress index (normalized 0-1)
# Combines temperature anomaly + precipitation deficit
temp_anomaly  = np.random.uniform(-2, 5, N)   # degrees above historical avg
precip_deficit = np.random.uniform(-0.5, 1, N) # fraction below normal
climate_stress = np.clip((temp_anomaly / 5 * 0.6 + precip_deficit * 0.4), 0, 1)

# NEW Feature 4: range_fragmentation
# Std dev of sighting locations — high = fragmented habitat
# Simulated: CR/EN species tend to have more fragmented ranges
base_frag = np.random.exponential(scale=3, size=N)
range_fragmentation = (base_frag + (iucn_scores / 5) * 4).clip(0, 15)

# ── Risk score formula (10 features, ecologically grounded) ───────────────────
risk_score = (
    iucn_scores              *  7.0 +
    trend_scores             *  8.0 +
    np.log1p(range_anomaly)  *  4.0 +
    (1 / np.log1p(sighting_count)) * 14.0 +
    habitat_threat           *  0.40 +
    taxon_type               *  0.5 +
    # NEW features with much stronger weights
    is_invasive              * 14.0 +   # invasive = big penalty
    (-sighting_trend)        * 11.0 +   # declining sightings = big risk
    climate_stress           * 15.0 +   # climate stress = big risk
    range_fragmentation      *  2.5 +   # fragmentation matters more
    # Interactions
    (iucn_scores >= 4).astype(float) * np.log1p(range_anomaly) * 1.5 +
    (is_invasive * (iucn_scores >= 3).astype(float)) * 7.0 +
    (climate_stress > 0.7).astype(float) * range_fragmentation * 2.0 +
    # Recovery bonus
    (trend_scores == 0).astype(float) * np.log1p(sighting_count) * -1.8 +
    (-sighting_trend > 0.5).astype(float) * iucn_scores * 2.0 +
    np.random.normal(0, 3, N)
).clip(0, 100)

df = pd.DataFrame({
    "iucn_score":           iucn_scores,
    "trend_score":          trend_scores,
    "range_anomaly_km":     range_anomaly,
    "sighting_count":       sighting_count,
    "habitat_threat":       habitat_threat,
    "taxon_type":           taxon_type,
    "is_invasive":          is_invasive,
    "sighting_trend":       sighting_trend,
    "climate_stress":       climate_stress,
    "range_fragmentation":  range_fragmentation,
    "risk_score":           risk_score,
})

df["range_anomaly_log"] = np.log1p(df["range_anomaly_km"])
df["sighting_density"]  = np.log1p(df["sighting_count"])

FEATURES = [
    "iucn_score",
    "trend_score",
    "range_anomaly_log",
    "sighting_density",
    "habitat_threat",
    "taxon_type",
    "is_invasive",
    "sighting_trend",
    "climate_stress",
    "range_fragmentation",
]
TARGET = "risk_score"
X = df[FEATURES]
y = df[TARGET]

progress(1, TOTAL, f"Dataset ready — {N} samples, {len(FEATURES)} features", start)

# ── Step 2: Split ──────────────────────────────────────────────────────────────
time.sleep(0.1)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
progress(2, TOTAL, f"Split — train={len(X_train)}, test={len(X_test)}", start)

# ── Step 3: Train ──────────────────────────────────────────────────────────────
time.sleep(0.1)
model = RandomForestRegressor(
    n_estimators=300,
    max_depth=12,
    min_samples_split=3,
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)
progress(3, TOTAL, "RandomForest trained (300 trees)", start)

# ── Step 4: Evaluate ───────────────────────────────────────────────────────────
time.sleep(0.1)
y_pred         = model.predict(X_test)
mae            = mean_absolute_error(y_test, y_pred)
r2             = r2_score(y_test, y_pred)
model_pred_all = np.clip(model.predict(X), 0, 100)
model_mae_all  = mean_absolute_error(y, model_pred_all)
baseline_pred  = df["iucn_score"] * 20
baseline_mae   = mean_absolute_error(df["risk_score"], baseline_pred)
improvement    = (baseline_mae - model_mae_all) / baseline_mae * 100
progress(4, TOTAL, "Evaluation + baseline computed", start)

# ── Step 5: Save ───────────────────────────────────────────────────────────────
time.sleep(0.1)
joblib.dump(model,    "risk_model.joblib")
joblib.dump(FEATURES, "feature_names.joblib")
joblib.dump({
    "features":               FEATURES,
    "uncertainty_thresholds": {"high": 8, "medium": 15},
    "baseline_mae":           float(baseline_mae),
    "model_mae":              float(model_mae_all),
    "improvement_pct":        float(improvement),
    "r2":                     float(r2),
    "n_samples":              N,
    "n_features":             len(FEATURES),
}, "model_config.joblib")
progress(5, TOTAL, "Models saved to disk", start)

# ── Step 6: Report ─────────────────────────────────────────────────────────────
time.sleep(0.1)
progress(6, TOTAL, "Complete!", start)

print(f"\n{'='*58}")
print(f"  📊 Model Performance")
print(f"{'='*58}")
print(f"  MAE  (test)  : {mae:.2f} risk points")
print(f"  R²   (test)  : {r2:.4f}")
print(f"  Samples      : {N} (80/20 split)")
print(f"  Features     : {len(FEATURES)}")

print(f"\n{'='*58}")
print(f"  📈 Baseline Comparison")
print(f"{'='*58}")
print(f"  IUCN-only MAE   : {baseline_mae:.2f}")
print(f"  Our model MAE   : {model_mae_all:.2f}")
print(f"  Improvement     : {improvement:.1f}% better than single-metric baseline")

print(f"\n{'='*58}")
print(f"  🧠 Feature Importance")
print(f"{'='*58}")
for feat, imp in sorted(zip(FEATURES, model.feature_importances_), key=lambda x: -x[1]):
    bar = "█" * int(imp * 35)
    print(f"  {feat:<25} {bar} {imp:.3f}")

print(f"\n{'='*58}")
print(f"  🔬 Sample Predictions + Uncertainty")
print(f"{'='*58}")

# [iucn, trend, range_km, sightings, habitat, taxon, invasive, sight_trend, climate, fragmentation]
test_cases = [
    {"name": "Polar Bear (CR, Kansas City)",    "f": [5, 2, 5000,  50, 45, 1, 0,  0.1, 0.8, 8.0]},
    {"name": "Beluga (VU, Arctic range)",       "f": [3, 2,  100, 200, 35, 1, 0,  0.2, 0.6, 4.0]},
    {"name": "Tiger (EN, wrong continent)",     "f": [4, 2, 8000,  30, 70, 1, 0,  0.3, 0.7, 6.0]},
    {"name": "Giant Panda (VU, recovering)",    "f": [3, 0,  200, 300, 40, 1, 0, -0.5, 0.3, 3.0]},
    {"name": "Spotted Lanternfly (invasive)",   "f": [2, 2, 2000,  80, 55, 3, 1,  0.8, 0.5, 5.0]},
    {"name": "Gorilla (CR, habitat loss)",      "f": [5, 2,  800,  25, 85, 1, 0,  0.5, 0.9, 9.0]},
    {"name": "Whooping Crane (EN, recovering)", "f": [4, 0,  300, 120, 38, 2, 0, -0.6, 0.2, 3.0]},
    {"name": "Japanese Knotweed (invasive)",    "f": [1, 2, 3000, 500, 60, 4, 1,  0.9, 0.4, 7.0]},
    {"name": "Common Sparrow (LC, stable)",     "f": [1, 1,   10, 800, 20, 2, 0, -0.1, 0.2, 1.0]},
    {"name": "House Cat (LC, increasing)",      "f": [1, 0,    5,2000, 15, 1, 0, -0.8, 0.1, 0.5]},
]

print(f"  {'Species':<38} {'Score':>6}  {'Level':<9} {'±Uncert':<10} Confidence")
print(f"  {'-'*38} {'-'*6}  {'-'*9} {'-'*10} ----------")

for case in test_cases:
    f = case["f"]
    feat_vals = [f[0], f[1], np.log1p(f[2]), np.log1p(f[3]), f[4], f[5], f[6], f[7], f[8], f[9]]
    x = pd.DataFrame([feat_vals], columns=FEATURES)
    score       = float(np.clip(model.predict(x)[0], 0, 100))
    uncertainty = float(np.std([tree.predict(x)[0] for tree in model.estimators_]))
    confidence  = "HIGH" if uncertainty < 8 else "MEDIUM" if uncertainty < 15 else "LOW"
    level       = "CRITICAL" if score > 80 else "HIGH" if score > 60 else "MEDIUM" if score > 40 else "LOW"
    print(f"  {case['name']:<38} {score:>5.0f}/100  {level:<9} ±{uncertainty:<8.1f} {confidence}")

total_time = time.time() - start
print(f"\n{'='*58}")
print(f"  ✅ Training complete in {total_time:.1f}s")
print(f"  📁 risk_model.joblib")
print(f"  📁 feature_names.joblib")
print(f"  📁 model_config.joblib")
print(f"{'='*58}\n")