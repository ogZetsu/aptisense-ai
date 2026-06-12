import requests
BASE='http://127.0.0.1:8001/api/v1'
username='testuser_history'
password='Test@1234'
res=requests.post(f'{BASE}/auth/login', json={'username': username, 'password': password})
print('login', res.status_code, res.text[:300])
if res.status_code!=200:
    raise SystemExit(1)
token=res.json()['access_token']
res2=requests.get(f'{BASE}/auth/me', headers={'Authorization': f'Bearer {token}'})
print('me', res2.status_code, res2.text)
