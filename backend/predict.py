# predict.py

import joblib
import pandas as pd
import numpy as np

model = joblib.load("models/risk_model.joblib")
features = joblib.load("models/feature_names.joblib")

def predict_risk(input_data):
    df = pd.DataFrame([input_data])
    df["range_anomaly_log"] = np.log1p(df["range_anomaly_km"])
    df["sighting_density"] = np.log1p(df["sighting_count"])
    return float(np.clip(model.predict(df[features])[0], 0, 100))