import secrets
import string

def rand_hash(length: int = 12) -> str:
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))
