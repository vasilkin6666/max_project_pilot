// js/app.js
// Основное приложение
class App {
  static isInitialized = false;

  static async init() {
      if (this.isInitialized) {
          console.log('App already initialized, skipping...');
          return;
      }

      try {
          console.log('Initializing app...');
          this.isInitialized = true;

          this.initOnlineStatus();

          currentUser = await this.withTimeout(AuthManager.initialize(), 10000, 'Authentication timeout');

          await this.loadData();

          this.setupEventListeners();

          if (typeof MobileApp !== 'undefined') {
              MobileApp.init();
          }

          this.showStartButton();
          this.initMaxBackButton();

          this.attachStartButtonListener();

          this.updateProgressBar();

          console.log('App initialized successfully');

          window.dispatchEvent(new CustomEvent('appInitialized', {
              detail: { user: currentUser, timestamp: new Date() }
          }));

      } catch (error) {
          console.error('App initialization failed:', error);
          this.handleInitError(error);
          this.isInitialized = false;
      }
  }

  static withTimeout(promise, timeoutMs, errorMessage = 'Operation timeout') {
      return Promise.race([
          promise,
          new Promise((_, reject) =>
              setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
          )
      ]);
  }

  static initOnlineStatus() {
      window.addEventListener('online', () => {
          this.showSuccess('Соединение восстановлено');
          setTimeout(() => this.loadData(), 1000);
      });

      window.addEventListener('offline', () => {
          this.showError('Отсутствует интернет-соединение');
      });

      if (!navigator.onLine) {
          this.showError('Приложение работает в offline режиме');
      }
  }

  static showStartButton() {
      const startButton = document.getElementById('startButton');
      const tapToStart = document.getElementById('tapToStart');

      if (startButton) {
          startButton.style.display = 'inline-block';
          startButton.classList.add('fade-in');
      }

      if (tapToStart) {
          tapToStart.style.display = 'block';
          tapToStart.classList.add('fade-in');
      }
  }

  static hapticFeedback(style = 'light') {
      try {
          if (typeof MaxBridge !== 'undefined') {
              MaxBridge.hapticFeedback(style);
          } else if (typeof WebApp !== 'undefined' && WebApp.HapticFeedback) {
              WebApp.HapticFeedback.impactOccurred(style);
          }
      } catch (error) {
          console.log('Haptic feedback not available');
      }
  }

  static initMaxBackButton() {
      if (typeof WebApp !== 'undefined' && WebApp.BackButton) {
          try {
              WebApp.BackButton.onClick(() => {
                  this.backToPreviousView();
              });
              console.log('MAX Back button handler initialized');
          } catch (error) {
              console.log('MAX Back button setup failed:', error);
          }
      }
  }

  static showExitConfirmation() {
      if (confirm('Вы уверены, что хотите выйти из приложения?')) {
          if (typeof WebApp !== 'undefined' && WebApp.close) {
              WebApp.close();
          } else {
              console.log('Exit confirmed (standalone mode)');
          }
      }
  }

  static attachStartButtonListener() {
      const startButton = document.getElementById('startButton');
      const loadingOverlay = document.getElementById('loading');

      if (startButton) {
          startButton.replaceWith(startButton.cloneNode(true));
          document.getElementById('startButton').addEventListener('click', () => {
              this.hideSplashScreen();
          });
      }

      if (loadingOverlay) {
          loadingOverlay.addEventListener('click', () => {
              this.hideSplashScreen();
          });
      }
  }

