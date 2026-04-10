(function () {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let currentProject = null;
    let currentRatingProject = null;
    let allProjects = [];
    let userProgress = [];
    let userGroups = [];
    let userRatings = {};
    let watchedProjects = [];
    let currentMode = localStorage.getItem('profile_mode') || 'personal';
    let selectedGroupId = localStorage.getItem('selected_group') || null;

    // Переменные для голосования
    let currentVotingCycle = null;
    let groupMembers = [];
    let currentVoteSelections = [];

    // ========== ЗАГРУЗКА ДАННЫХ ПРИ СТАРТЕ ==========
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('👤 Личный кабинет загружается...');
        await loadCurrentUser();
    });

    async function loadCurrentUser() {
        try {
            const response = await window.authFetch(`${API_URL}/api/auth/me`);
            const data = await response.json();

            if (data.authenticated) {
                currentUser = data.user;
                const usernameEl = document.getElementById('profileUsername');
                if (usernameEl) usernameEl.textContent = currentUser.username;

                if (currentUser.role === 'admin') {
                    const badgeEl = document.getElementById('profileBadge');
                    if (badgeEl) badgeEl.innerHTML = '<span>ADMIN</span>';
                }
                
                // Обновляем аватар в зависимости от роли
                const avatarEl = document.getElementById('avatarEmoji');
                if (avatarEl) {
                    avatarEl.textContent = currentUser.role === 'admin' ? '👑' : '🎬';
                }
                
                await loadUserGroups();
                await loadUserRatings();
                setupModeToggle();
                await loadProfileData();
                setupVotingSystem();
                setupTabNavigation();
            } else {
                console.log('❌ Не авторизован, редирект на главную');
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            window.location.href = 'index.html';
        }
    }

    function setupTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                if (tabId) {
                    switchTab(tabId);
                }
            });
        });
    }

    async function loadProfileData() {
        try {
            showLoading();

            if (currentMode === 'personal') {
                await loadPersonalProjects();
            } else if (selectedGroupId) {
                await loadGroupProjects(selectedGroupId);
                await loadGroupVotingInfo();
            } else {
                await loadAllProjects();
            }

            await loadUserProgress();
            await loadWatchedProjects();

            updateStats();
            renderProgressList();
            renderWatchedList();
            renderPlannedList();
            updateTabCounters();

            hideLoading();
            console.log('✅ Данные профиля загружены');
        } catch (error) {
            hideLoading();
            console.error('❌ Ошибка загрузки данных:', error);
            showError('Ошибка загрузки данных');
        }
    }

    async function loadAllProjects() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            allProjects = await response.json();
            console.log(`📁 Загружено проектов из старой системы: ${allProjects.length}`);
        } catch (error) {
            console.error('Ошибка загрузки проектов:', error);
            allProjects = [];
        }
    }

    async function loadUserProgress() {
        try {
            const response = await window.authFetch(`${API_URL}/api/user/progress`);
            if (response.ok) {
                userProgress = await response.json();
                console.log(`📊 Загружен прогресс: ${userProgress.length} записей`);
            }
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
            userProgress = [];
        }
    }

    async function loadUserRatings() {
        try {
            const response = await window.authFetch(`${API_URL}/api/user/ratings`);
            if (response.ok) {
                userRatings = await response.json();
                console.log(`⭐ Загружены оценки:`, userRatings);
            }
        } catch (error) {
            console.error('Ошибка загрузки оценок:', error);
            userRatings = {};
        }
    }

    async function loadWatchedProjects() {
        try {
            let projects = [];

            if (currentMode === 'group' && selectedGroupId) {
                const response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects`);
                if (response.ok) {
                    let allGroupProjects = await response.json();
                    projects = allGroupProjects
                        .filter(p => p.status === 'watched')
                        .map(p => ({
                            ...p.data,
                            id: p.project_id,
                            group_project_id: p.id,
                            added_by: p.added_by,
                            status: p.status,
                            is_watched: true
                        }));
                }
            } else {
                const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
                if (response.ok) {
                    let allUserProjects = await response.json();
                    projects = allUserProjects
                        .filter(p => p.status === 'watched')
                        .map(p => ({
                            ...p.data,
                            id: p.project_id,
                            status: p.status,
                            is_watched: true
                        }));
                }
            }

            watchedProjects = projects;
            console.log(`✅ Загружено ${watchedProjects.length} просмотренных фильмов`);
            return projects;
        } catch (error) {
            console.error('Ошибка загрузки просмотренных фильмов:', error);
            watchedProjects = [];
            return [];
        }
    }

    // ========== НОВАЯ СИСТЕМА ГОЛОСОВАНИЯ ==========
    async function setupVotingSystem() {
        if (currentMode === 'group' && selectedGroupId) {
            await loadGroupVotingInfo();
        }
    }

    async function loadGroupVotingInfo() {
        if (!selectedGroupId) return;

        try {
            const membersResponse = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/members`);
            if (membersResponse.ok) {
                groupMembers = await membersResponse.json();
                console.log('👥 Участники группы:', groupMembers);
            }

            const cycleResponse = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/current`);
            if (cycleResponse.ok) {
                const data = await cycleResponse.json();
                currentVotingCycle = data;
                console.log('🔄 Активный цикл голосования:', currentVotingCycle);
                updateVotingUI();
            } else {
                currentVotingCycle = null;
                updateVotingUI();
            }

            await loadVotingHistory();

        } catch (error) {
            console.error('Ошибка загрузки информации о голосовании:', error);
            currentVotingCycle = null;
            updateVotingUI();
        }
    }

    async function loadVotingHistory() {
        try {
            const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/history`);
            if (response.ok) {
                const history = await response.json();
                renderVotingHistory(history);
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    }

    function updateVotingUI() {
        const adminControls = document.getElementById('adminVotingControls');
        const userPanel = document.getElementById('userVotingPanel');
        const statusBadge = document.getElementById('votingStatusBadge');
        const statusMessage = document.getElementById('votingStatusMessage');
        const currentResults = document.getElementById('currentVotingResults');

        const isAdmin = groupMembers.find(m => m.user_id === currentUser?.id)?.role === 'admin';

        if (adminControls) adminControls.style.display = 'none';
        if (userPanel) userPanel.style.display = 'none';
        if (currentResults) currentResults.style.display = 'none';
        if (statusMessage) statusMessage.style.display = 'none';

        if (!currentVotingCycle || currentVotingCycle.cycle === null ||
            currentVotingCycle.cycle?.status === 'completed' ||
            currentVotingCycle.cycle?.status === 'cancelled') {

            if (statusBadge) {
                statusBadge.innerHTML = '⚪ Не активно';
            }

            if (isAdmin && adminControls) {
                adminControls.style.display = 'block';
                const voteProgress = document.getElementById('voteProgress');
                const startBtn = document.getElementById('startVoteBtn');
                if (voteProgress) voteProgress.style.display = 'none';
                if (startBtn) startBtn.style.display = 'block';
            }
            return;
        }

        const cycle = currentVotingCycle.cycle;

        if (statusBadge) {
            statusBadge.innerHTML = '🟢 Активно';
        }

        if (statusMessage) {
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = `🎯 Голосование активно! Выберите от 1 до 3 фильмов. Осталось времени: <span id="voteTimer"></span>`;
            statusMessage.className = 'voting-status active';
        }

        const hasVoted = cycle.votes && cycle.votes[currentUser?.username];

        if (userPanel) {
            userPanel.style.display = 'block';
            const voteBtn = document.getElementById('castVoteBtn');
            if (voteBtn) {
                if (hasVoted) {
                    voteBtn.innerHTML = '✏️ Изменить голос';
                } else {
                    voteBtn.innerHTML = '🗳️ Проголосовать';
                }
            }
        }

        if (isAdmin && adminControls) {
            adminControls.style.display = 'block';
            const startBtn = document.getElementById('startVoteBtn');
            const voteProgress = document.getElementById('voteProgress');

            if (startBtn) startBtn.style.display = 'none';
            if (voteProgress) voteProgress.style.display = 'block';

            const votedCount = Object.keys(cycle.votes || {}).length;
            const totalMembers = groupMembers.length;
            const votedUsers = Object.keys(cycle.votes || {});

            const votedCountEl = document.getElementById('votedCount');
            const totalMembersEl = document.getElementById('totalMembers');
            const progressFill = document.getElementById('voteProgressFill');
            const votedUsersList = document.getElementById('votedUsersList');

            if (votedCountEl) votedCountEl.textContent = votedCount;
            if (totalMembersEl) totalMembersEl.textContent = totalMembers;

            if (progressFill) {
                const percent = totalMembers > 0 ? (votedCount / totalMembers) * 100 : 0;
                progressFill.style.width = `${percent}%`;
            }

            if (votedUsersList) {
                votedUsersList.innerHTML = `Проголосовали: ${votedUsers.map(u => `👤 ${u}`).join(' • ') || '—'}`;
            }
        }

        if (currentResults && cycle.results) {
            currentResults.style.display = 'block';
            renderCurrentVotingResults(cycle.results);
        }

        if (cycle.expires_at) {
            startVoteTimer(cycle.expires_at);
        }
    }

    function renderCurrentVotingResults(results) {
        const container = document.getElementById('currentVotingList');
        if (!container) return;

        const sortedResults = Object.entries(results).sort((a, b) => b[1] - a[1]).slice(0, 10);

        if (sortedResults.length === 0) {
            container.innerHTML = '<div class="empty-state-small">Пока нет голосов</div>';
            return;
        }

        container.innerHTML = sortedResults.map(([filmId, votes]) => {
            const project = allProjects.find(p => p.id === filmId);
            const title = project?.title_ru || project?.title || filmId;
            return `
                <div class="leader-item">
                    <span class="leader-title">${escapeHtml(title)}</span>
                    <span class="leader-votes">🎯 ${votes} голосов</span>
                </div>
            `;
        }).join('');
    }

    function renderVotingHistory(history) {
        const container = document.getElementById('votesHistory');
        if (!container) return;

        if (!history || history.length === 0) {
            container.innerHTML = '<div class="empty-state-small">Нет завершённых голосований</div>';
            return;
        }

        container.innerHTML = history.map(cycle => `
            <div class="history-item" onclick="window.openVoteDetails('${cycle.id}', '${cycle.created_at}')">
                <div class="history-date">${formatDate(cycle.created_at)}</div>
                <div class="history-status ${cycle.status}">${cycle.status === 'completed' ? '✅ Завершено' : '❌ Отменено'}</div>
            </div>
        `).join('');
    }

    function startVoteTimer(expiresAt) {
        const timerElement = document.getElementById('voteTimer');
        if (!timerElement) return;

        const updateTimer = () => {
            const now = new Date();
            const expires = new Date(expiresAt);
            const diff = expires - now;

            if (diff <= 0) {
                timerElement.textContent = '0:00';
                clearInterval(window.voteTimerInterval);
                loadGroupVotingInfo();
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        updateTimer();
        window.voteTimerInterval = setInterval(updateTimer, 1000);
    }

    // ========== ФУНКЦИИ ДЛЯ ГРУПП ==========
    async function loadUserGroups() {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups`);
            if (response.ok) {
                userGroups = await response.json();
                console.log(`👥 Загружено групп: ${userGroups.length}`);
                renderGroupsShortList();
                renderGroupsDetailedList();
                renderGroupSelector();

                const groupsCountEl = document.getElementById('tabGroupsCount');
                if (groupsCountEl) groupsCountEl.textContent = userGroups.length;
            }
        } catch (error) {
            console.error('Ошибка загрузки групп:', error);
            userGroups = [];
            renderGroupsShortList();
            renderGroupsDetailedList();
        }
    }

    function renderGroupsShortList() {
        const container = document.getElementById('groupsShortList');
        if (!container) return;

        if (userGroups.length === 0) {
            container.innerHTML = '<div class="empty-state-small">Нет групп</div>';
            return;
        }

        container.innerHTML = userGroups.slice(0, 3).map(group => `
            <div class="group-item" onclick="window.openGroupInfo('${group.id}')">
                <span class="group-name">${escapeHtml(group.name)}</span>
                <span class="group-role">${group.role === 'admin' ? 'admin' : 'участник'}</span>
            </div>
        `).join('');
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
            <button class="btn-icon" onclick="window.refreshGroupProjects()">🔄</button>
        `;
    }

    async function loadPersonalProjects() {
        try {
            const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
            if (response.ok) {
                const projects = await response.json();
                allProjects = projects.map(p => ({
                    ...p.data,
                    id: p.project_id,
                    user_status: p.status,
                    status: p.status,
                    inProgress: p.status === 'in_progress',
                    watched: p.status === 'watched'
                }));
                console.log(`📁 Загружено личных проектов: ${allProjects.length}`);
            } else {
                console.error('Ошибка загрузки личных проектов:', response.status);
                allProjects = [];
            }
        } catch (error) {
            console.error('Ошибка загрузки личных проектов:', error);
            allProjects = [];
        }
    }

    async function loadGroupProjects(groupId) {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups/${groupId}/projects`);
            if (response.ok) {
                const projects = await response.json();
                allProjects = projects.map(p => ({
                    ...p.data,
                    id: p.project_id,
                    group_project_id: p.id,
                    added_by: p.added_by,
                    user_status: p.status,
                    status: p.status,
                    inProgress: p.status === 'in_progress',
                    watched: p.status === 'watched'
                }));
                console.log(`📁 Загружено групповых проектов: ${allProjects.length}`);
            } else {
                console.error('Ошибка загрузки групповых проектов:', response.status);
                allProjects = [];
            }
        } catch (error) {
            console.error('Ошибка загрузки групповых проектов:', error);
            allProjects = [];
        }
    }

    // ========== ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ==========
    function setupModeToggle() {
        const catalogModeToggle = document.getElementById('catalogModeToggle');
        const personalLabel = document.querySelector('.mode-label.personal');
        const groupLabel = document.querySelector('.mode-label.group');
        const groupSelector = document.getElementById('groupSelector');

        if (!catalogModeToggle) {
            console.warn('⚠️ modeToggle не найден на странице');
            return;
        }

        function updateUIMode() {
            if (currentMode === 'personal') {
                if (personalLabel) personalLabel.classList.add('active');
                if (groupLabel) groupLabel.classList.remove('active');
                if (groupSelector) groupSelector.style.display = 'none';
                catalogModeToggle.classList.remove('group-mode');
            } else {
                if (personalLabel) personalLabel.classList.remove('active');
                if (groupLabel) groupLabel.classList.add('active');
                if (groupSelector) groupSelector.style.display = 'flex';
                catalogModeToggle.classList.add('group-mode');
            }
        }

        const newToggle = catalogModeToggle.cloneNode(true);
        catalogModeToggle.parentNode.replaceChild(newToggle, catalogModeToggle);

        newToggle.addEventListener('click', async () => {
            const newMode = currentMode === 'personal' ? 'group' : 'personal';
            
            if (newMode === 'group' && !selectedGroupId) {
                showError('Сначала выберите группу из списка');
                return;
            }
            
            currentMode = newMode;
            localStorage.setItem('profile_mode', currentMode);
            
            updateUIMode();
            showLoading();
            
            try {
                if (currentMode === 'personal') {
                    await loadPersonalProjects();
                } else {
                    await loadGroupProjects(selectedGroupId);
                    await loadGroupVotingInfo();
                }
                
                await loadWatchedProjects();
                updateStats();
                renderProgressList();
                renderPlannedList();
                renderWatchedList();
                updateTabCounters();
                
                window.dispatchEvent(new CustomEvent('modeChanged', {
                    detail: { mode: currentMode, groupId: selectedGroupId }
                }));
                
                showSuccess(`Переключено на ${currentMode === 'personal' ? 'личный' : 'групповой'} каталог`);
            } catch (error) {
                console.error('Ошибка:', error);
                showError('Ошибка при переключении режима');
            } finally {
                hideLoading();
            }
        });
        
        updateUIMode();
    }

    window.selectGroup = async function (groupId) {
        if (!groupId) {
            selectedGroupId = null;
            localStorage.removeItem('selected_group');
            if (currentMode === 'group') {
                currentMode = 'personal';
                localStorage.setItem('profile_mode', 'personal');
                await loadPersonalProjects();
                await loadWatchedProjects();
                updateStats();
                renderProgressList();
                renderPlannedList();
                renderWatchedList();
                setupModeToggle();
                updateTabCounters();
            }
            return;
        }
        
        selectedGroupId = groupId;
        localStorage.setItem('selected_group', groupId);
        
        if (currentMode === 'group') {
            showLoading();
            try {
                await loadGroupProjects(selectedGroupId);
                await loadGroupVotingInfo();
                await loadWatchedProjects();
                updateStats();
                renderProgressList();
                renderPlannedList();
                renderWatchedList();
                updateTabCounters();
                showSuccess('Проекты группы загружены');
            } catch (error) {
                console.error('Ошибка:', error);
                showError('Ошибка загрузки проектов группы');
            } finally {
                hideLoading();
            }
        }
    };

    window.refreshGroupProjects = function () {
        if (selectedGroupId && currentMode === 'group') {
            loadGroupProjects(selectedGroupId);
            loadWatchedProjects().then(() => renderWatchedList());
            loadGroupVotingInfo();
            showSuccess('Проекты группы обновлены');
        }
    };

    // ========== СТАТИСТИКА ==========
    function updateStats() {
        const watched = allProjects.filter(p => p.user_status === 'watched' || p.status === 'watched').length;
        const inProgress = allProjects.filter(p => p.user_status === 'in_progress' || p.status === 'in_progress').length;
        const planned = allProjects.filter(p => p.user_status === 'planned' || p.status === 'planned').length;
        const total = watched + inProgress + planned;

        const watchedCountEl = document.getElementById('watchedCount');
        const inProgressCountEl = document.getElementById('inProgressCount');
        const plannedCountEl = document.getElementById('plannedCount');
        const overallProgressEl = document.getElementById('overallProgress');
        const overallProgressFill = document.getElementById('overallProgressFill');

        if (watchedCountEl) watchedCountEl.textContent = watched;
        if (inProgressCountEl) inProgressCountEl.textContent = inProgress;
        if (plannedCountEl) plannedCountEl.textContent = planned;

        if (overallProgressEl && total > 0) {
            const percent = Math.round((watched / total) * 100);
            overallProgressEl.textContent = `${percent}%`;
            if (overallProgressFill) overallProgressFill.style.width = `${percent}%`;
        }
    }

    function updateTabCounters() {
        const progressCount = allProjects.filter(p => p.status === 'in_progress' || p.user_status === 'in_progress').length;
        const plannedCount = allProjects.filter(p => p.status === 'planned' || p.user_status === 'planned').length;
        const watchedCount = watchedProjects.length;

        const tabProgress = document.querySelector('.tab-btn[data-tab="progress"] .tab-count');
        const tabPlanned = document.querySelector('.tab-btn[data-tab="planned"] .tab-count');
        const tabWatched = document.querySelector('.tab-btn[data-tab="watched"] .tab-count');

        if (tabProgress) tabProgress.textContent = progressCount;
        if (tabPlanned) tabPlanned.textContent = plannedCount;
        if (tabWatched) tabWatched.textContent = watchedCount;
    }

    // ========== РЕНДЕРИНГ СПИСКОВ ==========
    function renderProgressList() {
        const container = document.getElementById('progressList');
        if (!container) return;

        const progressItems = allProjects.filter(p => p.status === 'in_progress' || p.user_status === 'in_progress');

        if (progressItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>🎬</span><p>Нет проектов в процессе</p><p class="hint">Отметьте фильм как "В процессе" в каталоге</p></div>';
            return;
        }

        container.innerHTML = progressItems.map(project => {
            const poster = project.poster || '';
            const title = project.title_ru || project.title;
            const type = project.type || 'Фильм';
            const year = project.year || '';
            const progress = userProgress.find(p => p.project_id === project.id);
            const progressPercent = progress?.duration ? Math.round((progress.timecode / progress.duration) * 100) : 0;

            return `
                <div class="item-card" onclick="window.showStatusModal('${project.id}', '${escapeHtml(title)}')">
                    <div class="item-poster" style="background-image: url('${poster}')">
                        ${!poster ? '<div class="item-no-poster">🎬</div>' : ''}
                        <div class="item-status status-in-progress">🔥</div>
                        ${progressPercent > 0 ? `<div class="item-progress"><div class="progress-fill-small" style="width: ${progressPercent}%;"></div></div>` : ''}
                    </div>
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(title)}</div>
                        <div class="item-meta">
                            <span>${type}</span>
                            <span>${year}</span>
                        </div>
                        ${progressPercent > 0 ? `<div class="item-progress-text">${progressPercent}% просмотрено</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPlannedList() {
        const container = document.getElementById('plannedList');
        if (!container) return;

        const plannedItems = allProjects.filter(p => p.status === 'planned' || p.user_status === 'planned');

        if (plannedItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>📋</span><p>Нет проектов в планах</p><p class="hint">Добавьте фильмы через поиск в каталоге</p></div>';
            return;
        }

        container.innerHTML = plannedItems.map(project => {
            const poster = project.poster || '';
            const title = project.title_ru || project.title;
            const type = project.type || 'Фильм';
            const year = project.year || '';

            return `
                <div class="item-card" onclick="window.showStatusModal('${project.id}', '${escapeHtml(title)}')">
                    <div class="item-poster" style="background-image: url('${poster}')">
                        ${!poster ? '<div class="item-no-poster">📋</div>' : ''}
                        <div class="item-status status-planned">📋</div>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(title)}</div>
                        <div class="item-meta">
                            <span>${type}</span>
                            <span>${year}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderWatchedList() {
        const container = document.getElementById('watchedList');
        if (!container) return;

        if (watchedProjects.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>✅</span><p>Нет просмотренных фильмов</p><p class="hint">Отметьте фильм как "Просмотрено" в каталоге</p></div>';
            return;
        }

        container.innerHTML = watchedProjects.map(project => {
            const poster = project.poster || '';
            const title = project.title_ru || project.title;
            const type = project.type || 'Фильм';
            const year = project.year || '';
            const userRating = userRatings[project.id];

            return `
                <div class="item-card watched-card">
                    <div class="item-poster" style="background-image: url('${poster}')">
                        ${!poster ? '<div class="item-no-poster">✅</div>' : ''}
                        <div class="item-status status-watched">✅</div>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(title)}</div>
                        <div class="item-meta">
                            <span>${type}</span>
                            <span>${year}</span>
                        </div>
                        <div class="item-rating">
                            ${userRating ? `
                                <div class="rating-display ${getRatingClass(userRating.rating)}">
                                    ${userRating.rating.toFixed(1)}
                                </div>
                                <button class="rate-btn-small" onclick="event.stopPropagation(); window.openRatingModal('${project.id}', '${escapeHtml(title)}', ${userRating.rating}, '${escapeHtml(userRating.notes || '')}')">✏️</button>
                            ` : `
                                <button class="rate-btn-small" onclick="event.stopPropagation(); window.openRatingModal('${project.id}', '${escapeHtml(title)}')">⭐ Оценить</button>
                            `}
                        </div>
                        <button class="remove-watched-btn" onclick="event.stopPropagation(); window.removeFromWatched('${project.id}')">🗑️ Удалить</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderGroupsDetailedList() {
        const container = document.getElementById('groupsDetailedList');
        if (!container) return;

        if (userGroups.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>👥</span><p>У вас нет групп</p><p class="hint">Создайте группу или вступите по коду приглашения</p></div>';
            return;
        }

        container.innerHTML = userGroups.map(group => `
            <div class="group-detailed-card">
                <div class="group-detailed-header">
                    <span class="group-detailed-name">${escapeHtml(group.name)}</span>
                    <span class="group-detailed-role">${group.role === 'admin' ? 'admin' : 'участник'}</span>
                </div>
                <div class="group-detailed-meta">
                    Создана: ${formatDate(group.created_at)} | 
                    Код: <strong>${group.invite_code}</strong>
                </div>
                <div class="group-detailed-actions">
                    <button class="btn-outline small" onclick="window.openGroupInfo('${group.id}')">📋 Подробнее</button>
                    ${group.role === 'admin' ? `
                        <button class="btn-outline danger small" onclick="window.deleteGroup('${group.id}')">🗑️ Удалить</button>
                    ` : `
                        <button class="btn-outline small" onclick="window.leaveGroup('${group.id}')">🚪 Выйти</button>
                    `}
                </div>
            </div>
        `).join('');
    }

    // ========== УПРАВЛЕНИЕ СТАТУСОМ ==========
    window.showStatusModal = function (projectId, title) {
        if (!currentUser) {
            showError('Требуется авторизация');
            return;
        }
        currentProject = { id: projectId, title: title };
        const modalTitleEl = document.getElementById('modalProjectTitle');
        if (modalTitleEl) modalTitleEl.textContent = title;
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('statusModal').style.display = 'flex';
    };

    window.closeStatusModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('statusModal').style.display = 'none';
        currentProject = null;
    };

    window.changeStatus = async function (status) {
        if (!currentProject) return;

        showLoading();

        try {
            let newStatus = status;
            if (status === 'remove') {
                newStatus = 'planned';
            }

            const response = await window.authFetch(`${API_URL}/api/user/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: currentProject.id,
                    status: newStatus,
                    season: 1,
                    episode: 1,
                    timecode: status === 'watched' ? 0 : null
                })
            });

            if (response.ok) {
                showSuccess(`Статус изменен на ${getStatusText(status)}`);
                await loadProfileData();
                await loadWatchedProjects();
                renderWatchedList();
                updateTabCounters();
            } else {
                const data = await response.json();
                showError(data.error || 'Ошибка изменения статуса');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
            closeStatusModal();
        }
    };

    // ========== ФУНКЦИИ ДЛЯ ОЦЕНКИ ==========
    function getRatingClass(rating) {
        if (!rating && rating !== 0) return 'rating-null';
        const rounded = Math.round(rating);
        return `rating-${rounded}`;
    }

    function updateRatingDisplay(value) {
        const display = document.getElementById('ratingDisplay');
        if (display) {
            if (!value || value === 0) {
                display.textContent = '—';
                display.className = 'rating-display rating-null';
            } else {
                const numValue = parseFloat(value);
                display.textContent = numValue.toFixed(1);
                display.className = `rating-display ${getRatingClass(numValue)}`;
            }
        }
    }

    window.openRatingModal = function (projectId, title, currentRating = null, currentNotes = '') {
        const project = watchedProjects.find(p => p.id === projectId);
        if (!project) {
            console.error('Проект не найден:', projectId);
            return;
        }

        currentRatingProject = { id: projectId, title: title, notes: currentNotes };

        const modal = document.getElementById('ratingModal');
        const modalTitle = document.getElementById('ratingModalTitle');
        const modalYear = document.getElementById('ratingModalYear');
        const modalKp = document.getElementById('ratingModalKp');
        const modalPoster = document.getElementById('ratingModalPoster');
        const ratingSlider = document.getElementById('ratingSlider');
        const ratingInput = document.getElementById('ratingInput');
        const ratingNotes = document.getElementById('ratingNotes');

        if (!modal || !modalTitle) {
            console.error('Элементы модалки не найдены');
            return;
        }

        modalTitle.textContent = title;
        if (modalYear) modalYear.textContent = project.year || '—';
        if (modalKp) modalKp.textContent = `Кинопоиск: ${project.rating || '—'}`;

        if (modalPoster) {
            if (project.poster) {
                modalPoster.style.backgroundImage = `url('${project.poster}')`;
                modalPoster.style.backgroundSize = 'cover';
                modalPoster.style.backgroundPosition = 'center';
                modalPoster.classList.remove('no-poster');
                modalPoster.textContent = '';
            } else {
                modalPoster.style.backgroundImage = '';
                modalPoster.classList.add('no-poster');
                const posterEmoji = project.type === 'Аниме' ? '🇯🇵' :
                    project.type === 'Сериал' ? '📺' :
                        project.type === 'Мультфильм' ? '🖍️' : '🎬';
                modalPoster.textContent = posterEmoji;
            }
        }

        if (ratingSlider && ratingInput) {
            if (currentRating) {
                ratingSlider.value = currentRating;
                ratingInput.value = currentRating;
                updateRatingDisplay(currentRating);
            } else {
                ratingSlider.value = 5;
                ratingInput.value = 5;
                updateRatingDisplay(null);
            }
        }

        if (ratingNotes) {
            ratingNotes.value = currentNotes || '';
        }

        if (modal) modal.style.display = 'flex';
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.style.display = 'block';
    };

    window.closeRatingModal = function () {
        const modal = document.getElementById('ratingModal');
        const overlay = document.getElementById('modalOverlay');
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
        currentRatingProject = null;
    };

    window.updateRatingValue = function (value) {
        const ratingInput = document.getElementById('ratingInput');
        if (ratingInput) ratingInput.value = value;
        updateRatingDisplay(value);
    };

    window.updateRatingFromInput = function (value) {
        const ratingSlider = document.getElementById('ratingSlider');
        if (ratingSlider) ratingSlider.value = value;
        updateRatingDisplay(value);
    };

    window.clearRating = function () {
        const ratingSlider = document.getElementById('ratingSlider');
        const ratingInput = document.getElementById('ratingInput');
        if (ratingSlider) ratingSlider.value = 5;
        if (ratingInput) ratingInput.value = 5;
        updateRatingDisplay(null);
    };

    window.saveRating = async function () {
        if (!currentRatingProject) return;

        const ratingSlider = document.getElementById('ratingSlider');
        const ratingNotes = document.getElementById('ratingNotes');

        let rating = null;
        const ratingDisplay = document.getElementById('ratingDisplay');
        if (ratingDisplay && ratingDisplay.textContent !== '—' && ratingSlider) {
            rating = parseFloat(ratingSlider.value);
        }

        const notes = ratingNotes ? ratingNotes.value : '';

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/user/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: currentRatingProject.id,
                    rating: rating,
                    notes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сохранения оценки');
            }

            showSuccess(rating ? `Оценка ${rating}/10 сохранена!` : 'Заметки сохранены!');
            closeRatingModal();

            await loadUserRatings();
            await loadWatchedProjects();
            renderWatchedList();

            window.dispatchEvent(new CustomEvent('ratingsUpdated'));

        } catch (error) {
            console.error('Ошибка:', error);
            showError(error.message || 'Ошибка сохранения');
        } finally {
            hideLoading();
        }
    };

    window.removeFromWatched = async function (projectId) {
        if (!confirm('Удалить фильм из просмотренных? Он будет перемещён обратно в каталог.')) return;

        showLoading();

        try {
            let response;

            if (currentMode === 'group' && selectedGroupId) {
                const watchedProject = watchedProjects.find(p => p.id === projectId);
                const groupProjectId = watchedProject?.group_project_id;

                if (groupProjectId) {
                    response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects/${groupProjectId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'planned' })
                    });
                } else {
                    showError('Не удалось идентифицировать проект');
                    hideLoading();
                    return;
                }
            } else {
                response = await window.authFetch(`${API_URL}/api/user/projects/${projectId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'planned' })
                });
            }

            if (response.ok) {
                showSuccess('Фильм удалён из просмотренных');
                await loadWatchedProjects();
                renderWatchedList();
                if (currentMode === 'personal') {
                    await loadPersonalProjects();
                } else if (selectedGroupId) {
                    await loadGroupProjects(selectedGroupId);
                }
                renderProgressList();
                renderPlannedList();
                updateStats();
                updateTabCounters();
            } else {
                const error = await response.json();
                showError(error.error || 'Ошибка');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    // ========== СОЗДАНИЕ ГРУППЫ ==========
    window.openCreateGroupModal = function () {
        document.getElementById('createGroupModal').style.display = 'flex';
        document.getElementById('modalOverlay').style.display = 'block';
    };

    window.closeCreateGroupModal = function () {
        document.getElementById('createGroupModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('groupNameInput').value = '';
    };

    window.createGroup = async function () {
        const name = document.getElementById('groupNameInput').value.trim();

        if (!name) {
            showError('Введите название группы');
            return;
        }

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Группа создана!');
                closeCreateGroupModal();
                await loadUserGroups();
            } else {
                showError(data.error || 'Ошибка создания группы');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.joinGroup = async function () {
        const inviteCode = document.getElementById('joinCodeInput').value.trim().toUpperCase();

        if (!inviteCode) {
            showError('Введите код приглашения');
            return;
        }

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/groups/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code: inviteCode })
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Вы вступили в группу!');
                document.getElementById('joinCodeInput').value = '';
                await loadUserGroups();
            } else {
                showError(data.error || 'Ошибка вступления в группу');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.leaveGroup = async function (groupId) {
        if (!confirm('Вы уверены, что хотите покинуть группу?')) return;

        showLoading();
        try {
            const response = await window.authFetch(`${API_URL}/api/groups/${groupId}/leave`, {
                method: 'POST'
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Вы покинули группу');
                await loadUserGroups();
                if (selectedGroupId === groupId) {
                    selectedGroupId = null;
                    if (currentMode === 'group') {
                        currentMode = 'personal';
                        localStorage.setItem('profile_mode', 'personal');
                        await loadPersonalProjects();
                        await loadWatchedProjects();
                        renderWatchedList();
                        setupModeToggle();
                    }
                }
            } else {
                showError(data.error || 'Ошибка при выходе из группы');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.deleteGroup = async function (groupId) {
        if (!confirm('ВНИМАНИЕ! Это действие удалит группу и все её проекты. Восстановить будет невозможно. Продолжить?')) return;

        showLoading();
        try {
            const response = await window.authFetch(`${API_URL}/api/groups/${groupId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Группа удалена');
                await loadUserGroups();
                if (selectedGroupId === groupId) {
                    selectedGroupId = null;
                    if (currentMode === 'group') {
                        currentMode = 'personal';
                        localStorage.setItem('profile_mode', 'personal');
                        await loadPersonalProjects();
                        await loadWatchedProjects();
                        renderWatchedList();
                        setupModeToggle();
                    }
                }
            } else {
                showError(data.error || 'Ошибка при удалении группы');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.openGroupInfo = async function (groupId) {
        showLoading();

        try {
            const infoResponse = await window.authFetch(`${API_URL}/api/groups/${groupId}/info`);
            const groupInfo = await infoResponse.json();

            const membersResponse = await window.authFetch(`${API_URL}/api/groups/${groupId}/members`);
            const members = await membersResponse.json();

            const projectsResponse = await window.authFetch(`${API_URL}/api/groups/${groupId}/projects`);
            const projects = await projectsResponse.json();

            const isAdmin = members.find(m => m.user_id === currentUser.id)?.role === 'admin';

            document.getElementById('groupInfoTitle').textContent = groupInfo.name;
            document.getElementById('groupInfoContent').innerHTML = `
                <div class="invite-code" style="background:#1a1a1a; padding:15px; border-radius:16px; margin-bottom:16px; text-align:center;">
                    <strong style="color:#8B7355;">🔑 Код приглашения:</strong><br>
                    <span style="font-family: monospace; font-size:1.2rem; color:#D4A85C;">${groupInfo.invite_code}</span>
                    <button class="btn-outline small" style="margin-top:8px;" onclick="window.copyToClipboard('${groupInfo.invite_code}')">📋 Копировать</button>
                </div>
                
                <div style="margin-bottom:16px;">
                    <strong style="color:#8B7355;">👥 Участники (${members.length})</strong>
                    <div style="margin-top:8px; max-height:200px; overflow-y:auto;">
                        ${members.map(m => `
                            <div style="display:flex; justify-content:space-between; padding:8px; background:#1a1a1a; border-radius:30px; margin-bottom:4px;">
                                <span>${escapeHtml(m.username)}</span>
                                <span style="color:#8B7355; font-size:0.7rem;">${m.role === 'admin' ? 'admin' : 'участник'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom:16px;">
                    <strong style="color:#8B7355;">🎬 Проекты группы (${projects.length})</strong>
                    <div style="margin-top:8px; max-height:150px; overflow-y:auto;">
                        ${projects.length === 0 ? '<div class="empty-state-small">Нет проектов</div>' :
                            projects.slice(0, 10).map(p => {
                                const data = p.data || {};
                                return `
                                    <div style="padding:8px; background:#1a1a1a; border-radius:30px; margin-bottom:4px;">
                                        ${escapeHtml(data.title_ru || data.title || p.project_id)}
                                    </div>
                                `;
                            }).join('')}
                        ${projects.length > 10 ? `<div class="empty-state-small">... и ещё ${projects.length - 10} проектов</div>` : ''}
                    </div>
                </div>
            `;

            document.getElementById('groupInfoModal').style.display = 'flex';
            document.getElementById('modalOverlay').style.display = 'block';

        } catch (error) {
            console.error('Ошибка загрузки группы:', error);
            showError('Ошибка загрузки информации о группе');
        } finally {
            hideLoading();
        }
    };

    window.closeGroupInfoModal = function () {
        document.getElementById('groupInfoModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    };

    window.copyToClipboard = function (text) {
        navigator.clipboard.writeText(text);
        showSuccess('Код скопирован!');
    };

    // ========== ДЕТАЛИ ГОЛОСОВАНИЙ ==========
    window.openVoteDetails = async function (cycleId, cycleDate) {
        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/cycle/${cycleId}/details`);
            if (!response.ok) {
                showError('Не удалось загрузить детали голосования');
                return;
            }

            const data = await response.json();
            const modal = document.getElementById('voteDetailsModal');
            const title = document.getElementById('voteDetailsTitle');
            const content = document.getElementById('voteDetailsContent');

            if (!modal || !title || !content) {
                console.error('Элементы модалки деталей не найдены');
                return;
            }

            title.textContent = `Голосование от ${formatDate(cycleDate)}`;

            if (!data.votes || Object.keys(data.votes).length === 0) {
                content.innerHTML = '<div class="empty-state-small">Нет данных о голосовании</div>';
            } else {
                let html = '';
                for (const [username, films] of Object.entries(data.votes)) {
                    html += `<div class="vote-detail-group">
                        <div class="vote-detail-user">👤 ${escapeHtml(username)}</div>`;
                    for (const film of films) {
                        const project = allProjects.find(p => p.id === film.film_id);
                        const filmTitle = project?.title_ru || project?.title || film.film_id;
                        html += `<div class="vote-detail-film">🎬 ${escapeHtml(filmTitle)} <span style="color:#8B7355;">+${film.boost || 1}</span></div>`;
                    }
                    html += `</div>`;
                }
                content.innerHTML = html;
            }

            modal.style.display = 'flex';
            document.getElementById('modalOverlay').style.display = 'block';

        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка загрузки деталей');
        } finally {
            hideLoading();
        }
    };

    window.closeVoteDetailsModal = function () {
        document.getElementById('voteDetailsModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    };

    // ========== ФУНКЦИИ ГОЛОСОВАНИЯ ==========
    window.startGroupVoting = async function () {
        if (!selectedGroupId) {
            showError('Сначала выберите группу');
            return;
        }

        const isAdmin = groupMembers.find(m => m.user_id === currentUser?.id)?.role === 'admin';
        if (!isAdmin) {
            showError('Только администратор группы может начать голосование');
            return;
        }

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duration_minutes: 1440 })
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Голосование начато!');
                await loadGroupVotingInfo();
            } else {
                showError(data.error || 'Ошибка начала голосования');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.endGroupVoting = async function () {
        if (!selectedGroupId || !currentVotingCycle) {
            showError('Нет активного голосования');
            return;
        }

        const isAdmin = groupMembers.find(m => m.user_id === currentUser?.id)?.role === 'admin';
        if (!isAdmin) {
            showError('Только администратор может завершить голосование');
            return;
        }

        if (!confirm('Завершить голосование и сохранить бусты?')) return;

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Голосование завершено! Бусты добавлены.');
                await loadGroupVotingInfo();
                window.dispatchEvent(new CustomEvent('ratingsUpdated'));
            } else {
                showError(data.error || 'Ошибка завершения голосования');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.cancelGroupVoting = async function () {
        if (!selectedGroupId || !currentVotingCycle) {
            showError('Нет активного голосования');
            return;
        }

        const isAdmin = groupMembers.find(m => m.user_id === currentUser?.id)?.role === 'admin';
        if (!isAdmin) {
            showError('Только администратор может отменить голосование');
            return;
        }

        if (!confirm('Отменить голосование? Бусты НЕ будут добавлены.')) return;

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Голосование отменено');
                await loadGroupVotingInfo();
            } else {
                showError(data.error || 'Ошибка отмены голосования');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    window.openVoteModal = async function () {
        if (!selectedGroupId || !currentVotingCycle) {
            showError('Нет активного голосования');
            return;
        }

        const response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects`);
        if (!response.ok) {
            showError('Не удалось загрузить фильмы');
            return;
        }

        const projects = await response.json();
        const plannedProjects = projects.filter(p => p.status === 'planned');

        if (plannedProjects.length === 0) {
            showError('В группе нет фильмов в планах для голосования');
            return;
        }

        const currentUserVotes = currentVotingCycle.votes?.[currentUser?.username] || [];

        const modal = document.getElementById('voteModal');
        const moviesList = document.getElementById('voteMoviesList');
        const counter = document.getElementById('voteCounter');
        const submitBtn = document.getElementById('submitVoteBtn');

        currentVoteSelections = [...currentUserVotes];

        moviesList.innerHTML = plannedProjects.map(project => {
            const isSelected = currentVoteSelections.includes(project.project_id);
            return `
                <div class="vote-movie-item ${isSelected ? 'selected' : ''}" data-film-id="${project.project_id}">
                    <div class="vote-movie-check">${isSelected ? '✓' : '○'}</div>
                    <div class="vote-movie-title">${escapeHtml(project.data?.title_ru || project.data?.title || 'Без названия')}</div>
                </div>
            `;
        }).join('');

        function updateVoteCounter() {
            counter.textContent = `Выбрано: ${currentVoteSelections.length} (от 1 до 3)`;
            submitBtn.disabled = currentVoteSelections.length < 1 || currentVoteSelections.length > 3;
        }

        document.querySelectorAll('.vote-movie-item').forEach(item => {
            item.onclick = () => {
                const filmId = item.dataset.filmId;
                const index = currentVoteSelections.indexOf(filmId);

                if (index !== -1) {
                    currentVoteSelections.splice(index, 1);
                    item.classList.remove('selected');
                    item.querySelector('.vote-movie-check').textContent = '○';
                } else if (currentVoteSelections.length < 3) {
                    currentVoteSelections.push(filmId);
                    item.classList.add('selected');
                    item.querySelector('.vote-movie-check').textContent = '✓';
                } else {
                    showError('Можно выбрать не более 3 фильмов');
                }
                updateVoteCounter();
            };
        });

        updateVoteCounter();
        modal.style.display = 'flex';
        document.getElementById('modalOverlay').style.display = 'block';
    };

    window.closeVoteModal = function () {
        document.getElementById('voteModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        currentVoteSelections = [];
    };

    window.submitVote = async function () {
        if (currentVoteSelections.length < 1 || currentVoteSelections.length > 3) {
            showError('Выберите от 1 до 3 фильмов');
            return;
        }

        showLoading();

        try {
            const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    film_ids: currentVoteSelections
                })
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Ваш голос сохранён!');
                closeVoteModal();
                await loadGroupVotingInfo();
            } else {
                showError(data.error || 'Ошибка сохранения голоса');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showError('Ошибка сети');
        } finally {
            hideLoading();
        }
    };

    // ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
    window.switchTab = function (tabId) {
        // Обновляем активную кнопку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            }
        });
        
        // Обновляем активную панель
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        const targetPane = document.getElementById(`tab-${tabId}`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
        
        // Если переключились на вкладку групп, обновляем список
        if (tabId === 'groups') {
            renderGroupsDetailedList();
        }
        
        // Если переключились на вкладку голосований, обновляем информацию
        if (tabId === 'votes') {
            loadGroupVotingInfo();
        }
    };

    // ========== ВЫХОД ==========
    window.logout = async function () {
        localStorage.removeItem('auth_token');
        window.location.href = 'index.html';
    };

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function getStatusText(status) {
        const map = {
            'in_progress': 'В процессе',
            'watched': 'Просмотрено',
            'planned': 'В планах',
            'remove': 'Удалено'
        };
        return map[status] || status;
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        try {
            let date;
            if (dateString.includes(' ')) {
                const [datePart] = dateString.split(' ');
                const [year, month, day] = datePart.split('-');
                date = new Date(year, month - 1, day);
            } else {
                date = new Date(dateString);
            }
            if (isNaN(date.getTime())) return '—';
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return '—';
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showLoading() {
        const loader = document.getElementById('profile-loader');
        if (loader) loader.remove();

        const newLoader = document.createElement('div');
        newLoader.id = 'profile-loader';
        newLoader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            backdrop-filter: blur(5px);
        `;
        newLoader.innerHTML = `
            <div class="loading-spinner" style="width: 60px; height: 60px;"></div>
            <div style="color: #e0e0e0; font-size: 1.2rem; margin-top: 16px;">Загрузка...</div>
        `;
        document.body.appendChild(newLoader);
    }

    function hideLoading() {
        const loader = document.getElementById('profile-loader');
        if (loader) loader.remove();
    }

    function showSuccess(text) {
        const msg = document.createElement('div');
        msg.className = 'toast-message success';
        msg.textContent = text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            animation: slideUp 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    function showError(text) {
        const msg = document.createElement('div');
        msg.className = 'toast-message error';
        msg.textContent = text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            animation: slideUp 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    window.debugProfile = function () {
        console.log('=== DEBUG PROFILE ===');
        console.log('currentMode:', currentMode);
        console.log('selectedGroupId:', selectedGroupId);
        console.log('allProjects length:', allProjects.length);
        console.log('Progress items:', allProjects.filter(p => p.user_status === 'in_progress' || p.status === 'in_progress'));
        console.log('Planned items:', allProjects.filter(p => p.user_status === 'planned' || p.status === 'planned'));
    };
})();