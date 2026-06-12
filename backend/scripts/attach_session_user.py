"""Attach a user_id/username to an existing session file.

Usage: run without args to auto-detect best match and patch the hard-coded session id,
or call with: python attach_session_user.py <session_id> <username>
"""
import sys
import os
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
USERS_DIR = BASE / 'data' / 'users'
SESSIONS_DIR = BASE / 'data' / 'sessions'

def load_users():
    users = {}
    for p in USERS_DIR.glob('*.json'):
        try:
            with open(p,'r') as f:
                d = json.load(f)
                users[d.get('username')] = d.get('user_id')
        except Exception:
            continue
    return users


def patch_session(session_id, user_id, username):
    session_file = SESSIONS_DIR / f"{session_id}.json"
    if not session_file.exists():
        print('Session file not found:', session_file)
        return False
    try:
        with open(session_file,'r') as f:
            data = json.load(f)
        data['user_id'] = user_id
        data['username'] = username
        with open(session_file,'w') as f:
            json.dump(data, f, indent=2)
        print(f'Patched session {session_id} -> user {username} ({user_id})')
        return True
    except Exception as e:
        print('Failed to patch session:', e)
        return False


def auto_detect_and_patch(session_id):
    users = load_users()
    session_file = SESSIONS_DIR / f"{session_id}.json"
    if not session_file.exists():
        print('Session file not found:', session_file)
        return False
    text = session_file.read_text(encoding='utf-8')

    # Try to match usernames found in user files within the session content
    for username in users.keys():
        if username.lower() in text.lower():
            return patch_session(session_id, users[username], username)

    # Fallback: if a user with exact "saimeen" exists, use it
    if 'saimeen' in users:
        return patch_session(session_id, users['saimeen'], 'saimeen')

    print('No matching user found for session. Available users:', list(users.keys())[:10])
    return False


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        sid = sys.argv[1]
        uname = sys.argv[2]
        users = load_users()
        if uname not in users:
            print('Username not found in users dir:', uname)
            sys.exit(1)
        uid = users[uname]
        ok = patch_session(sid, uid, uname)
        sys.exit(0 if ok else 2)
    else:
        # default to session from user request
        sid = '463211f3-0401-4087-be55-90373e028d25'
        ok = auto_detect_and_patch(sid)
        sys.exit(0 if ok else 2)
