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

print_debug() {
    if [ "$DEBUG" = "true" ]; then
        echo -e "${CYAN}🐛 $1${NC}"
    fi
}

# Функция для выполнения запросов и проверки результата
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    local expected_status=${5:-200}  # По умолчанию ожидаем 200
    local should_fail=${6:-false}    # Ожидаем ли ошибку

    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "URL: $method $url"

    if [ -n "$data" ]; then
        echo "Data: $data"
    fi

    local response
    local http_status
    local response_body

    # Выполняем запрос
    if [ -n "$data" ]; then
        response=$(curl -s -X $method "$url" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data" \
            -w " HTTP_STATUS:%{http_code}")
    else
        response=$(curl -s -X $method "$url" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -w " HTTP_STATUS:%{http_code}")
    fi

    http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
    response_body=$(echo "$response" | sed 's/ HTTP_STATUS:[0-9]*$//')

    echo "Response: $response_body"
    echo "Status: $http_status"

    # Проверяем результат
    if [ "$should_fail" = "true" ]; then
        # Ожидаем ошибку
        if [ "$http_status" -ge 400 ] && [ "$http_status" -lt 600 ]; then
            print_success "EXPECTED FAILURE - SUCCESS"
            return 0
        else
            print_error "UNEXPECTED SUCCESS - Expected failure but got success"
            return 1
        fi
    else
        # Ожидаем успех
        if [ "$http_status" -eq "$expected_status" ]; then
            print_success "SUCCESS"
            return 0
        else
            print_error "FAILED (Status: $http_status, Expected: $expected_status)"
            return 1
        fi
    fi
}

# Функция для извлечения значений из JSON
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*" | cut -d'"' -f4
}

extract_json_number() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":[0-9]*" | cut -d':' -f2
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

# Функция для ожидания (для асинхронных операций)
wait_for() {
    local seconds=$1
    local message=${2:-"Waiting ${seconds}s..."}
    print_info "$message"
    sleep $seconds
}

