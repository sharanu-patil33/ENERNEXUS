from flask import Flask, request, jsonify
import joblib
import numpy as np
from collections import deque

app = Flask(__name__)

# Load the trained anomaly-detection model once, when the server starts
model = joblib.load('anomaly_model.pkl')
print("✅ Real AI model loaded")

# Keep the last 30 solar readings in memory for simple trend-based forecasting
solar_history = deque(maxlen=30)


@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    print("📩 Received reading:", data)

    features = np.array([[
        data.get('voltage', 230),
        data.get('current', 2.2),
        data.get('power', 500),
        data.get('temperature', 28)
    ]])

    raw_score = model.decision_function(features)[0]
    is_anomaly = model.predict(features)[0] == -1

    normalized_score = round(float(1 / (1 + np.exp(raw_score * 10))), 2)

    result = {
        "anomaly": bool(is_anomaly),
        "score": normalized_score
    }
    print("📤 Sending result:", result)
    return jsonify(result)


@app.route('/log_solar', methods=['POST'])
def log_solar():
    data = request.get_json()
    solar_history.append(data.get('solarVoltage', 0))
    return jsonify({"logged": True, "count": len(solar_history)})


@app.route('/forecast_solar', methods=['GET'])
def forecast_solar():
    if len(solar_history) < 3:
        return jsonify({"predicted_30min": None, "predicted_2hr": None, "note": "not enough data yet"})

    # Simple moving average forecast — honest, explainable, appropriate for this data scale
    recent = list(solar_history)[-10:]
    avg = sum(recent) / len(recent)

    half = len(recent) // 2
    trend = (sum(recent[half:]) / len(recent[half:])) - (sum(recent[:half]) / len(recent[:half]))

    predicted_30min = round(avg + trend * 2, 2)
    predicted_2hr = round(avg + trend * 5, 2)

    return jsonify({
        "predicted_30min": max(0, predicted_30min),
        "predicted_2hr": max(0, predicted_2hr)
    })


if __name__ == '__main__':
    app.run(port=6000, debug=True)  