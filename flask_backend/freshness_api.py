"""
Flask API for Freshness Prediction
This API accepts ingredient data and returns freshness classification using a Random Forest model.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import os
import numpy as np
from typing import Dict, Any

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native app

# Model path - update this to your trained model file
MODEL_PATH = os.getenv('MODEL_PATH', 'freshness_model.pkl')

# Load the trained Random Forest model
model = None

def load_model():
    """Load the trained Random Forest model"""
    global model
    try:
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print(f"✅ Model loaded successfully from {MODEL_PATH}")
        return True
    except FileNotFoundError:
        print(f"⚠️  Model file not found at {MODEL_PATH}")
        print("⚠️  Using mock predictions for testing")
        return False
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        print("⚠️  Using mock predictions for testing")
        return False

# Load model on startup
model_loaded = load_model()

def encode_ingredient_type(ingredient_type: str) -> int:
    """
    Encode ingredient type to numeric value
    Update this mapping based on your training data
    """
    ingredient_mapping = {
        'BEEF': 0,
        'CHEESE': 1,
        'LETTUCE': 2,
        'TOMATO': 3,
        'ONION': 4,
        'BURGER BUN': 5,
        'BURGERBUN': 5,
        # Add more mappings as needed
    }
    # Normalize input (uppercase, strip spaces)
    normalized = ingredient_type.upper().strip()
    return ingredient_mapping.get(normalized, 0)  # Default to 0 if not found

def mock_predict(temperature: float, humidity: float, time_in_refrigerator: float, ingredient_type: str) -> str:
    """
    Mock prediction function for testing when model is not available
    This simulates a Random Forest classifier based on simple rules
    """
    # Simple rule-based prediction for testing
    if time_in_refrigerator > 72:  # More than 3 days
        return 'Expired'
    elif time_in_refrigerator > 48:  # More than 2 days
        return 'Stale'
    elif temperature > 10 or humidity > 80:  # High temperature or humidity
        if time_in_refrigerator > 24:
            return 'Stale'
        else:
            return 'Fresh'
    else:
        return 'Fresh'

@app.route('/')
def home():
    """Health check endpoint"""
    return jsonify({
        "message": "Freshness Prediction API is running!",
        "model_loaded": model_loaded,
        "endpoint": "/predict"
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict freshness of an ingredient
    
    Request Body (JSON):
    {
        "temperature": float,  # Temperature in Celsius
        "humidity": float,      # Humidity percentage
        "time_in_refrigerator": float,  # Time in hours
        "ingredient_type": str  # Ingredient type (e.g., "BEEF", "CHEESE")
    }
    
    Response (JSON):
    {
        "classification": "Fresh" | "Stale" | "Expired",
        "confidence": float (optional)
    }
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate required fields
        required_fields = ['temperature', 'humidity', 'time_in_refrigerator', 'ingredient_type']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                "error": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Extract features
        temperature = float(data['temperature'])
        humidity = float(data['humidity'])
        time_in_refrigerator = float(data['time_in_refrigerator'])
        ingredient_type = str(data['ingredient_type'])
        
        # Validate input ranges
        if temperature < -50 or temperature > 50:
            return jsonify({"error": "Temperature out of valid range (-50 to 50°C)"}), 400
        if humidity < 0 or humidity > 100:
            return jsonify({"error": "Humidity out of valid range (0 to 100%)"}), 400
        if time_in_refrigerator < 0:
            return jsonify({"error": "Time in refrigerator cannot be negative"}), 400
        
        # Prepare features for prediction
        if model_loaded and model is not None:
            # Use the trained model
            try:
                # Encode ingredient type
                ingredient_encoded = encode_ingredient_type(ingredient_type)
                
                # Prepare feature array
                # Adjust the order and number of features based on your model
                features = np.array([[
                    temperature,
                    humidity,
                    time_in_refrigerator,
                    ingredient_encoded
                ]])
                
                # Make prediction
                prediction = model.predict(features)[0]
                
                # Get prediction probabilities if available
                if hasattr(model, 'predict_proba'):
                    probabilities = model.predict_proba(features)[0]
                    confidence = float(max(probabilities))
                else:
                    confidence = None
                
                # Map prediction to classification
                # Adjust based on your model's output format
                if isinstance(prediction, (int, np.integer)):
                    classification_map = {0: 'Fresh', 1: 'Stale', 2: 'Expired'}
                    classification = classification_map.get(int(prediction), 'Fresh')
                else:
                    classification = str(prediction)
                
                return jsonify({
                    "classification": classification,
                    "confidence": confidence
                })
                
            except Exception as e:
                print(f"Error during prediction: {e}")
                # Fall back to mock prediction
                classification = mock_predict(temperature, humidity, time_in_refrigerator, ingredient_type)
                return jsonify({
                    "classification": classification,
                    "confidence": None,
                    "warning": "Model prediction failed, using fallback"
                })
        else:
            # Use mock prediction when model is not available
            classification = mock_predict(temperature, humidity, time_in_refrigerator, ingredient_type)
            return jsonify({
                "classification": classification,
                "confidence": None,
                "warning": "Model not loaded, using mock prediction"
            })
    except ValueError as e:
        return jsonify({"error": f"Invalid input format: {str(e)}"}), 400
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model_loaded
    })

if __name__ == '__main__':
    # For local development
    app.run(host='0.0.0.0', port=5000, debug=True)

