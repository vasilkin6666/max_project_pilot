// Менеджер поиска
class SearchManager {
    static currentResults = [];
    static searchIndex = new Map();

    static async performSearch(query) {
        if (!query || query.length < 2) {
            this.clearResults();
            return;
        }

        StateManager.updateState('ui.search', { query, loading: true });

        try {
            // Поиск по локальному индексу
            const localResults = this.searchLocal(query);

            // Поиск по API (если необходимо)
            const apiResults = await this.searchAPI(query);

            // Объединяем результаты
            const results = this.mergeResults(localResults, apiResults);

            this.currentResults = results;
            StateManager.updateState('ui.search', {
                results,
                loading: false
            });

            this.renderResults(results);

        } catch (error) {
            Utils.logError('Search error:', error);
            StateManager.updateState('ui.search', { loading: false });
            this.showSearchError();
        }
    }

    static searchLocal(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        // Поиск по проектам
        const projects = StateManager.getState('projects');
        projects.forEach(project => {
            const projectData = project.project || project;
            const score = this.calculateRelevance(projectData, lowerQuery, 'project');
            if (score > 0) {
                results.push({
                    type: 'project',
                    data: projectData,
                    score,
                    title: projectData.title,
                    description: projectData.description,
                    action: () => ProjectsManager.openProjectDetail(projectData.hash)
                });
            }
        });

        // Поиск по задачам
        const tasks = StateManager.getState('tasks');
        tasks.forEach(task => {
            const score = this.calculateRelevance(task, lowerQuery, 'task');
            if (score > 0) {
                results.push({
                    type: 'task',
                    data: task,
                    score,
                    title: task.title,
                    description: task.description,
                    action: () => TasksManager.openTaskDetail(task.id)
                });
            }
        });

        // Сортировка по релевантности
        return results.sort((a, b) => b.score - a.score);
    }

    static async searchAPI(query) {
        try {
            // Ищем среди всех проектов (не только пользовательских)
            const allProjects = await ApiService.getProjects({ search: query, include_public: true });
            const projects = allProjects.projects || [];

            return projects.map(project => {
                const isMember = project.role && project.role !== 'none';
                const canJoin = !project.is_private || (project.is_private && !project.requires_approval);

                return {
                    type: 'public-project',
                    data: project,
                    score: 80, // Высокий приоритет для публичных проектов
                    title: project.title,
                    description: project.description,
                    metadata: {
                        owner: project.owner?.full_name || 'Неизвестно',
                        isMember: isMember,
                        canJoin: canJoin,
                        requiresApproval: project.requires_approval
                    },
                    action: () => this.handlePublicProjectClick(project)
                };
            });
        } catch (error) {
            Utils.logError('API search error:', error);
            return [];
        }
    }


    static handlePublicProjectClick(project) {
        const currentUserId = AuthManager.getCurrentUserId();
        const isMember = project.members?.some(m => m.user_id === currentUserId);

        if (isMember) {
            // Уже участник - открываем проект
            ProjectsManager.openProjectDetail(project.hash);
        } else {
            // Не участник - показываем диалог присоединения
            this.showJoinProjectDialog(project);
        }

        UIComponents.hideSearch();
    }

    static showJoinProjectDialog(project) {
        const requiresApproval = project.requires_approval;

        ModalManager.showConfirmation({
            title: `Присоединиться к проекту "${project.title}"`,
            message: requiresApproval
                ? `Это приватный проект. Будет отправлен запрос на присоединение владельцу проекта.`
                : `Вы хотите присоединиться к проекту "${project.title}"?`,
            confirmText: requiresApproval ? 'Отправить запрос' : 'Присоединиться',
            cancelText: 'Отмена',
            onConfirm: () => this.joinProject(project.hash, requiresApproval)
        });
    }

    static async joinProject(projectHash, requiresApproval) {
        try {
            await ApiService.joinProject(projectHash);

            if (requiresApproval) {
                ToastManager.success('Запрос на присоединение отправлен');
            } else {
                ToastManager.success('Вы успешно присоединились к проекту!');
            }

            HapticManager.success();

            // Обновляем список проектов
            if (typeof ProjectsManager !== 'undefined') {
                await ProjectsManager.loadProjects();
            }

        } catch (error) {
            Utils.logError('Error joining project:', error);
            ToastManager.error('Ошибка присоединения к проекту: ' + error.message);
            HapticManager.error();
        }
    }

