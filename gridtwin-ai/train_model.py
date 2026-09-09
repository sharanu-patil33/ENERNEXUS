import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

# Load the baseline "normal" data
df = pd.read_csv('baseline_data.csv')

features = df[['voltage', 'current', 'power', 'temperature']]

# contamination=0.05 means "assume ~5% of data could be weird/edge-case"
model = IsolationForest(contamination=0.05, random_state=42)
model.fit(features)

# Save the trained model to a file so app.py can load it later
joblib.dump(model, 'anomaly_model.pkl')
print("✅ Model trained and saved as anomaly_model.pkl")