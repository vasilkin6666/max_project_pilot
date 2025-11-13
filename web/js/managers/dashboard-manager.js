// Менеджер дашборда
class DashboardManager {
  static async loadDashboard() {
      try {
          StateManager.setLoading(true);
          Utils.log('Loading dashboard...');

          const dashboardData = await CacheManager.getWithCache(
              'dashboard',
              () => ApiService.getDashboard(),
              'dashboard'
          );

          if (!dashboardData) throw new Error('Не удалось загрузить дашборд');

          const projects = Array.isArray(dashboardData.projects) ? dashboardData.projects : [];
          StateManager.setState('dashboard', dashboardData);
          StateManager.setState('projects', projects);

          this.updateStats(dashboardData);
          this.renderProjects(projects);

          // Приоритетные задачи
          try {
              const tasksData = await ApiService.getTasks({ status: 'todo', limit: 10 });
              const tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];
              StateManager.setState('tasks', tasks);
              this.renderPriorityTasks(tasks);
          } catch (e) {
              Utils.logError('Failed to load priority tasks:', e);
              this.renderPriorityTasks([]);
          }

          // Применение темы
          setTimeout(() => {
              try {
                  const theme = App.getCurrentTheme();
                  App.applyTheme(theme);
              } catch (e) {
                  Utils.logError('Theme apply failed:', e);
              }
          }, 150);

          EventManager.emit(APP_EVENTS.DATA_LOADED);
          Utils.log('Dashboard loaded', { projects: projects.length });
      } catch (error) {
          Utils.logError('Dashboard load error:', error);
          EventManager.emit(APP_EVENTS.DATA_ERROR, error);
          this.showErrorState(document.getElementById('dashboard-view'));
      } finally {
          StateManager.setLoading(false);
      }
  }

    static updateStats(data) {
        // Используем данные из dashboard response
        const projects = data.projects || [];

        // Рассчитываем статистику на основе проектов
        const totalTasks = projects.reduce((sum, project) => sum + (project.total_tasks || 0), 0);
        const doneTasks = projects.reduce((sum, project) => sum + (project.done_tasks || 0), 0);
        const activeProjects = projects.filter(project => {
            const progress = project.total_tasks > 0 ?
                Math.round((project.done_tasks / project.total_tasks) * 100) : 0;
            return progress < 100;
        }).length;

        // Для просроченных задач нужен отдельный запрос или расчет
        const overdueTasks = 0; // Временное значение

        // Обновляем счетчики
        this.updateCounter('active-projects-count', activeProjects);
        this.updateCounter('overdue-tasks-count', overdueTasks);
        this.updateCounter('total-tasks-count', totalTasks);
        this.updateCounter('completed-tasks-count', doneTasks);

        // Возвращаем статистику для использования в других методах
        return {
            activeProjects,
            overdueTasks,
            totalTasks,
            completedTasks: doneTasks,
            totalProjects: projects.length
        };
    }

    // Добавить в класс DashboardManager после updateStats() метода:
    static updateStatsDisplay(stats) {
        // Обновляем счетчики в UI
        this.updateCounter('active-projects-count', stats.activeProjects || 0);
        this.updateCounter('overdue-tasks-count', stats.overdueTasks || 0);
        this.updateCounter('total-tasks-count', stats.totalTasks || 0);
        this.updateCounter('completed-tasks-count', stats.completedTasks || 0);

        // Обновляем дополнительные счетчики если они есть
        const urgentTasksEl = document.getElementById('urgent-tasks-count');
        const totalProjectsEl = document.getElementById('total-projects-count');

        if (urgentTasksEl) {
            this.updateCounter('urgent-tasks-count', stats.urgentTasks || 0);
        }

        if (totalProjectsEl) {
            this.updateCounter('total-projects-count', stats.totalProjects || 0);
        }

        // Обновляем прогресс-бары если есть
        this.updateProgressBars(stats);
    }

    static updateProgressBars(stats) {
        // Обновляем прогресс выполнения задач если есть соответствующие элементы
        const completionRateEl = document.getElementById('completion-rate');
        if (completionRateEl) {
            const completionRate = stats.totalTasks > 0 ?
                Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
            const progressBar = completionRateEl.querySelector('.progress-fill');
            if (progressBar) {
                progressBar.style.width = `${completionRate}%`;
            }

            const progressText = completionRateEl.querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = `${completionRate}%`;
            }
        }
    }

    static updateCounter(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            // Анимация изменения числа
            this.animateCounter(element, parseInt(element.textContent) || 0, count);
        }
    }

    static initAdvancedStats() {
        // Добавляем обработку ошибок
        try {
            // Периодическое обновление статистики
            setInterval(() => {
                try {
                    this.updateDashboardStats();
                } catch (error) {
                    Utils.logError('Error in periodic stats update:', error);
                }
            }, 30000); // Каждые 30 секунд

            // Слушатель для обновления при изменении данных
            EventManager.on(APP_EVENTS.PROJECTS_LOADED, () => {
                try {
                    this.refreshStats();
                } catch (error) {
                    Utils.logError('Error refreshing stats on projects loaded:', error);
                }
            });

            EventManager.on(APP_EVENTS.TASKS_LOADED, () => {
                try {
                    this.refreshStats();
                } catch (error) {
                    Utils.logError('Error refreshing stats on tasks loaded:', error);
                }
            });
        } catch (error) {
            Utils.logError('Error initializing advanced stats:', error);
        }
    }

    static updateDashboardStats() {
        const projects = StateManager.getState('projects') || [];
        const tasks = StateManager.getState('tasks') || [];

        const stats = {
            activeProjects: this.getActiveProjectsCount(projects),
            totalProjects: projects.length,
            overdueTasks: this.getOverdueTasksCount(tasks),
            totalTasks: tasks.length,
            completedTasks: this.getCompletedTasksCount(tasks),
            urgentTasks: this.getUrgentTasksCount(tasks)
        };

        // Обновляем UI - ИСПРАВЛЕННАЯ СТРОКА:
        this.updateStatsDisplay(stats);

        // Сохраняем в state
        StateManager.setState('dashboard.stats', stats);

        return stats;
    }

    static animateCounter(element, from, to) {
        const duration = 500; // ms
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(from + (to - from) * easeOutQuart);

            element.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = to;
            }
        }

        requestAnimationFrame(update);
    }

    static renderProjects(projects) {
        if (!Array.isArray(projects)) return;

        const container = document.getElementById('projects-container');
        if (!container) return;

        container.innerHTML = projects
            .map(project => UIComponents.renderProjectCard(project))
            .join('');

        Utils.log(`Rendered ${projects.length} projects`);
    }

    static renderPriorityTasks(tasks) {
        const container = document.getElementById('priority-tasks-list');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.getEmptyTasksHTML();
            return;
        }

        this.showLoadingState(container);

        requestAnimationFrame(() => {
            container.innerHTML = '';
            tasks.forEach((task, index) => {
                setTimeout(() => {
                    try {
                        const cardHTML = this.renderTaskCardWithTemplate(task);
                        const card = document.createElement('div');
                        card.innerHTML = cardHTML;

                        const cardElement = card.firstElementChild;
                        if (cardElement) {
                            container.appendChild(cardElement);

                            // Добавляем обработчик клика
                            cardElement.addEventListener('click', () => {
                                TasksManager.openTaskDetail(task.id);
                            });

                            // Добавляем анимацию появления с проверкой существования
                            if (cardElement.style) {
                                cardElement.style.animationDelay = `${index * 50}ms`;
                            }
                            cardElement.classList.add('fade-in');
                        }
                    } catch (error) {
                        Utils.logError('Error rendering task card:', error);
                    }
                }, index * 50);
            });
        });
    }

    static getActiveProjects(projects) {
        return projects.filter(project => {
            const stats = project.stats || {};
            const progress = stats.tasks_count > 0 ?
                Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
            return progress < 100;
        });
    }

    static getPriorityTasks(tasks) {
        return tasks
            .filter(task => ['high', 'urgent'].includes(task.priority) || Utils.isOverdue(task.due_date))
            .sort((a, b) => {
                const aOverdue = Utils.isOverdue(a.due_date);
                const bOverdue = Utils.isOverdue(b.due_date);

                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;

                const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
    }

    static getEmptyProjectsHTML() {
        return `
            <div class="empty-state" style="padding: var(--spacing-lg);">
                <div class="empty-icon">
                    <i class="fas fa-folder-open"></i>
                </div>
                <h3 style="margin-bottom: var(--spacing-sm);">Проектов пока нет</h3>
                <p style="margin-bottom: var(--spacing-md);">Создайте свой первый проект, чтобы начать работу</p>
                <button class="btn btn-primary" onclick="ProjectsManager.showCreateProjectModal()">
                    <i class="fas fa-plus"></i> Создать проект
                </button>
            </div>
        `;
    }

    static getEmptyTasksHTML() {
        return `
            <div class="empty-state" style="padding: var(--spacing-lg);">
                <div class="empty-icon">
                    <i class="fas fa-tasks"></i>
                </div>
                <h3 style="margin-bottom: var(--spacing-sm);">Приоритетных задач нет</h3>
                <p>Все задачи выполнены или не требуют срочного внимания</p>
            </div>
        `;
    }

    static showErrorState() {
        const projectsContainer = document.getElementById('projects-list');
        const tasksContainer = document.getElementById('priority-tasks-list');

        if (projectsContainer) {
            projectsContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки проектов</h3>
                    <button class="btn btn-primary" onclick="DashboardManager.loadDashboard()">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }

        if (tasksContainer) {
            tasksContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки задач</h3>
                </div>
            `;
        }
    }

    // Методы для обновления отдельных компонентов дашборда
    static refreshProjects() {
        const projects = StateManager.getState('projects');
        this.renderProjects(projects);
    }

    static refreshTasks() {
        const tasks = StateManager.getState('tasks');
        this.renderPriorityTasks(tasks);
    }

    static refreshStats() {
        this.updateDashboardStats();
    }

    static getActiveProjectsCount(projects) {
        return this.getActiveProjects(projects).length;
    }

    static getOverdueTasksCount(tasks) {
        return tasks.filter(task => Utils.isOverdue(task.due_date) && task.status !== 'done').length;
    }

    static getCompletedTasksCount(tasks) {
        return tasks.filter(task => task.status === 'done').length;
    }

    static getUrgentTasksCount(tasks) {
        return tasks.filter(task => task.priority === 'urgent' && task.status !== 'done').length;
    }

    // Подписка на события обновления данных
    static initEventListeners() {
        EventManager.on(APP_EVENTS.PROJECTS_LOADED, (projects) => {
            this.refreshProjects();
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, (tasks) => {
            this.refreshTasks();
        });

        EventManager.on(APP_EVENTS.PROJECT_CREATED, () => {
            this.loadDashboard();
        });

        EventManager.on(APP_EVENTS.TASK_CREATED, () => {
            this.loadDashboard();
        });
    }

    // Вспомогательные методы для рендеринга с шаблонами
    static renderProjectCardWithTemplate(projectData) {
        const project = projectData.project || projectData;
        const stats = project.stats || {};
        const role = projectData.role || 'member';
        const progress = stats.tasks_count > 0
            ? Math.round((stats.tasks_done / stats.tasks_count) * 100)
            : 0;

        const templateData = {
            id: project.id,
            hash: project.hash,
            title: project.title,
            description: project.description || 'Без описания',
            role: role,
            roleText: this.getRoleText(role),
            membersCount: stats.members_count || 0,
            tasksCount: stats.tasks_count || 0,
            userTasks: stats.user_tasks || 0,
            progress: progress,
            status: this.getProjectStatus(project),
            canInvite: ['owner', 'admin'].includes(role)
        };

        // Используем UIComponents для рендеринга
        if (typeof UIComponents !== 'undefined' && UIComponents.templates.has('project-card-template')) {
            return UIComponents.renderTemplate('project-card-template', templateData);
        } else {
            // Fallback на стандартный рендеринг
            return this.createProjectCard(projectData);
        }
    }

    static renderTaskCardWithTemplate(task) {
        const isOverdue = Utils.isOverdue(task.due_date);
        const progress = task.subtasks && task.subtasks.length > 0
            ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
            : 0;

        const templateData = {
            id: task.id,
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            priorityText: Utils.getPriorityText(task.priority),
            status: task.status,
            statusText: Utils.getStatusText(task.status),
            assignee: task.assignee?.full_name || 'Не назначен',
            dueDate: task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока',
            isOverdue: isOverdue,
            hasSubtasks: !!(task.subtasks && task.subtasks.length > 0),
            progress: progress
        };

        // Используем UIComponents для рендеринга
        if (typeof UIComponents !== 'undefined' && UIComponents.templates.has('task-card-template')) {
            return UIComponents.renderTemplate('task-card-template', templateData);
        } else {
            // Fallback на стандартный рендеринг
            return this.createTaskCard(task);
        }
    }

    static createTaskCard(task) {
        const isOverdue = task.due_date && Utils.isOverdue(task.due_date);
        const progress = task.subtasks && task.subtasks.length > 0
            ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
            : 0;

        return `
            <div class="task-card" data-task-id="${task.id}" tabindex="0"
                 aria-label="Задача ${Utils.escapeHTML(task.title)}">
                <div class="swipe-actions" aria-hidden="true">
                    <div class="swipe-action edit-action" aria-label="Редактировать задачу">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </div>
                    <div class="swipe-action delete-action" aria-label="Удалить задачу">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </div>
                </div>

                <div class="card-content">
                    <div class="card-header">
                        <h4 class="task-title">${Utils.escapeHTML(task.title)}</h4>
                        <span class="priority-badge priority-${task.priority}">
                            ${Utils.escapeHTML(Utils.getPriorityText(task.priority))}
                        </span>
                    </div>

                    <p class="task-description">
                        ${Utils.escapeHTML(task.description || '')}
                    </p>

                    <div class="task-meta">
                        <div class="meta-item">
                            <i class="fas fa-user" aria-hidden="true"></i>
                            <span>${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}</span>
                        </div>
                        <div class="meta-item ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-clock" aria-hidden="true"></i>
                            <span>${task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока'}</span>
                            ${isOverdue ? '<span class="sr-only">Просрочено</span>' : ''}
                        </div>
                    </div>

                    <div class="task-footer">
                        <span class="status-badge status-${task.status}">
                            ${Utils.escapeHTML(Utils.getStatusText(task.status))}
                        </span>

                        ${task.subtasks && task.subtasks.length > 0 ? `
                            <div class="task-progress">
                                <span class="progress-text">${progress}%</span>
                                <div class="progress-bar small">
                                    <div class="progress-fill" style="width: ${progress}%"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    static getRoleText(role) {
        const roles = {
            'owner': 'Владелец',
            'admin': 'Админ',
            'member': 'Участник',
            'guest': 'Гость'
        };
        return roles[role] || role;
    }

    static getProjectStatus(project) {
        if (project.is_private) {
            return project.requires_approval ? 'Приватный (требует одобрения)' : 'Приватный';
        }
        return 'Публичный';
    }

    static showLoadingState(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="loading-state" aria-live="polite" aria-busy="true">
                <div class="spinner" aria-hidden="true"></div>
                <p>Загрузка...</p>
            </div>
        `;
    }
}

window.DashboardManager = DashboardManager;
