// js/app.js
// Глобальные переменные (как в index.txt)
let currentUser = null;
let currentProject = null;
let currentTask = null;
let userSettings = {};
let currentMemberToUpdate = null;
let currentMemberToRemove = null;

// Константы ролей (как в index.txt)
const ProjectRole = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    GUEST: 'guest'
};

// Основное приложение
class App {
  static async init() {
      try {
          console.log('Initializing app...');

          // Инициализируем аутентификацию
          currentUser = await AuthManager.initialize();

          // Загружаем данные
          await this.loadData();

          // Настраиваем обработчики событий
          this.setupEventListeners();

          // ИСПРАВЛЕНО: Показываем кнопку "Начать" вместо автоматического скрытия заставки
          showStartButton();
          // ИСПРАВЛЕНО: Добавляем обработчик клика на кнопку "Начать"
          attachStartButtonListener();

          // ИСПРАВЛЕНО: Обновляем прогресс-бар до 100% и меняем цвет
          const progressBar = document.getElementById('loadingBarProgress');
          if (progressBar) {
              progressBar.style.width = '100%';
              // Дополнительная анимация завершения, если нужно
              setTimeout(() => {
                  progressBar.style.background = 'var(--success)'; // Зеленый цвет при завершении
              }, 100);
          }

          console.log('App initialized successfully');
      } catch (error) {
          console.error('App initialization failed:', error);
          this.showError('Ошибка инициализации приложения: ' + error.message);
      }
  }

