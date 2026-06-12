import asyncio
from app.api import analytics

async def run_test():
    current_user = {
        'user_id': '00000000-0000-0000-0000-000000000000',
        'email': 'verify.user.a@example.com',
        'google_sub': None
    }
    res = await analytics.get_sessions(None, current_user)
    print('Found sessions:', len(res))
    for s in res[:5]:
        print('-', s['session_id'], s.get('position'), s.get('user_id'))

if __name__ == '__main__':
    asyncio.run(run_test())
