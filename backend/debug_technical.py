import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000/api/v1"


def post(path, payload, timeout=120):
    url = BASE + path
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def run_debug():
    examples = [
        ('short', 'It is about pointers and classes.'),
        ('detailed', 'C is procedural and low-level; Java is object-oriented with managed memory and JVM portability. C uses manual memory management and direct system calls, while Java provides a garbage collector and platform abstraction.'),
        ('incorrect', 'C and Java are the same because both use garbage collection and compile to bytecode.'),
        ('weak', 'I think C is old and Java is newer, so Java is better.'),
        ('strong', 'C gives fine control over memory, whereas Java prioritizes safety and cross-platform execution through the JVM. For performance-critical systems I would choose C, and for enterprise services I would use Java due to its runtime features.'),
    ]

    for style, answer in examples:
        try:
            print('\n=== TECHNICAL:', style, '===')
            start_payload = {
                'interview_type': 'technical',
                'position': 'QA Test',
                'experience_level': 'mid',
                'enable_proctoring': False
            }
            start = post('/interview/start', start_payload)
            session_id = start['session_id']
            qid = start['first_question_id']
            qtext = start['first_question']
            print('Question:', qtext)
            answer_payload = {
                'session_id': session_id,
                'question_id': qid,
                'answer_text': answer,
                'typing_metrics': {'typingSpeed': 35, 'backspaces': 3, 'hesitationTime': 1.2, 'totalTime': 25}
            }
            answer_resp = post('/interview/answer', answer_payload, timeout=180)
            print('API Feedback:', answer_resp.get('feedback'))
            print('API Follow-up:', answer_resp.get('follow_up'))
            print('API Analysis snippet:', json.dumps(answer_resp.get('analysis') or {}, indent=2)[:1000])
        except urllib.error.HTTPError as err:
            print('HTTP Error:', err.code, err.read().decode())
        except Exception as e:
            print('Error:', str(e))


if __name__ == '__main__':
    run_debug()
