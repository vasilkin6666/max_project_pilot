#!/bin/bash

# MAX Project Pilot - Comprehensive API Test Script
# Тестирует все эндпоинты API с улучшенной обработкой ошибок и логированием

# Настройки
BASE_URL="http://localhost:8000"
API_URL="$BASE_URL/api"
AUTH_TOKEN=""
USER_ID=""
PROJECT_HASH=""
TASK_ID=""
SECOND_TOKEN=""
SECOND_USER_ID=""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Переменные для статистики
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Функции для вывода
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_subheader() {
    echo -e "\n${CYAN}--- $1 ---${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_warning() {
    echo -e "${PURPLE}⚠ $1${NC}"
}

# Функции для работы с JSON
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

extract_json_number() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":[^,}]*" | cut -d':' -f2 | tr -d ' "'
}

# Функция для выполнения запросов с правильной передачей заголовков
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    local expected_status=${5:-200}
    local should_fail=${6:-false}
    local auth_token=${7:-$AUTH_TOKEN}

    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "URL: $method $url"
    echo "Auth Token: ${auth_token:0:20}..."

    local curl_cmd
    local headers=()

    # Добавляем заголовок авторизации если есть токен
    if [ -n "$auth_token" ]; then
        headers+=(-H "Authorization: Bearer $auth_token")
    fi

    # Добавляем Content-Type для POST/PUT запросов с данными
    if [ -n "$data" ]; then
        headers+=(-H "Content-Type: application/json")
    fi

    # Формируем команду curl
    if [ -n "$data" ]; then
        curl_cmd="curl -s -X $method \"$url\" ${headers[@]} -d '$data' -w \" HTTP_STATUS:%{http_code}\""
    else
        curl_cmd="curl -s -X $method \"$url\" ${headers[@]} -w \" HTTP_STATUS:%{http_code}\""
    fi

    echo "Command: $curl_cmd"
    local response=$(eval $curl_cmd 2>/dev/null)

    local http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
    local response_body=$(echo "$response" | sed 's/ HTTP_STATUS:[0-9]*$//')

    echo "Response: $response_body"
    echo "Status: $http_status"

    # Проверяем результат
    if [ "$should_fail" = "true" ]; then
        if [ "$http_status" -ge 400 ] && [ "$http_status" -lt 600 ]; then
            print_success "EXPECTED FAILURE - SUCCESS"
            return 0
        else
            print_error "UNEXPECTED SUCCESS - Expected failure but got success (Status: $http_status)"
            return 1
        fi
    else
        if [ "$http_status" -eq "$expected_status" ]; then
            print_success "SUCCESS"
            return 0
        else
            print_error "FAILED (Status: $http_status, Expected: $expected_status)"
            return 1
        fi
    fi
}

# Функция для создания пользователя
create_user() {
    local max_id=$1
    local full_name=$2
    local username=$3

    print_info "Creating user: $max_id"
    local response=$(curl -s -X POST "$API_URL/auth/token" \
        -H "Content-Type: application/json" \
        -d "{
            \"max_id\": \"$max_id\",
            \"full_name\": \"$full_name\",
            \"username\": \"$username\"
        }")

    echo "Response: $response"
    echo "$response"
}

