(function () {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    let myProjects = [];
    let currentFilter = 'all';
    let currentProject = null;
    let currentUser = null;
    let allUserRatings = {}; // { projectId: { username: { rating, notes } } }
    let userRatings = {}; // { projectId: { rating, notes } } для текущего пользователя
    let selectedGroupId = null;
    let currentMode = 'personal';

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

    // ========== ЗАГРУЗКА ВСЕХ ОЦЕНОК (для страницы оценок) ==========
    async function loadAllRatings() {
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/all-ratings`);
            if (response.ok) {
                allUserRatings = await response.json();
                console.log('⭐ Загружены оценки всех пользователей:', allUserRatings);
            } else {
                console.error('Ошибка загрузки оценок:', response.status);
            }
        } catch (error) {
            console.error('Ошибка загрузки оценок:', error);
        }
    }

    // ========== ЗАГРУЗКА ПРОСМОТРЕННЫХ ФИЛЬМОВ ==========
    async function loadWatchedProjects() {
        try {
            console.log('📡 Загружаем просмотренные фильмы...');

            let allProjects = [];

            // Пробуем загрузить из новой системы
            const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
            if (response.ok) {
                const projects = await response.json();
                allProjects = projects.filter(p => p.status === 'watched').map(p => ({
                    ...p.data,
                    id: p.project_id,
                    user_status: p.status
                }));
            } else if (response.status === 404) {
                // Fallback на старую систему
                const oldResponse = await fetch(`${API_URL}/projects`);
                if (oldResponse.ok) {
                    const oldProjects = await oldResponse.json();
                    allProjects = oldProjects.filter(p => p.watched === true);
                }
            }

            myProjects = allProjects;
            console.log(`✅ Загружено ${myProjects.length} просмотренных фильмов`);

            renderProjects();
            updateStats();

        } catch (error) {
            console.error('Ошибка загрузки:', error);
            showError('Ошибка загрузки: ' + error.message);
        }
    }

    // ========== УДАЛЕНИЕ ПРОЕКТА ==========
    const deleteProject = async function (projectId) {
        if (!confirm('Удалить проект из просмотренных?')) return;

        try {
            const response = await window.authFetch(`${API_URL}/api/user/projects/${projectId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'planned' })
            });

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

        // Получаем всех пользователей, которые оценили этот фильм
        const usersWithRatings = [];
        for (const [username, ratings] of Object.entries(allUserRatings)) {
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
            
            <div class="modal-notes">
                <label>📝 Общие заметки</label>
                <textarea id="modal-notes" rows="3" placeholder="Общие впечатления о фильме...">${project.notes || ''}</textarea>
            </div>
            
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
        // Перенаправляем на профиль для оценки
        window.location.href = `profile.html?rate=${projectId}`;
    };

    window.editMyRating = function (projectId) {
        window.location.href = `profile.html?edit=${projectId}`;
    };

    // ========== СТАТИСТИКА ==========
    function updateStats() {
        const total = myProjects.length;
        statsDiv.textContent = `📊 Всего оценённых фильмов: ${total}`;
    }

    // ========== ФИЛЬТРАЦИЯ ==========
    function getFilteredProjects() {
        if (currentFilter === 'all') return myProjects;
        return myProjects.filter(p => p.type === currentFilter);
    }

    // ========== ОТРИСОВКА КАРТОЧЕК ==========
    function renderProjects() {
        const filtered = getFilteredProjects();

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <span>⭐</span>
                    <p>Пока нет просмотренных фильмов</p>
                    <p style="font-size: 1rem; margin-top: 10px; color: #6b729b;">
                        Отмечайте фильмы галочкой ✅ в каталоге, а затем оценивайте их в профиле
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

            // Считаем среднюю оценку
            let totalRating = 0;
            let ratingCount = 0;
            for (const [username, ratings] of Object.entries(allUserRatings)) {
                if (ratings[project.id] && ratings[project.id].rating) {
                    totalRating += ratings[project.id].rating;
                    ratingCount++;
                }
            }
            const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;
            const userHasRated = userRatings[project.id] !== undefined;

            const posterHtml = project.poster
                ? `<div class="poster" style="background-image: url('${project.poster}');">
                     <div class="rating-badge">${project.rating}</div>
                     ${averageRating ? `<div class="average-rating-badge">⭐ ${averageRating}</div>` : ''}
                     ${userHasRated ? `<div class="user-rated-badge">✓ Оценено</div>` : ''}
                   </div>`
                : `<div class="poster">
                     <div class="no-poster">${posterEmoji}</div>
                     <div class="rating-badge">${project.rating}</div>
                     ${averageRating ? `<div class="average-rating-badge">⭐ ${averageRating}</div>` : ''}
                     ${userHasRated ? `<div class="user-rated-badge">✓ Оценено</div>` : ''}
                   </div>`;

            html += `
                <div class="card" onclick="openRatingModal('${project.id}')">
                    <button class="delete-card" onclick="event.stopPropagation(); window.deleteProject('${project.id}')" title="Удалить">✕</button>
                    ${posterHtml}
                    <div class="card-content">
                        <div class="card-title">${escapeHtml(project.title_ru || project.title)}</div>
                        <span class="card-type">${project.type}</span>
                        <div class="card-meta">
                            <span>📅 ${project.year}</span>
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

    // ========== СЛУШАЕМ СОБЫТИЯ ОБНОВЛЕНИЯ ==========
    window.addEventListener('ratingsUpdated', () => {
        loadAllRatings();
        loadUserRatings();
        renderProjects();
    });

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    async function init() {
        await loadCurrentUser();
        await loadUserRatings();
        await loadAllRatings();
        await loadWatchedProjects();

        // Обновляем оценки каждые 30 секунд
        setInterval(async () => {
            await loadAllRatings();
            await loadUserRatings();
            renderProjects();
        }, 30000);
    }

    // ========== ФИЛЬТРЫ ==========
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProjects();
            updateStats();
        });
    });

    init();
})();