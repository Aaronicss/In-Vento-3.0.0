# Flask Backend for YOLO Detection

This Flask API backend processes images from the mobile app and runs YOLO object detection.

## Setup Instructions

1. **Install Python Dependencies**
   ```bash
   cd flask_backend
   pip install -r requirements.txt
   ```

2. **Install YOLO Model**
   - The code uses YOLOv8 by default (`yolov8n.pt`)
   - On first run, it will automatically download if not present
   - For custom trained models, update `MODEL_PATH` in `app.py`

3. **Configure Inventory Classes**
   - Update `INVENTORY_CLASSES` dictionary in `app.py` with your actual class names
   - Ensure class IDs match your trained model

4. **Run the Server**
   ```bash
   python app.py
   ```
   
   The server will run on `http://localhost:5000`

5. **For Mobile Device Testing**
   - Update `FLASK_API_URL` in `app/(tabs)/camera.tsx` to your computer's IP address
   - Example: `http://192.168.1.100:5000/api/detect`
   - Make sure your phone and computer are on the same network
   - Disable firewall or allow port 5000

## API Endpoints

### POST `/api/detect`
- Accepts multipart/form-data with 'image' field
- Returns JSON with detection results

### GET `/api/health`
- Health check endpoint
- Returns server status

## Notes

- If YOLO is not installed, the API will use mock detection for testing
- Uploaded images are saved in the `uploads/` folder
- Adjust CORS settings if needed for production
