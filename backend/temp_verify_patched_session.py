import requests
BASE='http://127.0.0.1:8001/api/v1'
user_id='d05df01a-1f5d-48b1-9871-cafcf87c99b0'
print('GET /analytics/sessions?user_id=', user_id)
res = requests.get(f'{BASE}/analytics/sessions', params={'user_id': user_id})
print(res.status_code)
print(res.text[:1000])
print('\nGET /analytics/summary?user_id=')
res2 = requests.get(f'{BASE}/analytics/summary', params={'user_id': user_id})
print(res2.status_code)
print(res2.text[:1000])
print('\nGET /interview/report/{session_id}')
sid='463211f3-0401-4087-be55-90373e028d25'
res3 = requests.get(f'{BASE}/interview/report/{sid}')
print(res3.status_code)
try:
	j = res3.json()
	print('keys:', list(j.keys()))
	# print some nested fields if present
	print('final_gemini_report keys:', list(j.get('final_gemini_report', {}).keys()) if isinstance(j.get('final_gemini_report'), dict) else type(j.get('final_gemini_report')))
	print('top_strengths:', j.get('top_strengths'))
	print('improvement_areas:', j.get('improvement_areas'))
except Exception as e:
	print('failed to parse json', e)
