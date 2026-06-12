import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000/api/v1"


def post(path, payload):
    url = BASE + path
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def run_quality_test():
    categories = {
        'technical': [
            ('short', 'It is about pointers and classes.'),
            ('detailed', 'C is procedural and low-level; Java is object-oriented with managed memory and JVM portability. C uses manual memory management and direct system calls, while Java provides a garbage collector and platform abstraction.'),
            ('incorrect', 'C and Java are the same because both use garbage collection and compile to bytecode.'),
            ('weak', 'I think C is old and Java is newer, so Java is better.'),
            ('strong', 'C gives fine control over memory, whereas Java prioritizes safety and cross-platform execution through the JVM. For performance-critical systems I would choose C, and for enterprise services I would use Java due to its runtime features.'),
        ],
        'hr': [
            ('short', 'I like work.'),
            ('detailed', 'I lead a small team on a cross-functional project, handled stakeholder communication, and delivered the product on time by iterating quickly and removing blockers.'),
            ('weak', 'I am hardworking and I learn fast.'),
            ('strong', 'In my last role I improved customer feedback by launching a new onboarding flow that reduced complaints by 30%, and I drove alignment across design and engineering with daily syncs.'),
            ('awkward', 'My strengths are being good at things and I like doing stuff and I am reliable.'),
        ],
        'behavioral': [
            ('short', 'I solved it quickly.'),
            ('detailed', 'When a service went down, I identified a memory leak, coordinated a rollback, and then built better alerts and a post-mortem that prevented recurrence.'),
            ('weak', 'I fixed the bug by trying some things until it worked.'),
            ('strong', 'I owned the failure, rebuilt the retry logic, and then instituted daily code reviews so the same pattern did not happen again.'),
            ('awkward', 'I had a conflict with someone and we talked and then it was okay.'),
        ],
        'communication': [
            ('short', 'I speak well.'),
            ('nervous', 'Um, I think I can explain it, it was, well, about the product and I… yeah.'),
            ('detailed', 'I present complex ideas with clear structure: I start with the problem, explain the options, then summarize the recommendation with an example tied to the audience.'),
            ('weak', 'I talk about things but then I forget the point.'),
            ('strong', 'I organize a talk around the audience, use concrete examples, and pause for questions so the message is clear and memorable.'),
        ],
    }

    for category, examples in categories.items():
        print('\n=== CATEGORY:', category, '===')
        for style, answer in examples:
            try:
                print(f'-- {style} answer --')
                start_payload = {
                    'interview_type': category,
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
                answer_resp = post('/interview/answer', answer_payload)
                print('Feedback:', answer_resp.get('feedback'))
                print('Follow-up:', answer_resp.get('follow_up'))
                print('Raw scores:', answer_resp.get('analysis', {}).get('technical_score'), answer_resp.get('analysis', {}).get('communication_score'))
            except urllib.error.HTTPError as err:
                print('HTTP Error:', err.code, err.read().decode())
            except Exception as e:
                print('Error:', str(e))


if __name__ == '__main__':
    run_quality_test()