  static updateProgressBar() {
      const progressBar = document.getElementById('loadingBarProgress');
      if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.transition = 'all 0.5s ease-in-out';

          setTimeout(() => {
              progressBar.style.background = 'var(--success)';
              progressBar.style.boxShadow = '0 0 10px var(--success)';
          }, 100);
      }
  }

  static hideSplashScreen() {
      const loadingOverlay = document.getElementById('loading');
      const appElement = document.getElementById('app');

      if (loadingOverlay) {
          console.log('Hiding splash screen...');

          loadingOverlay.classList.add('hidden');

          setTimeout(() => {
              loadingOverlay.style.display = 'none';

              if (appElement) {
                  appElement.style.display = 'block';
                  appElement.classList.add('fade-in');
              }

              console.log('Splash screen hidden, app is ready');

              this.showDashboard();

              window.dispatchEvent(new Event('appStarted'));

          }, 800);
      }
  }

  static handleInitError(error) {
      const loadingContent = document.querySelector('.loading-content');

      if (loadingContent) {
          loadingContent.innerHTML = `
              <div class="error-state">
                  <div class="error-icon">⚠️</div>
                  <h2>Ошибка загрузки</h2>
                  <p>${error.message || 'Неизвестная ошибка'}</p>
                  <div class="error-actions">
                      <button onclick="location.reload()" class="btn btn-primary retry-button">
                          Перезагрузить
                      </button>
                      <button onclick="App.continueWithoutData()" class="btn btn-outline">
                          Продолжить без данных
                      </button>
                  </div>
              </div>
          `;
      }

      this.showError('Ошибка инициализации приложения: ' + error.message);
  }

  static continueWithoutData() {
      console.log('Continuing without data...');
      this.hideSplashScreen();

      this.renderProjects([]);
      this.updateStats([], []);
      this.renderRecentTasks([]);

      this.showSuccess('Приложение запущено в ограниченном режиме');
  }

  static setupEventListeners() {
      this.removeEventListeners();

      this.addEventListener('dashboardBtn', 'click', () => this.showDashboard());
      this.addEventListener('createProjectBtn', 'click', () => this.showModal('createProjectModal'));
      this.addEventListener('searchProjectsBtn', 'click', () => this.showSearchProjects());
      this.addEventListener('notificationsBtn', 'click', () => this.showNotifications());
      this.addEventListener('myTasksBtn', 'click', () => this.showMyTasks());
      this.addEventListener('settingsBtn', 'click', () => this.showSettings());

      this.addEventListener('manageMembersBtn', 'click', () => this.showProjectMembersManagement());
      this.addEventListener('joinRequestsBtn', 'click', () => this.showJoinRequests());
      this.addEventListener('editProjectBtn', 'click', () => this.showEditProjectModal());
      this.addEventListener('deleteProjectBtn', 'click', () => this.showDeleteProjectModal());

      this.addEventListener('createTaskBtn', 'click', () => this.showCreateTaskModal());
      this.addEventListener('createSubtaskBtn', 'click', () => this.showCreateSubtaskModal());
      this.addEventListener('editTaskBtn', 'click', () => this.showEditTaskModal());
      this.addEventListener('deleteTaskBtn', 'click', () => this.showDeleteTaskModal());
      this.addEventListener('addCommentBtn', 'click', () => this.addComment());

      this.addEventListener('tasksFilterStatus', 'change', () => this.loadMyTasks());
      this.addEventListener('tasksFilterProject', 'change', () => this.loadMyTasks());

      this.addEventListener('searchProjectsSubmitBtn', 'click', () => this.searchProjects());

      this.addEventListener('submitCreateProjectBtn', 'click', (e) => {
          e.preventDefault();
          this.handleCreateProject();
      });
      this.addEventListener('submitEditProjectBtn', 'click', (e) => {
          e.preventDefault();
          this.handleUpdateProject();
      });
      this.addEventListener('confirmDeleteProjectBtn', 'click', () => this.handleDeleteProject());
      this.addEventListener('submitCreateTaskBtn', 'click', (e) => {
          e.preventDefault();
          this.handleCreateTask();
      });
      this.addEventListener('submitEditTaskBtn', 'click', (e) => {
          e.preventDefault();
          this.handleUpdateTask();
      });
      this.addEventListener('confirmDeleteTaskBtn', 'click', () => this.handleDeleteTask());
      this.addEventListener('joinProjectFromPreviewBtn', 'click', () => this.joinProjectFromPreview());

      this.addEventListener('submitCreateSubtaskBtn', 'click', (e) => {
          e.preventDefault();
          this.handleCreateSubtask();
      });
      this.addEventListener('submitUpdateMemberRoleBtn', 'click', (e) => {
          e.preventDefault();
          this.handleUpdateMemberRole();
      });
      this.addEventListener('confirmRemoveMemberBtn', 'click', () => this.handleRemoveMember());

      this.addEventListener('taskStatusSelect', 'change', () => this.updateTaskStatus());

      this.addEventListener('searchProjectsInput', 'keypress', (e) => {
          if (e.key === 'Enter') {
              this.searchProjects();
          }
      });
  }

  static eventHandlers = new Map();

  static showMyTasks() {
      this.showView('myTasksView');
      this.loadMyTasks();
  }

  static addEventListener(elementId, event, handler) {
      const element = document.getElementById(elementId);
      if (element) {
          const key = `${elementId}_${event}`;

          if (this.eventHandlers.has(key)) {
              const { element: oldElement, event: oldEvent, handler: oldHandler } = this.eventHandlers.get(key);
              oldElement.removeEventListener(oldEvent, oldHandler);
          }

          element.addEventListener(event, handler);
          this.eventHandlers.set(key, { element, event, handler });
      }
  }

  static removeEventListeners() {
      for (const [key, { element, event, handler }] of this.eventHandlers) {
          element.removeEventListener(event, handler);
      }
      this.eventHandlers.clear();
  }

  static loadDataInProgress = false;

  static async loadData() {
      if (this.loadDataInProgress) {
          console.log('Data loading already in progress, skipping...');
          return;
      }

      try {
          this.loadDataInProgress = true;
          console.log('Loading data...');

          const dashboardData = await ApiService.getDashboard();
          const projects = dashboardData.projects || [];
          const settings = dashboardData.settings || {};
          const recentTasks = dashboardData.recent_tasks || [];

          userSettings = settings;
          this.applyUserSettings(settings);

          this.renderProjects(projects);
          this.updateStats(projects, recentTasks);
          this.renderRecentTasks(recentTasks);
          console.log('Data loaded successfully');
      } catch (error) {
          console.error('Error loading data:', error);
          this.showError('Ошибка загрузки данных: ' + error.message);
      } finally {
          this.loadDataInProgress = false;
      }
  }

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
              <div class="project-card-actions">
                  <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditProjectModal('${projectData.hash}')">✏️</button>
                  <button class="quick-action-btn quick-action-delete" onclick="event.stopPropagation(); App.showDeleteProjectModal('${projectData.hash}')">🗑️</button>
              </div>
          </div>`;
      }).join('');
  }

  static updateStats(projects, recentTasks) {
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
              <div class="task-card-actions">
                  <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                  <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
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

  static showView(viewId) {
      try {
          document.querySelectorAll('.view').forEach(view => {
              view.style.display = 'none';
          });

          const targetView = document.getElementById(viewId);
          if (targetView) {
              targetView.style.display = 'block';
          } else {
              console.error(`View ${viewId} not found`);
              this.showDashboard();
          }
      } catch (error) {
          console.error('Error showing view:', error);
          this.showDashboard();
      }
  }

  static showDashboard() {
      this.showView('dashboardView');
      this.loadData();
  }

  static async showSearchProjects() {
      this.showView('searchProjectsView');
      document.getElementById('searchProjectsInput').value = '';
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
      this.showModal('settingsModal');
  }

  static async openProject(projectHash) {
      try {
          console.log('Opening project:', projectHash);
          const projectData = await ApiService.getProject(projectHash);

          currentProject = projectData.project || projectData;
          currentProject.members = projectData.members || [];

          console.log('Opened project:', currentProject);

          document.getElementById('projectTitleHeader').textContent = currentProject.title;
          document.getElementById('projectDescriptionText').textContent = currentProject.description || 'Без описания';
          document.getElementById('projectHashValue').textContent = currentProject.hash;
          document.getElementById('projectHashInfo').style.display = 'block';

          document.getElementById('projectMembersCount').textContent = currentProject.members.length;

          const tasksResponse = await ApiService.getTasks(currentProject.hash);
          const tasks = tasksResponse.tasks || [];
          const totalTasks = tasks.length;
          const doneTasks = tasks.filter(t => t.status === 'done').length;
          const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

          document.getElementById('projectTotalTasks').textContent = totalTasks;
          document.getElementById('projectDoneTasks').textContent = doneTasks;
          document.getElementById('projectInProgressTasks').textContent = inProgressTasks;

          await this.loadProjectTasks(currentProject.hash);

          try {
              await this.loadProjectMembers(currentProject.hash);
          } catch (memberError) {
              console.error('Failed to load members, but continuing:', memberError);
          }

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
                  <div class="task-card-actions">
                      <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                      <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
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

  static async openTask(taskId) {
      try {
          const response = await ApiService.getTask(taskId);
          currentTask = response.task || response;

          console.log('Current task set to:', currentTask);
          if (!currentTask) {
              this.showError('Задача не найдена');
              return;
          }

          document.getElementById('taskTitleHeader').textContent = currentTask.title;
          document.getElementById('taskDescriptionText').textContent = currentTask.description || 'Без описания';
          document.getElementById('taskPriorityText').textContent = this.getPriorityText(currentTask.priority);
          document.getElementById('taskStatusSelect').value = currentTask.status;
          document.getElementById('taskCreatedAtText').textContent = new Date(currentTask.created_at).toLocaleString();
          document.getElementById('taskDueDateText').textContent = currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : 'Не установлен';

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

          const createSubtaskBtn = document.getElementById('createSubtaskBtn');
          const subtasksSection = document.getElementById('subtasksSection');
          if (currentTask.parent_task_id === null && currentProject) {
              subtasksSection.style.display = 'block';
              createSubtaskBtn.style.display = 'inline-block';
              await this.loadSubtasks(taskId);
          } else {
              subtasksSection.style.display = 'none';
              createSubtaskBtn.style.display = 'none';
          }

          await this.loadTaskComments(taskId);

          this.showView('taskView');
      } catch (error) {
          console.error('Error opening task:', error);
          this.showError('Ошибка открытия задачи: ' + error.message);
      }
  }

  static async loadTaskAssigneeInfo(assigneeId) {
      try {
          console.log('Loading assignee info for:', assigneeId);
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
          const response = await ApiService.getProjectMembers(currentProject.hash);
          const members = response.members || [];
          const assignee = members.find(member => (member.user_id || (member.user && member.user.id)) === assigneeId);
          if (assignee) {
              const displayName = (assignee.user && assignee.user.full_name) || assignee.full_name || `Участник #${assigneeId}`;
              document.getElementById('taskAssignedToText').textContent = displayName;
              return;
          }
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
                      <div class="task-card-actions">
                          <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                          <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
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
                      <div class="task-card-actions">
                          <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                          <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
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
          await this.loadData();
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

      if (currentProject.current_user_role !== 'owner' && currentProject.current_user_role !== 'admin') {
          this.showError('Недостаточно прав для редактирования проекта');
          this.hideModal('editProjectModal');
          return;
      }

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
          await this.openProject(currentProject.hash);
          this.showSuccess('Проект обновлен успешно!');
      } catch (error) {
          console.error('Error updating project:', error);
          if (error.message.includes('403')) {
              this.showError('Недостаточно прав для редактирования проекта');
          } else {
              this.showError('Ошибка обновления проекта: ' + error.message);
          }
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

  static async showCreateTaskModal() {
      if (!currentProject) return;

      try {
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

          const tasksResponse = await ApiService.getTasks(currentProject.hash);
          const tasks = tasksResponse.tasks || [];

          const parentTaskSelect = document.getElementById('taskParentId');
          parentTaskSelect.innerHTML = '<option value="">Основная задача (без родителя)</option>';
          tasks.forEach(task => {
              if (task.parent_task_id === null) {
                  const option = document.createElement('option');
                  option.value = task.id;
                  option.textContent = task.title;
                  parentTaskSelect.appendChild(option);
              }
          });

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
      this.tempParentTaskId = parentTaskId;
      this.showCreateTaskModal();
  }

  static async handleCreateTask() {
      if (!currentProject) return;
      const title = document.getElementById('taskTitle').value.trim();
      const description = document.getElementById('taskDescription').value.trim();
      const priority = document.getElementById('taskPriority').value;
      const dueDate = document.getElementById('taskDueDate').value;
      const parentTaskId = this.tempParentTaskId || document.getElementById('taskParentId').value || null;
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
          if (assignedTo) taskData.assigned_to_id = parseInt(assignedTo);

          console.log('Creating task with data:', taskData);
          await ApiService.createTask(taskData);

          this.hideModal('createTaskModal');
          const createTaskForm = document.getElementById('createTaskForm');
          if (createTaskForm) {
              createTaskForm.reset();
          }
          this.tempParentTaskId = null;

          if (currentProject && !currentTask) {
              await this.loadProjectTasks(currentProject.hash);
          } else if (currentTask) {
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

  static async handleCreateSubtask() {
      if (!currentTask || !currentTask.id) return;
      const title = document.getElementById('subtaskTitle').value.trim();
      const description = "";
      if (!title) {
          this.showError('Введите название подзадачи');
          return;
      }

      try {
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

          if (parentTask.assigned_to_id) {
              taskData.assigned_to_id = parentTask.assigned_to_id;
          }

          console.log('Creating subtask with data:', taskData);
          await ApiService.createTask(taskData);

          this.hideModal('createSubtaskModal');
          const createSubtaskForm = document.getElementById('createSubtaskForm');
          if (createSubtaskForm) {
              createSubtaskForm.reset();
          }

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

      const editTaskTitle = document.getElementById('editTaskTitle');
      const editTaskDescription = document.getElementById('editTaskDescription');
      const editTaskPriority = document.getElementById('editTaskPriority');
      const editTaskDueDate = document.getElementById('editTaskDueDate');
      const taskStatusSelect = document.getElementById('taskStatusSelect');

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
              taskData.due_date = null;
          }

          console.log('Updating task:', currentTask.id, taskData);
          await ApiService.updateTask(currentTask.id, taskData);

          this.hideModal('editTaskModal');
          await this.openTask(currentTask.id);
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

  static async updateTaskStatus() {
      if (!currentTask || !currentTask.id) {
          console.error('No current task for status update:', currentTask);
          this.showError('Ошибка: задача не выбрана');
          return;
      }

      const newStatus = document.getElementById('taskStatusSelect').value;
      if (!newStatus) {
          this.showError('Выберите статус задачи');
          return;
      }

      try {
          console.log('Updating task status:', currentTask.id, newStatus);
          const updatedTask = await ApiService.updateTaskStatus(currentTask.id, newStatus);

          if (newStatus === 'done') {
              await this.completeAllChildTasks(currentTask.id);
          } else if (newStatus === 'todo') {
               await this.resetParentTasksStatus(currentTask.id);
          }
          await this.checkParentTaskStatus(currentTask.id);

          currentTask = updatedTask.task || updatedTask;
          this.showSuccess('Статус задачи обновлен!');
      } catch (error) {
          console.error('Error updating task status:', error);
          this.showError('Ошибка обновления статуса: ' + error.message);
          if (currentTask) {
              document.getElementById('taskStatusSelect').value = currentTask.status;
          }
      }
  }

  static async checkParentTaskStatus(taskId) {
      if (!currentProject || !taskId) return;

      try {
          const response = await ApiService.getTasks(currentProject.hash);
          const tasks = response.tasks || [];
          const currentTask = tasks.find(t => t.id === taskId);

          if (currentTask && currentTask.parent_task_id) {
              const parentTask = tasks.find(t => t.id === currentTask.parent_task_id);
              if (!parentTask) return;

              const responseSiblings = await ApiService.getTasks(currentProject.hash);
              const tasksSiblings = responseSiblings.tasks || [];
              const siblingTasks = tasksSiblings.filter(t => t.parent_task_id === parentTask.id);

              const allChildrenDone = siblingTasks.every(child => child.status === 'done');

              if (allChildrenDone && parentTask.status !== 'done') {
                  await ApiService.updateTaskStatus(parentTask.id, 'done');
                  await this.checkParentTaskStatus(parentTask.id);
              } else if (!allChildrenDone && parentTask.status === 'done') {
                  await ApiService.updateTaskStatus(parentTask.id, 'todo');
              }
          }
      } catch (error) {
          console.error('Error checking parent task status:', error);
      }
  }

  static async resetParentTasksStatus(taskId) {
      if (!currentProject || !taskId) return;

      try {
          const response = await ApiService.getTasks(currentProject.hash);
          const tasks = response.tasks || [];
          const currentTask = tasks.find(t => t.id === taskId);

          if (currentTask && currentTask.parent_task_id) {
              const parentTask = tasks.find(t => t.id === currentTask.parent_task_id);
              if (!parentTask) return;

              if (parentTask.status !== 'todo') {
                  await ApiService.updateTaskStatus(parentTask.id, 'todo');
              }

              await this.resetParentTasksStatus(parentTask.id);
          }
      } catch (error) {
          console.error('Error resetting parent task status:', error);
      }
  }

  static async completeAllChildTasks(parentTaskId) {
      if (!currentProject || !parentTaskId) return;

      try {
          const response = await ApiService.getTasks(currentProject.hash);
          const tasks = response.tasks || [];
          const childTasks = tasks.filter(t => t.parent_task_id === parentTaskId);

          for (const childTask of childTasks) {
              if (childTask.status !== 'done') {
                  await ApiService.updateTaskStatus(childTask.id, 'done');
                  await this.completeAllChildTasks(childTask.id);
              }
          }
      } catch (error) {
          console.error('Error completing child tasks:', error);
      }
  }

  static async assignTaskToUser(userId) {
      if (!currentTask || !currentTask.id || !userId) {
          this.showError('ID задачи и ID пользователя обязательны');
          return;
      }
      try {
          await ApiService.updateTask(currentTask.id, { assigned_to_id: userId });
          this.showSuccess('Исполнитель задачи обновлен!');
          if (currentTask && currentTask.id === currentTask.id) {
              await this.openTask(currentTask.id);
          }
      } catch (error) {
          console.error('Error assigning task:', error);
          this.showError('Ошибка назначения исполнителя: ' + error.message);
      }
  }

  static async loadSubtasks(parentTaskId, level = 0, container = null) {
      try {
          if (!currentProject || !currentProject.hash) {
              console.log('No current project for loading subtasks, skipping...');
              if (container) {
                  container.innerHTML = '<p>Не удалось загрузить подзадачи</p>';
              } else {
                  document.getElementById('subtasksList').innerHTML = '<p>Не удалось загрузить подзадачи</p>';
              }
              return;
          }

          const response = await ApiService.getTasks(currentProject.hash);
          const tasks = response.tasks || [];
          const subtasks = tasks.filter(task => task.parent_task_id === parentTaskId);

          const targetContainer = container || document.getElementById('subtasksList');
          if (!targetContainer) {
              console.error('Subtasks container not found');
              return;
          }

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
                  <span style="width: 16px;"></span>
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
          const targetContainer = container || document.getElementById('subtasksList');
          if (targetContainer) {
              targetContainer.innerHTML = '<p>Ошибка загрузки подзадач</p>';
          }
      }
  }

  static async toggleSubtaskStatus(taskId, isDone) {
      try {
          const newStatus = isDone ? 'done' : 'todo';
          await ApiService.updateTaskStatus(taskId, newStatus);

          if (isDone) {
              await this.completeAllChildTasks(taskId);
          } else {
              await this.resetParentTasksStatus(taskId);
          }

          await this.checkParentTaskStatus(taskId);

          if (currentTask) {
              await this.loadSubtasks(currentTask.id);
          }
          this.showSuccess('Статус задачи обновлен!');
      } catch (error) {
          console.error('Error toggling subtask status:', error);
          this.showError('Ошибка обновления статуса задачи: ' + error.message);
      }
  }

  static async searchProjects() {
      const searchTerm = document.getElementById('searchProjectsInput').value.trim();
      try {
           if (!searchTerm) {
              await this.loadRecentPublicProjects();
              return;
          }

          if (/^[a-zA-Z0-9]{6,}$/.test(searchTerm)) {
              console.log('Searching by exact hash:', searchTerm);
              try {
                  await this.searchProjectByExactHash(searchTerm);
                  return;
              } catch (error) {
                  console.log('Project not found by hash, trying by name...');
                  await this.searchProjectsByQuery(searchTerm);
                  return;
              }
          } else {
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
              const title = `Проект по хэшу: "${hash}"`;
              this.renderSearchResults([project], title);
          } else {
              throw new Error('Project not found by hash');
          }
      } catch (error) {
          console.error('Error searching project by exact hash:', error);
          throw error;
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

          let buttonText = 'Присоединиться';
          let buttonAction = `App.handleJoinProject('${project.hash}')`;
          let buttonClass = 'btn-primary';

          if (isPrivate && !requiresApproval) {
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
              this.showDashboard();
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
      this.renderSearchResults([project], `Предварительный просмотр: ${project.title}`);
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
              const statusText = this.getJoinRequestStatusText(request.status);
              const statusColor = this.getJoinRequestStatusColor(request.status);
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
          await this.showJoinRequests();
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
          await this.showJoinRequests();
      } catch (error) {
          console.error('Error rejecting join request:', error);
          if (error.message.includes('404')) {
              this.showError('Заявка не найдена. Возможно, она уже была обработана.');
          } else {
              this.showError('Ошибка отклонения заявки: ' + error.message);
          }
      }
  }

  static async loadSettings() {
      try {
          const userData = await ApiService.getCurrentUser();
          document.getElementById('userFullName').value = userData.full_name || '';
          document.getElementById('userUsername').value = userData.username || '';

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

          if (fullName || username) {
              await ApiService.updateCurrentUser({
                  full_name: fullName,
                  username: username
              });
          }

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

  static showModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
          modal.classList.add('active');
      } else {
           console.error(`Modal with id '${modalId}' not found`);
      }
  }

  static hideModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
          modal.classList.remove('active');
      }
  }

  static showSuccess(message) {
      console.log('Success:', message);
      alert(message);
  }

  static showError(message) {
      console.error('Error:', message);
      alert('Ошибка: ' + message);
  }

  static backToPreviousView() {
      const currentView = document.querySelector('.view[style*="display: block"]');
      console.log('Back button pressed, current view:', currentView?.id);

      if (currentView && currentView.id !== 'dashboardView') {
          currentView.style.animation = 'slideOutRight 0.3s ease-out';
          setTimeout(() => {
              this.showDashboard();
              document.getElementById('dashboardView').style.animation = 'slideInLeft 0.3s ease-out';
          }, 150);
      } else {
          this.showExitConfirmation();
      }
  }
}

// Mobile navigation and enhanced features
class MobileApp {
  static init() {
    this.initMobileNavigation();
    this.initSwipeGestures();
    this.initFloatingActionButton();
    this.initPullToRefresh();
  }

  static initMobileNavigation() {
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-view]');

    mobileNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();

        mobileNavItems.forEach(i => i.classList.remove('active'));

        item.classList.add('active');

        const view = item.dataset.view;
        if (view) {
          App.showView(view);

          switch(view) {
            case 'dashboardView':
              App.loadData();
              break;
            case 'myTasksView':
              App.loadMyTasks();
              break;
            case 'notificationsView':
              App.showNotifications();
              break;
            case 'searchProjectsView':
              App.showSearchProjects();
              break;
          }
        }
      });
    });

    const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    if (mobileSettingsBtn) {
      mobileSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        App.showSettings();
      });
    }
  }

  static initFloatingActionButton() {
    const fab = document.getElementById('mainFab');
    const fabMenu = document.getElementById('fabMenu');

    if (!fab || !fabMenu) return;

    fab.addEventListener('click', () => {
      fabMenu.classList.toggle('open');
    });

    document.getElementById('fabCreateProject')?.addEventListener('click', () => {
      App.showCreateProjectModal();
      fabMenu.classList.remove('open');
    });

    document.getElementById('fabCreateTask')?.addEventListener('click', () => {
      if (currentProject) {
        App.showCreateTaskModal();
      } else {
        App.showError('Сначала откройте проект');
      }
      fabMenu.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target) && !fabMenu.contains(e.target)) {
        fabMenu.classList.remove('open');
      }
    });
  }

  static initSwipeGestures() {
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;
    let currentCard = null;

    document.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.project-card, .task-card');
      if (card) {
        startX = e.touches[0].clientX;
        currentX = startX;
        isSwiping = true;
        currentCard = card;

        document.querySelectorAll('.project-card.swiped, .task-card.swiped').forEach(c => {
          if (c !== card) c.classList.remove('swiped');
        });
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (!isSwiping || !currentCard) return;

      currentX = e.touches[0].clientX;
      const diff = startX - currentX;

      if (diff > 0) {
        e.preventDefault();
        const translateX = Math.min(diff, 80);
        currentCard.style.transform = `translateX(-${translateX}px)`;
      }
    });

    document.addEventListener('touchend', () => {
      if (!isSwiping || !currentCard) return;

      const diff = startX - currentX;
      const threshold = 50;

      if (diff > threshold) {
        currentCard.classList.add('swiped');
        currentCard.style.transform = 'translateX(-80px)';

        setTimeout(() => {
          currentCard.classList.remove('swiped');
          currentCard.style.transform = '';
        }, 3000);
      } else {
        currentCard.classList.remove('swiped');
        currentCard.style.transform = '';
      }

      isSwiping = false;
      currentCard = null;
    });
  }

  static initPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const pullIndicator = document.createElement('div');
    pullIndicator.className = 'pull-indicator';
    pullIndicator.innerHTML = '<div class="spinner"></div> Обновление...';

    document.querySelector('.main-content')?.prepend(pullIndicator);

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (!isPulling) return;

      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0) {
        e.preventDefault();
        pullIndicator.style.display = 'block';
        pullIndicator.style.opacity = Math.min(diff / 100, 1);
      }
    });

    document.addEventListener('touchend', async () => {
      if (!isPulling) return;

      const diff = currentY - startY;

      if (diff > 80) {
        pullIndicator.classList.add('refreshing');

        try {
          await App.loadData();
          App.showSuccess('Данные обновлены');
        } catch (error) {
          App.showError('Ошибка обновления');
        }

        setTimeout(() => {
          pullIndicator.classList.remove('refreshing');
          pullIndicator.style.display = 'none';
          pullIndicator.style.opacity = '0';
        }, 1000);
      } else {
        pullIndicator.style.display = 'none';
      }

      isPulling = false;
    });
  }

  static updateNotificationBadge(count) {
    const badge = document.querySelector('.nav-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}

// Enhanced view transitions
const originalShowView = App.showView;
App.showView = function(viewId) {
  const currentView = document.querySelector('.view[style*="display: block"]');

  if (currentView) {
    currentView.style.animation = 'slideOutLeft 0.3s ease-out';
    setTimeout(() => {
      originalShowView.call(this, viewId);
      document.getElementById(viewId).style.animation = 'slideInRight 0.3s ease-out';
    }, 150);
  } else {
    originalShowView.call(this, viewId);
  }
};

// Инициализация анимации искр
function initSparkAnimation() {
    const sparkContainer = document.getElementById('sparkContainer');
    if (!sparkContainer) return;

    const createSpark = () => {
        const spark = document.createElement('div');
        spark.classList.add('spark');

        const startX = Math.random() * 100;
        const startY = Math.random() * 100;

        const endX = (Math.random() - 0.5) * 200;
        const endY = (Math.random() - 0.5) * 200;

        spark.style.setProperty('--end-x', `${endX}vw`);
        spark.style.setProperty('--end-y', `${endY}vh`);
        spark.style.left = `${startX}%`;
        spark.style.top = `${startY}%`;

        sparkContainer.appendChild(spark);

        setTimeout(() => {
            spark.remove();
        }, 3000);
    };

    setInterval(createSpark, Math.random() * 300 + 200);
}

function showStartButton() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        setTimeout(() => {
             startButton.style.display = 'inline-block';
        }, 300);
    }
}

function attachStartButtonListener() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', () => {
            const loadingOverlay = document.getElementById('loading');
            if (loadingOverlay) {
                window.dispatchEvent(new Event('appLoaded'));
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }
        });
    }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    initSparkAnimation();
    App.init();
});
