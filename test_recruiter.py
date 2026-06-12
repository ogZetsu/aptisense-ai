"""Test recruiter responses with post-processing."""
import requests
import json

base = 'http://127.0.0.1:8000/api/v1/interview'

# Test 1: Frontend interest
print("=" * 70)
print("TEST 1: FRONTEND INTEREST QUESTION")
print("=" * 70)
start = requests.post(base + '/start', json={
    'interview_type': 'technical',
    'position': 'engineer',
    'experience_level': 'mid',
    'enable_proctoring': False
})

if start.status_code == 200:
    data = start.json()
    session_id = data['session_id']
    qid = data['first_question_id']
    
    ans = requests.post(base + '/answer', json={
        'session_id': session_id,
        'question_id': qid,
        'answer_text': 'I like frontend development because I enjoy building user interfaces that are responsive and accessible.',
        'typing_metrics': {}
    })
    
    if ans.status_code == 200:
        resp = ans.json()
        feedback = resp.get('feedback', 'NO FEEDBACK')
        print(f"RECRUITER RESPONSE:\n>>> {feedback}\n")
else:
    print(f"Failed: {start.text}")

# Test 2: Backend/database focus
print("=" * 70)
print("TEST 2: DATABASE/BACKEND QUESTION")
print("=" * 70)
start2 = requests.post(base + '/start', json={
    'interview_type': 'technical',
    'position': 'engineer',
    'experience_level': 'mid',
    'enable_proctoring': False
})

if start2.status_code == 200:
    data2 = start2.json()
    session_id2 = data2['session_id']
    qid2 = data2['first_question_id']
    
    ans2 = requests.post(base + '/answer', json={
        'session_id': session_id2,
        'question_id': qid2,
        'answer_text': 'When designing databases, I typically consider both SQL and NoSQL options depending on the schema requirements and query patterns.',
        'typing_metrics': {}
    })
    
    if ans2.status_code == 200:
        resp2 = ans2.json()
        feedback2 = resp2.get('feedback', 'NO FEEDBACK')
        print(f"RECRUITER RESPONSE:\n>>> {feedback2}\n")
else:
    print(f"Failed: {start2.text}")

# Test 3: Team communication
print("=" * 70)
print("TEST 3: TEAM COLLABORATION QUESTION")
print("=" * 70)
start3 = requests.post(base + '/start', json={
    'interview_type': 'behavioral',
    'position': 'engineer',
    'experience_level': 'mid',
    'enable_proctoring': False
})

if start3.status_code == 200:
    data3 = start3.json()
    session_id3 = data3['session_id']
    qid3 = data3['first_question_id']
    
    ans3 = requests.post(base + '/answer', json={
        'session_id': session_id3,
        'question_id': qid3,
        'answer_text': 'I handled a conflict by listening to the other person first, understanding their perspective, then proposing a solution that addressed both concerns.',
        'typing_metrics': {}
    })
    
    if ans3.status_code == 200:
        resp3 = ans3.json()
        feedback3 = resp3.get('feedback', 'NO FEEDBACK')
        print(f"RECRUITER RESPONSE:\n>>> {feedback3}\n")
else:
    print(f"Failed: {start3.text}")

print("=" * 70)
print("TEST COMPLETE")
print("=" * 70)
