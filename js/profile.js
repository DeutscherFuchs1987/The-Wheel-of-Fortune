(function() {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let currentProject = null;
    let allProjects = [];
    let userProgress = [];
    let userVotes = {};
    let userGroups = [];
    let currentMode = 'personal';
    let selectedGroupId = null;

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
                document.getElementById('profileUsername').textContent = currentUser.username;
                if (currentUser.role === 'admin') {
                    document.getElementById('profileBadge').innerHTML = '<span>ADMIN</span>';
                }
                await loadProfileData();
                await loadUserGroups();
                setupModeToggle();
            } else {
                console.log('❌ Не авторизован, редирект на главную');
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            window.location.href = 'index.html';
        }
    }

    async function loadProfileData() {
        try {
            showLoading();
            
            await loadAllProjects();
            await loadUserProgress();
            await loadUserVotes();
            
            updateStats();
            renderProgressList();
            renderWatchedList();
            renderPlannedList();
            renderVotesList();
            
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
            console.log(`📁 Загружено проектов: ${allProjects.length}`);
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

    async function loadUserVotes() {
        try {
            const response = await window.authFetch(`${API_URL}/api/voting/current-cycle`);
            if (response.ok) {
                const data = await response.json();
                userVotes = data.votes || {};
                console.log(`🗳️ Загружены голоса:`, userVotes);
            }
        } catch (error) {
            console.error('Ошибка загрузки голосов:', error);
            userVotes = {};
        }
    }

    // ========== ФУНКЦИИ ДЛЯ ГРУПП ==========
    async function loadUserGroups() {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups`);
            if (response.ok) {
                userGroups = await response.json();
                console.log(`👥 Загружено групп: ${userGroups.length}`);
                renderGroupsList();
                renderGroupsDetailedList();
                renderGroupSelector();
                
                const groupsCountEl = document.getElementById('groupsCount');
                if (groupsCountEl) groupsCountEl.textContent = userGroups.length;
            }
        } catch (error) {
            console.error('Ошибка загрузки групп:', error);
            userGroups = [];
            renderGroupsList();
            renderGroupsDetailedList();
        }
    }

    async function loadPersonalProjects() {
        try {
            const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
            if (response.ok) {
                const projects = await response.json();
                allProjects = projects.map(p => ({
                    ...p.data,
                    id: p.project_id,
                    user_status: p.status
                }));
                updateStats();
                renderProgressList();
                renderWatchedList();
                renderPlannedList();
                renderVotesList();
            }
        } catch (error) {
            console.error('Ошибка загрузки личных проектов:', error);
            showError('Ошибка загрузки личного каталога');
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
                    user_status: 'planned'
                }));
                updateStats();
                renderProgressList();
                renderWatchedList();
                renderPlannedList();
                renderVotesList();
            }
        } catch (error) {
            console.error('Ошибка загрузки групповых проектов:', error);
            showError('Ошибка загрузки проектов группы');
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

    window.selectGroup = function(groupId) {
        if (!groupId) {
            selectedGroupId = null;
            if (currentMode === 'group') {
                currentMode = 'personal';
                const modeToggle = document.getElementById('modeToggle');
                if (modeToggle) modeToggle.classList.remove('group-mode');
                updateModeUI();
            }
            return;
        }
        selectedGroupId = groupId;
        localStorage.setItem('selected_group', groupId);
        if (currentMode === 'group') {
            loadGroupProjects(groupId);
        }
    };

    window.refreshGroupProjects = function() {
        if (selectedGroupId && currentMode === 'group') {
            loadGroupProjects(selectedGroupId);
            showSuccess('Проекты группы обновлены');
        }
    };

    window.leaveGroup = async function(groupId) {
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
                        const modeToggle = document.getElementById('modeToggle');
                        if (modeToggle) modeToggle.classList.remove('group-mode');
                        updateModeUI();
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

    window.deleteGroup = async function(groupId) {
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
                        const modeToggle = document.getElementById('modeToggle');
                        if (modeToggle) modeToggle.classList.remove('group-mode');
                        updateModeUI();
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

    // ========== ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ==========
    function setupModeToggle() {
        const modeToggle = document.getElementById('modeToggle');
        const personalLabel = document.querySelector('.mode-label.personal');
        const groupLabel = document.querySelector('.mode-label.group');
        const groupSelector = document.getElementById('groupSelector');
        
        if (!modeToggle) return;
        
        function updateModeUI() {
            if (currentMode === 'personal') {
                if (personalLabel) personalLabel.classList.add('active');
                if (groupLabel) groupLabel.classList.remove('active');
                if (groupSelector) groupSelector.style.display = 'none';
                loadPersonalProjects();
            } else {
                if (personalLabel) personalLabel.classList.remove('active');
                if (groupLabel) groupLabel.classList.add('active');
                if (groupSelector) groupSelector.style.display = 'flex';
                if (selectedGroupId) {
                    loadGroupProjects(selectedGroupId);
                }
            }
        }
        
        modeToggle.addEventListener('click', () => {
            currentMode = currentMode === 'personal' ? 'group' : 'personal';
            modeToggle.classList.toggle('group-mode', currentMode === 'group');
            updateModeUI();
            
            localStorage.setItem('profile_mode', currentMode);
            if (currentMode === 'group' && selectedGroupId) {
                localStorage.setItem('selected_group', selectedGroupId);
            }
        });
        
        const savedMode = localStorage.getItem('profile_mode');
        if (savedMode === 'group') {
            currentMode = 'group';
            modeToggle.classList.add('group-mode');
            const savedGroup = localStorage.getItem('selected_group');
            if (savedGroup) selectedGroupId = savedGroup;
        }
        updateModeUI();
    }

    function updateModeUI() {
        const modeToggle = document.getElementById('modeToggle');
        const personalLabel = document.querySelector('.mode-label.personal');
        const groupLabel = document.querySelector('.mode-label.group');
        const groupSelector = document.getElementById('groupSelector');
        
        if (currentMode === 'personal') {
            if (personalLabel) personalLabel.classList.add('active');
            if (groupLabel) groupLabel.classList.remove('active');
            if (groupSelector) groupSelector.style.display = 'none';
            loadPersonalProjects();
        } else {
            if (personalLabel) personalLabel.classList.remove('active');
            if (groupLabel) groupLabel.classList.add('active');
            if (groupSelector) groupSelector.style.display = 'flex';
            if (selectedGroupId) {
                loadGroupProjects(selectedGroupId);
            }
        }
    }

    // ========== СТАТИСТИКА ==========
    function updateStats() {
        const watched = allProjects.filter(p => p.user_status === 'watched' || p.status === 'watched').length;
        const inProgress = allProjects.filter(p => p.user_status === 'in_progress' || p.status === 'in_progress').length;
        const planned = allProjects.filter(p => p.user_status === 'planned' || p.status === 'planned').length;
        
        document.getElementById('watchedCount').textContent = watched;
        document.getElementById('inProgressCount').textContent = inProgress;
        document.getElementById('plannedCount').textContent = planned;
        
        document.getElementById('registerDate').textContent = formatDate(currentUser.registered_at);
        document.getElementById('lastLogin').textContent = formatDateTime(currentUser.last_login);
    }

    // ========== РЕНДЕРИНГ СПИСКОВ ==========
    function renderProgressList() {
        const container = document.getElementById('progressList');
        const countEl = document.getElementById('progressCount');
        
        const progressItems = allProjects.filter(p => p.user_status === 'in_progress' || p.status === 'in_progress');
        countEl.textContent = progressItems.length;
        
        if (progressItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>🎬</span><p>Нет проектов в процессе</p></div>';
            return;
        }
        
        container.innerHTML = progressItems.map(project => {
            const poster = project.poster || '';
            const title = project.title_ru || project.title;
            const type = project.type || 'Фильм';
            const year = project.year || '';
            
            return `
                <div class="item-card" onclick="showStatusModal('${project.id}', '${escapeHtml(title)}')">
                    <div class="item-poster" style="background-image: url('${poster}')">
                        ${!poster ? '<div class="item-no-poster">🎬</div>' : ''}
                        <div class="item-status status-in-progress">🔥</div>
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
        const countEl = document.getElementById('watchedListCount');
        
        const watchedItems = allProjects.filter(p => p.user_status === 'watched' || p.status === 'watched');
        countEl.textContent = watchedItems.length;
        
        if (watchedItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>✅</span><p>Нет просмотренных проектов</p></div>';
            return;
        }
        
        container.innerHTML = watchedItems.map(project => {
            const poster = project.poster || '';
            const title = project.title_ru || project.title;
            const type = project.type || 'Фильм';
            const year = project.year || '';
            
            return `
                <div class="item-card" onclick="showStatusModal('${project.id}', '${escapeHtml(title)}')">
                    <div class="item-poster" style="background-image: url('${poster}')">
                        ${!poster ? '<div class="item-no-poster">🎬</div>' : ''}
                        <div class="item-status status-watched">✅</div>
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

    function renderPlannedList() {
        const container = document.getElementById('plannedList');
        const countEl = document.getElementById('plannedListCount');
        
        const plannedItems = allProjects.filter(p => p.user_status === 'planned' || p.status === 'planned');
        countEl.textContent = plannedItems.length;
        
        if (plannedItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>📋</span><p>Нет проектов в планах</p></div>';
            return;
        }
        
        container.innerHTML = plannedItems.map(project => {
            const poster = project.poster || '';
            const title = project.title_ru || project.title;
            const type = project.type || 'Фильм';
            const year = project.year || '';
            
            return `
                <div class="item-card" onclick="showStatusModal('${project.id}', '${escapeHtml(title)}')">
                    <div class="item-poster" style="background-image: url('${poster}')">
                        ${!poster ? '<div class="item-no-poster">🎬</div>' : ''}
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

    function renderVotesList() {
        const container = document.getElementById('votesList');
        const countEl = document.getElementById('votesCount');
        
        const currentUserVotes = userVotes[currentUser?.username] || [];
        countEl.textContent = `${currentUserVotes.length}/3`;
        
        if (currentUserVotes.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>🗳️</span><p>Вы ещё не голосовали в этом цикле</p></div>';
        } else {
            const votedMovies = currentUserVotes.map(filmId => {
                const project = allProjects.find(p => p.id === filmId);
                const boost = window.filmBoosts?.[filmId] || 0;
                return { project, boost };
            }).filter(item => item.project);
            
            container.innerHTML = `
                <div class="votes-grid">
                    ${votedMovies.map(item => `
                        <div class="vote-item">
                            <div class="item-title">${escapeHtml(item.project.title_ru || item.project.title)}</div>
                            <div class="vote-boost">+${item.boost.toFixed(1)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        const historyContainer = document.getElementById('votesHistory');
        historyContainer.innerHTML = `
            <div class="empty-state">
                <span>📊</span>
                <p>История голосований будет доступна позже</p>
            </div>
        `;
    }

    // ========== ОТРИСОВКА ГРУПП ==========
    function renderGroupsList() {
        const container = document.getElementById('groupsList');
        if (!container) return;
        
        if (userGroups.length === 0) {
            container.innerHTML = '<div class="empty-groups">У вас нет групп</div>';
            return;
        }
        
        container.innerHTML = userGroups.map(group => `
            <div class="group-card" onclick="openGroupInfo('${group.id}')">
                <div class="group-info">
                    <div class="group-name">
                        ${escapeHtml(group.name)}
                        <span class="group-role">${group.role === 'admin' ? 'admin' : 'участник'}</span>
                    </div>
                    <div class="group-meta">
                        Код: <span class="group-invite">${group.invite_code}</span>
                    </div>
                </div>
                <div class="group-arrow">👉</div>
            </div>
        `).join('');
    }

    function renderGroupsDetailedList() {
        const container = document.getElementById('groupsDetailedList');
        if (!container) return;
        
        if (userGroups.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>👥</span><p>У вас нет групп</p><p>Создайте группу или вступите по коду приглашения</p></div>';
            return;
        }
        
        container.innerHTML = userGroups.map(group => `
            <div class="group-card" style="margin-bottom: 10px;">
                <div class="group-info" onclick="openGroupInfo('${group.id}')">
                    <div class="group-name">
                        ${escapeHtml(group.name)}
                        <span class="group-role">${group.role === 'admin' ? 'admin' : 'участник'}</span>
                    </div>
                    <div class="group-meta">
                        Создана: ${formatDate(group.created_at)} | 
                        Код: <span class="group-invite">${group.invite_code}</span>
                    </div>
                </div>
                <div class="group-actions">
                    ${group.role === 'admin' ? `
                        <button class="group-action-btn delete-group" onclick="event.stopPropagation(); deleteGroup('${group.id}')" title="Удалить группу">
                            🗑️ Удалить
                        </button>
                    ` : `
                        <button class="group-action-btn leave-group" onclick="event.stopPropagation(); leaveGroup('${group.id}')" title="Покинуть группу">
                            🚪 Выйти
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    }

    window.openGroupInfo = async function(groupId) {
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
                <div class="invite-code">
                    <strong>🔑 Код приглашения:</strong><br>
                    <span>${groupInfo.invite_code}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${groupInfo.invite_code}')">📋 Копировать</button>
                </div>
                
                <div class="group-members-list">
                    <strong>👥 Участники (${members.length})</strong>
                    ${members.map(m => `
                        <div class="member-item">
                            <span class="member-name">${escapeHtml(m.username)}</span>
                            <span class="member-role">${m.role === 'admin' ? 'admin' : 'участник'}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="group-projects-list">
                    <strong>🎬 Проекты группы (${projects.length})</strong>
                    ${projects.length === 0 ? '<p style="color: #a3b7f0; padding: 10px;">Нет проектов</p>' : 
                        projects.slice(0, 5).map(p => {
                            const data = p.data || {};
                            return `
                                <div class="member-item">
                                    <span class="member-name">${escapeHtml(data.title_ru || data.title || p.project_id)}</span>
                                </div>
                            `;
                        }).join('')}
                    ${projects.length > 5 ? `<p style="color: #a3b7f0; padding: 10px;">... и ещё ${projects.length - 5} проектов</p>` : ''}
                </div>
                
                <div class="group-action-buttons" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    ${isAdmin ? `
                        <button class="group-action-btn delete-group" onclick="deleteGroup('${groupId}'); closeGroupInfoModal()">
                            🗑️ Удалить группу
                        </button>
                    ` : `
                        <button class="group-action-btn leave-group" onclick="leaveGroup('${groupId}'); closeGroupInfoModal()">
                            🚪 Покинуть группу
                        </button>
                    `}
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

    // ========== УПРАВЛЕНИЕ СТАТУСОМ ==========
    window.showStatusModal = function(projectId, title) {
        if (!currentUser) {
            showError('Требуется авторизация');
            return;
        }
        currentProject = { id: projectId, title: title };
        document.getElementById('modalProjectTitle').textContent = title;
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('statusModal').style.display = 'flex';
    };

    window.closeStatusModal = function() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('statusModal').style.display = 'none';
        currentProject = null;
    };

    window.changeStatus = async function(status) {
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

    // ========== СОЗДАНИЕ ГРУППЫ ==========
    window.openCreateGroupModal = function() {
        document.getElementById('createGroupModal').style.display = 'flex';
        document.getElementById('modalOverlay').style.display = 'block';
    };

    window.closeCreateGroupModal = function() {
        document.getElementById('createGroupModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('groupNameInput').value = '';
    };

    window.createGroup = async function() {
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

    window.joinGroup = async function() {
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

    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text);
        showSuccess('Код скопирован!');
    };

    window.closeGroupInfoModal = function() {
        document.getElementById('groupInfoModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    };

    // ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
    window.switchTab = function(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
    };

    // ========== ВЫХОД ==========
    window.logout = async function() {
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
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return '—';
        }
    }

    function formatDateTime(dateString) {
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
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
            <div style="width: 60px; height: 60px; border: 4px solid #5f4bb6; border-top-color: #ffd966; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <div style="color: white; font-size: 1.2rem;">Загрузка...</div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(newLoader);
    }

    function hideLoading() {
        const loader = document.getElementById('profile-loader');
        if (loader) loader.remove();
    }

    function showSuccess(text) {
        const msg = document.createElement('div');
        msg.className = 'success-message';
        msg.textContent = '✅ ' + text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e3a2a;
            color: #a0ffa0;
            padding: 12px 24px;
            border-radius: 30px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    function showError(text) {
        const msg = document.createElement('div');
        msg.className = 'error-message';
        msg.textContent = '❌ ' + text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3d1e2b;
            color: #ff8a8a;
            padding: 12px 24px;
            border-radius: 30px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    window.openCreateGroupModal = openCreateGroupModal;
    window.closeCreateGroupModal = closeCreateGroupModal;
    window.createGroup = createGroup;
    window.joinGroup = joinGroup;
    window.leaveGroup = leaveGroup;
    window.deleteGroup = deleteGroup;
    window.openGroupInfo = openGroupInfo;
    window.closeGroupInfoModal = closeGroupInfoModal;
    window.selectGroup = selectGroup;
    window.refreshGroupProjects = refreshGroupProjects;
    window.copyToClipboard = copyToClipboard;
    window.showStatusModal = showStatusModal;
    window.closeStatusModal = closeStatusModal;
    window.changeStatus = changeStatus;
    window.switchTab = switchTab;
    window.logout = logout;
})();