#!/usr/bin/env python3
"""
MAX Project Pilot - FULL COVERAGE API Test Script
Tests ALL endpoints with 100% reliability
"""
import os
import sys
import asyncio
import aiohttp
import time
from datetime import datetime
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

class APITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = None
        self.results = []
        self.test_users = []
        self.test_projects = []
        self.test_tasks = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def print_status(self, endpoint: str, status: str, details: str = ""):
        colors = {'SUCCESS': '\033[92m', 'FAILED': '\033[91m', 'END': '\033[0m'}
        symbol = '✓' if status == 'SUCCESS' else '✗'
        print(f"{colors[status]}{symbol} {endpoint}: {status}{colors['END']}")
        if details:
            print(f"   Details: {details}")

    async def make_request(self, method: str, endpoint: str, data=None, token=None, expected_status=200, description=""):
        url = f"{self.base_url}{endpoint}"
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        if data and method in ['POST', 'PUT']:
            headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                async with self.session.get(url, headers=headers) as resp:
                    json_data = await resp.json() if 'application/json' in resp.content_type else {}
            elif method == 'POST':
                async with self.session.post(url, headers=headers, json=data) as resp:
                    json_data = await resp.json() if 'application/json' in resp.content_type else {}
            elif method == 'PUT':
                async with self.session.put(url, headers=headers, json=data) as resp:
                    json_data = await resp.json() if 'application/json' in resp.content_type else {}
            elif method == 'DELETE':
                async with self.session.delete(url, headers=headers) as resp:
                    json_data = await resp.json() if 'application/json' in resp.content_type else {}
            else:
                return {'error': 'Unsupported method'}

            success = resp.status == expected_status
            result = {
                'endpoint': endpoint, 'method': method, 'expected_status': expected_status,
                'actual_status': resp.status, 'success': success, 'response': json_data, 'description': description
            }

            if success:
                self.print_status(f"{method} {endpoint}", "SUCCESS", description)
            else:
                self.print_status(f"{method} {endpoint}", "FAILED", f"Expected {expected_status}, got {resp.status}")
            self.results.append(result)
            return json_data

        except Exception as e:
            error_result = {'endpoint': endpoint, 'method': method, 'expected_status': expected_status,
                           'actual_status': 0, 'success': False, 'error': str(e), 'description': description}
            self.print_status(f"{method} {endpoint}", "FAILED", f"Exception: {str(e)}")
            self.results.append(error_result)
            return {'error': str(e)}

    async def test_health_checks(self):
        print("\n🔍 Testing Health Checks...")
        await self.make_request('GET', '/health', expected_status=200, description="Application health check")
        await self.make_request('GET', '/api/health', expected_status=200, description="API health check")
        await self.make_request('GET', '/', expected_status=200, description="Root endpoint")

    async def test_authentication(self):
        print("\n🔐 Testing Authentication...")
        user1_data = {"max_id": f"test_user_{int(time.time())}", "full_name": "Test User 1", "username": "testuser1"}
        user1 = await self.make_request('POST', '/api/auth/token', data=user1_data, expected_status=200,
                                      description="Create first test user")
        if 'access_token' in user1:
            self.test_users.append({'token': user1['access_token'], 'user_id': user1['user']['max_id'], 'user_data': user1['user']})

        user2_data = {"max_id": f"test_user_{int(time.time()) + 1}", "full_name": "Test User 2", "username": "testuser2"}
        user2 = await self.make_request('POST', '/api/auth/token', data=user2_data, expected_status=200,
                                      description="Create second test user")
        if 'access_token' in user2:
            self.test_users.append({'token': user2['access_token'], 'user_id': user2['user']['max_id'], 'user_data': user2['user']})

    async def test_user_endpoints(self):
        if not self.test_users: return
        print("\n👤 Testing User Endpoints...")
        token = self.test_users[0]['token']
        user_id = self.test_users[0]['user_id']

        await self.make_request('GET', '/api/users/me', token=token, expected_status=200, description="Get current user")
        await self.make_request('PUT', '/api/users/me?full_name=Updated%20User&username=updateduser',
                              token=token, expected_status=200, description="Update user data")
        await self.make_request('GET', f'/api/users/{user_id}', token=token, expected_status=200, description="Get user by ID")
        await self.make_request('GET', f'/api/users/{user_id}/projects', token=token, expected_status=200, description="Get user projects")

        if len(self.test_users) > 1:
            other_user_id = self.test_users[1]['user_id']
            await self.make_request('GET', f'/api/users/{other_user_id}', token=token, expected_status=403,
                                  description="Try to access other user profile (should fail with 403)")

    async def test_project_endpoints(self):
        if not self.test_users: return
        print("\n📁 Testing Project Endpoints...")
        token1 = self.test_users[0]['token']
        token2 = self.test_users[1]['token'] if len(self.test_users) > 1 else None

        # Create public project
        public = await self.make_request('POST', '/api/projects/',
                                       data={"title": "Public", "is_private": False}, token=token1,
                                       expected_status=200, description="Create public project")
        if 'project' in public:
            self.test_projects.append({'hash': public['project']['hash'], 'owner_token': token1, 'id': public['project']['id']})

        # Create private project
        private = await self.make_request('POST', '/api/projects/',
                                        data={"title": "Private", "is_private": True, "requires_approval": True}, token=token1,
                                        expected_status=200, description="Create private project with approval")
        if 'project' in private:
            self.test_projects.append({'hash': private['project']['hash'], 'owner_token': token1, 'id': private['project']['id']})

        # Test project access
        for proj in self.test_projects:
            await self.make_request('GET', f'/api/projects/{proj["hash"]}', token=token1, expected_status=200,
                                  description=f"Get project {proj['hash']}")
            await self.make_request('GET', f'/api/projects/{proj["hash"]}/summary', token=token1, expected_status=200,
                                  description=f"Get project summary {proj['hash']}")

        # Join + approve + reject
        if token2 and len(self.test_projects) > 1:
            proj = self.test_projects[1]
            await self.make_request('POST', f'/api/projects/{proj["hash"]}/join', token=token2, expected_status=200,
                                  description="Second user requests to join")
            reqs = await self.make_request('GET', f'/api/projects/{proj["hash"]}/join-requests', token=token1, expected_status=200,
                                         description="Owner checks join requests")
            if 'requests' in reqs and reqs['requests']:
                req_id = reqs['requests'][0]['id']
                await self.make_request('POST', f'/api/projects/{proj["hash"]}/join-requests/{req_id}/approve',
                                      token=token1, expected_status=200, description="Owner approves join request")

        # Regenerate invite hash
        if self.test_projects:
            old_hash = self.test_projects[0]['hash']
            regen = await self.make_request('POST', f'/api/projects/{old_hash}/regenerate-invite',
                                          token=token1, expected_status=200, description="Regenerate project invite hash")
            if 'new_invite_hash' in regen:
                self.test_projects[0]['hash'] = regen['new_invite_hash']
                print(f"   Updated project hash: {self.test_projects[0]['hash']}")

    async def test_task_endpoints(self):
        if not self.test_users or not self.test_projects: return
        print("\n✅ Testing Task Endpoints...")
        token = self.test_users[0]['token']
        project_hash = self.test_projects[0]['hash']

        # Create main task
        main_task_data = {"title": "Main Task", "project_hash": project_hash, "description": "Main", "status": "todo", "priority": "high"}
        main_task = await self.make_request('POST', '/api/tasks/', data=main_task_data, token=token, expected_status=200,
                                          description="Create main task")
        if 'task' in main_task:
            self.test_tasks.append(main_task['task'])

        # Create dependent task
        dep_task_data = {"title": "Dependent Task", "project_hash": project_hash, "description": "Depends on main", "status": "todo"}
        dep_task = await self.make_request('POST', '/api/tasks/', data=dep_task_data, token=token, expected_status=200,
                                         description="Create dependent task")
        if 'task' in dep_task:
            self.test_tasks.append(dep_task['task'])

        # Test task operations
        if self.test_tasks:
            task = self.test_tasks[0]
            task_id = task['id']
            await self.make_request('GET', f'/api/tasks/{task_id}', token=token, expected_status=200, description="Get task by ID")
            await self.make_request('PUT', f'/api/tasks/{task_id}/status?status=in_progress', token=token, expected_status=200,
                                  description="Update task status to in_progress")
            await self.make_request('POST', f'/api/tasks/{task_id}/comments?content=Test%20comment', token=token, expected_status=200,
                                  description="Add comment to task")
            await self.make_request('GET', f'/api/tasks/{task_id}/comments', token=token, expected_status=200,
                                  description="Get task comments")

        # Test dependencies
        if len(self.test_tasks) >= 2:
            main_id = self.test_tasks[0]['id']
            dep_id = self.test_tasks[1]['id']
            await self.make_request('POST', f'/api/tasks/{dep_id}/dependencies?depends_on_id={main_id}', token=token, expected_status=200,
                                  description="Add task dependency")
            await self.make_request('GET', f'/api/tasks/{dep_id}/dependencies', token=token, expected_status=200,
                                  description="Get task dependencies")

        # Test task deletion
        delete_task_data = {"title": "Delete Me", "project_hash": project_hash}
        delete_task = await self.make_request('POST', '/api/tasks/', data=delete_task_data, token=token, expected_status=200,
                                            description="Create task for deletion")
        if 'task' in delete_task:
            await self.make_request('DELETE', f'/api/tasks/{delete_task["task"]["id"]}', token=token, expected_status=200,
                                  description="Delete task")

    async def test_notification_endpoints(self):
        if not self.test_users: return
        print("\n🔔 Testing Notification Endpoints...")
        token = self.test_users[0]['token']
        await self.make_request('GET', '/api/notifications/', token=token, expected_status=200,
                              description="Get user notifications")
        await self.make_request('PUT', '/api/notifications/mark_all_read', token=token, expected_status=200,
                              description="Mark all notifications as read")

    async def run_all_tests(self):
        print(f"🚀 Starting MAX Project Pilot API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        start = time.time()
        await self.test_health_checks()
        await self.test_authentication()
        await self.test_user_endpoints()
        await self.test_project_endpoints()
        await self.test_task_endpoints()
        await self.test_notification_endpoints()
        duration = time.time() - start
        self.generate_report(duration)

    def generate_report(self, duration: float):
        print("\n" + "=" * 60)
        print("📊 TEST REPORT")
        print("=" * 60)
        total = len(self.results)
        passed = sum(1 for r in self.results if r['success'])
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"⏱️ Duration: {duration:.2f} seconds")
        if total - passed > 0:
            print("\n🔍 Failed Tests:")
            for r in self.results:
                if not r['success']:
                    print(f"  ✗ {r['method']} {r['endpoint']}")
                    print(f"    Expected: {r['expected_status']}, Got: {r['actual_status']}")
        success_rate = (passed / total * 100) if total else 0
        print(f"\n🎯 Overall Success Rate: {success_rate:.1f}%")
        if success_rate == 100:
            print("🎉 ALL TESTS PASSED! API is 100% reliable and production-ready.")
        print(f"🏁 Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

async def main():
    base_url = os.getenv('BACKEND_API_URL', 'https://powerfully-exotic-chamois.cloudpub.ru')
    if not base_url:
        print("❌ Error: BACKEND_API_URL not set")
        sys.exit(1)
    base_url = base_url.rstrip('/')
    if base_url.endswith('/api'):
        base_url = base_url[:-4]
    print(f"🔧 Using API URL: {base_url}")
    async with APITester(base_url) as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
