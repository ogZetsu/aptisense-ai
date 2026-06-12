import json
import urllib.request
import urllib.error
import time

BASE = "http://127.0.0.1:8000/api/v1"


def post(path, payload):
    url = BASE + path
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


for itype in ['technical', 'hr', 'behavioral', 'communication', 'mock']:
    try:
        print('\n--- Running E2E for type:', itype, '---')
        start_payload = {
            'interview_type': itype,
            'position': 'E2E Multi Test',
            'experience_level': 'mid',
            'enable_proctoring': False
        }
        start = post('/interview/start', start_payload)
        print('Start:', json.dumps(start, indent=2)[:800])

        session_id = start.get('session_id')
        qid = start.get('first_question_id')
        qtext = start.get('first_question')

        answer_payload = {
            'session_id': session_id,
            'question_id': qid,
            'answer_text': 'This is a short test answer to exercise the system and get feedback.',
            'typing_metrics': {'typingSpeed': 40, 'backspaces': 1, 'hesitationTime': 0.2, 'totalTime': 20}
        }

        answer_resp = post('/interview/answer', answer_payload)
        print('Answer feedback:', answer_resp.get('feedback'))
        print('Follow-up:', answer_resp.get('follow_up'))

    except Exception as e:
        print('Error for', itype, e)
