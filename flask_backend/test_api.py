import requests

url = "http://127.0.0.1:5000/predict"
file_path = "test.jpg"

with open(file_path, "rb") as f:
    response = requests.post(url, files={"image": f})

print(response.json())