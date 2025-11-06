import os
from dotenv import load_dotenv

load_dotenv()

print("=== Проверка переменных из .env ===")
print(f"BOT_TOKEN: {os.getenv('BOT_TOKEN', 'NOT FOUND')}")
print(f"APP_HOST: {os.getenv('APP_HOST', 'NOT FOUND')}")
print(f"APP_PORT: {os.getenv('APP_PORT', 'NOT FOUND')}")
print(f"BOT_PUBLIC_URL: {os.getenv('BOT_PUBLIC_URL', 'NOT FOUND')}")
print(f"MINIAPP_URL: {os.getenv('MINIAPP_URL', 'NOT FOUND')}")
