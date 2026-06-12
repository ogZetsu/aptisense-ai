import sys
sys.path.insert(0, '.')
import google.generativeai as genai
from app.core.config import settings

print('GEMINI_API_KEY length:', len(settings.GEMINI_API_KEY or ''))
genai.configure(api_key=settings.GEMINI_API_KEY)
models = genai.list_models()
count = 0
for m in models:
    count += 1
    name = getattr(m, 'name', None)
    print(name)
print('Model count:', count)
