import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from flask import Flask, request, jsonify

app = Flask(__name__)

# Define and train a simple LSTM model for anomaly detection
def create_model():
    model = Sequential([
        LSTM(50, activation='relu', input_shape=(10, 4), return_sequences=False),  # 10 timesteps, 4 features
        Dense(1, activation='sigmoid')  # Output: anomaly probability (0-1)
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy')
    
    # Dummy training data (replace with real data in production)
    X_train = np.random.rand(100, 10, 4)  # 100 samples, 10 timesteps, 4 features (HR, SpO2, RR, Temp)
    y_train = np.random.randint(0, 2, 100)  # Binary labels (0 = normal, 1 = anomaly)
    model.fit(X_train, y_train, epochs=5, batch_size=32, verbose=0)
    return model

# Initialize the model
model = create_model()

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get vitals data from the request
        data = request.json
        heart_rate = data.get('heartRate')
        spO2 = data.get('spO2')
        respiration_rate = data.get('respirationRate')
        temperature = data.get('temperature')

        # Validate input
        if not all([heart_rate, spO2, respiration_rate, temperature]):
            return jsonify({'error': 'Missing required vitals data'}), 400

        # Prepare input for LSTM (repeat single data point to simulate 10 timesteps)
        vitals = np.array([[heart_rate, spO2, respiration_rate, temperature]])
        input_data = np.repeat(vitals, 10, axis=0).reshape(1, 10, 4)

        # Predict anomaly score
        anomaly_score = model.predict(input_data, verbose=0)[0][0]
        return jsonify({'anomalyScore': float(anomaly_score)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)