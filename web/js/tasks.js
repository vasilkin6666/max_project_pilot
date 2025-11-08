// web/js/tasks.js
// import { getTasks, getProjectTasks, updateTaskStatus } from './api.js'; // Если используем ES6 modules

let currentTaskId = null;
let currentTaskDetails = null;
let taskSearchFuse = null;

async function loadTasks(status = null) {
    if (!currentUserId) {
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра задач войдите в систему</p>
            </div>`;
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getTasks(currentUserId, token); // Предполагаем, что getTasks определена в api.js или импортирована
        const tasks = data.tasks || [];

        // Фильтрация по статусу
        const filteredTasks = status ? tasks.filter(t => t.status === status) : tasks;

        const container = document.getElementById('tasks-list');
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                    <h6>Задач пока нет</h6>
                    <p class="text-muted">Создайте первую задачу в проекте!</p>
                </div>`;
            return;
        }

        container.innerHTML = filteredTasks.map(task => {
            const statusColor = getStatusColor(task.status); // Предполагаем, что функция определена в main.js или utils.js
            const statusText = getStatusText(task.status); // Предполагаем, что функция определена в main.js или utils.js
            return `
                <div class="task-item task-${task.status} max-card" onclick="openTaskModal(${task.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">${task.title}</h6>
                            <p class="text-muted small mb-1">${task.description ? task.description.substring(0, 50) + '...' : ''}</p>
                            <div class="d-flex align-items-center">
                                <span class="badge bg-${statusColor} me-2">${statusText}</span>
                                <span class="text-muted small">${formatDate(task.created_at)}</span>
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="text-muted small">Проект: ${task.project.title}</div>
                            <div class="text-muted small">Приоритет: ${task.priority}</div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // Инициализация поиска
        taskSearchFuse = new Fuse(tasks, {
            keys: ['title', 'description'],
            threshold: 0.3
        });

    } catch (error) {
        console.error('Tasks load error:', error);
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить задачи</p>
            </div>`;
    }
}

function openTaskModal(taskId) {
    currentTaskId = taskId;
    // Загрузка деталей задачи и открытие модального окна
    // Пока упрощённо
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        currentTaskDetails = data.task;
        document.getElementById('taskModalTitle').textContent = data.task.title;
        document.getElementById('taskModalProjectTitle').textContent = data.task.project.title;
        document.getElementById('taskModalDescription').textContent = data.task.description || '';
        document.getElementById('taskModalStatus').value = data.task.status;

        // Заполнение assignees
        const assigneeSelect = document.getElementById('taskModalAssignees');
        assigneeSelect.innerHTML = '';
        data.task.project.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_id;
            option.textContent = member.user.full_name;
            if (data.task.assigned_to_id === member.user_id) option.selected = true;
            assigneeSelect.appendChild(option);
        });

        // Заполнение подзадач
        const subtasksContainer = document.getElementById('taskModalSubtasks');
        subtasksContainer.innerHTML = data.task.subtasks ? data.task.subtasks.map(st => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="" id="subtask${st.id}" ${st.status === 'done' ? 'checked' : ''} disabled>
                <label class="form-check-label" for="subtask${st.id}">${st.title}</label>
            </div>
        `).join('') : '';

        // Заполнение комментариев
        const commentsContainer = document.getElementById('taskModalComments');
        commentsContainer.innerHTML = data.task.comments ? data.task.comments.map(c => `
            <div class="comment-item mb-2">
                <strong>${c.user.full_name}</strong> <small class="text-muted">${formatDate(c.created_at)}</small>
                <p class="mb-1">${escapeHTML(c.content)}</p>
            </div>
        `).join('') : '';

        // Заполнение файлов
        const filesContainer = document.getElementById('taskModalFiles');
        filesContainer.innerHTML = data.task.attachments ? data.task.attachments.map(att => `
            <a href="${att.url}" target="_blank">${att.filename}</a>
        `).join('<br>') : 'Нет прикреплённых файлов';

        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        modal.show();
    })
    .catch(err => console.error('Error loading task details:', err));
}

function updateTask() {
    if (!currentUserId || !currentTaskId) return;
    const token = localStorage.getItem('access_token');
    const newStatus = document.getElementById('taskModalStatus').value;
    updateTaskStatus(currentTaskId, newStatus, token) // Предполагаем, что updateTaskStatus определена в api.js или импортирована
        .then(() => {
            alert('Задача обновлена!');
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            modal.hide();
            if (currentSection === 'tasks') {
                loadTasks(); // Перезагрузить задачи
            }
        })
        .catch(err => {
            console.error('Update task error:', err);
            alert('Ошибка обновления задачи');
        });
}

function debounceSaveTaskDescription() {
    debounce(async () => { // Предполагаем, что debounce определена в main.js или utils.js
        if (!currentTaskId) return;
        const newDesc = document.getElementById('taskModalDescription').textContent;
        // Реализовать PUT запрос для обновления описания
        // PUT /api/tasks/{id}/description
        // console.log('Saving description for task', currentTaskId, ':', newDesc);
    }, 500)();
}

function addSubtask() {
    const title = prompt('Введите название подзадачи:');
    if (title) {
        // Реализовать POST запрос для создания подзадачи
        // POST /api/tasks/
        // console.log('Adding subtask:', title, 'to task', currentTaskId);
    }
}

function addComment() {
    const text = document.getElementById('newCommentText').value.trim();
    if (!text) return;
    // Реализовать POST запрос для создания комментария
    // POST /api/tasks/{id}/comments
    // console.log('Adding comment:', text, 'to task', currentTaskId);
    document.getElementById('newCommentText').value = '';
}

function searchTasks() {
    const query = document.getElementById('searchTasksInput').value;
    if (!taskSearchFuse || !query) {
        loadTasks(); // Показать все задачи, если нет запроса
        return;
    }
    const results = taskSearchFuse.search(query);
    const container = document.getElementById('tasks-list');
    if (results.length === 0) {
        container.innerHTML = '<p class="text-muted">Задачи не найдены.</p>';
        return;
    }
    container.innerHTML = results.map(result => {
        const task = result.item;
        const statusColor = getStatusColor(task.status); // Предполагаем, что функция определена в main.js или utils.js
        const statusText = getStatusText(task.status); // Предполагаем, что функция определена в main.js или utils.js
        return `
            <div class="task-item task-${task.status} max-card" onclick="openTaskModal(${task.id})">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${task.title}</h6>
                        <p class="text-muted small mb-1">${task.description ? task.description.substring(0, 50) + '...' : ''}</p>
                        <div class="d-flex align-items-center">
                            <span class="badge bg-${statusColor} me-2">${statusText}</span>
                            <span class="text-muted small">${formatDate(task.created_at)}</span>
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="text-muted small">Проект: ${task.project.title}</div>
                        <div class="text-muted small">Приоритет: ${task.priority}</div>
                    </div>
                </div>
            </div>`;
    }).join('');
}