    static setupEventListeners() {
        // Navigation
        document.getElementById('dashboardBtn').addEventListener('click', () => {
            this.showDashboard();
        });
        document.getElementById('createProjectBtn').addEventListener('click', () => {
            this.showModal('createProjectModal');
        });
        document.getElementById('searchProjectsBtn').addEventListener('click', () => {
            this.showSearchProjects();
        });
        document.getElementById('notificationsBtn').addEventListener('click', () => {
            this.showNotifications();
        });
        document.getElementById('myTasksBtn').addEventListener('click', () => {
            this.showMyTasks();
        });
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        // Project View Actions
        document.getElementById('manageMembersBtn').addEventListener('click', () => {
            this.showProjectMembersManagement();
        });
        document.getElementById('joinRequestsBtn').addEventListener('click', () => {
            this.showJoinRequests();
        });
        document.getElementById('editProjectBtn').addEventListener('click', () => {
            this.showEditProjectModal();
        });
        document.getElementById('deleteProjectBtn').addEventListener('click', () => {
            this.showDeleteProjectModal();
        });

        // Task View Actions
        document.getElementById('createTaskBtn').addEventListener('click', () => {
            this.showCreateTaskModal();
        });
        document.getElementById('createSubtaskBtn').addEventListener('click', () => {
            this.showCreateSubtaskModal();
        });
        document.getElementById('editTaskBtn').addEventListener('click', () => {
            this.showEditTaskModal();
        });
        document.getElementById('deleteTaskBtn').addEventListener('click', () => {
            this.showDeleteTaskModal();
        });
        document.getElementById('addCommentBtn').addEventListener('click', () => {
            this.addComment();
        });

        // My Tasks Filters
        document.getElementById('tasksFilterStatus').addEventListener('change', () => {
            this.loadMyTasks();
        });
        document.getElementById('tasksFilterProject').addEventListener('change', () => {
            this.loadMyTasks();
        });

        // Search Projects
        document.getElementById('searchProjectsSubmitBtn').addEventListener('click', () => {
            this.searchProjects();
        });

        // Form submissions
        document.getElementById('submitCreateProjectBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCreateProject();
        });
        document.getElementById('submitEditProjectBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleUpdateProject();
        });
        document.getElementById('confirmDeleteProjectBtn').addEventListener('click', () => {
            this.handleDeleteProject();
        });
        document.getElementById('submitCreateTaskBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCreateTask();
        });
        document.getElementById('submitEditTaskBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleUpdateTask();
        });
        document.getElementById('confirmDeleteTaskBtn').addEventListener('click', () => {
            this.handleDeleteTask();
        });
        document.getElementById('joinProjectFromPreviewBtn').addEventListener('click', () => {
            this.joinProjectFromPreview();
        });

        // --- Добавлены обработчики для новых форм ---
        document.getElementById('submitCreateSubtaskBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCreateSubtask();
        });
        document.getElementById('submitUpdateMemberRoleBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleUpdateMemberRole();
        });
        document.getElementById('confirmRemoveMemberBtn').addEventListener('click', () => {
            this.handleRemoveMember();
        });

        // ИСПРАВЛЕНО: Добавляем обработчик изменения статуса задачи
        document.getElementById('taskStatusSelect').addEventListener('change', () => {
            this.updateTaskStatus();
        });

        // ИСПРАВЛЕНО: Обработчик Enter в поле поиска проектов
        document.getElementById('searchProjectsInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchProjects();
            }
        });
    }

    static async loadData() {
        try {
            console.log('Loading data...');
            // Загружаем дашборд с проектами
            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];
            const settings = dashboardData.settings || {};
            const recentTasks = dashboardData.recent_tasks || [];

            // Сохраняем настройки
            userSettings = settings;
            this.applyUserSettings(settings);

            this.renderProjects(projects);
            this.updateStats(projects, recentTasks);
            this.renderRecentTasks(recentTasks);
            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    // Применение настроек пользователя
    static applyUserSettings(settings) {
        if (settings.theme) {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }
    }

    static renderProjects(projects) {
        const container = document.getElementById('projectsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>Проектов пока нет</p>
                <button class="btn btn-primary" onclick="App.showModal('createProjectModal')">Создать проект</button>
            </div>`;
            return;
        }

        container.innerHTML = projects.map(project => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            const membersCount = stats.members_count || stats.membersCount || 0;
            const tasksCount = stats.tasks_count || stats.tasksCount || 0;
            const doneTasks = stats.tasks_done || stats.done_tasks || stats.doneTasks || 0;

            return `
            <div class="project-card hover-lift" onclick="App.openProject('${projectData.hash}')">
                <div class="project-card-header">
                    <h3 class="project-title">${this.escapeHtml(projectData.title)}</h3>
                    <span class="project-type-badge">${projectData.is_private ? '🔒' : '🌐'}</span>
                </div>
                <p class="project-description">${this.escapeHtml(projectData.description || 'Без описания')}</p>
                <div class="project-stats">
                    <span>Участников: ${membersCount}</span>
                    <span>Задач: ${tasksCount}</span>
                    <span>Выполнено: ${doneTasks}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${tasksCount > 0 ? (doneTasks / tasksCount) * 100 : 0}%"></div>
                </div>
            </div>`;
        }).join('');
    }

    static updateStats(projects, recentTasks) {
        // ИСПРАВЛЕНО: Правильный подсчет статистики
        document.getElementById('projectsCount').textContent = projects.length;
        const totalTasks = projects.reduce((sum, project) => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            return sum + (stats.tasks_count || stats.tasksCount || 0);
        }, 0);
        document.getElementById('tasksCount').textContent = totalTasks;
        document.getElementById('recentTasksCount').textContent = recentTasks ? recentTasks.length : 0;
    }

    static renderRecentTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p>Нет недавних задач</p>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            const projectTitle = task.project_title || (task.project && task.project.title) || 'N/A';
            return `
            <div class="task-card" onclick="App.openTask(${task.id})">
                <div class="task-card-header">
                    <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                    <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                </div>
                <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                <div class="task-card-footer">
                    <span>Проект: ${this.escapeHtml(projectTitle)}</span>
                </div>
            </div>`;
        }).join('');
    }

    static getStatusText(status) {
        const statusMap = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Выполнено'
        };
        return statusMap[status] || status;
    }

    static getPriorityText(priority) {
        const priorityMap = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'urgent': 'Срочный'
        };
        return priorityMap[priority] || priority;
    }

    static getRoleText(role) {
        const roleMap = {
            'owner': 'Владелец',
            'admin': 'Администратор',
            'member': 'Участник',
            'guest': 'Гость'
        };
        return roleMap[role] || role;
    }

    static escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Navigation methods
    static showView(viewId) {
        // Скрываем все вью
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });
        // Показываем нужную вью
        document.getElementById(viewId).style.display = 'block';
    }

    static showDashboard() {
        this.showView('dashboardView');
        this.loadData();
    }

    static async showSearchProjects() {
        this.showView('searchProjectsView');
        // Сбрасываем поле поиска
        document.getElementById('searchProjectsInput').value = '';
        // Показываем недавние публичные проекты при открытии
        await this.loadRecentPublicProjects();
    }

    static async loadRecentPublicProjects() {
        try {
            const response = await ApiService.searchPublicProjects();
            const projects = response.projects || [];
            const title = 'Недавние публичные проекты';
            this.renderSearchResults(projects, title);
        } catch (error) {
            console.error('Error loading recent public projects:', error);
            // Не показываем ошибку для этой опциональной функции
        }
    }

    static async showNotifications() {
        try {
            const response = await ApiService.getNotifications();
            const notifications = response.notifications || [];
            const container = document.getElementById('notificationsList');

            if (!notifications || notifications.length === 0) {
                container.innerHTML = '<p>Уведомлений нет</p>';
                return;
            }

            container.innerHTML = notifications.map(notification => {
                return `
                <div class="notification-item">
                    <div class="notification-content">${this.escapeHtml(notification.content)}</div>
                    <div class="notification-date">${new Date(notification.created_at).toLocaleString()}</div>
                </div>`;
            }).join('');

            this.showView('notificationsView');
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showError('Ошибка загрузки уведомлений: ' + error.message);
        }
    }

    static showSettings() {
        // Используем модальное окно для настроек
        this.showModal('settingsModal');
    }

    // Project methods
    static async openProject(projectHash) {
        try {
            console.log('Opening project:', projectHash);
            const projectData = await ApiService.getProject(projectHash);

            currentProject = projectData.project || projectData;
            currentProject.members = projectData.members || [];

            console.log('Opened project:', currentProject);

            // Update project view
            document.getElementById('projectTitleHeader').textContent = currentProject.title;
            document.getElementById('projectDescriptionText').textContent = currentProject.description || 'Без описания';
            document.getElementById('projectHashValue').textContent = currentProject.hash;
            document.getElementById('projectHashInfo').style.display = 'block';

            // Update stats
            document.getElementById('projectMembersCount').textContent = currentProject.members.length;

            const tasksResponse = await ApiService.getTasks(currentProject.hash);
            const tasks = tasksResponse.tasks || [];
            const totalTasks = tasks.length;
            const doneTasks = tasks.filter(t => t.status === 'done').length;
            const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

            document.getElementById('projectTotalTasks').textContent = totalTasks;
            document.getElementById('projectDoneTasks').textContent = doneTasks;
            document.getElementById('projectInProgressTasks').textContent = inProgressTasks;

            // Load tasks and members (с обработкой ошибок)
            await this.loadProjectTasks(currentProject.hash);

            try {
                await this.loadProjectMembers(currentProject.hash);
            } catch (memberError) {
                console.error('Failed to load members, but continuing:', memberError);
                // Можно показать уведомление, но не блокировать весь процесс
            }

            // Switch view
            this.showView('projectView');
        } catch (error) {
            console.error('Error opening project:', error);
            this.showError('Ошибка открытия проекта: ' + error.message);
        }
    }

    static async loadProjectTasks(projectHash) {
        try {
            const response = await ApiService.getTasks(projectHash);
            const tasks = response.tasks || [];
            const container = document.getElementById('projectTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<p>Задач нет</p>';
                return;
            }

            // Show only main tasks (without parent_task_id)
            const mainTasks = tasks.filter(task => task.parent_task_id === null);
            container.innerHTML = mainTasks.map(task => {
                const taskClass = `task-card ${task.status === 'done' ? 'completed' : ''}`;
                return `
                <div class="${taskClass}" onclick="App.openTask(${task.id})">
                    <div class="task-card-header">
                        <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                        <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                    </div>
                    <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                    <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                    <div class="task-card-footer">
                        <span>Исполнитель: ${task.assigned_to_name || 'Не назначен'}</span>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project tasks:', error);
            this.showError('Ошибка загрузки задач проекта: ' + error.message);
        }
    }

    static async loadProjectMembers(projectHash) {
        try {
            const response = await ApiService.getProjectMembers(projectHash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '')
                    ? memberData.full_name
                    : (member.full_name && member.full_name.trim() !== '')
                        ? member.full_name
                        : `Участник #${member.user_id || memberData.id}`;
                const isCurrentUser = (member.user_id || memberData.id) === currentUser.id;
                const isOwnerMember = member.role === ProjectRole.OWNER;
                const isAdminMember = member.role === ProjectRole.ADMIN;

                // Определяем доступные действия
                let canChangeRole = false;
                let canRemoveMember = false;

                if (currentUser.id === currentProject.owner_id) {
                    canChangeRole = !isCurrentUser && !isOwnerMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember;
                } else if (currentUser.role === ProjectRole.ADMIN) {
                    canChangeRole = !isCurrentUser && !isOwnerMember && !isAdminMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember && !isAdminMember;
                }

                return `
                <div class="member-item">
                    <span class="member-name">${this.escapeHtml(displayName)}</span>
                    <span class="member-role">${this.getRoleText(member.role)}</span>
                    ${canChangeRole ? `<select class="role-select" onchange="App.updateMemberRole(${member.user_id || memberData.id}, this.value)">
                        <option value="member" ${member.role === 'member' ? 'selected' : ''}>Участник</option>
                        <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>` : ''}
                    ${canRemoveMember ? `<button class="btn btn-danger btn-sm" onclick="App.removeMember(${member.user_id || memberData.id})">Удалить</button>` : ''}
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project members:', error);
            // Более мягкая обработка ошибки - не показываем alert для этой не критичной функции
            const container = document.getElementById('projectMembersList');
            container.innerHTML = '<p>Не удалось загрузить список участников</p>';
        }
    }

    static backToProject() {
        console.log('Back to project, currentProject:', currentProject);
        if (currentProject && currentProject.hash) {
            this.openProject(currentProject.hash);
        } else {
            console.log('No current project, showing dashboard');
            this.showDashboard();
        }
    }

    // Task methods
    static async openTask(taskId) {
        try {
            const response = await ApiService.getTask(taskId);
            currentTask = response.task || response;

            console.log('Current task set to:', currentTask);
            if (!currentTask) {
                this.showError('Задача не найдена');
                return;
            }

            // Update task view
            document.getElementById('taskTitleHeader').textContent = currentTask.title;
            document.getElementById('taskDescriptionText').textContent = currentTask.description || 'Без описания';
            document.getElementById('taskPriorityText').textContent = this.getPriorityText(currentTask.priority);
            document.getElementById('taskStatusSelect').value = currentTask.status; // Устанавливаем статус
            document.getElementById('taskCreatedAtText').textContent = new Date(currentTask.created_at).toLocaleString();
            document.getElementById('taskDueDateText').textContent = currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : 'Не установлен';

            // --- Загрузка информации об исполнителе из index.txt ---
            if (currentTask.assigned_to_id) {
                if (currentTask.assigned_user) {
                    const displayName = currentTask.assigned_user.full_name || currentTask.assigned_user.username || `Участник #${currentTask.assigned_to_id}`;
                    document.getElementById('taskAssignedToText').textContent = displayName;
                } else {
                    await this.loadTaskAssigneeInfo(currentTask.assigned_to_id);
                }
            } else {
                document.getElementById('taskAssignedToText').textContent = 'Не назначена';
            }

            // Show/hide create subtask button based on permissions or task type
            const createSubtaskBtn = document.getElementById('createSubtaskBtn');
            const subtasksSection = document.getElementById('subtasksSection');
            if (currentTask.parent_task_id === null) {
                subtasksSection.style.display = 'block';
                createSubtaskBtn.style.display = 'inline-block';
                await this.loadSubtasks(taskId);
            } else {
                subtasksSection.style.display = 'none';
                createSubtaskBtn.style.display = 'none';
            }

            // Load comments
            await this.loadTaskComments(taskId);

            // Switch view
            this.showView('taskView');
        } catch (error) {
            console.error('Error opening task:', error);
            this.showError('Ошибка открытия задачи: ' + error.message);
        }
    }

    static async loadTaskAssigneeInfo(assigneeId) {
        try {
            console.log('Loading assignee info for:', assigneeId);
            // Если у нас есть данные о проекте и участниках, ищем исполнителя среди участников
            if (currentProject && currentProject.members) {
                console.log('Searching in project members:', currentProject.members);
                const assignee = currentProject.members.find(member => {
                    const memberId = member.user_id || (member.user && member.user.id);
                    console.log('Checking member:', memberId, 'against assignee:', assigneeId);
                    return memberId === assigneeId;
                });
                if (assignee) {
                    console.log('Found assignee in members:', assignee);
                    const displayName = (assignee.user && assignee.user.full_name) || assignee.full_name || `Участник #${assigneeId}`;
                    document.getElementById('taskAssignedToText').textContent = displayName;
                    return;
                }
            }
            // Если не нашли в участниках, попробуем загрузить участников проекта
            const response = await ApiService.getProjectMembers(currentProject.hash);
            const members = response.members || [];
            const assignee = members.find(member => (member.user_id || (member.user && member.user.id)) === assigneeId);
            if (assignee) {
                const displayName = (assignee.user && assignee.user.full_name) || assignee.full_name || `Участник #${assigneeId}`;
                document.getElementById('taskAssignedToText').textContent = displayName;
                return;
            }
            // Если не нашли, оставляем ID
            document.getElementById('taskAssignedToText').textContent = `Участник #${assigneeId}`;
        } catch (error) {
            console.error('Error loading assignee info:', error);
            document.getElementById('taskAssignedToText').textContent = `Участник #${assigneeId}`;
        }
    }

    static async loadTaskComments(taskId) {
        try {
            const response = await ApiService.getTaskComments(taskId);
            const comments = response.comments || [];
            const container = document.getElementById('taskCommentsList');

            if (!comments || comments.length === 0) {
                container.innerHTML = '<p>Комментариев нет</p>';
                return;
            }

            container.innerHTML = comments.map(comment => {
                return `
                <div class="comment-item">
                    <div class="comment-header">
                        <strong>${this.escapeHtml(comment.author_name)}</strong>
                        <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <p class="comment-text">${this.escapeHtml(comment.content)}</p>
                </div>`;
            }).join('');
        } catch (error) {
            console.error('Error loading comments:', error);
            // Don't show error for comments as it's not critical
        }
    }

    static async addComment() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for comment:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const content = document.getElementById('newCommentText').value.trim();
        if (!content) {
            this.showError('Введите текст комментария');
            return;
        }

        try {
            await ApiService.createTaskComment(currentTask.id, content);
            document.getElementById('newCommentText').value = '';
            await this.loadTaskComments(currentTask.id);
            this.showSuccess('Комментарий добавлен!');
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showError('Ошибка добавления комментария: ' + error.message);
        }
    }

    static async loadMyTasks() {
        try {
            const statusFilter = document.getElementById('tasksFilterStatus').value;
            const projectFilter = document.getElementById('tasksFilterProject').value;

            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (projectFilter) filters.project_hash = projectFilter;

            const response = await ApiService.getUserTasks(filters);
            const tasks = response.tasks || [];
            const container = document.getElementById('myTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<p>Задач нет</p>';
                return;
            }

            // Разделяем задачи на назначенные и созданные
            const assignedTasks = tasks.filter(task => task.assigned_to_id === currentUser.id);
            const createdTasks = tasks.filter(task => task.created_by_id === currentUser.id && task.assigned_to_id !== currentUser.id);

            let html = '';

            if (assignedTasks.length > 0) {
                html += '<h4>Назначенные мне</h4>';
                html += assignedTasks.map(task => {
                    const projectTitle = task.project_title || (task.project && task.project.title) || 'N/A';
                    return `
                    <div class="task-card" onclick="App.openTask(${task.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                            <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                        <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                        <div class="task-card-footer">
                            <span>Проект: ${this.escapeHtml(projectTitle)}</span>
                        </div>
                    </div>`;
                }).join('');
            }

            if (createdTasks.length > 0) {
                if (assignedTasks.length > 0) html += '<h4 style="margin-top: var(--space-6);">Созданные мной</h4>';
                else html += '<h4>Созданные мной</h4>';

                html += createdTasks.map(task => {
                    return `
                    <div class="task-card" onclick="App.openTask(${task.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                            <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                        <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                        <div class="task-card-footer">
                            <span>Исполнитель: ${task.assigned_to_name || 'Не назначен'}</span>
                        </div>
                    </div>`;
                }).join('');
            }

            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading my tasks:', error);
            this.showError('Ошибка загрузки моих задач: ' + error.message);
        }
    }

    // Project management methods
    static showCreateProjectModal() {
        document.getElementById('createProjectForm').reset();
        this.showModal('createProjectModal');
    }

    static async handleCreateProject() {
        const title = document.getElementById('projectTitle').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const isPrivate = document.getElementById('projectIsPrivate').checked;
        const requiresApproval = document.getElementById('projectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            console.log('Creating project:', { title, description, isPrivate, requiresApproval });
            await ApiService.createProject({
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('createProjectModal');
            document.getElementById('createProjectForm').reset();
            await this.loadData(); // Reload dashboard
            this.showSuccess('Проект создан успешно!');
        } catch (error) {
            console.error('Error creating project:', error);
            this.showError('Ошибка создания проекта: ' + error.message);
        }
    }

    static showEditProjectModal() {
        if (!currentProject) return;
        document.getElementById('editProjectTitle').value = currentProject.title;
        document.getElementById('editProjectDescription').value = currentProject.description || '';
        document.getElementById('editProjectIsPrivate').checked = currentProject.is_private;
        document.getElementById('editProjectRequiresApproval').checked = currentProject.requires_approval;

        this.showModal('editProjectModal');
    }

    static async handleUpdateProject() {
        if (!currentProject) return;
        const title = document.getElementById('editProjectTitle').value.trim();
        const description = document.getElementById('editProjectDescription').value.trim();
        const isPrivate = document.getElementById('editProjectIsPrivate').checked;
        const requiresApproval = document.getElementById('editProjectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            await ApiService.updateProject(currentProject.hash, {
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('editProjectModal');
            await this.openProject(currentProject.hash); // Перезагружаем проект
            this.showSuccess('Проект обновлен успешно!');
        } catch (error) {
            console.error('Error updating project:', error);
            this.showError('Ошибка обновления проекта: ' + error.message);
        }
    }

    static showDeleteProjectModal() {
        if (!currentProject) return;
        document.getElementById('deleteProjectName').textContent = currentProject.title;
        this.showModal('deleteProjectModal');
    }

    static async handleDeleteProject() {
        if (!currentProject) return;
        try {
            await ApiService.deleteProject(currentProject.hash);

            this.hideModal('deleteProjectModal');
            this.showDashboard();
            this.showSuccess('Проект удален успешно!');
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showError('Ошибка удаления проекта: ' + error.message);
        }
    }

    // Task management methods
    static async showCreateTaskModal() {
        if (!currentProject) return;

        try {
            // Загружаем участников проекта
            const response = await ApiService.getProjectMembers(currentProject.hash);
            const members = response.members || [];

            const assignedToSelect = document.getElementById('taskAssignedTo');
            assignedToSelect.innerHTML = '<option value="">Не назначена</option>';
            members.forEach(member => {
                const memberData = member.user || member;
                const displayName = memberData.full_name && memberData.full_name.trim() !== ''
                    ? memberData.full_name
                    : member.full_name && member.full_name.trim() !== ''
                        ? member.full_name
                        : `Участник #${member.user_id || memberData.id}`;
                const option = document.createElement('option');
                option.value = member.user_id || memberData.id;
                option.textContent = displayName;
                assignedToSelect.appendChild(option);
            });

            // Загружаем задачи для выбора родительской задачи
            const tasksResponse = await ApiService.getTasks(currentProject.hash);
            const tasks = tasksResponse.tasks || [];

            const parentTaskSelect = document.getElementById('taskParentId');
            parentTaskSelect.innerHTML = '<option value="">Основная задача (без родителя)</option>';
            tasks.forEach(task => {
                if (task.parent_task_id === null) { // Only main tasks can be parents
                    const option = document.createElement('option');
                    option.value = task.id;
                    option.textContent = task.title;
                    parentTaskSelect.appendChild(option);
                }
            });

            // Устанавливаем сегодняшнюю дату по умолчанию
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('taskDueDate').value = today;

            this.showModal('createTaskModal');
        } catch (error) {
            console.error('Error loading task creation ', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    static showCreateSubtaskModal() {
        if (!currentProject || !currentTask) return;
        this.showCreateSubtaskModalForTask(currentTask.id);
    }

    static showCreateSubtaskModalForTask(parentTaskId) {
        // Устанавливаем родительскую задачу для создания подзадачи
        this.tempParentTaskId = parentTaskId;
        this.showCreateTaskModal(); // Reuse the main create modal
    }

    static async handleCreateTask() {
        if (!currentProject) return;
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const parentTaskId = this.tempParentTaskId || document.getElementById('taskParentId').value || null; // Use temp ID first
        const assignedTo = document.getElementById('taskAssignedTo').value || null;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                priority,
                project_hash: currentProject.hash
            };

            if (dueDate) taskData.due_date = dueDate;
            if (parentTaskId) taskData.parent_task_id = parseInt(parentTaskId);
            if (assignedTo) taskData.assigned_to_id = parseInt(assignedTo); // ИСПРАВЛЕНО: используем assigned_to_id

            console.log('Creating task with data:', taskData);
            await ApiService.createTask(taskData);

            this.hideModal('createTaskModal');
            // ИСПРАВЛЕНО: Проверяем существование формы перед reset
            const createTaskForm = document.getElementById('createTaskForm');
            if (createTaskForm) {
                createTaskForm.reset();
            }
            // Clear temp parent ID
            this.tempParentTaskId = null;

            // Reload tasks for the current view (project or task)
            if (currentProject && !currentTask) {
                await this.loadProjectTasks(currentProject.hash);
            } else if (currentTask) {
                // Reload subtasks if current task is parent
                if (currentTask.id === parentTaskId || currentTask.id === this.tempParentTaskId) {
                     await this.loadSubtasks(currentTask.id);
                }
            }

            this.showSuccess('Задача создана успешно!');
        } catch (error) {
            console.error('Error creating task:', error);
            this.showError('Ошибка создания задачи: ' + error.message);
        }
    }

    // --- Новое из index.txt ---
    static async handleCreateSubtask() {
        if (!currentTask || !currentTask.id) return;
        const title = document.getElementById('subtaskTitle').value.trim();
        const description = ""; // Подзадачи без описания в index.txt
        if (!title) {
            this.showError('Введите название подзадачи');
            return;
        }

        try {
            // Получаем данные родительской задачи для наследования
            const parentTaskResponse = await ApiService.getTask(currentTask.id);
            const parentTask = parentTaskResponse.task || parentTaskResponse;

            const taskData = {
                title,
                description,
                project_hash: currentProject.hash,
                priority: parentTask.priority || 'medium',
                status: 'todo',
                parent_task_id: currentTask.id
            };

            // Наследуем исполнителя от родительской задачи
            if (parentTask.assigned_to_id) {
                taskData.assigned_to_id = parentTask.assigned_to_id;
            }

            console.log('Creating subtask with data:', taskData);
            await ApiService.createTask(taskData);

            this.hideModal('createSubtaskModal');
            // Reset form
            const createSubtaskForm = document.getElementById('createSubtaskForm');
            if (createSubtaskForm) {
                createSubtaskForm.reset();
            }

            // Reload subtasks for the current task
            if (currentTask) {
                await this.loadSubtasks(currentTask.id);
            }

            this.showSuccess('Подзадача создана успешно!');
        } catch (error) {
            console.error('Error creating subtask:', error);
            this.showError('Ошибка создания подзадачи: ' + error.message);
        }
    }

    static showEditTaskModal() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for editing:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        // ИСПРАВЛЕНО: Проверяем существование элементов перед установкой значений
        const editTaskTitle = document.getElementById('editTaskTitle');
        const editTaskDescription = document.getElementById('editTaskDescription');
        const editTaskPriority = document.getElementById('editTaskPriority');
        const editTaskDueDate = document.getElementById('editTaskDueDate');
        const taskStatusSelect = document.getElementById('taskStatusSelect'); // Добавлено для установки статуса

        if (editTaskTitle) editTaskTitle.value = currentTask.title;
        if (editTaskDescription) editTaskDescription.value = currentTask.description || '';
        if (editTaskPriority) editTaskPriority.value = currentTask.priority;
        if (editTaskDueDate) {
            if (currentTask.due_date) {
                const dueDate = new Date(currentTask.due_date);
                editTaskDueDate.value = dueDate.toISOString().split('T')[0];
            } else {
                editTaskDueDate.value = '';
            }
        }
        if (taskStatusSelect) taskStatusSelect.value = currentTask.status;
        this.showModal('editTaskModal');
    }

    static async handleUpdateTask() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for update:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const title = document.getElementById('editTaskTitle').value.trim();
        const description = document.getElementById('editTaskDescription').value.trim();
        const priority = document.getElementById('editTaskPriority').value;
        const dueDate = document.getElementById('editTaskDueDate').value;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                priority
            };

            if (dueDate) {
                taskData.due_date = dueDate;
            } else {
                taskData.due_date = null; // Explicitly set to null if cleared
            }

            console.log('Updating task:', currentTask.id, taskData);
            await ApiService.updateTask(currentTask.id, taskData);

            this.hideModal('editTaskModal');
            await this.openTask(currentTask.id); // Перезагружаем задачу
            this.showSuccess('Задача обновлена успешно!');
        } catch (error) {
            console.error('Error updating task:', error);
            this.showError('Ошибка обновления задачи: ' + error.message);
        }
    }

    static showDeleteTaskModal() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for deletion:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        // ИСПРАВЛЕНО: Проверяем существование элемента
        const deleteTaskName = document.getElementById('deleteTaskName');
        if (deleteTaskName) {
            deleteTaskName.textContent = currentTask.title;
        }
        this.showModal('deleteTaskModal');
    }

    static async handleDeleteTask() {
        if (!currentTask || !currentTask.id) {
            this.showError('Задача не выбрана');
            return;
        }

        try {
            await ApiService.deleteTask(currentTask.id);

            this.hideModal('deleteTaskModal');
            // Go back to project view or wherever appropriate
            if (currentProject) {
                this.openProject(currentProject.hash);
            } else {
                this.showDashboard();
            }
            this.showSuccess('Задача удалена успешно!');
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showError('Ошибка удаления задачи: ' + error.message);
        }
    }

    // --- Новые методы из index.txt ---

    // Изменение статуса задачи
    static async updateTaskStatus() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for status update:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const newStatus = document.getElementById('taskStatusSelect').value; // Получаем значение из селекта
        if (!newStatus) {
            this.showError('Выберите статус задачи');
            return;
        }

        try {
            console.log('Updating task status:', currentTask.id, newStatus);
            const updatedTask = await ApiService.updateTaskStatus(currentTask.id, newStatus);

            // Если задача выполнена, проверяем родительскую
            if (newStatus === 'done') {
                await this.completeAllChildTasks(currentTask.id); // Выполняем дочерние, если родительская выполнена
            } else if (newStatus === 'todo') {
                 await this.resetParentTasksStatus(currentTask.id); // Сбрасываем родительские, если дочерняя возвращена
            }
            await this.checkParentTaskStatus(currentTask.id);

            // Обновляем currentTask
            currentTask = updatedTask.task || updatedTask;
            this.showSuccess('Статус задачи обновлен!');
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Ошибка обновления статуса: ' + error.message);
            // Восстанавливаем предыдущее значение если возможно
            if (currentTask) {
                document.getElementById('taskStatusSelect').value = currentTask.status;
            }
        }
    }

    // Проверка статуса родительской задачи
    static async checkParentTaskStatus(taskId) {
        if (!currentProject || !taskId) return;

        try {
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const currentTask = tasks.find(t => t.id === taskId);

            if (currentTask && currentTask.parent_task_id) {
                const parentTask = tasks.find(t => t.id === currentTask.parent_task_id);
                if (!parentTask) return; // Родительская задача не найдена

                // Получаем всех "братьев" текущей задачи (другие дочерние задачи того же родителя)
                const responseSiblings = await ApiService.getTasks(currentProject.hash); // Нужно для обновленного списка
                const tasksSiblings = responseSiblings.tasks || [];
                const siblingTasks = tasksSiblings.filter(t => t.parent_task_id === parentTask.id);

                // Проверяем, все ли дочерние задачи выполнены
                const allChildrenDone = siblingTasks.every(child => child.status === 'done');

                if (allChildrenDone && parentTask.status !== 'done') {
                    // Все дочерние задачи выполнены - выполняем родительскую
                    await ApiService.updateTaskStatus(parentTask.id, 'done');
                    // Рекурсивно проверяем родительскую задачу
                    await this.checkParentTaskStatus(parentTask.id);
                } else if (!allChildrenDone && parentTask.status === 'done') {
                    // Не все дочерние выполнены, но родительская стоит как done - возвращаем в todo
                    await ApiService.updateTaskStatus(parentTask.id, 'todo');
                }
            }
        } catch (error) {
            console.error('Error checking parent task status:', error);
        }
    }

    // Сброс статуса родительских задач
    static async resetParentTasksStatus(taskId) {
        if (!currentProject || !taskId) return;

        try {
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const currentTask = tasks.find(t => t.id === taskId);

            if (currentTask && currentTask.parent_task_id) {
                const parentTask = tasks.find(t => t.id === currentTask.parent_task_id);
                if (!parentTask) return;

                // Обновляем статус родительской задачи на 'todo'
                if (parentTask.status !== 'todo') {
                    await ApiService.updateTaskStatus(parentTask.id, 'todo');
                }

                // Рекурсивно сбрасываем статусы выше
                await this.resetParentTasksStatus(parentTask.id);
            }
        } catch (error) {
            console.error('Error resetting parent task status:', error);
        }
    }

    // Выполнение всех дочерних задач
    static async completeAllChildTasks(parentTaskId) {
        if (!currentProject || !parentTaskId) return;

        try {
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const childTasks = tasks.filter(t => t.parent_task_id === parentTaskId);

            for (const childTask of childTasks) {
                if (childTask.status !== 'done') {
                    await ApiService.updateTaskStatus(childTask.id, 'done');
                    // Рекурсивно выполнить дочерние подзадачи
                    await this.completeAllChildTasks(childTask.id);
                }
            }
        } catch (error) {
            console.error('Error completing child tasks:', error);
        }
    }

    // Назначение задачи пользователю
    static async assignTaskToUser(userId) { // Принимает userId
        if (!currentTask || !currentTask.id || !userId) {
            this.showError('ID задачи и ID пользователя обязательны');
            return;
        }
        try {
            await ApiService.updateTask(currentTask.id, { assigned_to_id: userId });
            this.showSuccess('Исполнитель задачи обновлен!');
            // Перезагружаем задачу
            if (currentTask && currentTask.id === currentTask.id) {
                await this.openTask(currentTask.id);
            }
        } catch (error) {
            console.error('Error assigning task:', error);
            this.showError('Ошибка назначения исполнителя: ' + error.message);
        }
    }

    // Загрузка подзадач
    static async loadSubtasks(parentTaskId, level = 0, container = null) {
        try {
            if (!currentProject || !currentProject.hash) {
                console.error('No current project for loading subtasks');
                document.getElementById('subtasksList').innerHTML = '<p>Ошибка загрузки подзадач</p>';
                return;
            }

            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const subtasks = tasks.filter(task => task.parent_task_id === parentTaskId);

            const targetContainer = container || document.getElementById('subtasksList');

            if (subtasks.length === 0 && level === 0) {
                targetContainer.innerHTML = '<p>Подзадач нет</p>';
                return;
            }

            let subtasksHtml = '';
            subtasks.forEach(subtask => {
                const paddingLeft = level * 20;
                const childSubtasks = tasks.filter(task => task.parent_task_id === subtask.id);
                const hasChildren = childSubtasks.length > 0;

                subtasksHtml += `
                <div class="subtask-item" style="margin-left: ${paddingLeft}px; display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 5px;">
                    <span style="width: 16px;"></span> <!-- Spacer for indentation -->
                    <input type="checkbox" ${subtask.status === 'done' ? 'checked' : ''}
                           onchange="App.toggleSubtaskStatus(${subtask.id}, this.checked)"
                           style="cursor: pointer;"
                           onclick="event.stopPropagation()">
                    <div style="flex: 1;">
                        <div style="font-weight: bold;" onclick="App.openTask(${subtask.id})">${this.escapeHtml(subtask.title)}</div>
                    </div>
                    <div style="font-size: 12px; color: #666;">${this.getStatusText(subtask.status)}</div>
                    <button onclick="App.showCreateSubtaskModalForTask(${subtask.id}); event.stopPropagation();"
                            style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">+</button>
                </div>`;

                // Recursively add child subtasks
                if (hasChildren) {
                    const childContainer = document.createElement('div');
                    childContainer.className = 'subtask-children';
                    this.loadSubtasks(subtask.id, level + 1, childContainer);
                    subtasksHtml += childContainer.outerHTML;
                }
            });

            targetContainer.innerHTML = subtasksHtml;
        } catch (error) {
            console.error('Error loading subtasks:', error);
            this.showError('Ошибка загрузки подзадач: ' + error.message);
        }
    }

    // Переключение статуса подзадачи
    static async toggleSubtaskStatus(taskId, isDone) {
        try {
            const newStatus = isDone ? 'done' : 'todo';
            // Обновляем статус текущей задачи
            await ApiService.updateTaskStatus(taskId, newStatus);

            // Если задача выполняется, выполняем все дочерние задачи
            if (isDone) {
                await this.completeAllChildTasks(taskId);
            } else {
                // Если задача возвращается в "к выполнению", сбрасываем статус родительских задач
                await this.resetParentTasksStatus(taskId);
            }

            // Проверяем статус родительской задачи
            await this.checkParentTaskStatus(taskId);

            // Перезагружаем отображение подзадач
            if (currentTask) {
                await this.loadSubtasks(currentTask.id);
            }
            this.showSuccess('Статус задачи обновлен!');
        } catch (error) {
            console.error('Error toggling subtask status:', error);
            this.showError('Ошибка обновления статуса задачи: ' + error.message);
        }
    }

    // Search projects
    static async searchProjects() {
        const searchTerm = document.getElementById('searchProjectsInput').value.trim();
        try {
             if (!searchTerm) {
                await this.loadRecentPublicProjects(); // --- Вызываем, если поле пустое ---
                return;
            }

            // Если поисковый запрос похож на хэш (только буквы и цифры, длина 6+ символов), пробуем поиск по хэшу
            if (/^[a-zA-Z0-9]{6,}$/.test(searchTerm)) {
                console.log('Searching by exact hash:', searchTerm);
                try {
                    await this.searchProjectByExactHash(searchTerm);
                    return; // Если нашли по хэшу, выходим
                } catch (error) {
                    console.log('Project not found by hash, trying by name...'); // Выводим в консоль, как в index.txt
                    // Если не нашли по хэшу, продолжаем поиск по названию
                    await this.searchProjectsByQuery(searchTerm);
                    return;
                }
            } else {
                // Поиск только по названию
                await this.searchProjectsByQuery(searchTerm);
                return;
            }
        } catch (error) {
            console.error('Error searching projects:', error);
            this.showError('Ошибка поиска проектов: ' + error.message);
        }
    }

    static async searchProjectByExactHash(hash) {
        try {
            const response = await ApiService.getProjectByHashExact(hash);
            const project = response.project;

            if (project) {
                // Показываем найденный проект
                const title = `Проект по хэшу: "${hash}"`;
                this.renderSearchResults([project], title);
            } else {
                // Если проект по хэшу не найден, выбрасываем ошибку для перехода к поиску по названию
                throw new Error('Project not found by hash');
            }
        } catch (error) {
            console.error('Error searching project by exact hash:', error);
            // Не показываем ошибку, так как это может быть просто неправильный хэш, и мы переходим к поиску по названию
            throw error; // Перебрасываем ошибку для вызова обычного поиска
        }
    }

    static async searchProjectsByQuery(query) {
        try {
            const response = await ApiService.searchPublicProjects(query);
            const projects = response.projects || [];
            const title = query ? `Результаты поиска по названию: "${query}"` : 'Публичные проекты';
            this.renderSearchResults(projects, title);
        } catch (error) {
            console.error('Error searching projects by query:', error);
            // Не показываем ошибку здесь, так как она обрабатывается в searchProjects
        }
    }

    static renderSearchResults(projects, title) {
        const container = document.getElementById('searchResultsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>Проекты не найдены</p>
                <p>Попробуйте изменить поисковый запрос или создать новый проект</p>
            </div>`;
            return;
        }

        let html = `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;"><h3 style="margin: 0;">${title}</h3>${title.includes('хэшу') ? '<span class="search-type-badge">По хэшу</span>' : '<span class="search-type-badge">По названию</span>'}</div>`;
        html += projects.map(project => {
            const stats = project.stats || {};
            const requiresApproval = project.requires_approval;
            const isPrivate = project.is_private;

            // Определяем текст и действие для кнопки
            let buttonText = 'Присоединиться';
            let buttonAction = `App.handleJoinProject('${project.hash}')`; // ИЗМЕНЕНО: используем handleJoinProject вместо joinProject
            let buttonClass = 'btn-primary';

            // ПЕРВОЕ: Проверяем exactMatchData для определения статуса пользователя (если бы оно было в ответе)
            // В упрощенной версии предполагаем, что можно присоединиться, если публичный или требует одобрения
            if (isPrivate && !requiresApproval) {
                // Приватный без одобрения - доступ закрыт для посторонних
                buttonText = 'Доступ закрыт';
                buttonAction = '';
                buttonClass = 'btn-secondary';
            } else if (isPrivate && requiresApproval) {
                buttonText = 'Отправить заявку';
                buttonClass = 'btn-warning';
            } else if (isPrivate) {
                buttonText = 'Запросить доступ';
                buttonClass = 'btn-info';
            }

            // Формируем атрибут disabled
            const disabledAttr = (buttonClass.includes('btn-secondary') || !buttonAction) ? 'disabled' : '';

            return `
            <div class="search-result-item">
                <div class="project-card">
                    <div class="project-card-header">
                        <h3 class="project-title">${this.escapeHtml(project.title)}</h3>
                        <span class="project-type-badge">${isPrivate ? '🔒' : '🌐'}</span>
                    </div>
                    <p class="project-description">${this.escapeHtml(project.description || 'Без описания')}</p>
                    <div class="project-stats">
                        <span>Участников: ${stats.members_count || 0}</span>
                        <span>Задач: ${stats.tasks_count || 0}</span>
                        <span>Выполнено: ${stats.tasks_done || 0}</span>
                        <span>Тип: ${isPrivate ? 'Приватный' : 'Публичный'}</span>
                        ${isPrivate ? `<span>Одобрение: ${requiresApproval ? 'Требуется' : 'Не требуется'}</span>` : ''}
                    </div>
                    <div style="font-size: 12px; color: #999;">Хэш: <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">${project.hash}</code> • Создан: ${new Date(project.created_at).toLocaleDateString()}${project.owner ? ` • Владелец: ${this.escapeHtml(project.owner.full_name)}` : ''}</div>
                    <div style="display: flex; flex-direction: column; gap: 10px; min-width: 150px;">
                        <button onclick="${buttonAction}"
                                style="padding: 8px 16px; background: ${this.getButtonColor(buttonClass)}; color: white; border: none; border-radius: 4px; cursor: pointer;" ${disabledAttr}>${buttonText}</button>
                        <button onclick="App.openProjectPreview('${project.hash}')"
                                style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Подробнее</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
    }

    static getButtonColor(buttonClass) {
        const colorMap = {
            'btn-primary': '#007bff',
            'btn-warning': '#ffc107',
            'btn-info': '#17a2b8',
            'btn-success': '#28a745',
            'btn-secondary': '#6c757d'
        };
        return colorMap[buttonClass] || '#007bff';
    }

    static async handleJoinProject(projectHash) {
        try {
            console.log('Joining project:', projectHash);
            const response = await ApiService.joinProject(projectHash);

            if (response.status === 'joined') {
                this.showSuccess('Вы успешно присоединились к проекту!');
                await this.openProject(projectHash);
            } else if (response.status === 'pending_approval') {
                this.showSuccess('Заявка на вступление отправлена! Ожидайте одобрения.');
                this.showDashboard(); // Закрываем поиск и возвращаемся к дашборду
            } else {
                this.showError('Неизвестный статус ответа: ' + response.status);
            }
        } catch (error) {
            console.error('Error joining project:', error);
            if (error.message.includes('400') && error.message.includes('already a member')) {
                this.showError('Вы уже являетесь участником этого проекта');
                await this.openProject(projectHash);
            } else if (error.message.includes('400') && error.message.includes('already pending')) {
                this.showError('Заявка на вступление уже отправлена');
            } else if (error.message.includes('403')) {
                this.showError('Доступ к проекту запрещен');
            } else if (error.message.includes('404')) {
                this.showError('Проект не найден');
            } else {
                this.showError('Ошибка вступления в проект: ' + error.message);
            }
        }
    }

    static showProjectPreviewModal(project, projectData) {
        // Используем renderSearchResults для отображения одного проекта
        this.renderSearchResults([project], `Предварительный просмотр: ${project.title}`);
        // Добавляем кнопку "Присоединиться" если можно
        const container = document.getElementById('searchResultsList');
        const joinBtnHtml = projectData && projectData.can_join && !projectData.is_member
            ? `<button onclick="App.joinProjectFromPreview('${project.hash}')" style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Присоединиться</button>`
            : '';
        container.innerHTML += joinBtnHtml;
    }

    static async openProjectPreview(projectHash) {
        try {
            const response = await ApiService.getProjectByHashExact(projectHash);
            const project = response.project;

            // Show modal with project info
            this.showProjectPreviewModal(project, response);
        } catch (error) {
            console.error('Error opening project preview:', error);
            this.showError('Ошибка загрузки информации о проекте: ' + error.message);
        }
    }

    static async joinProjectFromPreview(projectHash) {
        try {
            const response = await ApiService.joinProject(projectHash);

            if (response.status === 'joined') {
                this.showSuccess('Вы успешно присоединились к проекту!');
                await this.openProject(projectHash);
            } else if (response.status === 'pending_approval') {
                this.showSuccess('Заявка на вступление отправлена! Ожидайте одобрения.');
                this.showDashboard();
            } else {
                this.showError('Неизвестный статус ответа: ' + response.status);
            }
        } catch (error) {
            console.error('Error joining project from preview:', error);
             if (error.message.includes('400') && error.message.includes('already a member')) {
                this.showError('Вы уже являетесь участником этого проекта');
                await this.openProject(projectHash);
            } else if (error.message.includes('400') && error.message.includes('already pending')) {
                this.showError('Заявка на вступление уже отправлена');
            } else if (error.message.includes('403')) {
                this.showError('Доступ к проекту запрещен');
            } else if (error.message.includes('404')) {
                this.showError('Проект не найден');
            } else {
                this.showError('Ошибка вступления в проект: ' + error.message);
            }
        }
    }

    // Project members management
    static showProjectMembersManagement() {
        this.showView('projectMembersView');
        this.loadProjectMembersManagement();
    }

    static async loadProjectMembersManagement() {
        if (!currentProject) return;

        try {
            const response = await ApiService.getProjectMembers(currentProject.hash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersManagementList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '') ? memberData.full_name : (member.full_name && member.full_name.trim() !== '') ? member.full_name : `Участник #${member.user_id || memberData.id}`;
                const isCurrentUser = (member.user_id || memberData.id) === currentUser.id;
                const isOwnerMember = member.role === ProjectRole.OWNER;
                const isAdminMember = member.role === ProjectRole.ADMIN;

                // Определяем доступные действия
                let canChangeRole = false;
                let canRemoveMember = false;

                if (currentUser.id === currentProject.owner_id) { // Current user is owner
                    canChangeRole = !isCurrentUser && !isOwnerMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember;
                } else if (currentUser.role === ProjectRole.ADMIN) { // Current user is admin
                    canChangeRole = !isCurrentUser && !isOwnerMember && !isAdminMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember && !isAdminMember;
                }

                return `
                <div class="member-management-item">
                    <div class="member-info">
                        <span class="member-name">${this.escapeHtml(displayName)}</span>
                        <span class="member-role">${this.getRoleText(member.role)}</span>
                        <span class="member-email">${this.escapeHtml(memberData.email || 'N/A')}</span>
                    </div>
                    <div class="member-actions">
                        ${canChangeRole ? `<select class="role-select" onchange="App.updateMemberRole(${member.user_id || memberData.id}, this.value)">
                            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Участник</option>
                            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Администратор</option>
                        </select>
                        <button onclick="App.prepareUpdateMemberRole(${member.user_id || memberData.id})" class="btn btn-primary btn-sm">Обновить</button>` : ''}
                        ${canRemoveMember ? `<button onclick="App.prepareRemoveMember(${member.user_id || memberData.id})" class="btn btn-danger btn-sm">Удалить</button>` : ''}
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project members management:', error);
            this.showError('Ошибка загрузки участников: ' + error.message);
        }
    }

    static prepareUpdateMemberRole(memberId) {
        currentMemberToUpdate = memberId;
        this.showModal('updateMemberRoleModal');
    }

    static prepareRemoveMember(memberId) {
        currentMemberToRemove = memberId;
        this.showModal('removeMemberModal');
    }

    static async updateMemberRole(memberId, newRole) {
        try {
            await ApiService.updateProjectMemberRole(currentProject.hash, memberId, newRole);
            this.showSuccess('Роль участника обновлена');
            // Reload the management list
            await this.loadProjectMembersManagement();
        } catch (error) {
            console.error('Error updating member role:', error);
            this.showError('Ошибка обновления роли: ' + error.message);
        }
    }

    static async handleUpdateMemberRole() {
        if (!currentMemberToUpdate) return;
        const newRole = document.getElementById('updateMemberRoleSelect').value;
        await this.updateMemberRole(currentMemberToUpdate, newRole);
        this.hideModal('updateMemberRoleModal');
    }

    static async removeMember(memberId) {
        try {
            await ApiService.removeProjectMember(currentProject.hash, memberId);
            this.showSuccess('Участник удален');
            // Reload the management list
            await this.loadProjectMembersManagement();
        } catch (error) {
            console.error('Error removing member:', error);
            this.showError('Ошибка удаления участника: ' + error.message);
        }
    }

    static async handleRemoveMember() {
        if (!currentMemberToRemove) return;
        await this.removeMember(currentMemberToRemove);
        this.hideModal('removeMemberModal');
    }

    // Join requests
    static showJoinRequests() {
        this.showView('joinRequestsView');
        this.loadJoinRequests();
    }

    static async loadJoinRequests() {
        if (!currentProject) return;

        try {
            const response = await ApiService.getProjectJoinRequests(currentProject.hash);
            const joinRequests = response.requests || [];
            const container = document.getElementById('joinRequestsList');

            if (!joinRequests || joinRequests.length === 0) {
                container.innerHTML = '<p>Заявок нет</p>';
                return;
            }

            container.innerHTML = joinRequests.map(request => {
                const requestDate = request.created_at;
                const formattedDate = requestDate ? new Date(requestDate).toLocaleString() : 'Дата не указана';
                // Определяем статус и доступные действия
                const statusText = this.getJoinRequestStatusText(request.status); // --- Предполагаемая функция ---
                const statusColor = this.getJoinRequestStatusColor(request.status); // --- Предполагаемая функция ---
                const canApprove = request.status === 'pending';
                const canReject = request.status === 'pending';

                return `
                <div class="join-request-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <strong>${this.escapeHtml(request.user_name)}</strong> (${this.escapeHtml(request.user_email)}) - ${formattedDate}
                            <span style="color: ${statusColor};">${statusText}</span>
                        </div>
                        <div class="request-actions">
                            ${canApprove ? `<button class="btn btn-success btn-sm" onclick="App.handleApproveRequest(${request.id})">Одобрить</button>` : ''}
                            ${canReject ? `<button class="btn btn-danger btn-sm" onclick="App.handleRejectRequest(${request.id})">Отклонить</button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading join requests:', error);
            this.showError('Ошибка загрузки заявок: ' + error.message);
        }
    }

    static getJoinRequestStatusText(status) {
        const map = { 'pending': 'Ожидает', 'approved': 'Одобрена', 'rejected': 'Отклонена' };
        return map[status] || status;
    }

    static getJoinRequestStatusColor(status) {
        const map = { 'pending': '#ffc107', 'approved': '#28a745', 'rejected': '#dc3545' };
        return map[status] || '#6c757d';
    }

    static async handleApproveRequest(requestId) {
        if (!currentProject) return;
        try {
            console.log('Approving join request:', requestId, 'for project:', currentProject.hash);
            await ApiService.approveJoinRequest(currentProject.hash, requestId);
            this.showSuccess('Заявка одобрена!');
            await this.showJoinRequests(); // Перезагружаем список
        } catch (error) {
            console.error('Error approving join request:', error);
            if (error.message.includes('404')) {
                this.showError('Заявка не найдена. Возможно, она уже была обработана.');
            } else {
                this.showError('Ошибка одобрения заявки: ' + error.message);
            }
        }
    }

    static async handleRejectRequest(requestId) {
        if (!currentProject) return;
        try {
            console.log('Rejecting join request:', requestId, 'for project:', currentProject.hash);
            await ApiService.rejectJoinRequest(currentProject.hash, requestId);
            this.showSuccess('Заявка отклонена!');
            await this.showJoinRequests(); // Перезагружаем список
        } catch (error) {
            console.error('Error rejecting join request:', error);
            if (error.message.includes('404')) {
                this.showError('Заявка не найдена. Возможно, она уже была обработана.');
            } else {
                this.showError('Ошибка отклонения заявки: ' + error.message);
            }
        }
    }

    // Settings
    static async loadSettings() {
        try {
            const userData = await ApiService.getCurrentUser();
            document.getElementById('userFullName').value = userData.full_name || '';
            document.getElementById('userUsername').value = userData.username || '';

            // Загружаем предпочтения пользователя
            // Предположим, что они входят в состав userSettings или загружаются отдельно
            // const userPrefs = await ApiService.getUserPreferences(); // Если есть такой метод
            // document.getElementById('userTheme').value = userPrefs.theme || 'light';
            // document.getElementById('userNotificationsEnabled').checked = userPrefs.notifications_enabled || false;
            // document.getElementById('userCompactView').checked = userPrefs.compact_view || false;

            // Или используем уже загруженные userSettings
            document.getElementById('userTheme').value = userSettings.theme || 'light';
            document.getElementById('userNotificationsEnabled').checked = userSettings.notifications_enabled || false;
            document.getElementById('userCompactView').checked = userSettings.compact_view || false;

        } catch (error) {
            console.error('Error loading settings:', error);
            this.showError('Ошибка загрузки настроек: ' + error.message);
        }
    }

    static async handleSaveSettings() {
        try {
            const fullName = document.getElementById('userFullName').value.trim();
            const username = document.getElementById('userUsername').value.trim();

            // Обновляем данные пользователя
            if (fullName || username) {
                await ApiService.updateCurrentUser({
                    full_name: fullName,
                    username: username
                });
            }

            // Обновляем настройки
            await ApiService.updateUserPreferences({
                theme: document.getElementById('userTheme').value,
                notifications_enabled: document.getElementById('userNotificationsEnabled').checked,
                compact_view: document.getElementById('userCompactView').checked
            });

            this.hideModal('settingsModal');
            this.showSuccess('Настройки сохранены успешно!');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError('Ошибка сохранения настроек: ' + error.message);
        }
    }

    static async resetUserPreferences() {
        try {
            await ApiService.resetUserPreferences();
            this.hideModal('settingsModal');
            this.showSuccess('Настройки сброшены к значениям по умолчанию!');
        } catch (error) {
            console.error('Error resetting preferences:', error);
            this.showError('Ошибка сброса настроек: ' + error.message);
        }
    }

    // Modal helpers
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // Trap focus? Add event listener for Escape key?
        } else {
             console.error(`Modal with id '${modalId}' not found`); // --- Добавлено из index.txt ---
        }
    }

    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Notification helpers
    static showSuccess(message) {
        // Implement success notification (e.g., toast)
        console.log('Success:', message);
        // Example using a simple alert, replace with proper UI component
        alert(message);
    }

    static showError(message) {
        // Implement error notification (e.g., toast)
        console.error('Error:', message);
        // Example using a simple alert, replace with proper UI component
        alert('Ошибка: ' + message);
    }
}

// ИСПРАВЛЕНО: Добавляем функцию для инициализации искр
function initSparkAnimation() {
    const sparkContainer = document.getElementById('sparkContainer');
    if (!sparkContainer) return;

    const createSpark = () => {
        const spark = document.createElement('div');
        spark.classList.add('spark');

        // Случайная стартовая позиция
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;

        // Случайная конечная позиция (используем CSS переменные)
        const endX = (Math.random() - 0.5) * 200; // От -100 до 100vw
        const endY = (Math.random() - 0.5) * 200; // От -100 до 100vh

        spark.style.setProperty('--end-x', `${endX}vw`);
        spark.style.setProperty('--end-y', `${endY}vh`);
        spark.style.left = `${startX}%`;
        spark.style.top = `${startY}%`;

        sparkContainer.appendChild(spark);

        // Удаляем искру после анимации
        setTimeout(() => {
            spark.remove();
        }, 3000);
    };

    // Создаем искры каждые 200-500мс
    setInterval(createSpark, Math.random() * 300 + 200);
}

// ИСПРАВЛЕНО: Добавляем функцию для анимации прогресса
function initLoadingProgress() {
    const progressBar = document.getElementById('loadingBarProgress');
    if (!progressBar) return;
}

function showStartButton() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        // Плавно появляем кнопку
        setTimeout(() => {
             startButton.style.display = 'inline-block';
        }, 300); // Небольшая задержка для завершения анимации прогресса
    }
}

function attachStartButtonListener() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', () => {
            const loadingOverlay = document.getElementById('loading');
            if (loadingOverlay) {
                // Вызываем событие завершения загрузки
                window.dispatchEvent(new Event('appLoaded'));
                // Скрываем заставку через небольшую задержку для анимации
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300); // Соответствует transition
            }
        });
    }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем искры
    initSparkAnimation();
    // Инициализируем анимацию прогресса
    initLoadingProgress();
    // Инициализируем приложение
    App.init();
});
