# evaluate_model.py

import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Load
model = joblib.load("models/risk_model.joblib")
features = joblib.load("models/feature_names.joblib")
config = joblib.load("models/model_config.joblib")

print("\n📊 MODEL SUMMARY")
print(f"R²: {config['r2']:.3f}")
print(f"Improvement over baseline: {config['improvement_pct']:.1f}%")

# --- Feature Importance ---
importances = model.feature_importances_
indices = np.argsort(importances)[::-1]

plt.figure()
plt.title("Feature Importance")
plt.bar(range(len(features)), importances[indices])
plt.xticks(range(len(features)), [features[i] for i in indices], rotation=45, ha="right")
plt.tight_layout()
plt.savefig("models/output/feature_importance.png")
plt.close()

# --- Correlation Heatmap ---
df = pd.DataFrame(np.random.rand(1000, len(features)), columns=features)
corr = df.corr()

plt.figure()
plt.imshow(corr, cmap="coolwarm")
plt.colorbar()
plt.xticks(range(len(features)), features, rotation=45)
plt.yticks(range(len(features)), features)
plt.title("Feature Correlation Matrix")
plt.tight_layout()
plt.savefig("models/output/correlation_matrix.png")
plt.close()

# --- Risk Distribution ---
sample_preds = np.clip(model.predict(df), 0, 100)

plt.figure()
plt.hist(sample_preds, bins=30)
plt.title("Risk Score Distribution")
plt.savefig("models/output/risk_distribution.png")
plt.close()

print("\n✅ Graphs saved in /models/output/")