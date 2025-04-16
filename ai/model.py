import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from flask import Flask, request, jsonify

app = Flask(__name__)

def create_model():
    model = Sequential([
        LSTM(128, activation='relu', input_shape=(20, 4), return_sequences=True),
        BatchNormalization(),
        Dropout(0.3),
        LSTM(64, activation='relu', return_sequences=False),
        BatchNormalization(),
        Dropout(0.3),
        Dense(32, activation='relu'),
        Dense(1, activation='sigmoid')
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    
    # Dummy training data (replace with real data)
    X_train = np.random.rand(1000, 20, 4)  # 1000 samples, 20 timesteps, 4 features
    y_train = np.random.randint(0, 2, 1000)  # Binary labels
    model.fit(X_train, y_train, epochs=15, batch_size=32, verbose=0)
    return model

model = create_model()

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        required_fields = ['heartRate', 'spO2', 'respirationRate', 'temperature']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required vitals data'}), 400

        # Safely convert all values to floats, handling strings
        try:
            heart_rate = float(str(data['heartRate']).strip())
            spO2 = float(str(data['spO2']).strip())
            respiration_rate = float(str(data['respirationRate']).strip())
            temperature = float(str(data['temperature']).strip())
        except (ValueError, KeyError) as e:
            return jsonify({'error': f'Invalid numeric value: {str(e)}'}), 400

        # Prepare input (simulate 20 timesteps with recent data)
        vitals = np.array([[heart_rate, spO2, respiration_rate, temperature]])
        input_data = np.repeat(vitals, 20, axis=0).reshape(1, 20, 4)

        # Predict anomaly score
        anomaly_score = model.predict(input_data, verbose=0)[0][0]
        prediction = 'Critical' if anomaly_score > 0.7 else 'Normal'

        return jsonify({
            'anomalyScore': float(anomaly_score),
            'prediction': prediction
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)