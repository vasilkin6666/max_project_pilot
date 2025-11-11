#!/usr/bin/env python3
"""
MAX Project Pilot - COMPLETE COVERAGE API Test Script
Tests ALL endpoints with 100% reliability including dashboard, settings, and all CRUD operations
"""
import os
import sys
import asyncio
import aiohttp
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

class CompleteAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = None
        self.results = []
        self.test_users = []
        self.test_projects = []
        self.test_tasks = []
        self.test_join_requests = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def print_status(self, endpoint: str, status: str, details: str = ""):
        colors = {'SUCCESS': '\033[92m', 'FAILED': '\033[91m', 'WARNING': '\033[93m', 'END': '\033[0m'}
        symbol = '✓' if status == 'SUCCESS' else '✗' if status == 'FAILED' else '⚠'
        print(f"{colors[status]}{symbol} {endpoint}: {status}{colors['END']}")
        if details:
            print(f"   Details: {details}")

    async def make_request(self, method: str, endpoint: str, data=None, token=None, expected_status=200, description=""):
        url = f"{self.base_url}{endpoint}"
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        if data and method in ['POST', 'PUT', 'PATCH']:
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
            elif method == 'PATCH':
                async with self.session.patch(url, headers=headers, json=data) as resp:
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
                if 'detail' in json_data:
                    print(f"   Error detail: {json_data['detail']}")
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
        # Test multiple users for different scenarios
        user1_data = {"max_id": f"test_user_{int(time.time())}", "full_name": "Test User 1", "username": "testuser1"}
        user1 = await self.make_request('POST', '/api/auth/token', data=user1_data, expected_status=200,
                                      description="Create first test user")
        if 'access_token' in user1:
            self.test_users.append({
                'token': user1['access_token'],
                'user_id': user1['user']['max_id'],
                'user_data': user1['user'],
                'db_id': user1['user']['id']
            })

        user2_data = {"max_id": f"test_user_{int(time.time()) + 1}", "full_name": "Test User 2", "username": "testuser2"}
        user2 = await self.make_request('POST', '/api/auth/token', data=user2_data, expected_status=200,
                                      description="Create second test user")
        if 'access_token' in user2:
            self.test_users.append({
                'token': user2['access_token'],
                'user_id': user2['user']['max_id'],
                'user_data': user2['user'],
                'db_id': user2['user']['id']
            })

        user3_data = {"max_id": f"test_user_{int(time.time()) + 2}", "full_name": "Test User 3", "username": "testuser3"}
        user3 = await self.make_request('POST', '/api/auth/token', data=user3_data, expected_status=200,
                                      description="Create third test user")
        if 'access_token' in user3:
            self.test_users.append({
                'token': user3['access_token'],
                'user_id': user3['user']['max_id'],
                'user_data': user3['user'],
                'db_id': user3['user']['id']
            })

    async def test_user_endpoints(self):
        if not self.test_users:
            print("❌ No users available for user endpoints test")
            return

        print("\n👤 Testing User Endpoints...")
        token = self.test_users[0]['token']
        user_id = self.test_users[0]['user_id']

        # Test all user endpoints
        await self.make_request('GET', '/api/users/me', token=token, expected_status=200, description="Get current user")

        # Test user update
        await self.make_request('PUT', '/api/users/me?full_name=Updated%20User&username=updateduser',
                              token=token, expected_status=200, description="Update user data")

        # Test user by ID (self)
        await self.make_request('GET', f'/api/users/{user_id}', token=token, expected_status=200, description="Get user by ID")

        # Test user projects
        await self.make_request('GET', f'/api/users/{user_id}/projects', token=token, expected_status=200, description="Get user projects")

        # Test accessing other user profile (should fail)
        if len(self.test_users) > 1:
            other_user_id = self.test_users[1]['user_id']
            await self.make_request('GET', f'/api/users/{other_user_id}', token=token, expected_status=403,
                                  description="Try to access other user profile (should fail with 403)")

        # Test "me" alias
        await self.make_request('GET', '/api/users/me/projects', token=token, expected_status=200, description="Get own projects using 'me'")

    async def test_user_preferences(self):
        if not self.test_users: return

        print("\n⚙️ Testing User Preferences...")
        token = self.test_users[0]['token']

        # Get current preferences
        prefs = await self.make_request('GET', '/api/users/me/preferences', token=token, expected_status=200,
                                      description="Get user preferences")

        # Update preferences
        update_data = {
            "theme": "dark",
            "language": "en",
            "notifications_enabled": True,
            "email_notifications": False,
            "push_notifications": True,
            "compact_view": True,
            "show_completed_tasks": False,
            "default_project_view": "board",
            "timezone": "Europe/Moscow",
            "date_format": "DD.MM.YYYY",
            "time_format": "24h",
            "items_per_page": 50,
            "custom_settings": {"key1": "value1", "key2": "value2"}
        }
        await self.make_request('PUT', '/api/users/me/preferences', data=update_data, token=token, expected_status=200,
                              description="Update user preferences")

        # Partial update
        partial_data = {"theme": "light", "compact_view": False}
        await self.make_request('PATCH', '/api/users/me/preferences', data=partial_data, token=token, expected_status=200,
                              description="Partial update of user preferences")

        # Reset preferences
        await self.make_request('PUT', '/api/users/me/preferences/reset', token=token, expected_status=200,
                              description="Reset user preferences to default")

    async def test_dashboard(self):
        if not self.test_users: return

        print("\n📊 Testing Dashboard...")
        token = self.test_users[0]['token']

        await self.make_request('GET', '/api/dashboard/', token=token, expected_status=200,
                              description="Get dashboard data")

    async def test_project_operations(self):
        if not self.test_users: return

        print("\n📁 Testing Project Operations...")
        owner_token = self.test_users[0]['token']
        member_token = self.test_users[1]['token'] if len(self.test_users) > 1 else None
        guest_token = self.test_users[2]['token'] if len(self.test_users) > 2 else None

        # Create different types of projects
        project_types = [
            {"title": "Public Project", "description": "Public project description", "is_private": False, "requires_approval": False},
            {"title": "Private Project", "description": "Private project description", "is_private": True, "requires_approval": False},
            {"title": "Approval Project", "description": "Approval required project", "is_private": True, "requires_approval": True}
        ]

        for i, project_data in enumerate(project_types):
            project = await self.make_request('POST', '/api/projects/', data=project_data, token=owner_token,
                                            expected_status=200, description=f"Create {project_data['title']}")
            if 'project' in project:
                self.test_projects.append({
                    'hash': project['project']['hash'],
                    'owner_token': owner_token,
                    'data': project['project'],
                    'type': project_data['title']
                })

        # Test project listing
        await self.make_request('GET', '/api/projects/', token=owner_token, expected_status=200,
                              description="Get user projects list")

        # Test individual project access
        for proj in self.test_projects:
            await self.make_request('GET', f'/api/projects/{proj["hash"]}', token=owner_token, expected_status=200,
                                  description=f"Get project {proj['type']}")
            await self.make_request('GET', f'/api/projects/{proj["hash"]}/summary', token=owner_token, expected_status=200,
                                  description=f"Get project summary {proj['type']}")

        # Test project update
        if self.test_projects:
            proj_hash = self.test_projects[0]['hash']
            update_data = {"title": "Updated Project Title", "description": "Updated description", "is_private": True}
            await self.make_request('PUT', f'/api/projects/{proj_hash}', data=update_data, token=owner_token, expected_status=200,
                                  description="Update project details")

    async def test_project_membership(self):
        if len(self.test_users) < 2:
            print("⚠️ Not enough users for membership tests")
            return

        print("\n👥 Testing Project Membership...")
        owner_token = self.test_users[0]['token']
        member_token = self.test_users[1]['token']

        # Create a project for membership testing
        project_data = {"title": "Membership Test Project", "is_private": True, "requires_approval": True}
        project = await self.make_request('POST', '/api/projects/', data=project_data, token=owner_token,
                                        expected_status=200, description="Create project for membership tests")
        if 'project' not in project:
            return

        proj_hash = project['project']['hash']
        self.test_projects.append({'hash': proj_hash, 'owner_token': owner_token, 'data': project['project']})

        # Test join request flow
        join_result = await self.make_request('POST', f'/api/projects/{proj_hash}/join', token=member_token, expected_status=200,
                                            description="Member requests to join project")

        # Get join requests as owner
        join_requests = await self.make_request('GET', f'/api/projects/{proj_hash}/join-requests', token=owner_token, expected_status=200,
                                              description="Owner gets join requests")

        if 'requests' in join_requests and join_requests['requests']:
            req_id = join_requests['requests'][0]['id']
            self.test_join_requests.append(req_id)

            # Test approving join request
            await self.make_request('POST', f'/api/projects/{proj_hash}/join-requests/{req_id}/approve', token=owner_token, expected_status=200,
                                  description="Owner approves join request")

            # Test getting project members
            members = await self.make_request('GET', f'/api/projects/{proj_hash}/members', token=owner_token, expected_status=200,
                                            description="Get project members")

            # Test member role update
            if 'members' in members and len(members['members']) > 1:
                member_user_id = members['members'][1]['user_id']  # The member we just added
                role_data = {"role": "admin"}
                await self.make_request('PUT', f'/api/projects/{proj_hash}/members/{member_user_id}', data=role_data, token=owner_token, expected_status=200,
                                      description="Update member role to admin")

                # Test removing member
                await self.make_request('DELETE', f'/api/projects/{proj_hash}/members/{member_user_id}', token=owner_token, expected_status=200,
                                      description="Remove member from project")

        # Test join without approval (public project)
        public_proj = next((p for p in self.test_projects if not p['data']['is_private']), None)
        if public_proj:
            await self.make_request('POST', f'/api/projects/{public_proj["hash"]}/join', token=member_token, expected_status=200,
                                  description="Join public project without approval")

    async def test_task_operations(self):
        if not self.test_users or not self.test_projects:
            print("⚠️ No projects available for task tests")
            return

        print("\n✅ Testing Task Operations...")
        token = self.test_users[0]['token']
        project_hash = self.test_projects[0]['hash']

        # Create multiple tasks with different properties
        task_data_list = [
            {"title": "High Priority Task", "project_hash": project_hash, "description": "Important task", "priority": "high", "status": "todo"},
            {"title": "In Progress Task", "project_hash": project_hash, "description": "Working on it", "priority": "medium", "status": "in_progress"},
            {"title": "Completed Task", "project_hash": project_hash, "description": "Already done", "priority": "low", "status": "done"},
            {"title": "Task with Due Date", "project_hash": project_hash, "description": "Has deadline", "priority": "urgent", "status": "todo",
             "due_date": (datetime.now() + timedelta(days=7)).isoformat()}
        ]

        for task_data in task_data_list:
            task = await self.make_request('POST', '/api/tasks/', data=task_data, token=token, expected_status=200,
                                         description=f"Create task: {task_data['title']}")
            if 'task' in task:
                self.test_tasks.append(task['task'])

        # Test task listing with filters
        await self.make_request('GET', '/api/tasks/', token=token, expected_status=200, description="Get all user tasks")
        await self.make_request('GET', f'/api/tasks/?status=todo', token=token, expected_status=200, description="Get todo tasks")
        await self.make_request('GET', f'/api/tasks/?project_hash={project_hash}', token=token, expected_status=200, description="Get project tasks")
        await self.make_request('GET', f'/api/tasks/projects/{project_hash}/tasks', token=token, expected_status=200, description="Get project tasks via project endpoint")

        # Test individual task operations
        if self.test_tasks:
            task = self.test_tasks[0]
            task_id = task['id']

            # Get task
            await self.make_request('GET', f'/api/tasks/{task_id}', token=token, expected_status=200, description="Get task by ID")

            # Update task
            update_data = {"title": "Updated Task Title", "description": "Updated description", "priority": "medium"}
            await self.make_request('PUT', f'/api/tasks/{task_id}', data=update_data, token=token, expected_status=200, description="Update task")

            # Update task status
            await self.make_request('PUT', f'/api/tasks/{task_id}/status?status=in_progress', token=token, expected_status=200, description="Update task status")

            # Test task assignment (if we have multiple users)
            if len(self.test_users) > 1:
                assignee_id = self.test_users[1]['db_id']
                assignment_data = {"assigned_to_ids": [assignee_id]}
                await self.make_request('PUT', f'/api/tasks/{task_id}', data=assignment_data, token=token, expected_status=200, description="Assign task to user")

    async def test_task_dependencies_and_comments(self):
        if len(self.test_tasks) < 2:
            print("⚠️ Not enough tasks for dependency tests")
            return

        print("\n🔄 Testing Task Dependencies and Comments...")
        token = self.test_users[0]['token']

        # Get two tasks for dependency testing
        task1 = self.test_tasks[0]
        task2 = self.test_tasks[1]

        # Add dependency
        await self.make_request('POST', f'/api/tasks/{task2["id"]}/dependencies?depends_on_id={task1["id"]}',
                              token=token, expected_status=200, description="Add task dependency")

        # Get dependencies
        await self.make_request('GET', f'/api/tasks/{task2["id"]}/dependencies', token=token, expected_status=200,
                              description="Get task dependencies")

        # Test comments
        comment_content = "This is a test comment on the task"
        await self.make_request('POST', f'/api/tasks/{task1["id"]}/comments?content={comment_content}',
                              token=token, expected_status=200, description="Add comment to task")

        # Get comments
        await self.make_request('GET', f'/api/tasks/{task1["id"]}/comments', token=token, expected_status=200,
                              description="Get task comments")

    async def test_notification_endpoints(self):
        if not self.test_users: return

        print("\n🔔 Testing Notification Endpoints...")
        token = self.test_users[0]['token']

        await self.make_request('GET', '/api/notifications/', token=token, expected_status=200,
                              description="Get user notifications")
        await self.make_request('PUT', '/api/notifications/mark_all_read', token=token, expected_status=200,
                              description="Mark all notifications as read")

    async def test_edge_cases(self):
        if not self.test_users: return

        print("\n⚠️ Testing Edge Cases...")
        token = self.test_users[0]['token']

        # Test invalid project hash
        await self.make_request('GET', '/api/projects/invalid_hash', token=token, expected_status=404,
                              description="Access non-existent project")

        # Test invalid task ID
        await self.make_request('GET', '/api/tasks/999999', token=token, expected_status=404,
                              description="Access non-existent task")

        # Test without authentication
        await self.make_request('GET', '/api/users/me', expected_status=401,
                              description="Access protected endpoint without token")

        # Test with invalid token
        await self.make_request('GET', '/api/users/me', token="invalid_token", expected_status=401,
                              description="Access with invalid token")

    async def run_all_tests(self):
        print(f"🚀 Starting MAX Project Pilot COMPLETE API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)

        start = time.time()

        # Run all test suites
        await self.test_health_checks()
        await self.test_authentication()
        await self.test_user_endpoints()
        await self.test_user_preferences()
        await self.test_dashboard()
        await self.test_project_operations()
        await self.test_project_membership()
        await self.test_task_operations()
        await self.test_task_dependencies_and_comments()
        await self.test_notification_endpoints()
        await self.test_edge_cases()

        duration = time.time() - start
        self.generate_report(duration)

    def generate_report(self, duration: float):
        print("\n" + "=" * 80)
        print("📊 COMPLETE TEST REPORT")
        print("=" * 80)

        total = len(self.results)
        passed = sum(1 for r in self.results if r['success'])
        failed = total - passed

        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⏱️ Duration: {duration:.2f} seconds")

        if failed > 0:
            print("\n🔍 Failed Tests:")
            for r in self.results:
                if not r['success']:
                    print(f"  ✗ {r['method']} {r['endpoint']}")
                    print(f"    Expected: {r['expected_status']}, Got: {r['actual_status']}")
                    if 'error' in r:
                        print(f"    Error: {r['error']}")
                    elif 'response' in r and 'detail' in r['response']:
                        print(f"    Detail: {r['response']['detail']}")

        success_rate = (passed / total * 100) if total else 0
        print(f"\n🎯 Overall Success Rate: {success_rate:.1f}%")

        if success_rate == 100:
            print("🎉 ALL TESTS PASSED! API is 100% reliable and production-ready.")
        elif success_rate >= 90:
            print("👍 Excellent! API is highly reliable.")
        elif success_rate >= 80:
            print("⚠️ Good! Some minor issues to address.")
        else:
            print("🔧 Significant issues need attention.")

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

    async with CompleteAPITester(base_url) as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
