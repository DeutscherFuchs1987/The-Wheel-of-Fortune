(function() {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let currentProject = null;
    let allProjects = [];
    let userProgress = [];
    let userVotes = {};

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
            
            // Загружаем все проекты
            await loadAllProjects();
            
            // Загружаем прогресс пользователя
            await loadUserProgress();
            
            // Загружаем голоса пользователя
            await loadUserVotes();
            
            // Обновляем статистику
            updateStats();
            
            // Рендерим списки
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

    // ========== СТАТИСТИКА ==========
    function updateStats() {
        const watched = userProgress.filter(p => p.status === 'watched').length;
        const inProgress = userProgress.filter(p => p.status === 'in_progress').length;
        const planned = userProgress.filter(p => p.status === 'planned').length;
        
        document.getElementById('watchedCount').textContent = watched;
        document.getElementById('inProgressCount').textContent = inProgress;
        document.getElementById('plannedCount').textContent = planned;
        
        // Информация о пользователе
        document.getElementById('registerDate').textContent = formatDate(currentUser.registered_at);
        document.getElementById('lastLogin').textContent = formatDateTime(currentUser.last_login);
    }

    // ========== РЕНДЕРИНГ СПИСКОВ ==========
    function renderProgressList() {
        const container = document.getElementById('progressList');
        const countEl = document.getElementById('progressCount');
        
        const progressItems = userProgress.filter(p => p.status === 'in_progress');
        countEl.textContent = progressItems.length;
        
        if (progressItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>🎬</span><p>Нет проектов в процессе</p></div>';
            return;
        }
        
        container.innerHTML = progressItems.map(progress => {
            const project = allProjects.find(p => p.id === progress.project_id);
            if (!project) return '';
            
            return `
                <div class="item-card" onclick="showStatusModal('${project.id}', '${escapeHtml(project.title_ru || project.title)}')">
                    <div class="item-poster" style="background-image: url('${project.poster || ''}')">
                        ${!project.poster ? '<div class="item-no-poster">🎬</div>' : ''}
                        <div class="item-progress">
                            <div class="progress-fill" style="width: ${progress.timecode ? (progress.timecode / (progress.duration || 1) * 100) : 0}%"></div>
                        </div>
                        <div class="item-status status-in-progress">🔥</div>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(project.title_ru || project.title)}</div>
                        <div class="item-meta">
                            <span>${project.type || 'Фильм'}</span>
                            <span>${progress.season ? `${progress.season} сезон` : ''} ${progress.episode ? `${progress.episode} серия` : ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderWatchedList() {
        const container = document.getElementById('watchedList');
        const countEl = document.getElementById('watchedListCount');
        
        const watchedItems = userProgress.filter(p => p.status === 'watched');
        countEl.textContent = watchedItems.length;
        
        if (watchedItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>✅</span><p>Нет просмотренных проектов</p></div>';
            return;
        }
        
        container.innerHTML = watchedItems.map(progress => {
            const project = allProjects.find(p => p.id === progress.project_id);
            if (!project) return '';
            
            return `
                <div class="item-card" onclick="showStatusModal('${project.id}', '${escapeHtml(project.title_ru || project.title)}')">
                    <div class="item-poster" style="background-image: url('${project.poster || ''}')">
                        ${!project.poster ? '<div class="item-no-poster">🎬</div>' : ''}
                        <div class="item-status status-watched">✅</div>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(project.title_ru || project.title)}</div>
                        <div class="item-meta">
                            <span>${project.type || 'Фильм'}</span>
                            <span>${project.year || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPlannedList() {
        const container = document.getElementById('plannedList');
        const countEl = document.getElementById('plannedListCount');
        
        const plannedItems = userProgress.filter(p => p.status === 'planned');
        countEl.textContent = plannedItems.length;
        
        if (plannedItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>📋</span><p>Нет проектов в планах</p></div>';
            return;
        }
        
        container.innerHTML = plannedItems.map(progress => {
            const project = allProjects.find(p => p.id === progress.project_id);
            if (!project) return '';
            
            return `
                <div class="item-card" onclick="showStatusModal('${project.id}', '${escapeHtml(project.title_ru || project.title)}')">
                    <div class="item-poster" style="background-image: url('${project.poster || ''}')">
                        ${!project.poster ? '<div class="item-no-poster">🎬</div>' : ''}
                        <div class="item-status status-planned">📋</div>
                    </div>
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(project.title_ru || project.title)}</div>
                        <div class="item-meta">
                            <span>${project.type || 'Фильм'}</span>
                            <span>${project.year || ''}</span>
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
        
        // История голосований (пока заглушка)
        const historyContainer = document.getElementById('votesHistory');
        historyContainer.innerHTML = `
            <div class="empty-state">
                <span>📊</span>
                <p>История голосований будет доступна позже</p>
            </div>
        `;
    }

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
                newStatus = 'planned'; // Удаляем из списка
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
                await loadProfileData(); // Перезагружаем все данные
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
        const loader = document.createElement('div');
        loader.id = 'profile-loader';
        loader.style.cssText = `
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
        loader.innerHTML = `
            <div style="width: 60px; height: 60px; border: 4px solid #5f4bb6; border-top-color: #ffd966; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <div style="color: white; font-size: 1.2rem;">Загрузка...</div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(loader);
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
})();