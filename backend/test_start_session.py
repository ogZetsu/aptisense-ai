import requests
import json

url = 'http://127.0.0.1:8000/api/v1/interview/start'
body = {
    "interview_type": "technical",
    "position": "Technical Round",
    "experience_level": "mid",
    "enable_proctoring": False
}

r = requests.post(url, json=body)
print('STATUS', r.status_code)
try:
    print(json.dumps(r.json(), indent=2))
except Exception:
    print('RESPONSE TEXT:', r.text)
