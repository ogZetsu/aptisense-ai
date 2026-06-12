import time
import requests
BASE='http://127.0.0.1:8001/api/v1'
username='testuser_history'
password='Test@1234'
print('signup/login...')
res=requests.post(f'{BASE}/auth/signup', json={'username': username, 'password': password})
print('signup', res.status_code, res.text[:300])
if res.status_code == 400:
    print('user exists, logging in')
    res = requests.post(f'{BASE}/auth/login', json={'username': username, 'password': password})
    print('login', res.status_code, res.text[:300])
if res.status_code != 200:
    raise SystemExit('auth failed')
user = res.json()['user']
token = res.json()['access_token']
headers={'Authorization': f'Bearer {token}'}
print('user_id', user['user_id'])
print('start interview...')
res = requests.post(f'{BASE}/interview/start', json={'interview_type': 'hr', 'position': 'HR Test', 'experience_level': 'mid', 'enable_proctoring': False}, headers=headers)
print('start', res.status_code, res.text[:300])
if res.status_code != 200:
    raise SystemExit('start failed')
session = res.json()
session_id = session['session_id']
question_id = session['first_question_id']
print('session_id', session_id)
res = requests.post(f'{BASE}/interview/answer', json={'session_id': session_id, 'question_id': question_id, 'answer_text': 'This is a test answer for history verification.', 'typing_metrics': {}}, headers=headers)
print('answer', res.status_code, res.text[:300])
if res.status_code != 200:
    raise SystemExit('answer failed')
res = requests.post(f'{BASE}/interview/end/{session_id}', headers=headers)
print('end', res.status_code, res.text[:300])
if res.status_code != 200:
    raise SystemExit('end failed')
print('waiting for persistence...')
time.sleep(1)
res = requests.get(f'{BASE}/analytics/sessions', params={'user_id': user['user_id']}, headers=headers)
print('sessions', res.status_code, res.text[:800])
res2 = requests.get(f'{BASE}/analytics/summary', params={'user_id': user['user_id']}, headers=headers)
print('summary', res2.status_code, res2.text[:800])
res3 = requests.get(f'{BASE}/interview/report/{session_id}', headers=headers)
print('report', res3.status_code, res3.text[:300])