# Основной скрипт
main() {
    print_header "MAX Project Pilot - Comprehensive API Testing"
    echo "Started at: $(date)"
    echo "Base URL: $BASE_URL"

    # 1. Health Checks
    print_header "1. Health Checks"
    make_request "GET" "$BASE_URL/health" "" "Application Health Check" 200 false ""
    make_request "GET" "$API_URL/health" "" "API Health Check" 200 false ""
    make_request "GET" "$BASE_URL/" "" "Root Endpoint" 200 false ""

    # 2. Authentication
    print_header "2. Authentication"

    # Создание основного пользователя
    print_subheader "Primary User Authentication"
    local auth_response=$(create_user "test_user_123" "Test User" "testuser")
    AUTH_TOKEN=$(extract_json_value "$auth_response" "access_token")
    USER_ID=$(extract_json_value "$auth_response" "max_id")

    if [ -z "$AUTH_TOKEN" ]; then
        print_error "Failed to get authentication token for primary user"
        print_info "Response was: $auth_response"
        # Попробуем извлечь токен альтернативным способом
        AUTH_TOKEN=$(echo "$auth_response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
        if [ -z "$AUTH_TOKEN" ]; then
            exit 1
        fi
    fi

    print_success "Primary token obtained: ${AUTH_TOKEN:0:20}..."
    print_success "Primary User ID: $USER_ID"

    # Создание второго пользователя
    print_subheader "Secondary User Authentication"
    local second_auth_response=$(create_user "test_user_456" "Second Test User" "testuser2")
    SECOND_TOKEN=$(extract_json_value "$second_auth_response" "access_token")
    SECOND_USER_ID=$(extract_json_value "$second_auth_response" "max_id")

    if [ -z "$SECOND_TOKEN" ]; then
        print_error "Failed to get authentication token for secondary user"
        SECOND_TOKEN=$(echo "$second_auth_response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
        if [ -z "$SECOND_TOKEN" ]; then
            print_warning "Continuing without secondary token"
        fi
    else
        print_success "Secondary token obtained: ${SECOND_TOKEN:0:20}..."
        print_success "Secondary User ID: $SECOND_USER_ID"
    fi

    # 3. User Endpoints
    print_header "3. User Endpoints"

    print_subheader "Current User Operations"
    make_request "GET" "$API_URL/users/me" "" "Get Current User" 200 false "$AUTH_TOKEN"

    # Обновление пользователя
    make_request "PUT" "$API_URL/users/me" '{"full_name": "Updated Test User", "username": "updateduser"}' "Update Current User" 200 false "$AUTH_TOKEN"

    print_subheader "User Profile Operations"
    make_request "GET" "$API_URL/users/$USER_ID" "" "Get User by ID" 200 false "$AUTH_TOKEN"
    make_request "GET" "$API_URL/users/$USER_ID/projects" "" "Get User Projects" 200 false "$AUTH_TOKEN"

    print_subheader "User Access Control Tests"
    # Попытка доступа к чужому профилю (должна завершиться ошибкой)
    if [ -n "$SECOND_TOKEN" ]; then
        make_request "GET" "$API_URL/users/$USER_ID" "" "Access Other User Profile (Should Fail)" 403 true "$SECOND_TOKEN"
    else
        print_warning "Skipping access control test - no secondary token"
    fi

    # 4. Project Endpoints
    print_header "4. Project Endpoints"

    print_subheader "Project Creation"
    local project_response=$(curl -s -X POST "$API_URL/projects/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{
            "title": "Test Project",
            "description": "Test Description",
            "is_private": false,
            "requires_approval": false
        }')

    echo "Project Creation Response: $project_response"
    PROJECT_HASH=$(extract_json_value "$project_response" "hash")

    if [ -z "$PROJECT_HASH" ]; then
        print_error "Failed to create project or get project hash"
        print_info "Trying alternative extraction method..."
        PROJECT_HASH=$(echo "$project_response" | grep -o '"hash":"[^"]*' | cut -d'"' -f4)
    fi

    if [ -n "$PROJECT_HASH" ]; then
        print_success "Project created with hash: $PROJECT_HASH"

        print_subheader "Project Operations"
        make_request "GET" "$API_URL/projects/$PROJECT_HASH" "" "Get Project by Hash" 200 false "$AUTH_TOKEN"
        make_request "GET" "$API_URL/projects/$PROJECT_HASH/summary" "" "Get Project Summary" 200 false "$AUTH_TOKEN"

        print_subheader "Project Join System"
        # Присоединение второго пользователя к проекту
        if [ -n "$SECOND_TOKEN" ]; then
            make_request "POST" "$API_URL/projects/$PROJECT_HASH/join" "" "Second User Join Project" 200 false "$SECOND_TOKEN"
        fi

        # Проверка запросов на присоединение
        make_request "GET" "$API_URL/projects/$PROJECT_HASH/join-requests" "" "Get Join Requests" 200 false "$AUTH_TOKEN"

        print_subheader "Project Management"
        make_request "POST" "$API_URL/projects/$PROJECT_HASH/regenerate-invite" "" "Regenerate Invite Hash" 200 false "$AUTH_TOKEN"
    else
        print_warning "Skipping project operations - no project hash"
    fi

    # 5. Task Endpoints
    if [ -n "$PROJECT_HASH" ]; then
        print_header "5. Task Endpoints"

        print_subheader "Task Creation"
        local task_response=$(curl -s -X POST "$API_URL/tasks/" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "{
                \"title\": \"Test Task\",
                \"project_hash\": \"$PROJECT_HASH\",
                \"description\": \"Test Task Description\",
                \"status\": \"todo\",
                \"priority\": \"medium\"
            }")

        echo "Task Creation Response: $task_response"
        TASK_ID=$(extract_json_number "$task_response" "id")

        if [ -n "$TASK_ID" ]; then
            print_success "Task created with ID: $TASK_ID"

            print_subheader "Task Operations"
            make_request "GET" "$API_URL/tasks/$TASK_ID/dependencies" "" "Get Task Dependencies" 200 false "$AUTH_TOKEN"
            make_request "PUT" "$API_URL/tasks/$TASK_ID/status?status=in_progress" "" "Update Task Status" 200 false "$AUTH_TOKEN"
        else
            print_warning "Skipping task operations - no task ID"
        fi
    else
        print_warning "Skipping task endpoints - no project hash"
    fi

    # 6. Notification Endpoints
    print_header "6. Notification Endpoints"
    make_request "GET" "$API_URL/notifications/" "" "Get User Notifications" 200 false "$AUTH_TOKEN"
    make_request "PUT" "$API_URL/notifications/mark_all_read" "" "Mark All Notifications as Read" 200 false "$AUTH_TOKEN"

    # 7. Error Handling Tests
    print_header "7. Error Handling Tests"
    make_request "GET" "$API_URL/users/nonexistent_user" "" "Get Non-Existent User" 404 true "$AUTH_TOKEN"
    make_request "GET" "$API_URL/projects/invalid_hash" "" "Get Project with Invalid Hash" 404 true "$AUTH_TOKEN"
    make_request "GET" "$API_URL/tasks/999999" "" "Get Non-Existent Task" 404 true "$AUTH_TOKEN"
    make_request "GET" "$API_URL/users/me" "" "Access Without Token" 401 true ""
    make_request "GET" "$API_URL/users/me" "" "Access With Invalid Token" 401 true "invalid_token"

    # Финальный отчет
    print_header "TESTING COMPLETE"
    echo "Finished at: $(date)"

    # Статистика
    echo -e "\n${GREEN}=== TESTING SUMMARY ===${NC}"
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    else
        echo -e "\n${RED}❌ SOME TESTS FAILED ❌${NC}"
    fi
}

# Проверка зависимостей
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    print_success "All dependencies satisfied"
}

# Проверка доступности сервера
check_server() {
    print_info "Checking server availability..."
    if curl -s "$BASE_URL/health" | grep -q '"status":"ok"'; then
        print_success "Server is available"
    else
        print_error "Server is not available at $BASE_URL"
        exit 1
    fi
}

# Основная функция
run_tests() {
    print_header "Starting MAX Project Pilot API Tests"
    check_dependencies
    check_server
    main
}

# Запуск тестов
run_tests "$@"
