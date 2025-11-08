# bot/app/utils.py
import secrets
import string

def generate_invite_hash():
    return ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12))
