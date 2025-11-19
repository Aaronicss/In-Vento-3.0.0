import requests

url = "https://freshness-api-m31w.onrender.com/predict"
data = {
    "temperature": 25.5,
    "humidity": 65.0,
    "time_in_refrigerator": 24.5,
    "ingredient_type": "BEEF"
}

response = requests.post(url, json=data)
print(response.json())