from flask import Flask, request, jsonify
from ultralytics import YOLO
import torch
import torch.nn as nn
import io
from PIL import Image
from collections import Counter

# --- Temporary fix for missing YOLO layers ---
class C3k2(nn.Module):
    def __init__(self, *args, **kwargs):
        super().__init__()
    def forward(self, x):
        return x

torch.serialization.add_safe_globals({'C3k2': C3k2})

app = Flask(__name__)

# --- Define custom classes ---
CUSTOM_CLASSES = {0: 'CheeseCake', 1: 'Cracker', 2: 'Strawberry'}

# --- Load YOLOv8 model with weights_only=False fallback ---
def load_model():
    model_path = "my_model.pt"
    try:
        model = YOLO(model_path)
    except Exception as e:
        if "weights_only=True" in str(e) or "weights only load failed" in str(e).lower():
            print("⚙️ Retrying model load with weights_only=False...")
            checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
            model = YOLO(checkpoint)
        else:
            raise e
    print("Model loaded successfully!")
    return model

model = load_model()


@app.route('/')
def home():
    return jsonify({"message": "YOLOv8 Flask API is running!"})


@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    image = Image.open(io.BytesIO(file.read()))

    # Run inference
    results = model(image)

    detections = []
    class_list = []

    for box in results[0].boxes:
        cls_id = int(box.cls)
        label = CUSTOM_CLASSES.get(cls_id, f"class_{cls_id}")
        confidence = float(box.conf)
        bbox = box.xyxy[0].tolist()

        detections.append({
            "label": label,
            "confidence": confidence,
            "bbox": bbox
        })
        class_list.append(label)

    # Count number of detections per class
    counts = dict(Counter(class_list))

    return jsonify({
        "detections": detections,
        "summary": counts
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