    static calculateRelevance(item, query, type) {
        let score = 0;
        const fields = this.getSearchFields(type);

        fields.forEach(field => {
            const value = item[field];
            if (value && typeof value === 'string') {
                const lowerValue = value.toLowerCase();

                if (lowerValue === query) {
                    score += 100; // Точное совпадение
                } else if (lowerValue.startsWith(query)) {
                    score += 50; // Начинается с запроса
                } else if (lowerValue.includes(query)) {
                    score += 30; // Содержит запрос
                } else {
                    // Поиск по словам
                    const words = query.split(' ');
                    words.forEach(word => {
                        if (word.length > 2 && lowerValue.includes(word)) {
                            score += 10;
                        }
                    });
                }
            }
        });

        return score;
    }

    static getSearchFields(type) {
        const fields = {
            project: ['title', 'description'],
            task: ['title', 'description']
        };
        return fields[type] || ['title', 'description'];
    }

    static mergeResults(localResults, apiResults) {
        // Объединяем и удаляем дубликаты
        const merged = [...localResults, ...apiResults];
        const seen = new Set();

        return merged.filter(item => {
            const key = `${item.type}-${item.data.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Заменить метод renderResults в SearchManager
    static renderResults(results) {
        const container = document.getElementById('search-results');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = this.getNoResultsHTML();
            return;
        }

        // Группируем результаты по типам
        const grouped = this.groupResultsByType(results);

        // Создаем HTML для результатов
        let html = '';

        // Проекты
        if (grouped.project || grouped['public-project']) {
            const projects = [...(grouped.project || []), ...(grouped['public-project'] || [])];
            html += this.createSectionHTML('Проекты', projects);
        }

        // Задачи
        if (grouped.task) {
            html += this.createSectionHTML('Задачи', grouped.task);
        }

        container.innerHTML = html;
    }

    // Добавить метод createResultsHTML (если он используется где-то еще)
    static createResultsHTML(grouped) {
        let html = '';

        if (grouped.project || grouped['public-project']) {
            const projects = [...(grouped.project || []), ...(grouped['public-project'] || [])];
            html += this.createSectionHTML('Проекты', projects);
        }

        if (grouped.task) {
            html += this.createSectionHTML('Задачи', grouped.task);
        }

        return html;
    }

    static groupResultsByType(results) {
        const grouped = {};

        results.forEach(result => {
            if (!grouped[result.type]) {
                grouped[result.type] = [];
            }
            grouped[result.type].push(result);
        });

        return grouped;
    }

    static createSectionHTML(title, items) {
        const itemsHTML = items.slice(0, 5).map(item => {
            let actionButton = '';

            if (item.type === 'public-project') {
                if (item.metadata.isMember) {
                    actionButton = '<span class="badge bg-success">Вы в проекте</span>';
                } else if (item.metadata.requiresApproval) {
                    actionButton = '<span class="badge bg-warning">Запрос на присоединение</span>';
                } else {
                    actionButton = '<span class="badge bg-primary">Присоединиться</span>';
                }
            }

            return `
                <div class="search-result-item" onclick="SearchManager.handleResultClick(${JSON.stringify(item).replace(/'/g, "\\'")})">
                    <div class="result-icon">
                        <i class="fas ${this.getTypeIcon(item.type)}"></i>
                    </div>
                    <div class="result-content">
                        <h6 class="result-title">${Utils.escapeHTML(item.title)}</h6>
                        <p class="result-description">${Utils.escapeHTML(item.description || '')}</p>
                        ${item.metadata?.owner ? `
                            <p class="result-owner">Владелец: ${Utils.escapeHTML(item.metadata.owner)}</p>
                        ` : ''}
                    </div>
                    <div class="result-meta">
                        ${actionButton || `<span class="result-type">${this.getTypeLabel(item.type)}</span>`}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="search-section">
                <h5 class="section-title">${title}</h5>
                <div class="search-results-list">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }

    static createSectionHTML(title, items) {
        const itemsHTML = items.slice(0, 5).map(item => `
            <div class="search-result-item" onclick="SearchManager.handleResultClick(${JSON.stringify(item).replace(/'/g, "\\'")})">
                <div class="result-icon">
                    <i class="fas ${this.getTypeIcon(item.type)}"></i>
                </div>
                <div class="result-content">
                    <h6 class="result-title">${Utils.escapeHTML(item.title)}</h6>
                    <p class="result-description">${Utils.escapeHTML(item.description || '')}</p>
                </div>
                <div class="result-meta">
                    <span class="result-type">${this.getTypeLabel(item.type)}</span>
                </div>
            </div>
        `).join('');

        return `
            <div class="search-section">
                <h5 class="section-title">${title}</h5>
                <div class="search-results-list">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }

    static getTypeIcon(type) {
        const icons = {
            project: 'fa-folder',
            'public-project': 'fa-folder-plus',
            task: 'fa-tasks',
            user: 'fa-user',
            notification: 'fa-bell'
        };
        return icons[type] || 'fa-file';
    }

    static getTypeLabel(type) {
        const labels = {
            project: 'Проект',
            'public-project': 'Публичный проект',
            task: 'Задача',
            user: 'Пользователь',
            notification: 'Уведомление'
        };
        return labels[type] || 'Элемент';
    }

    static handleResultClick(result) {
        if (result.action && typeof result.action === 'function') {
            result.action();
        }

        UIComponents.hideSearch();
        HapticManager.light();
    }

    static clearResults() {
        this.currentResults = [];
        StateManager.updateState('ui.search', { results: [] });

        const container = document.getElementById('search-results');
        if (container) {
            container.innerHTML = this.getEmptyStateHTML();
        }
    }

    static getEmptyStateHTML() {
        return `
            <div class="search-empty-state">
                <i class="fas fa-search"></i>
                <p>Введите запрос для поиска</p>
            </div>
        `;
    }

    static getNoResultsHTML() {
        return `
            <div class="search-empty-state">
                <i class="fas fa-search"></i>
                <p>Ничего не найдено</p>
                <p class="text-muted">Попробуйте изменить запрос</p>
            </div>
        `;
    }

    static showSearchError() {
        const container = document.getElementById('search-results');
        if (container) {
            container.innerHTML = `
                <div class="search-error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка при поиске</p>
                    <button class="btn btn-sm btn-outline" onclick="SearchManager.retrySearch()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    static retrySearch() {
        const query = StateManager.getState('ui.search.query');
        if (query) {
            this.performSearch(query);
        }
    }

    // Индексирование данных для быстрого поиска
    static buildSearchIndex() {
        this.searchIndex.clear();

        const projects = StateManager.getState('projects');
        const tasks = StateManager.getState('tasks');

        // Индексируем проекты
        projects.forEach(project => {
            const projectData = project.project || project;
            this.indexItem(projectData, 'project');
        });

        // Индексируем задачи
        tasks.forEach(task => {
            this.indexItem(task, 'task');
        });

        Utils.log('Search index built', {
            projects: projects.length,
            tasks: tasks.length
        });
    }

    static indexItem(item, type) {
        const key = `${type}-${item.id}`;
        const fields = this.getSearchFields(type);
        const content = fields.map(field => item[field] || '').join(' ').toLowerCase();

        this.searchIndex.set(key, {
            type,
            item,
            content
        });
    }

    // Быстрый поиск по индексу
    static quickSearch(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        for (const [key, indexed] of this.searchIndex.entries()) {
            if (indexed.content.includes(lowerQuery)) {
                const score = this.calculateRelevance(indexed.item, lowerQuery, indexed.type);
                results.push({
                    type: indexed.type,
                    data: indexed.item,
                    score,
                    title: indexed.item.title,
                    description: indexed.item.description,
                    action: () => {
                        if (indexed.type === 'project') {
                            ProjectsManager.openProjectDetail(indexed.item.hash);
                        } else if (indexed.type === 'task') {
                            TasksManager.openTaskDetail(indexed.item.id);
                        }
                    }
                });
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }
}

window.SearchManager = SearchManager;
