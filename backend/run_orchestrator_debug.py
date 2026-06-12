from app.services.ai_orchestration import AIOrchestrationService

examples = [
    ('short', 'It is about pointers and classes.'),
    ('detailed', 'C is procedural and low-level; Java is object-oriented with managed memory and JVM portability. C uses manual memory management and direct system calls, while Java provides a garbage collector and platform abstraction.'),
    ('incorrect', 'C and Java are the same because both use garbage collection and compile to bytecode.'),
    ('weak', 'I think C is old and Java is newer, so Java is better.'),
    ('strong', 'C gives fine control over memory, whereas Java prioritizes safety and cross-platform execution through the JVM. For performance-critical systems I would choose C, and for enterprise services I would use Java due to its runtime features.'),
]

service = AIOrchestrationService()
import os
log_path = os.path.join(os.path.dirname(__file__), 'orchestrator_debug_output.log')
with open(log_path, 'w', encoding='utf-8') as fh:
    for style, answer in examples:
        fh.write(f"\n=== ORCHESTRATOR DEBUG: {style} ===\n")
        q = 'What is the difference between C and Java?'
        try:
            result = service.generate_interviewer_turn(question=q, answer=answer, category='technical', difficulty='easy', context={})
            import json
            fh.write('Result JSON:\n')
            fh.write(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
        except Exception as e:
            fh.write('Error calling orchestrator: ' + repr(e) + "\n")
    fh.write('\n--- END DEBUG RUN ---\n')
print('Wrote debug log to', log_path)
