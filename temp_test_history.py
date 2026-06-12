import json, os, time, sys
try:
    import requests
except ImportError:
    print('requests missing')
    sys.exit(1)
BASE='http://127.0.0.1:8000/api/v1'
username='testuser_history'
password='Test@1234'
print('signup...')
res=requests.post(f'{BASE}/auth/signup', json={'username': username, 'password': password})
print('signup status', res.status_code, res.text[:300])
if res.status_code==400:
    print('user exists, login instead')
res=requests.post(f'{BASE}/auth/login', json={'username': username, 'password': password})
print('login status', res.status_code, res.text[:300])
if res.status_code!=200:
    raise SystemExit('login failed')
login_data=res.json()
token=login_data['access_token']
headers={'Authorization': f'Bearer {token}'}
print('start interview...')
res=requests.post(f'{BASE}/interview/start', json={'interview_type': 'hr', 'position': 'HR Test', 'experience_level': 'mid', 'enable_proctoring': False}, headers=headers)
print('start status', res.status_code, res.text[:300])
if res.status_code!=200:
    raise SystemExit('start fail')
start=res.json(); session_id=start['session_id']; print('session_id', session_id)
question_id=start['first_question_id']
res=requests.post(f'{BASE}/interview/answer', json={'session_id': session_id, 'question_id': question_id, 'answer_text': 'This is a test answer.', 'typing_metrics': {}}, headers=headers)
print('answer status', res.status_code, res.text[:300])
if res.status_code!=200:
    raise SystemExit('answer fail')
res=requests.post(f'{BASE}/interview/end/{session_id}', headers=headers)
print('end status', res.status_code, res.text[:300])
if res.status_code!=200:
    raise SystemExit('end fail')
print('waiting 3s...')
time.sleep(3)
res=requests.get(f'{BASE}/analytics/sessions', params={'user_id': login_data['user']['user_id']}, headers=headers)
print('analytics sessions status', res.status_code)
print(res.json())
res2=requests.get(f'{BASE}/analytics/summary', params={'user_id': login_data['user']['user_id']}, headers=headers)
print('summary status', res2.status_code)
print(res2.json())
res3=requests.get(f'{BASE}/interview/report/{session_id}', headers=headers)
print('report status', res3.status_code)
print('report keys', list(res3.json().keys()) if res3.status_code==200 else res3.text)
