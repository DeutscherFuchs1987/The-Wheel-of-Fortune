(function () {
    const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    let myProjects = [];
    let currentFilter = 'all';
    let searchCache = new Map();
    let seasonsCache = new Map();
    let videoCandidates = new Map();
    let currentUser = null;

    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const projectsGrid = document.getElementById('projectsGrid');
    const statsDiv = document.getElementById('stats');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // ========== ГЛОБАЛЬНАЯ СИНХРОНИЗАЦИЯ РЕЖИМА ==========
    let currentMode = localStorage.getItem('catalog_mode') || 'personal';
    let selectedGroupId = localStorage.getItem('selected_group') || null;
    let userGroups = [];

    function syncModeAcrossPages() {
        localStorage.setItem('catalog_mode', currentMode);
        window.dispatchEvent(new CustomEvent('modeChanged', {
            detail: { mode: currentMode, groupId: selectedGroupId }
        }));
    }

    window.addEventListener('modeChanged', (event) => {
        if (event.detail.mode !== currentMode) {
            currentMode = event.detail.mode;
            selectedGroupId = event.detail.groupId;
            updateModeUI();
            loadProjectsByMode();
        }
    });

    window.addEventListener('groupProjectStatusChanged', (event) => {
        if (event.detail.groupId === selectedGroupId && currentMode === 'group') {
            const projectIndex = myProjects.findIndex(p => p.id === event.detail.projectId);
            if (projectIndex !== -1) {
                myProjects[projectIndex] = {
                    ...myProjects[projectIndex],
                    status: event.detail.status,
                    user_status: event.detail.status,
                    inProgress: event.detail.status === 'in_progress',
                    watched: event.detail.status === 'watched'
                };
                if (event.detail.status === 'watched') {
                    myProjects = myProjects.filter(p => p.id !== event.detail.projectId);
                }
                renderProjects();
                updateStats();
            }
            const modal = document.querySelector('.project-modal.active');
            if (modal && modal.dataset.projectId === event.detail.projectId) {
                openModal(event.detail.projectId);
            }
            showInfo(`Статус фильма изменён на ${getStatusText(event.detail.status)}`);
        }
    });

    function updateModeUI() {
        const modeToggle = document.getElementById('modeToggle');
        const personalLabel = document.querySelector('.mode-label.personal');
        const groupLabel = document.querySelector('.mode-label.group');
        const groupSelector = document.getElementById('groupSelector');
        if (!modeToggle) return;
        if (currentMode === 'personal') {
            modeToggle.classList.remove('group-mode');
            if (personalLabel) personalLabel.classList.add('active');
            if (groupLabel) groupLabel.classList.remove('active');
            if (groupSelector) groupSelector.style.display = 'none';
        } else {
            modeToggle.classList.add('group-mode');
            if (personalLabel) personalLabel.classList.remove('active');
            if (groupLabel) groupLabel.classList.add('active');
            if (groupSelector) groupSelector.style.display = 'flex';
        }
    }

    async function loadProjectsByMode() {
        if (currentMode === 'personal') {
            await loadPersonalProjects();
        } else if (selectedGroupId) {
            await loadGroupProjects(selectedGroupId);
        } else {
            projectsGrid.innerHTML = '<div class="empty-state"><span>👥</span><p>Выберите группу для просмотра</p></div>';
        }
    }

    async function loadPersonalProjects() {
        try {
            console.log('📡 Загружаем личные проекты...');
            const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
            if (response.ok) {
                let projects = await response.json();
                console.log(`✅ Загружено ${projects.length} личных проектов`, projects);
                myProjects = projects.map(p => ({
                    ...p.data,
                    id: p.project_id,
                    user_status: p.status,
                    status: p.status,
                    inProgress: p.status === 'in_progress',
                    watched: p.status === 'watched'
                })).filter(p => !p.watched);
                console.log(`📊 Непросмотренных: ${myProjects.length}`);
                renderProjects();
                updateStats();
            } else {
                console.error('❌ Ошибка загрузки личных проектов:', response.status);
                await loadUnwatchedProjects();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки личных проектов:', error);
            await loadUnwatchedProjects();
        }
    }

    async function loadGroupProjects(groupId) {
        try {
            console.log(`📡 Загружаем проекты группы ${groupId}...`);
            const response = await window.authFetch(`${API_URL}/api/groups/${groupId}/projects`);
            if (response.ok) {
                let projects = await response.json();
                console.log(`✅ Загружено ${projects.length} проектов группы`, projects);
                myProjects = projects.map(p => ({
                    ...p.data,
                    id: p.project_id,
                    group_project_id: p.id,
                    added_by: p.added_by,
                    status: p.status || 'planned',
                    inProgress: (p.status || 'planned') === 'in_progress',
                    watched: (p.status || 'planned') === 'watched'
                })).filter(p => !p.watched);
                console.log(`📊 Непросмотренных в группе: ${myProjects.length}`);
                renderProjects();
                updateStats();
            } else {
                const errorText = await response.text();
                console.error('❌ Ошибка загрузки проектов группы:', response.status, errorText);
                projectsGrid.innerHTML = '<div class="empty-state"><span>❌</span><p>Ошибка загрузки проектов группы</p></div>';
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки групповых проектов:', error);
            projectsGrid.innerHTML = '<div class="empty-state"><span>❌</span><p>Ошибка загрузки проектов группы</p></div>';
        }
    }

    async function loadUserGroupsForSelector() {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups`);
            if (response.ok) {
                userGroups = await response.json();
                console.log('👥 Загружены группы:', userGroups);
                renderGroupSelector();
            }
        } catch (error) {
            console.error('Ошибка загрузки групп:', error);
            userGroups = [];
        }
    }

    function renderGroupSelector() {
        const container = document.getElementById('groupSelector');
        if (!container) return;
        if (userGroups.length === 0) {
            container.innerHTML = '<select disabled><option>Нет групп</option></select>';
            return;
        }
        container.innerHTML = `
            <select id="groupSelect" onchange="window.selectGroup(this.value)">
                <option value="">-- Выберите группу --</option>
                ${userGroups.map(group => `
                    <option value="${group.id}" ${selectedGroupId === group.id ? 'selected' : ''}>
                        ${escapeHtml(group.name)} (${group.role === 'admin' ? 'admin' : 'участник'})
                    </option>
                `).join('')}
            </select>
            <button class="refresh-group-btn" onclick="window.refreshGroupProjects()">🔄</button>
        `;
    }

    window.selectGroup = function (groupId) {
        selectedGroupId = groupId;
        localStorage.setItem('selected_group', groupId);
        if (currentMode === 'group') {
            loadGroupProjects(groupId);
        }
        syncModeAcrossPages();
    };

    window.refreshGroupProjects = function () {
        if (selectedGroupId && currentMode === 'group') {
            loadGroupProjects(selectedGroupId);
            showSuccess('Проекты группы обновлены');
        }
    };

    function setupModeToggle() {
        const modeToggle = document.getElementById('modeToggle');
        if (!modeToggle) return;
        const newToggle = modeToggle.cloneNode(true);
        modeToggle.parentNode.replaceChild(newToggle, modeToggle);
        newToggle.addEventListener('click', () => {
            currentMode = currentMode === 'personal' ? 'group' : 'personal';
            newToggle.classList.toggle('group-mode', currentMode === 'group');
            updateModeUI();
            if (currentMode === 'personal') {
                loadPersonalProjects();
            } else if (selectedGroupId) {
                loadGroupProjects(selectedGroupId);
            } else {
                projectsGrid.innerHTML = '<div class="empty-state"><span>👥</span><p>Выберите группу для просмотра</p></div>';
            }
            syncModeAcrossPages();
        });
        newToggle.classList.toggle('group-mode', currentMode === 'group');
    }

    async function loadCurrentUser() {
        try {
            if (typeof window.authFetch !== 'function') {
                console.log('⏳ Ждём загрузку auth.js...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const response = await window.authFetch(`${API_URL}/api/auth/me`);
            const data = await response.json();
            if (data.authenticated) {
                currentUser = data.user;
                console.log(`👤 Пользователь: ${currentUser.username}`);
                const authButtons = document.getElementById('authButtons');
                const userInfo = document.getElementById('userInfo');
                const userName = document.getElementById('userName');
                const userBadge = document.getElementById('userBadge');
                if (authButtons && userInfo) {
                    authButtons.style.display = 'none';
                    userInfo.style.display = 'flex';
                    if (userName) userName.textContent = currentUser.username;
                    if (userBadge) {
                        userBadge.textContent = currentUser.role === 'admin' ? 'admin' : '';
                        userBadge.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
                    }
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            return false;
        }
    }

    // ========== УТИЛИТЫ ==========
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function getStatusText(status) {
        const map = { 'planned': 'В планах', 'in_progress': 'В процессе', 'watched': 'Просмотрено' };
        return map[status] || status;
    }

    function showError(text) {
        console.error('❌ Ошибка:', text);
        if (errorMessageDiv) {
            errorMessageDiv.style.display = 'block';
            errorMessageDiv.textContent = '❌ ' + text;
            setTimeout(() => errorMessageDiv.style.display = 'none', 3000);
        }
    }

    function showSuccess(text) {
        console.log('✅ Успех:', text);
        if (successMessageDiv) {
            successMessageDiv.style.display = 'block';
            successMessageDiv.textContent = '✅ ' + text;
            setTimeout(() => successMessageDiv.style.display = 'none', 2000);
        }
    }

    function showInfo(text) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4a3f7a;color:white;padding:10px 20px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards;`;
        infoDiv.textContent = 'ℹ️ ' + text;
        document.body.appendChild(infoDiv);
        setTimeout(() => infoDiv.remove(), 3000);
    }

    function formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function detectTypeByGenres(film) {
        const genres = (film.genres || []).map(g => (g.genre || g).toLowerCase());
        if (genres.includes('аниме')) return 'Аниме';
        if (genres.includes('мультфильм') || genres.includes('анимация')) return 'Мультфильм';
        if (film.type === 'TV_SERIES' || film.type === 'MINI_SERIES') return 'Сериал';
        return 'Фильм';
    }

    function clearVideoCache(projectId, seasonNum, episodeNum) {
        if (projectId && seasonNum && episodeNum) {
            const cacheKey = `${projectId}_${seasonNum}_${episodeNum}`;
            if (videoCandidates.has(cacheKey)) {
                videoCandidates.delete(cacheKey);
                showSuccess('Кэш видео очищен');
            }
        } else {
            videoCandidates.clear();
            showSuccess('Весь кэш видео очищен');
        }
    }

    function clearAllCache() {
        searchCache.clear();
        seasonsCache.clear();
        videoCandidates.clear();
        showSuccess('Весь кэш очищен');
    }

    async function loadUnwatchedProjects() {
        try {
            console.log('📡 Загружаем проекты с сервера...');
            const response = await window.authFetch(`${API_URL}/projects`);
            if (!response.ok) {
                if (response.status === 401) {
                    projectsGrid.innerHTML = '<div class="empty-state"><span>🔒</span><p>Войдите, чтобы увидеть свой каталог</p></div>';
                    return;
                }
                throw new Error(`Ошибка загрузки: ${response.status}`);
            }
            let allProjects = await response.json();
            console.log(`✅ Загружено ${allProjects.length} проектов`);
            if (allProjects.length > 0 && allProjects[0].data) {
                allProjects = allProjects.map(p => ({ ...p.data, id: p.project_id, user_status: p.status }));
            }
            myProjects = allProjects.filter(p => !p.watched);
            renderProjects();
            updateStats();
        } catch (error) {
            showError('Не удалось загрузить проекты: ' + error.message);
        }
    }

    // ========== ОСНОВНАЯ ФУНКЦИЯ ДОБАВЛЕНИЯ ==========
    async function addProject(film) {
        if (!currentUser) {
            showError('Сначала войдите в аккаунт');
            return;
        }

        const newProject = {
            id: 'kp_' + film.filmId,
            title: film.nameEn || film.nameRu || 'Без названия',
            title_ru: film.nameRu || film.nameEn || 'Без названия',
            year: film.year || 'Неизвестно',
            rating: film.rating || '—',
            poster: film.posterUrlPreview || film.posterUrl || null,
            type: detectTypeByGenres(film),
            inProgress: false,
            watched: false,
            watchedDate: null,
            ratings: { senya: null, vanya: null, pasha: null, volodya: null, artem: null },
            notes: '',
            genres: film.genres || [],
            description: film.description || 'Описание будет добавлено позже',
            filmId: film.filmId
        };

        try {
            let response;
            if (currentMode === 'group' && selectedGroupId) {
                console.log(`📝 Добавляем фильм в группу ${selectedGroupId}`);
                console.log('📦 Данные проекта:', newProject);
                response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_id: newProject.id, data: newProject })
                });
                const responseData = await response.json();
                console.log('📥 Ответ сервера:', response.status, responseData);
                if (response.ok) {
                    showSuccess('Фильм добавлен в группу!');
                    await loadGroupProjects(selectedGroupId);
                    return;
                } else {
                    throw new Error(responseData.error || `Ошибка: ${response.status}`);
                }
            } else {
                console.log('📝 Добавляем фильм в личный каталог');
                response = await window.authFetch(`${API_URL}/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProject)
                });
                const responseData = await response.json();
                console.log('📥 Ответ сервера:', response.status, responseData);
                if (response.status === 409) {
                    showError('Этот фильм уже есть в каталоге');
                    return;
                }
                if (!response.ok) throw new Error(`Ошибка добавления: ${response.status}`);
                showSuccess('Фильм добавлен в личный каталог!');
                await loadPersonalProjects();
            }
        } catch (error) {
            console.error('❌ Ошибка добавления:', error);
            showError('Ошибка при добавлении: ' + error.message);
        }
    }

    // ========== ОСТАЛЬНЫЕ ФУНКЦИИ (сохраняем все из предыдущей версии) ==========
    async function updateProjectStatus(projectId, newStatus) {
        try {
            let response;
            if (currentMode === 'group' && selectedGroupId) {
                const groupProject = myProjects.find(p => p.id === projectId);
                const groupProjectId = groupProject?.group_project_id;
                if (!groupProjectId) {
                    showError('Не удалось идентифицировать групповой проект');
                    return false;
                }
                console.log(`📊 Обновляем статус в группе: проект ${projectId}, статус ${newStatus}`);
                response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects/${groupProjectId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
            } else {
                console.log(`📊 Обновляем статус в личном каталоге: проект ${projectId}, статус ${newStatus}`);
                response = await window.authFetch(`${API_URL}/api/user/projects/${projectId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
            }
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Ошибка: ${response.status}`);
            }
            const projectIndex = myProjects.findIndex(p => p.id === projectId);
            if (projectIndex !== -1) {
                myProjects[projectIndex] = {
                    ...myProjects[projectIndex],
                    status: newStatus,
                    user_status: newStatus,
                    inProgress: newStatus === 'in_progress',
                    watched: newStatus === 'watched'
                };
                if (newStatus === 'watched') {
                    myProjects = myProjects.filter(p => p.id !== projectId);
                    closeModal();
                    showSuccess('Фильм перемещён в просмотренные! ✨');
                } else {
                    renderProjects();
                    updateStats();
                    const modal = document.querySelector('.project-modal.active');
                    if (modal && modal.dataset.projectId === projectId) {
                        openModal(projectId);
                    }
                }
            }
            window.dispatchEvent(new CustomEvent('groupProjectStatusChanged', {
                detail: { groupId: selectedGroupId, projectId: projectId, status: newStatus }
            }));
            showSuccess(`Статус изменён на ${getStatusText(newStatus)}`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления статуса:', error);
            showError('Ошибка при изменении статуса: ' + error.message);
            return false;
        }
    }

    async function refreshProjectDetails(projectId) {
        try {
            const response = await window.authFetch(`${API_URL}/projects/${projectId}/refresh`, { method: 'POST' });
            if (!response.ok) throw new Error('Ошибка обновления');
            const index = myProjects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                const updatedResponse = await window.authFetch(`${API_URL}/projects`);
                const allProjects = await updatedResponse.json();
                myProjects = allProjects.filter(p => !p.watched);
            }
            renderProjects();
            updateStats();
            const modal = document.querySelector('.project-modal.active');
            if (modal && modal.dataset.projectId === projectId) {
                openModal(projectId);
            }
            showSuccess('Данные проекта обновлены!');
        } catch (error) {
            showError('Ошибка обновления: ' + error.message);
        }
    }

    async function deleteProject(projectId) {
        if (!confirm('Удалить проект?')) return;
        try {
            let response;
            if (currentMode === 'group' && selectedGroupId) {
                const groupProject = myProjects.find(p => p.id === projectId);
                const groupProjectId = groupProject?.group_project_id;
                if (groupProjectId) {
                    response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects/${groupProjectId}`, { method: 'DELETE' });
                } else {
                    showError('Не удалось идентифицировать групповой проект');
                    return;
                }
            } else {
                response = await window.authFetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' });
            }
            if (!response.ok) throw new Error(`Ошибка удаления: ${response.status}`);
            myProjects = myProjects.filter(p => p.id !== projectId);
            renderProjects();
            updateStats();
            const modal = document.querySelector('.project-modal.active');
            if (modal && modal.dataset.projectId === projectId) closeModal();
            showSuccess('Проект удалён');
        } catch (error) {
            showError('Ошибка удаления: ' + error.message);
        }
    }

    async function toggleInProgress(projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;
        await updateProjectStatus(projectId, project.inProgress ? 'planned' : 'in_progress');
    }

    async function markAsWatched(projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;
        await updateProjectStatus(projectId, 'watched');
    }

    async function changeProjectType(projectId, newType) {
        try {
            const response = await window.authFetch(`${API_URL}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: newType })
            });
            if (!response.ok) throw new Error(`Ошибка обновления: ${response.status}`);
            const index = myProjects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                myProjects[index].type = newType;
                renderProjects();
                updateStats();
                const modal = document.querySelector('.project-modal.active');
                if (modal && modal.dataset.projectId === projectId) openModal(projectId);
            }
        } catch (error) {
            showError('Ошибка изменения типа: ' + error.message);
        }
    }

    function updateStats() {
        const total = myProjects.length;
        const inProgress = myProjects.filter(p => p.inProgress).length;
        const types = {};
        myProjects.forEach(p => { types[p.type] = (types[p.type] || 0) + 1; });
        let statsText = `📊 Всего: ${total}`;
        if (inProgress > 0) statsText += ` | 🔥 В процессе: ${inProgress}`;
        if (types['Фильм']) statsText += ` | 🎬 Фильмов: ${types['Фильм']}`;
        if (types['Сериал']) statsText += ` | 📺 Сериалов: ${types['Сериал']}`;
        if (types['Мультфильм']) statsText += ` | 🖍️ Мультфильмов: ${types['Мультфильм']}`;
        if (types['Аниме']) statsText += ` | 🇯🇵 Аниме: ${types['Аниме']}`;
        if (statsDiv) statsDiv.textContent = statsText;
    }

    function getFilteredProjects() {
        if (currentFilter === 'all') return myProjects;
        return myProjects.filter(p => p.type === currentFilter);
    }

    // ========== ЗАГРУЗКА СЕЗОНОВ И ВИДЕО (сохраняем из предыдущей версии) ==========
    async function loadSeasons(filmId) {
        const cacheKey = `seasons_${filmId}`;
        if (seasonsCache.has(cacheKey)) return seasonsCache.get(cacheKey);
        try {
            const response = await fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${filmId}/seasons`, { headers: { 'X-API-KEY': KINOPOISK_TOKEN } });
            if (!response.ok) throw new Error(`Ошибка загрузки сезонов: ${response.status}`);
            const data = await response.json();
            seasonsCache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки сезонов:', error);
            return null;
        }
    }

    async function loadEpisodeVideo(projectId, filmId, title, year, originalTitle, seasonNum, episodeNum, contentType, skipCache = false) {
        const playerDiv = document.getElementById(`rutube-player-${projectId}`);
        if (!playerDiv) return;
        if (skipCache) clearVideoCache(projectId, seasonNum, episodeNum);
        const hasSeasonInfo = seasonNum !== null && seasonNum !== undefined && episodeNum !== null && episodeNum !== undefined;
        let startTime = 0;
        if (contentType === 'Сериал') {
            const savedProgress = window.watchProgress?.get(projectId);
            if (savedProgress && savedProgress.season === seasonNum && savedProgress.episode === episodeNum && !savedProgress.completed) {
                startTime = savedProgress.timecode;
            }
        }
        playerDiv.style.display = 'block';
        playerDiv.innerHTML = `<div style="text-align:center; padding:30px;"><div class="loading-spinner" style="margin: 0 auto 20px;"></div><div style="color: #a3b7f0; font-size: 1rem;">${hasSeasonInfo ? `🔍 Ищем ${seasonNum} сезон ${episodeNum} серию...` : `🔍 Ищем "${title}"...`}</div></div>`;
        try {
            const response = await fetch(`${API_URL}/api/search-rutube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, film_id: filmId, season: seasonNum, episode: episodeNum, year, original_title: originalTitle, type: contentType })
            });
            const data = await response.json();
            if (data.success) {
                if (data.candidates?.length) videoCandidates.set(`${projectId}_${seasonNum}_${episodeNum}`, data.candidates);
                playerDiv.innerHTML = embedPlayerWithOptions(projectId, { embed_code: data.embed_code, title: data.title, score: data.score, reasons: data.reasons || [] }, data.candidates || [], seasonNum, episodeNum, contentType === 'Сериал' ? startTime : 0);
                if (hasSeasonInfo) showSuccess(`Загружена ${seasonNum} сезон ${episodeNum} серия`);
                else showSuccess(`Видео загружено`);
            } else {
                showVideoNotFound(playerDiv, projectId, filmId, title, year, originalTitle, seasonNum, episodeNum, contentType);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки видео:', error);
            showVideoNotFound(playerDiv, projectId, filmId, title, year, originalTitle, seasonNum, episodeNum, contentType);
        }
    }

    function showVideoNotFound(playerDiv, projectId, filmId, title, year, originalTitle, seasonNum, episodeNum, contentType) {
        const hasSeasonInfo = seasonNum !== null && seasonNum !== undefined && episodeNum !== null && episodeNum !== undefined;
        const errorMessage = hasSeasonInfo ? `Не удалось найти "${title} ${seasonNum} сезон ${episodeNum} серия"` : `Не удалось найти "${title}"`;
        playerDiv.innerHTML = `<div style="text-align:center; padding:30px; color:#ff8a8a;">❌ ${errorMessage}<br><small style="color:#aaa;">Попробуйте найти вручную на Rutube</small><br><br><div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;"><button class="retry-btn" onclick="window.clearAndRetry('${projectId}', '${filmId}', '${title.replace(/'/g, "\\'")}', '${year}', '${originalTitle.replace(/'/g, "\\'")}', ${seasonNum}, ${episodeNum}, '${contentType}')">🗑️ Очистить кэш и повторить</button><button class="retry-btn" onclick="window.openManualSearch('${title}', ${seasonNum}, ${episodeNum}, '${contentType}')">🔍 Поиск на Rutube</button><button class="retry-btn" onclick="window.loadEpisodeVideo('${projectId}', '${filmId}', '${title.replace(/'/g, "\\'")}', '${year}', '${originalTitle.replace(/'/g, "\\'")}', ${seasonNum}, ${episodeNum}, '${contentType}')">🔄 Повторить</button></div></div>`;
    }

    function embedPlayerWithOptions(projectId, primaryVideo, candidates, season, episode, startTime = 0) {
        const playerId = `player-${projectId}-${season}-${episode}-${Date.now()}`;
        const cacheKey = `${projectId}_${season}_${episode}`;
        return `<div class="player-container" id="${playerId}"><div class="primary-player">${primaryVideo.embed_code}</div><div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;"><div style="display: flex; align-items: center; gap: 10px;"><button class="retry-btn" style="padding: 4px 8px; font-size: 11px;" onclick="window.clearAndRetry('${projectId}', '', '${primaryVideo.title}', '', '', ${season}, ${episode}, '')">🗑️ Очистить кэш</button></div><div style="display: flex; align-items: center; opacity: 0.5;"><span style="color: #888; font-size: 11px;">🎯 осн.</span><span style="color: #666; font-size: 10px; margin-left: 5px;">${primaryVideo.score} баллов</span></div></div>${candidates?.length > 1 ? `<div class="alternative-toggle" style="margin-top: 5px; opacity: 0.3; transition: opacity 0.3s; text-align: right; font-size: 11px;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='0.3'"><span style="color: #666; cursor: pointer;" onclick="window.toggleAlternatives('${playerId}')">📋 еще ${candidates.length - 1} вар.</span></div><div class="alternatives-hidden" id="alt-${playerId}" style="display: none; margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px;"><div style="font-size: 12px; color: #aaa; margin-bottom: 8px; text-align: center;">другие варианты</div><div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;">${candidates.slice(1).map((video, index) => `<div style="min-width: 200px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px; cursor: pointer;" onclick="window.switchVideo('${projectId}', ${season}, ${episode}, ${index + 1})"><div style="font-size: 11px; color: #ccc;">${video.title.substring(0, 40)}${video.title.length > 40 ? '...' : ''}</div><div style="display: flex; gap: 10px; font-size: 10px; color: #666; margin-top: 4px;"><span>⏱️ ${formatDuration(video.duration)}</span><span>👁️ ${Math.round(video.views / 1000)}k</span><span style="color: #888;">${video.score} баллов</span></div></div>`).join('')}</div></div>` : ''}${startTime > 0 ? `<div style="margin-top: 8px; text-align: center; opacity: 0.6;"><button class="resume-btn-mini" onclick="window.resumeVideo('${projectId}', ${season}, ${episode}, ${startTime})" style="background: none; border: 1px solid #4caf50; border-radius: 12px; color: #4caf50; padding: 4px 12px; font-size: 11px; cursor: pointer;">⏯️ продолжить с ${window.watchProgress?.formatTime(startTime) || '0:00'}</button></div>` : ''}</div><script>(function(){if(!window.videoCandidates)window.videoCandidates=new Map();window.videoCandidates.set('${cacheKey}',${JSON.stringify(candidates)});setTimeout(()=>{const wrapper=document.getElementById('${playerId}');const iframe=wrapper.querySelector('iframe');if(!iframe)return;try{const player=iframe.contentWindow?.player;if(player?.api){if(${startTime}>0)player.api.seek(${startTime});let lastSave=0;player.api.on('timeupdate',(data)=>{if(Math.floor(data.currentTime/10)>Math.floor(lastSave/10)){lastSave=data.currentTime;window.watchProgress?.markStarted('${projectId}',${season},${episode},data.currentTime,data.duration);}});player.api.on('ended',()=>{window.watchProgress?.markWatched('${projectId}',${season},${episode});if(window.showInfo)window.showInfo('✅ Серия отмечена как просмотренная');});}}catch(e){console.log('⚠️ Rutube API недоступен');}},2000);})();<\/script>`;
    }

    window.switchVideo = function (projectId, season, episode, candidateIndex) {
        const cacheKey = `${projectId}_${season}_${episode}`;
        const candidates = window.videoCandidates?.get(cacheKey) || [];
        if (!candidates[candidateIndex]) { showError('Вариант не найден'); return; }
        const video = candidates[candidateIndex];
        const playerDiv = document.getElementById(`rutube-player-${projectId}`);
        if (!playerDiv) return;
        playerDiv.innerHTML = embedPlayerWithOptions(projectId, { embed_code: video.embed_code, title: video.title, score: video.score, reasons: video.reasons }, candidates.filter((_, i) => i !== candidateIndex), season, episode, 0);
        showSuccess(`Выбран вариант ${candidateIndex + 1}`);
    };

    window.openManualSearch = function (title, seasonNum, episodeNum, contentType) {
        const hasSeasonInfo = seasonNum !== null && seasonNum !== undefined && episodeNum !== null && episodeNum !== undefined;
        const searchQuery = hasSeasonInfo ? `${title} ${seasonNum} сезон ${episodeNum} серия` : title;
        window.open(`https://rutube.ru/search/?query=${encodeURIComponent(searchQuery)}`, '_blank');
        showInfo(`Поиск на Rutube: "${searchQuery}"`);
    };

    window.saveManualProgress = function (projectId, season, episode) {
        const timeStr = prompt('Введите время в минутах (например, 24:30 или 1250 секунд):');
        if (!timeStr) return;
        const seconds = window.watchProgress?.parseTime(timeStr);
        if (seconds > 0) {
            window.watchProgress?.markStarted(projectId, season, episode, seconds, 0);
            alert(`✅ Позиция сохранена! При следующем просмотре начнём с ${window.watchProgress?.formatTime(seconds)}`);
        }
    };

    window.clearAndRetry = function (projectId, filmId, title, year, originalTitle, seasonNum, episodeNum, contentType) {
        clearVideoCache(projectId, seasonNum, episodeNum);
        loadEpisodeVideo(projectId, filmId, title, year, originalTitle, seasonNum, episodeNum, contentType, true);
    };

    function renderSeasons(seasonsData, projectId, filmId, title, year, originalTitle, contentType) {
        const container = document.getElementById(`seasons-container-${projectId}`);
        if (!container) return;
        if (!seasonsData?.items?.length) { container.innerHTML = '<p class="no-data">Нет информации о сезонах</p>'; return; }
        const progress = window.watchProgress?.get(projectId);
        let html = '<div class="seasons-list">';
        seasonsData.items.forEach(season => {
            html += `<div class="season-item"><h4 onclick="window.toggleSeason('${projectId}', ${season.number})" style="cursor: pointer;">${season.number}-й сезон <span style="color:#888; font-size:12px;">▼</span></h4><div class="episodes-list" id="season-${projectId}-${season.number}" style="display: none;">`;
            season.episodes.forEach(episode => {
                const isCurrentEpisode = progress?.season === season.number && progress?.episode === episode.episodeNumber;
                const progressPercent = isCurrentEpisode && progress?.duration ? Math.round((progress.timecode / progress.duration) * 100) : 0;
                html += `<div class="episode-item ${isCurrentEpisode ? 'current' : ''}" onclick="window.loadEpisodeVideo('${projectId}', '${filmId}', '${title.replace(/'/g, "\\'")}', '${year}', '${originalTitle.replace(/'/g, "\\'")}', ${season.number}, ${episode.episodeNumber}, '${contentType}')"><span class="episode-number">Серия ${episode.episodeNumber}</span><span class="episode-title">${episode.nameRu || episode.nameEn || ''}</span>${isCurrentEpisode && !progress?.completed ? `<span class="episode-progress">${progressPercent}%</span>` : ''}</div>`;
            });
            html += `</div></div>`;
        });
        html += '</div>';
        container.innerHTML = html;
        if (seasonsData.items.length > 0) {
            let targetSeason = progress?.season || 1;
            let targetEpisode = progress?.episode || 1;
            toggleSeason(projectId, targetSeason, true);
            const season = seasonsData.items.find(s => s.number === targetSeason);
            if (season) {
                const episode = season.episodes.find(e => e.episodeNumber === targetEpisode);
                if (episode) loadEpisodeVideo(projectId, filmId, title, year, originalTitle, targetSeason, targetEpisode, contentType);
            }
        }
    }

    window.toggleSeason = function (projectId, seasonNumber, forceOpen = false) {
        const seasonDiv = document.getElementById(`season-${projectId}-${seasonNumber}`);
        if (seasonDiv) seasonDiv.style.display = forceOpen ? 'grid' : seasonDiv.style.display === 'none' ? 'grid' : 'none';
    };

    window.openModal = async function (projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;
        const existingModal = document.querySelector('.project-modal');
        if (existingModal) existingModal.remove();
        document.body.classList.add('modal-open');
        const modal = document.createElement('div');
        modal.className = 'project-modal active';
        modal.dataset.projectId = project.id;
        const posterEmoji = project.type === 'Аниме' ? '🇯🇵' : project.type === 'Сериал' ? '📺' : project.type === 'Мультфильм' ? '🖍️' : '🎬';
        const genresHtml = project.genres?.length ? project.genres.map(g => `<span class="modal-genre-tag">${g.genre || g}</span>`).join('') : '<span class="modal-genre-tag">Жанры будут добавлены</span>';
        const description = project.description?.length > 500 ? project.description.substring(0, 500) + '...' : project.description || 'Описание будет загружено позже...';
        const filmId = project.id.replace('kp_', '');
        const progress = window.watchProgress?.get(project.id);
        const isSeries = project.type === 'Сериал';
        const isAnimeOrCartoon = project.type === 'Аниме' || project.type === 'Мультфильм';
        const continueButton = (isSeries || isAnimeOrCartoon) && progress && !progress.completed ? `<button class="continue-watching-btn" onclick="window.continueWatching('${project.id}')">▶️ Продолжить с ${progress.season} сезона ${progress.episode} серии (${window.watchProgress?.formatTime(progress.timecode)})</button>` : '';
        const cacheButtons = `<div style="display: flex; gap: 10px; margin-bottom: 15px; justify-content: flex-end;"><button class="retry-btn" style="padding: 5px 10px; font-size: 12px;" onclick="window.clearAllCache()">🗑️ Очистить весь кэш</button></div>`;
        const seasonsSection = (isSeries || isAnimeOrCartoon) ? `<div class="modal-section"><h3>📺 Сезоны и серии</h3>${cacheButtons}<div id="seasons-container-${project.id}" class="seasons-container"><div class="loading-spinner" style="text-align:center; padding:30px;"></div></div></div>` : '';
        modal.innerHTML = `<div class="modal-overlay" onclick="window.closeModal()"></div><div class="modal-content"><button class="modal-close" onclick="window.closeModal()">✕</button><div class="modal-layout"><div class="modal-left"><div class="modal-poster">${project.poster ? `<img src="${project.poster}" alt="${project.title_ru || project.title}">` : `<div class="modal-no-poster">${posterEmoji}</div>`}</div><div class="modal-quick-info"><div class="modal-rating-badge"><span>⭐</span><span>${project.rating}</span></div><div class="modal-year-badge"><span>📅</span><span>${project.year}</span></div></div><div class="modal-actions"><button class="modal-action-btn delete" onclick="window.deleteProject('${project.id}'); window.closeModal()" title="Удалить"><span class="btn-icon">🗑️</span><span class="btn-text">Удалить</span></button><button class="modal-action-btn progress ${project.inProgress ? 'active' : ''}" onclick="window.toggleInProgress('${project.id}')" title="${project.inProgress ? 'Убрать из процесса' : 'В процессе'}"><span class="btn-icon">🔥</span><span class="btn-text">${project.inProgress ? 'В процессе' : 'В процесс'}</span></button><button class="modal-action-btn watched" onclick="window.markAsWatched('${project.id}'); window.closeModal()" title="Просмотрено"><span class="btn-icon">✅</span><span class="btn-text">Просмотрено</span></button><button class="modal-action-btn refresh" onclick="window.refreshProjectDetails('${project.id}')" title="Обновить данные"><span class="btn-icon">🔄</span><span class="btn-text">Обновить</span></button></div></div><div class="modal-right"><h2 class="modal-title">${project.title_ru || project.title}</h2><div class="modal-section"><h3>Жанры</h3><div class="modal-genres">${genresHtml}</div></div><div class="modal-section"><h3>Описание</h3><p class="modal-description">${description}</p></div><div class="modal-section"><h3>🎬 Смотреть на Rutube</h3>${continueButton}<div class="rutube-player" id="rutube-player-${project.id}" style="display: block;"><div class="loading-spinner" style="text-align:center; padding:50px;"></div></div></div>${seasonsSection}</div></div></div>`;
        document.body.appendChild(modal);
        if (isSeries || isAnimeOrCartoon) {
            const seasonsData = await loadSeasons(filmId);
            if (seasonsData?.items?.length > 0) {
                renderSeasons(seasonsData, project.id, filmId, project.title_ru || project.title, project.year, project.title || '', project.type);
            } else {
                loadEpisodeVideo(project.id, filmId, project.title_ru || project.title, project.year, project.title || '', 1, 1, project.type);
            }
        } else {
            loadEpisodeVideo(project.id, filmId, project.title_ru || project.title, project.year, project.title || '', 1, 1, project.type);
        }
    };

    window.continueWatching = function (projectId) {
        const progress = window.watchProgress?.get(projectId);
        if (!progress) return;
        const seasonDiv = document.getElementById(`season-${projectId}-${progress.season}`);
        if (seasonDiv) {
            window.toggleSeason(projectId, progress.season, true);
            const episodeItems = seasonDiv.querySelectorAll('.episode-item');
            episodeItems.forEach(item => { if (item.textContent.includes(`Серия ${progress.episode}`)) item.click(); });
        }
    };

    window.closeModal = function () {
        const modal = document.querySelector('.project-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => modal.remove(), 300);
        }
    };

    function renderProjects() {
        const filtered = getFilteredProjects();
        if (filtered.length === 0) {
            projectsGrid.innerHTML = `<div class="empty-state"><span>🎬</span><p>${currentFilter === 'all' ? 'Пока нет добавленных проектов' : `В категории нет проектов`}</p></div>`;
            return;
        }
        const sorted = [...filtered].sort((a, b) => (a.inProgress === b.inProgress) ? 0 : a.inProgress ? -1 : 1);
        projectsGrid.innerHTML = sorted.map(project => {
            const posterEmoji = project.type === 'Аниме' ? '🇯🇵' : project.type === 'Сериал' ? '📺' : project.type === 'Мультфильм' ? '🖍️' : '🎬';
            const progress = window.watchProgress?.get(project.id);
            const progressPercent = progress?.duration ? (progress.timecode / progress.duration) * 100 : 0;
            const hasProgress = progress && !progress.completed && progressPercent > 0;
            return `<div class="card ${project.inProgress ? 'in-progress' : ''}" data-project-id="${project.id}" onclick="window.openModal('${project.id}')"><div class="card-buttons" onclick="event.stopPropagation()"><button class="delete-card" onclick="window.deleteProject('${project.id}')">✕</button><div style="display: flex; gap: 5px;"><button class="in-progress-btn ${project.inProgress ? 'active' : ''}" onclick="window.toggleInProgress('${project.id}')">🔥</button><button class="watched-btn" onclick="window.markAsWatched('${project.id}')">✅</button></div></div><div class="poster" style="background-image: ${project.poster ? `url('${project.poster}')` : 'none'};">${!project.poster ? `<div class="no-poster">${posterEmoji}</div>` : ''}${hasProgress ? `<div class="progress-overlay"><div class="progress-bar" style="width: ${progressPercent}%;"></div><div class="progress-text">Сезон ${progress.season} серия ${progress.episode}<br><small>${Math.round(progressPercent)}%</small></div></div>` : ''}<div class="rating-badge ${project.rating === '—' ? 'none' : ''}">${project.rating}</div></div><div class="card-content"><div class="card-title">${project.title_ru || project.title}</div><div class="type-selector" onclick="event.stopPropagation()"><button class="type-btn ${project.type === 'Фильм' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Фильм')">🎬</button><button class="type-btn ${project.type === 'Сериал' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Сериал')">📺</button><button class="type-btn ${project.type === 'Мультфильм' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Мультфильм')">🖍️</button><button class="type-btn ${project.type === 'Аниме' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Аниме')">🇯🇵</button></div><div class="card-meta"><span>📅 ${project.year}</span></div></div></div>`;
        }).join('');
    }

    window.addEventListener('progress-updated', () => renderProjects());

    // ========== ПОИСК НА КИНОПОИСКЕ ==========
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (query.length < 2) {
                if (searchResults) searchResults.classList.remove('active');
                return;
            }
            searchTimeout = setTimeout(async () => {
                try {
                    if (!searchResults) return;
                    searchResults.innerHTML = '<div class="loading">🔍 Поиск на Кинопоиске...</div>';
                    searchResults.classList.add('active');
                    const response = await fetch(`https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`, { headers: { 'X-API-KEY': KINOPOISK_TOKEN } });
                    if (!response.ok) throw new Error(`Ошибка ${response.status}`);
                    const data = await response.json();
                    if (!data.films?.length) { searchResults.innerHTML = '<div style="padding:20px; text-align:center;">Ничего не найдено</div>'; return; }
                    searchResults.innerHTML = data.films.slice(0, 7).map(film => {
                        const type = detectTypeByGenres(film);
                        const poster = film.posterUrlPreview || film.posterUrl;
                        return `<div class="result-item" onclick="window.addMovieFromKinopoisk('${encodeURIComponent(JSON.stringify(film).replace(/'/g, "\\'"))}')"><div class="result-poster" style="background-image: url('${poster || ''}');"></div><div class="result-info"><div class="result-title">${film.nameRu || film.nameEn || 'Без названия'}</div><div class="result-meta"><span>📅 ${film.year || '?'}</span><span class="result-rating">⭐ ${film.rating || '—'}</span><span class="result-type">${type}</span></div></div></div>`;
                    }).join('');
                } catch (error) {
                    console.error('Ошибка поиска:', error);
                    if (searchResults) searchResults.innerHTML = `<div style="padding:20px; text-align:center; color:#ff8a8a;">Ошибка: ${error.message}</div>`;
                }
            }, 400);
        });
    }

    document.addEventListener('click', (e) => {
        if (searchInput && searchResults && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });

    window.addMovieFromKinopoisk = function (encodedFilm) {
        try {
            const film = JSON.parse(decodeURIComponent(encodedFilm));
            addProject(film);
            if (searchResults) searchResults.classList.remove('active');
            if (searchInput) searchInput.value = '';
        } catch (e) {
            console.error('Ошибка парсинга фильма:', e);
            showError('Ошибка при добавлении');
        }
    };

    window.toggleAlternatives = function (playerId) {
        const altDiv = document.getElementById('alt-' + playerId);
        if (altDiv) altDiv.style.display = altDiv.style.display === 'none' ? 'block' : 'none';
    };

    window.resumeVideo = function (projectId, season, episode, startTime) {
        const playerDiv = document.getElementById(`rutube-player-${projectId}`);
        if (!playerDiv) return;
        const iframe = playerDiv.querySelector('iframe');
        if (iframe && iframe.contentWindow?.player?.api) {
            iframe.contentWindow.player.api.seek(startTime);
        } else {
            showInfo('⏱️ Функция продолжения доступна только при активном плеере');
        }
    };

    // ========== ЭКСПОРТ ФУНКЦИЙ ==========
    window.deleteProject = deleteProject;
    window.toggleInProgress = toggleInProgress;
    window.markAsWatched = markAsWatched;
    window.changeProjectType = changeProjectType;
    window.refreshProjectDetails = refreshProjectDetails;
    window.loadEpisodeVideo = loadEpisodeVideo;
    window.switchVideo = switchVideo;
    window.openManualSearch = openManualSearch;
    window.saveManualProgress = saveManualProgress;
    window.continueWatching = continueWatching;
    window.toggleSeason = toggleSeason;
    window.toggleAlternatives = toggleAlternatives;
    window.resumeVideo = resumeVideo;
    window.showInfo = showInfo;
    window.clearVideoCache = clearVideoCache;
    window.clearAllCache = clearAllCache;
    window.clearAndRetry = clearAndRetry;
    window.addMovieFromKinopoisk = addMovieFromKinopoisk;
    window.selectGroup = selectGroup;
    window.refreshGroupProjects = refreshGroupProjects;
    window.debugCatalog = function() {
        console.log('=== DEBUG CATALOG ===');
        console.log('currentMode:', currentMode);
        console.log('selectedGroupId:', selectedGroupId);
        console.log('userGroups:', userGroups);
        console.log('myProjects:', myProjects);
        console.log('currentUser:', currentUser);
    };

    // ========== ФИЛЬТРЫ ==========
    if (filterButtons) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderProjects();
                updateStats();
            });
        });
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    async function init() {
        await loadCurrentUser();
        await loadUserGroupsForSelector();
        setupModeToggle();
        updateModeUI();
        if (currentMode === 'personal') {
            await loadPersonalProjects();
        } else if (selectedGroupId) {
            await loadGroupProjects(selectedGroupId);
        } else {
            await loadUnwatchedProjects();
        }
    }
    init();
})();