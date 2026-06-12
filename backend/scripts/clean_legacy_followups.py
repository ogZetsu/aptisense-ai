import os
import json

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data', 'sessions')
FORBIDDEN = [
    "could you elaborate more on that point",
    "i have a quick reaction to that answer",
    "could you provide more specific examples",
    "tell me more about that",
    "can you elaborate",
    "what specific part of that answer should i probe next",
    "what specific part of that answer should i probe next?",
]

changed = []
for fname in os.listdir(ROOT):
    if not fname.endswith('.json'):
        continue
    path = os.path.join(ROOT, fname)
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except Exception:
        continue
    modified = False
    qhist = data.get('question_history', [])
    for q in qhist:
        qtext = q.get('question', '')
        if not isinstance(qtext, str):
            continue
        norm = qtext.strip().lower()
        if any(f in norm for f in FORBIDDEN):
            # sanitize: clear the question and mark as suppressed
            q['question'] = ''
            q['is_follow_up'] = False
            if 'parent_question_id' in q:
                del q['parent_question_id']
            modified = True
    if modified:
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
        changed.append(path)

print('Sanitized files:', len(changed))
for c in changed:
    print('-', c)
