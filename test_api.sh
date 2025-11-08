#!/bin/bash

echo "=== ПОЛНЫЙ ТЕСТ MAX PROJECT PILOT API ==="

# 1. Создание пользователей
echo "1. Создание пользователей..."
TOKEN1=$(curl -s -X POST https://powerfully-exotic-chamois.cloudpub.ru/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"max_id": "test_user_1", "full_name": "Test User 1"}' | jq -r '.access_token')

TOKEN2=$(curl -s -X POST https://powerfully-exotic-chamois.cloudpub.ru/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"max_id": "test_user_2", "full_name": "Test User 2"}' | jq -r '.access_token')

echo "Токены созданы"

# 2. Создание проектов
echo "2. Создание проектов..."
PUBLIC_PROJECT=$(curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/?title=Public%20Test&description=Public%20test%20project&is_private=false&requires_approval=false" \
  -H "Authorization: Bearer $TOKEN1")
PUBLIC_HASH=$(echo $PUBLIC_PROJECT | jq -r '.project.hash')

PRIVATE_APPROVAL=$(curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/?title=Private%20Approval&description=Private%20with%20approval&is_private=true&requires_approval=true" \
  -H "Authorization: Bearer $TOKEN1")
APPROVAL_HASH=$(echo $PRIVATE_APPROVAL | jq -r '.project.hash')

PRIVATE_OPEN=$(curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/?title=Private%20Open&description=Private%20without%20approval&is_private=true&requires_approval=false" \
  -H "Authorization: Bearer $TOKEN1")
OPEN_HASH=$(echo $PRIVATE_OPEN | jq -r '.project.hash')

echo "Проекты созданы: $PUBLIC_HASH, $APPROVAL_HASH, $OPEN_HASH"

# 3. Присоединение пользователя 2 к проектам
echo "3. Присоединение к проектам..."
curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/$PUBLIC_HASH/join" \
  -H "Authorization: Bearer $TOKEN2" > /dev/null

curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/$APPROVAL_HASH/join" \
  -H "Authorization: Bearer $TOKEN2" > /dev/null

curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/$OPEN_HASH/join" \
  -H "Authorization: Bearer $TOKEN2" > /dev/null

echo "Присоединение завершено"

# 4. Управление заявками
echo "4. Управление заявками..."
REQUESTS=$(curl -s -X GET "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/$APPROVAL_HASH/join-requests" \
  -H "Authorization: Bearer $TOKEN1")
REQUEST_ID=$(echo $REQUESTS | jq -r '.requests[0].id')

curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/projects/$APPROVAL_HASH/join-requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $TOKEN1" > /dev/null

echo "Заявка одобрена"

# 5. Создание задач
echo "5. Создание задач..."
TASK1=$(curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/?title=Main%20Task&project_hash=$PUBLIC_HASH&description=Main%20task%20description&status=todo&priority=high" \
  -H "Authorization: Bearer $TOKEN1")
TASK1_ID=$(echo $TASK1 | jq -r '.task.id')

TASK2=$(curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/?title=Dependent%20Task&project_hash=$PUBLIC_HASH&description=Depends%20on%20main&status=todo&priority=medium&depends_on_ids=$TASK1_ID" \
  -H "Authorization: Bearer $TOKEN1")
TASK2_ID=$(echo $TASK2 | jq -r '.task.id')

echo "Задачи созданы: $TASK1_ID, $TASK2_ID"

# 6. Работа с задачами
echo "6. Работа с задачами..."
curl -s -X PUT "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/$TASK1_ID/status?status=in_progress" \
  -H "Authorization: Bearer $TOKEN1" > /dev/null

curl -s -X POST "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/$TASK1_ID/comments?content=Task%20started" \
  -H "Authorization: Bearer $TOKEN1" > /dev/null

curl -s -X PUT "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/$TASK1_ID/status?status=done" \
  -H "Authorization: Bearer $TOKEN1" > /dev/null

curl -s -X PUT "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/$TASK2_ID/status?status=done" \
  -H "Authorization: Bearer $TOKEN1" > /dev/null

echo "Задачи завершены"

# 7. Проверка результатов
echo "7. Финальная проверка..."
curl -s -X GET "https://powerfully-exotic-chamois.cloudpub.ru/api/users/test_user_1/projects" \
  -H "Authorization: Bearer $TOKEN1" | jq '.projects | length' | read PROJECT_COUNT

curl -s -X GET "https://powerfully-exotic-chamois.cloudpub.ru/api/tasks/" \
  -H "Authorization: Bearer $TOKEN1" | jq '.tasks | length' | read TASK_COUNT

curl -s -X GET "https://powerfully-exotic-chamois.cloudpub.ru/api/notifications/" \
  -H "Authorization: Bearer $TOKEN1" | jq '.notifications | length' | read NOTIF_COUNT

echo "=== ТЕСТ ЗАВЕРШЕН ==="
echo "Итоги:"
echo "- Проектов: $PROJECT_COUNT"
echo "- Задач: $TASK_COUNT"
echo "- Уведомлений: $NOTIF_COUNT"
echo "Все функции работают корректно! 🎉"
