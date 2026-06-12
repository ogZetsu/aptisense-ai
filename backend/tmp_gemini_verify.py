import sys
import traceback
sys.path.insert(0, '.')
from app.services.ai_orchestration import AIOrchestrationService

svc = AIOrchestrationService()
print('SERVICE MODEL:', svc.chosen_model)

try:
    ai_turn = svc.generate_interviewer_turn(
        question='What is frontend development?',
        answer='I enjoy frontend development because I like designing responsive user interfaces.',
        category='technical',
        difficulty='easy',
        context={
            'recent_questions': ['What is a stack?'],
            'recent_answers': ['A stack is a data structure that follows LIFO principle.'],
        }
    )
    print('AI TURN:', ai_turn)
except Exception as e:
    print('EXCEPTION:', type(e).__name__, e)
    traceback.print_exc()