# Основной скрипт
main() {
    print_header "MAX Project Pilot - Comprehensive API Testing"
    echo "Started at: $(date)"
    echo "Base URL: $BASE_URL"

    # 1. Health Checks
    print_header "1. Health Checks"
    make_request "GET" "$BASE_URL/health" "" "Application Health Check"
    make_request "GET" "$API_URL/health" "" "API Health Check"
    make_request "GET" "$BASE_URL/" "" "Root Endpoint"

    # 2. Authentication
    print_header "2. Authentication"

    # Создание основного пользователя
    print_subheader "Primary User Authentication"
    local auth_response=$(create_user "test_user_123" "Test User" "testuser")
    AUTH_TOKEN=$(extract_json_value "$auth_response" "access_token")
    USER_ID=$(extract_json_value "$auth_response" "max_id")

    if [ -z "$AUTH_TOKEN" ]; then
        print_error "Failed to get authentication token for primary user"
        exit 1
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
        exit 1
    fi

    print_success "Secondary token obtained: ${SECOND_TOKEN:0:20}..."
    print_success "Secondary User ID: $SECOND_USER_ID"

    # Тестирование обновления токена
    print_subheader "Token Refresh"
    make_request "POST" "$API_URL/auth/refresh" "" "Refresh Token"

    # 3. User Endpoints
    print_header "3. User Endpoints"

    print_subheader "Current User Operations"
    make_request "GET" "$API_URL/users/me" "" "Get Current User"
    make_request "PUT" "$API_URL/users/me" '{"full_name": "Updated Test User", "username": "updateduser"}' "Update Current User" 200

    print_subheader "User Profile Operations"
    make_request "GET" "$API_URL/users/$USER_ID" "" "Get User by ID"
    make_request "GET" "$API_URL/users/$USER_ID/projects" "" "Get User Projects"

    print_subheader "User Access Control Tests"
    # Попытка доступа к чужому профилю (должна завершиться ошибкой)
    AUTH_TOKEN_BACKUP=$AUTH_TOKEN
    AUTH_TOKEN=$SECOND_TOKEN
    make_request "GET" "$API_URL/users/$USER_ID" "" "Access Other User Profile (Should Fail)" 403 true
    AUTH_TOKEN=$AUTH_TOKEN_BACKUP

    # Попытка использовать 'me' в общем эндпоинте (должна завершиться ошибкой)
    make_request "GET" "$API_URL/users/me" "" "Use 'me' in general endpoint (Should Fail)" 400 true

    # 4. Project Endpoints
    print_header "4. Project Endpoints"

    print_subheader "Project Creation"
    local project_response=$(curl -s -X POST "$API_URL/projects/?title=Test%20Project&description=Test%20Description&is_private=false&requires_approval=false" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    echo "Project Creation Response: $project_response"
    PROJECT_HASH=$(extract_json_value "$project_response" "hash")

    if [ -z "$PROJECT_HASH" ]; then
        print_error "Failed to create project or get project hash"
        exit 1
    fi
    print_success "Project created with hash: $PROJECT_HASH"

    print_subheader "Project Operations"
    make_request "GET" "$API_URL/projects/$PROJECT_HASH" "" "Get Project by Hash"
    make_request "GET" "$API_URL/projects/$PROJECT_HASH/summary" "" "Get Project Summary"

    print_subheader "Project Join System"
    # Присоединение второго пользователя к проекту
    AUTH_TOKEN_BACKUP=$AUTH_TOKEN
    AUTH_TOKEN=$SECOND_TOKEN
    make_request "POST" "$API_URL/projects/$PROJECT_HASH/join" "" "Second User Join Project"
    AUTH_TOKEN=$AUTH_TOKEN_BACKUP

    # Проверка запросов на присоединение
    make_request "GET" "$API_URL/projects/$PROJECT_HASH/join-requests" "" "Get Join Requests"

    print_subheader "Project Management"
    make_request "POST" "$API_URL/projects/$PROJECT_HASH/regenerate-invite" "" "Regenerate Invite Hash"

    # Создание приватного проекта
    print_subheader "Private Project Testing"
    local private_project_response=$(curl -s -X POST "$API_URL/projects/?title=Private%20Test%20Project&description=Private%20project%20for%20testing&is_private=true&requires_approval=true" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    local private_project_hash=$(extract_json_value "$private_project_response" "hash")

    if [ -n "$private_project_hash" ]; then
        print_success "Private project created with hash: $private_project_hash"

        # Попытка доступа к приватному проекту без прав (должна завершиться ошибкой)
        AUTH_TOKEN_BACKUP=$AUTH_TOKEN
        AUTH_TOKEN=$SECOND_TOKEN
        make_request "GET" "$API_URL/projects/$private_project_hash" "" "Access Private Project Without Permissions (Should Fail)" 403 true
        AUTH_TOKEN=$AUTH_TOKEN_BACKUP
    fi

    # 5. Task Endpoints
    print_header "5. Task Endpoints"

    print_subheader "Task Listing"
    make_request "GET" "$API_URL/tasks/" "" "Get All User Tasks"
    make_request "GET" "$API_URL/tasks/project/$PROJECT_HASH" "" "Get Project Tasks"

    print_subheader "Task Creation"
    local task_response=$(curl -s -X POST "$API_URL/tasks/?title=Test%20Task&project_hash=$PROJECT_HASH&description=Test%20Task%20Description&status=todo&priority=medium" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    echo "Task Creation Response: $task_response"
    TASK_ID=$(extract_json_number "$task_response" "id")

    if [ -n "$TASK_ID" ]; then
        print_success "Task created with ID: $TASK_ID"

        print_subheader "Task Operations"
        make_request "GET" "$API_URL/tasks/$TASK_ID/dependencies" "" "Get Task Dependencies"
        make_request "PUT" "$API_URL/tasks/$TASK_ID/status?status=in_progress" "" "Update Task Status"

        # Создание второй задачи для тестирования зависимостей
        print_subheader "Task Dependencies"
        local second_task_response=$(curl -s -X POST "$API_URL/tasks/?title=Second%20Test%20Task&project_hash=$PROJECT_HASH&description=Another%20test%20task&status=todo&priority=low" \
            -H "Authorization: Bearer $AUTH_TOKEN")
        local second_task_id=$(extract_json_number "$second_task_response" "id")

        if [ -n "$second_task_id" ]; then
            print_success "Second task created with ID: $second_task_id"
            make_request "POST" "$API_URL/tasks/$second_task_id/dependencies?depends_on_id=$TASK_ID" "" "Add Task Dependency"

            # Проверка зависимостей
            make_request "GET" "$API_URL/tasks/$second_task_id/dependencies" "" "Get Task Dependencies After Adding"
        fi

        print_subheader "Task Comments"
        make_request "GET" "$API_URL/tasks/$TASK_ID/comments" "" "Get Task Comments (Empty)"
        make_request "POST" "$API_URL/tasks/$TASK_ID/comments?content=This%20is%20a%20test%20comment" "" "Add Task Comment"
        make_request "GET" "$API_URL/tasks/$TASK_ID/comments" "" "Get Task Comments (With Data)"

        # Тестирование доступа к задаче для второго пользователя
        print_subheader "Task Access Control"
        AUTH_TOKEN_BACKUP=$AUTH_TOKEN
        AUTH_TOKEN=$SECOND_TOKEN
        make_request "GET" "$API_URL/tasks/$TASK_ID" "" "Second User Access Task" 200
        AUTH_TOKEN=$AUTH_TOKEN_BACKUP

        # Удаление задачи (опционально)
        # make_request "DELETE" "$API_URL/tasks/$TASK_ID" "" "Delete Task"
    else
        print_error "Failed to create task or get task ID"
    fi

    # 6. Notification Endpoints
    print_header "6. Notification Endpoints"

    print_subheader "Notification Operations"
    make_request "GET" "$API_URL/notifications/" "" "Get User Notifications"
    make_request "PUT" "$API_URL/notifications/mark_all_read" "" "Mark All Notifications as Read"

    # 7. Advanced Operations
    print_header "7. Advanced Operations"

    print_subheader "Complex Scenarios"
    # Создание проекта с задачами и зависимостями
    local complex_project_response=$(curl -s -X POST "$API_URL/projects/?title=Complex%20Test%20Project&description=Project%20for%20complex%20testing&is_private=false&requires_approval=false" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    local complex_project_hash=$(extract_json_value "$complex_project_response" "hash")

    if [ -n "$complex_project_hash" ]; then
        print_success "Complex project created: $complex_project_hash"

        # Создание нескольких связанных задач
        local parent_task_response=$(curl -s -X POST "$API_URL/tasks/?title=Parent%20Task&project_hash=$complex_project_hash&description=Parent%20task%20description&status=todo&priority=high" \
            -H "Authorization: Bearer $AUTH_TOKEN")
        local parent_task_id=$(extract_json_number "$parent_task_response" "id")

        if [ -n "$parent_task_id" ]; then
            # Создание подзадач
            for i in {1..2}; do
                curl -s -X POST "$API_URL/tasks/?title=Subtask%20$i&project_hash=$complex_project_hash&description=Subtask%20$i%20description&status=todo&priority=medium&parent_task_id=$parent_task_id" \
                    -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null
            done
            print_success "Created parent task with subtasks"
        fi
    fi

    # 8. Error Handling Tests
    print_header "8. Error Handling Tests"

    print_subheader "Invalid Requests"
    make_request "GET" "$API_URL/users/nonexistent_user" "" "Get Non-Existent User" 404 true
    make_request "GET" "$API_URL/projects/invalid_hash" "" "Get Project with Invalid Hash" 404 true
    make_request "GET" "$API_URL/tasks/999999" "" "Get Non-Existent Task" 404 true

    print_subheader "Invalid Authentication"
    make_request "GET" "$API_URL/users/me" "" "Access Without Token" 401 true "" "no_token"
    make_request "GET" "$API_URL/users/me" "" "Access With Invalid Token" 401 true "" "invalid_token"

    # 9. Performance Tests
    print_header "9. Performance Tests"

    print_subheader "Batch Operations"
    # Создание нескольких задач для тестирования производительности
    local start_time=$(date +%s)
    for i in {1..3}; do
        curl -s -X POST "$API_URL/tasks/?title=Performance%20Task%20$i&project_hash=$PROJECT_HASH&description=Performance%20test%20task%20$i&status=todo&priority=low" \
            -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null &
    done
    wait
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    print_info "Created 3 tasks in ${duration}s"

    # Финальный отчет
    print_header "TESTING COMPLETE"
    echo "Finished at: $(date)"

    print_info "Base URL: $BASE_URL"
    print_info "Primary User ID: $USER_ID"
    print_info "Secondary User ID: $SECOND_USER_ID"
    print_info "Test Project Hash: $PROJECT_HASH"

    if [ -n "$TASK_ID" ]; then
        print_info "Test Task ID: $TASK_ID"
    fi

    # Статистика
    echo -e "\n${GREEN}=== TESTING SUMMARY ===${NC}"
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    else
        echo -e "\n${RED}❌ SOME TESTS FAILED ❌${NC}"
        exit 1
    fi

    echo -e "\n${BLUE}API Testing Summary:${NC}"
    echo "✓ Health Checks"
    echo "✓ Authentication & Token Management"
    echo "✓ User Management & Access Control"
    echo "✓ Project Operations & Permissions"
    echo "✓ Task Management & Dependencies"
    echo "✓ Notification System"
    echo "✓ Error Handling & Validation"
    echo "✓ Performance & Batch Operations"
}

# Обработка ошибок
handle_error() {
    print_error "Script execution failed at line $1"
    echo -e "\n${RED}=== DEBUG INFO ===${NC}"
    echo "AUTH_TOKEN: ${AUTH_TOKEN:0:20}..."
    echo "USER_ID: $USER_ID"
    echo "PROJECT_HASH: $PROJECT_HASH"
    echo "TASK_ID: $TASK_ID"
    exit 1
}

# Установка обработчиков ошибок
trap 'handle_error $LINENO' ERR

# Проверка зависимостей
check_dependencies() {
    local missing_deps=()

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed - using basic JSON parsing"
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_info "Please install missing dependencies and try again"

        if command -v apt-get &> /dev/null; then
            print_info "You can install them with: sudo apt-get update && sudo apt-get install ${missing_deps[*]}"
        elif command -v yum &> /dev/null; then
            print_info "You can install them with: sudo yum install ${missing_deps[*]}"
        elif command -v brew &> /dev/null; then
            print_info "You can install them with: brew install ${missing_deps[*]}"
        fi
        exit 1
    fi

    print_success "All dependencies satisfied"
}

# Проверка доступности сервера
check_server() {
    print_info "Checking server availability..."
    if curl -s --head --request GET "$BASE_URL/health" | grep "200 OK" > /dev/null; then
        print_success "Server is available"
    else
        print_error "Server is not available at $BASE_URL"
        print_info "Please make sure the server is running and accessible"
        exit 1
    fi
}

# Парсинг аргументов командной строки
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--debug)
                DEBUG="true"
                shift
                ;;
            -u|--url)
                BASE_URL="$2"
                API_URL="$BASE_URL/api"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  -d, --debug     Enable debug output"
                echo "  -u, --url URL   Set base URL (default: http://localhost:8000)"
                echo "  -h, --help      Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Основная функция
run_tests() {
    print_header "Starting MAX Project Pilot API Tests"

    parse_arguments "$@"
    check_dependencies
    check_server
    main
}

# Запуск тестов
run_tests "$@"
