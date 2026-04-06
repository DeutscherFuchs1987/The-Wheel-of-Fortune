(function () {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    let myProjects = [];
    let groupRatings = {}; // Оценки внутри текущей группы
    let currentFilter = 'all';
    let currentProject = null;
    let currentUser = null;
    let userRatings = {}; // { projectId: { rating, notes } } для текущего пользователя

    // ========== ПЕРЕМЕННЫЕ ДЛЯ ГРУППОВОГО РЕЖИМА ==========
    let currentMode = localStorage.getItem('ratings_mode') || 'personal';
    let selectedGroupId = localStorage.getItem('selected_group') || null;
    let userGroups = [];

    const projectsGrid = document.getElementById('projectsGrid');
    const statsDiv = document.getElementById('stats');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const ratingModal = document.getElementById('ratingModal');
    const modalContent = document.getElementById('modalContent');
    const body = document.body;

    // ========== АВТОРИЗАЦИЯ ==========
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

    // ========== ЗАГРУЗКА ОЦЕНОК ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ==========
    async function loadUserRatings() {
        try {
            const response = await window.authFetch(`${API_URL}/api/user/ratings`);
            if (response.ok) {
                userRatings = await response.json();
                console.log('⭐ Загружены личные оценки:', userRatings);
            }
        } catch (error) {
            console.error('Ошибка загрузки личных оценок:', error);
            userRatings = {};
        }
    }

    // ========== ЗАГРУЗКА ОЦЕНОК ВНУТРИ ГРУППЫ ==========
    async function loadGroupRatings() {
        if (currentMode !== 'group' || !selectedGroupId) {
            groupRatings = {};
            return;
        }

        try {
            console.log(`👥 Загружаем оценки группы ${selectedGroupId}...`);
            const response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/ratings`);
            if (response.ok) {
                groupRatings = await response.json();
                console.log('⭐ Загружены оценки группы:', groupRatings);
            } else if (response.status === 403) {
                console.warn('Нет доступа к оценкам группы');
                groupRatings = {};
            } else {
                console.error('Ошибка загрузки оценок группы:', response.status);
                groupRatings = {};
            }
        } catch (error) {
            console.error('Ошибка загрузки оценок группы:', error);
            groupRatings = {};
        }
    }

    // ========== ЗАГРУЗКА ВСЕХ ОЦЕНОК ==========
    async function loadAllRatings() {
        try {
            if (currentMode === 'group' && selectedGroupId) {
                await loadGroupRatings();
                if (Object.keys(groupRatings).length > 0) {
                    console.log('⭐ Используем оценки группы для отображения');
                }
                return;
            }

            // В личном режиме используем только свои оценки
            console.log('👤 Личный режим: показываем только свои оценки');
            allUserRatings = {};
            return;
        } catch (error) {
            console.error('Ошибка загрузки оценок:', error);
            groupRatings = {};
        }
    }

    // ========== ЗАГРУЗКА ПРОСМОТРЕННЫХ ФИЛЬМОВ ==========
    async function loadWatchedProjects() {
        try {
            console.log(`📡 Загружаем просмотренные фильмы (режим: ${currentMode})...`);

            let projects = [];

            if (currentMode === 'personal') {
                const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
                if (response.ok) {
                    const userProjects = await response.json();
                    projects = userProjects
                        .filter(p => p.status === 'watched')
                        .map(p => ({
                            ...p.data,
                            id: p.project_id,
                            user_status: p.status
                        }));
                    console.log(`✅ Загружено ${projects.length} фильмов из личного каталога`);
                } else {
                    console.error('Ошибка загрузки личных проектов:', response.status);
                }
            } else if (selectedGroupId) {
                const response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects`);
                if (response.ok) {
                    const groupProjects = await response.json();
                    projects = groupProjects
                        .filter(p => p.status === 'watched')
                        .map(p => ({
                            ...p.data,
                            id: p.project_id,
                            group_project_id: p.id,
                            user_status: p.status
                        }));
                    console.log(`✅ Загружено ${projects.length} фильмов из группы`);
                } else {
                    console.error('Ошибка загрузки групповых проектов:', response.status);
                }
            } else {
                console.log('⚠️ Групповой режим выбран, но группа не выбрана');
            }

            myProjects = projects;
            console.log(`✅ Итого просмотренных фильмов: ${myProjects.length}`);

            renderProjects();
            updateStats();

        } catch (error) {
            console.error('Ошибка загрузки:', error);
            showError('Ошибка загрузки: ' + error.message);
            myProjects = [];
            renderProjects();
        }
    }

    // ========== УПРАВЛЕНИЕ ГРУППАМИ ==========
    async function loadUserGroups() {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups`);
            if (response.ok) {
                userGroups = await response.json();
                console.log(`👥 Загружено групп: ${userGroups.length}`);
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
        selectedGroupId = groupId || null;
        if (groupId) {
            localStorage.setItem('selected_group', groupId);
        } else {
            localStorage.removeItem('selected_group');
        }
        if (currentMode === 'group') {
            loadAllRatings().then(() => loadWatchedProjects());
        }
    };

    window.refreshGroupProjects = function () {
        if (selectedGroupId && currentMode === 'group') {
            loadAllRatings().then(() => loadWatchedProjects());
            showSuccess('Проекты группы обновлены');
        }
    };

    // ========== ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ==========
    function setupModeToggle() {
        const catalogModeToggle = document.getElementById('catalogModeToggle');
        const personalLabel = document.querySelector('.mode-label.personal');
        const groupLabel = document.querySelector('.mode-label.group');
        const groupSelector = document.getElementById('groupSelector');

        if (!catalogModeToggle) {
            console.warn('⚠️ catalogModeToggle не найден на странице');
            return;
        }

        function updateModeUI() {
            console.log('🔄 Обновляем UI режима:', currentMode);

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

        newToggle.addEventListener('click', (e) => {
            console.log('🖱️ Клик по переключателю');
            
            const newMode = currentMode === 'personal' ? 'group' : 'personal';
            
            if (newMode === 'group' && !selectedGroupId) {
                showError('Сначала выберите группу из списка');
                return;
            }
            
            currentMode = newMode;
            localStorage.setItem('ratings_mode', currentMode);
            console.log('📌 Режим изменён на:', currentMode);
            updateModeUI();

            loadAllRatings().then(() => loadWatchedProjects());

            window.dispatchEvent(new CustomEvent('modeChanged', {
                detail: { mode: currentMode, groupId: selectedGroupId }
            }));
        });

        updateModeUI();
    }

    // ========== УДАЛЕНИЕ ПРОЕКТА ==========
    const deleteProject = async function (projectId) {
        if (!confirm('Удалить проект из просмотренных?')) return;

        try {
            let response;

            if (currentMode === 'group' && selectedGroupId) {
                const project = myProjects.find(p => p.id === projectId);
                const groupProjectId = project?.group_project_id;
                if (!groupProjectId) {
                    showError('Не удалось идентифицировать групповой проект');
                    return;
                }
                response = await window.authFetch(`${API_URL}/api/groups/${selectedGroupId}/projects/${groupProjectId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'planned' })
                });
            } else {
                response = await window.authFetch(`${API_URL}/api/user/projects/${projectId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'planned' })
                });
            }

            if (!response.ok) throw new Error(`Ошибка удаления: ${response.status}`);

            myProjects = myProjects.filter(p => p.id !== projectId);
            renderProjects();
            updateStats();
            showSuccess('Проект удалён из просмотренных');

        } catch (error) {
            showError('Ошибка удаления: ' + error.message);
        }
    };
    window.deleteProject = deleteProject;

    // ========== ФУНКЦИИ ДЛЯ ОТОБРАЖЕНИЯ ОЦЕНОК ==========
    function getRatingClass(rating) {
        if (!rating && rating !== 0) return 'rating-null';
        const rounded = Math.round(rating);
        return `rating-${rounded}`;
    }

    function formatRating(rating) {
        if (!rating && rating !== 0) return '—';
        return rating.toFixed(1);
    }

    // ========== ОТКРЫТИЕ МОДАЛКИ С ОЦЕНКАМИ ==========
    window.openRatingModal = function (projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;

        currentProject = project;
        body.classList.add('modal-open');

        const posterEmoji = project.type === 'Аниме' ? '🇯🇵' :
            project.type === 'Сериал' ? '📺' :
                project.type === 'Мультфильм' ? '🖍️' : '🎬';

        const posterHtml = project.poster
            ? `<div class="modal-poster" style="background-image: url('${project.poster}');"></div>`
            : `<div class="modal-poster no-poster">${posterEmoji}</div>`;

        // ВЫБИРАЕМ ПРАВИЛЬНЫЙ ИСТОЧНИК ОЦЕНОК
        const ratingsSource = (currentMode === 'group' && selectedGroupId) ? groupRatings : { [currentUser?.username]: userRatings };

        // Получаем всех пользователей, которые оценили этот фильм
        const usersWithRatings = [];
        for (const [username, ratings] of Object.entries(ratingsSource)) {
            if (ratings[projectId]) {
                usersWithRatings.push({
                    username: username,
                    rating: ratings[projectId].rating,
                    notes: ratings[projectId].notes
                });
            }
        }

        // Сортируем по оценке (от высшей к низшей)
        usersWithRatings.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        const currentUserRating = userRatings[projectId];

        const ratingsHtml = usersWithRatings.length > 0
            ? usersWithRatings.map(user => `
                <div class="rating-row">
                    <div class="rating-header">
                        <span class="rating-name">${escapeHtml(user.username)} ${user.username === currentUser?.username ? '(Вы)' : ''}</span>
                        <span class="rating-display ${getRatingClass(user.rating)}">
                            ${formatRating(user.rating)}
                        </span>
                    </div>
                    ${user.notes ? `<div class="rating-notes">📝 ${escapeHtml(user.notes)}</div>` : ''}
                </div>
            `).join('')
            : '<div class="rating-row"><div class="rating-header"><span class="rating-name">Пока нет оценок</span></div></div>';

        modalContent.innerHTML = `
            <div class="modal-header">
                ${posterHtml}
                <div class="modal-info">
                    <div class="modal-title">${escapeHtml(project.title_ru || project.title)}</div>
                    <div class="modal-year">${project.year || '—'}</div>
                    <div class="modal-rating">Кинопоиск: ${project.rating || '—'}</div>
                </div>
            </div>
            
            <div class="ratings-container">
                <h3 style="color: #ffd966; margin-bottom: 15px;">⭐ Оценки участников</h3>
                ${ratingsHtml}
            </div>
            
            ${currentUserRating ? `
                <div class="my-rating">
                    <h3 style="color: #ffd966; margin-top: 20px; margin-bottom: 10px;">🎯 Ваша оценка</h3>
                    <div class="rating-row">
                        <div class="rating-header">
                            <span class="rating-name">${escapeHtml(currentUser.username)}</span>
                            <span class="rating-display ${getRatingClass(currentUserRating.rating)}">
                                ${formatRating(currentUserRating.rating)}
                            </span>
                        </div>
                        ${currentUserRating.notes ? `<div class="rating-notes">📝 ${escapeHtml(currentUserRating.notes)}</div>` : ''}
                        <div style="margin-top: 10px;">
                            <button class="edit-my-rating-btn" onclick="editMyRating('${projectId}')">✏️ Изменить оценку</button>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="rate-this-film" style="margin-top: 20px;">
                    <button class="rate-this-film-btn" onclick="rateThisFilm('${projectId}')">⭐ Оценить фильм</button>
                </div>
            `}
            
            <div class="modal-buttons">
                <button class="modal-btn cancel" onclick="closeRatingModal()">Закрыть</button>
            </div>
        `;

        ratingModal.classList.add('active');
    };

    window.closeRatingModal = function () {
        body.classList.remove('modal-open');
        ratingModal.classList.remove('active');
        currentProject = null;
    };

    window.rateThisFilm = function (projectId) {
        window.location.href = `profile.html?rate=${projectId}`;
    };

    window.editMyRating = function (projectId) {
        window.location.href = `profile.html?edit=${projectId}`;
    };

    // ========== СТАТИСТИКА ==========
    function updateStats() {
        const total = myProjects.length;
        if (statsDiv) statsDiv.textContent = `📊 Всего оценённых фильмов: ${total}`;
    }

    // ========== ФИЛЬТРАЦИЯ ==========
    function getFilteredProjects() {
        if (currentFilter === 'all') return myProjects;
        return myProjects.filter(p => (p.type || 'Фильм') === currentFilter);
    }

    // ========== ОТРИСОВКА КАРТОЧЕК ==========
    function renderProjects() {
        console.log('🎨 renderProjects() вызван, myProjects.length:', myProjects.length);
        
        const filtered = getFilteredProjects();
        console.log('🎨 filtered.length:', filtered.length);

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <span>⭐</span>
                    <p>Пока нет просмотренных фильмов</p>
                    <p style="font-size: 1rem; margin-top: 10px; color: #6b729b;">
                        ${currentMode === 'group' && !selectedGroupId
                            ? 'Выберите группу в переключателе режимов'
                            : 'Отмечайте фильмы галочкой ✅ в каталоге, а затем оценивайте их в профиле'}
                    </p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(project => {
            let posterEmoji = '🎬';
            if (project.type === 'Аниме') posterEmoji = '🇯🇵';
            else if (project.type === 'Сериал') posterEmoji = '📺';
            else if (project.type === 'Мультфильм') posterEmoji = '🖍️';

            // ВЫБИРАЕМ ПРАВИЛЬНЫЙ ИСТОЧНИК ДЛЯ ПОДСЧЁТА СРЕДНЕЙ ОЦЕНКИ
            const ratingsSource = (currentMode === 'group' && selectedGroupId) ? groupRatings : { [currentUser?.username]: userRatings };

            // Считаем среднюю оценку
            let totalRating = 0;
            let ratingCount = 0;
            for (const [username, ratings] of Object.entries(ratingsSource)) {
                if (ratings[project.id] && ratings[project.id].rating) {
                    totalRating += ratings[project.id].rating;
                    ratingCount++;
                }
            }
            const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;
            const userHasRated = userRatings[project.id] !== undefined;

            const posterHtml = project.poster
                ? `<div class="poster" style="background-image: url('${project.poster}');">
                     <div class="rating-badge">${project.rating || '—'}</div>
                     ${averageRating ? `<div class="average-rating-badge">⭐ ${averageRating}</div>` : ''}
                     ${userHasRated ? `<div class="user-rated-badge">✓ Оценено</div>` : ''}
                   </div>`
                : `<div class="poster">
                     <div class="no-poster">${posterEmoji}</div>
                     <div class="rating-badge">${project.rating || '—'}</div>
                     ${averageRating ? `<div class="average-rating-badge">⭐ ${averageRating}</div>` : ''}
                     ${userHasRated ? `<div class="user-rated-badge">✓ Оценено</div>` : ''}
                   </div>`;

            html += `
                <div class="card" onclick="openRatingModal('${project.id}')">
                    <button class="delete-card" onclick="event.stopPropagation(); window.deleteProject('${project.id}')" title="Удалить">✕</button>
                    ${posterHtml}
                    <div class="card-content">
                        <div class="card-title">${escapeHtml(project.title_ru || project.title)}</div>
                        <span class="card-type">${project.type || 'Фильм'}</span>
                        <div class="card-meta">
                            <span>📅 ${project.year || '—'}</span>
                            <span>👥 ${ratingCount} ${getRatingWord(ratingCount)}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        projectsGrid.innerHTML = html;
    }

    function getRatingWord(count) {
        if (count === 0) return 'оценок';
        if (count === 1) return 'оценка';
        if (count < 5) return 'оценки';
        return 'оценок';
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

    function showError(text) {
        errorMessageDiv.style.display = 'block';
        errorMessageDiv.textContent = '❌ ' + text;
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 3000);
    }

    function showSuccess(text) {
        successMessageDiv.style.display = 'block';
        successMessageDiv.textContent = '✅ ' + text;
        setTimeout(() => {
            successMessageDiv.style.display = 'none';
        }, 2000);
    }

    // ========== СЛУШАЕМ СОБЫТИЯ ==========
    window.addEventListener('ratingsUpdated', () => {
        loadAllRatings();
        loadUserRatings();
        loadWatchedProjects();
    });

    window.addEventListener('modeChanged', (event) => {
        if (event.detail.mode !== currentMode) {
            currentMode = event.detail.mode;
            selectedGroupId = event.detail.groupId;
            localStorage.setItem('ratings_mode', currentMode);
            if (selectedGroupId) localStorage.setItem('selected_group', selectedGroupId);
            setupModeToggle();
            loadAllRatings().then(() => loadWatchedProjects());
        }
    });

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    async function init() {
        await loadCurrentUser();
        await loadUserRatings();
        await loadAllRatings();
        await loadUserGroups();
        setupModeToggle();
        await loadWatchedProjects();

        setInterval(async () => {
            await loadAllRatings();
            await loadUserRatings();
            renderProjects();
        }, 30000);
    }

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

    init();
})();