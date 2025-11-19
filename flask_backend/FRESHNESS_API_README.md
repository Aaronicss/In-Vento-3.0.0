# Freshness Prediction API

This Flask API provides freshness prediction for ingredients using a trained Random Forest classifier model.

## Setup

### 1. Install Dependencies

```bash
cd flask_backend
pip install -r freshness_requirements.txt
```

### 2. Prepare Your Model

1. Train your Random Forest classifier model using scikit-learn
2. Save the model using pickle:
   ```python
   import pickle
   with open('freshness_model.pkl', 'wb') as f:
       pickle.dump(model, f)
   ```
3. Place the model file (`freshness_model.pkl`) in the `flask_backend` directory

### 3. Update Model Configuration

Edit `freshness_api.py` and update:
- `MODEL_PATH`: Path to your trained model file
- `encode_ingredient_type()`: Mapping of ingredient types to numeric values (must match training data)
- Feature order in the prediction function (must match training data)

### 4. Run Locally

```bash
python freshness_api.py
```

The API will run on `http://localhost:5000`

## API Endpoints

### POST `/predict`

Predicts freshness of an ingredient.

**Request Body:**
```json
{
    "temperature": 25.5,
    "humidity": 65.0,
    "time_in_refrigerator": 24.5,
    "ingredient_type": "BEEF"
}
```

**Response:**
```json
{
    "classification": "Fresh",
    "confidence": 0.95
}
```

### GET `/health`

Health check endpoint.

**Response:**
```json
{
    "status": "healthy",
    "model_loaded": true
}
```

## Deployment on Render

### 1. Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository and branch

### 2. Configure Build Settings

- **Name**: `freshness-api` (or your preferred name)
- **Environment**: `Python 3`
- **Build Command**: `pip install -r flask_backend/freshness_requirements.txt`
- **Start Command**: `cd flask_backend && gunicorn freshness_api:app --bind 0.0.0.0:$PORT`

### 3. Set Environment Variables

- `MODEL_PATH`: Path to your model file (e.g., `freshness_model.pkl`)
- `PORT`: Render will set this automatically

### 4. Upload Model File

You have two options:

**Option A: Include model in repository** (not recommended for large files)
- Add `freshness_model.pkl` to your repository
- Update `.gitignore` to allow it (if needed)

**Option B: Use Render's file system** (recommended)
- Upload the model file through Render's file system
- Update `MODEL_PATH` environment variable to point to the uploaded file

### 5. Deploy

Click "Create Web Service" and wait for deployment to complete.

Your API will be available at: `https://freshness-api.onrender.com`

## Testing

### Test with cURL

```bash
curl -X POST https://freshness-api.onrender.com/predict \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "humidity": 65.0,
    "time_in_refrigerator": 24.5,
    "ingredient_type": "BEEF"
  }'
```

### Test with Python

```python
import requests

url = "https://freshness-api.onrender.com/predict"
data = {
    "temperature": 25.5,
    "humidity": 65.0,
    "time_in_refrigerator": 24.5,
    "ingredient_type": "BEEF"
}

response = requests.post(url, json=data)
print(response.json())
```

## Notes

- If the model file is not found, the API will use mock predictions for testing
- Update the `encode_ingredient_type()` function to match your training data
- Ensure the feature order matches your training data
- For production, consider adding authentication and rate limiting

