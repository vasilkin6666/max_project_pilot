# bot/app/services/api_client.py
import aiohttp
from app.config import settings
from loguru import logger
import json

class APIClient:
    def __init__(self):
        self.base_url = settings.BACKEND_API_URL

    async def get_user_projects(self, user_id: str):
        url = f"{self.base_url}/users/{user_id}/projects"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("projects", [])
                    else:
                        logger.error(f"API Error: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Network error: {e}")
            return []

    async def create_project(self, user_id: str, full_name: str, title: str, description: str = ""):
        url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": full_name}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._create_project_with_token(title, description, access_token)
        except Exception as e:
            logger.error(f"Error getting token: {e}")
        return None

    async def _create_project_with_token(self, title: str, description: str, token: str):
        url = f"{self.base_url}/projects/"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        data = {"title": title, "description": description}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=data, headers=headers) as response:
                    if response.status == 200:
                        project_data = await response.json()
                        return project_data.get("project")
        except Exception as e:
            logger.error(f"Error creating project: {e}")
        return None

    async def get_project_by_hash(self, project_hash: str):
        # Предположим, есть эндпоинт для получения проекта по хэшу без авторизации
        # или с токеном владельца, что сложно в боте. Реализуем как вызов из веб-приложения.
        # В боте можно реализовать только join.
        # Или бот может использовать токен текущего пользователя.
        # Для упрощения, пусть бот использует токен для проверки доступа.
        # Пока возвращаем заглушку.
        pass

    async def request_join_project(self, project_hash: str, user_id: str, full_name: str):
        # Сначала получаем токен
        token_url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": full_name}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(token_url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._request_join_with_token(project_hash, access_token)
        except Exception as e:
            logger.error(f"Error getting token for join: {e}")
        return {"status": "error", "message": "Failed to get token"}

    async def _request_join_with_token(self, project_hash: str, token: str):
        url = f"{self.base_url}/projects/{project_hash}/join"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        return {"status": "error", "message": "Project not found"}
                    elif response.status == 400:
                        error_json = await response.json()
                        return {"status": "error", "message": error_json.get("detail", "Already a member")}
        except Exception as e:
            logger.error(f"Error requesting join: {e}")
        return {"status": "error", "message": "Failed to join project"}

    async def get_user_notifications(self, user_id: str):
        # Аналогично, получаем токен и запрашиваем уведомления
        token_url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": "Anonymous"} # Имя не важно для получения токена
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(token_url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._get_notifications_with_token(access_token)
        except Exception as e:
            logger.error(f"Error getting token for notifications: {e}")
        return {"notifications": []}

    async def get_project_summary(self, project_hash: str, user_id: str, full_name: str):
        """Получение сводки проекта для бота"""
        token_url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": full_name}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(token_url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._get_project_summary_with_token(project_hash, access_token)
        except Exception as e:
            logger.error(f"Error getting token for project summary: {e}")
        return None

    async def _get_project_summary_with_token(self, project_hash: str, token: str):
        url = f"{self.base_url}/projects/{project_hash}/summary"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception as e:
            logger.error(f"Error getting project summary: {e}")
        return None

    async def get_project_join_requests(self, project_hash: str, user_id: str, full_name: str):
        """Получение запросов на присоединение к проекту"""
        token_url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": full_name}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(token_url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._get_project_join_requests_with_token(project_hash, access_token)
        except Exception as e:
            logger.error(f"Error getting token for join requests: {e}")
        return {"requests": []}

    async def _get_project_join_requests_with_token(self, project_hash: str, token: str):
        url = f"{self.base_url}/projects/{project_hash}/join-requests"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception as e:
            logger.error(f"Error getting join requests: {e}")
        return {"requests": []}

    async def approve_join_request(self, project_hash: str, request_id: int, user_id: str, full_name: str):
        """Одобрение запроса на присоединение"""
        token_url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": full_name}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(token_url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._approve_join_request_with_token(project_hash, request_id, access_token)
        except Exception as e:
            logger.error(f"Error getting token for approve: {e}")
        return {"status": "error", "message": "Failed to approve"}

    async def _approve_join_request_with_token(self, project_hash: str, request_id: int, token: str):
        url = f"{self.base_url}/projects/{project_hash}/join-requests/{request_id}/approve"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception as e:
            logger.error(f"Error approving join request: {e}")
        return {"status": "error", "message": "Failed to approve"}

    async def reject_join_request(self, project_hash: str, request_id: int, user_id: str, full_name: str):
        """Отклонение запроса на присоединение"""
        token_url = f"{self.base_url}/auth/token"
        token_data = {"max_id": user_id, "full_name": full_name}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(token_url, json=token_data) as response:
                    if response.status == 200:
                        token_response = await response.json()
                        access_token = token_response.get("access_token")
                        if access_token:
                            return await self._reject_join_request_with_token(project_hash, request_id, access_token)
        except Exception as e:
            logger.error(f"Error getting token for reject: {e}")
        return {"status": "error", "message": "Failed to reject"}

    async def _reject_join_request_with_token(self, project_hash: str, request_id: int, token: str):
        url = f"{self.base_url}/projects/{project_hash}/join-requests/{request_id}/reject"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception as e:
            logger.error(f"Error rejecting join request: {e}")
        return {"status": "error", "message": "Failed to reject"}
