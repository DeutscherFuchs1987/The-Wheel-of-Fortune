(function () {
    const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';
    const API_URL = 'https://DeutscherFuchs.pythonanywhere.com';

    let myProjects = [];
    let currentFilter = 'all';

    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const projectsGrid = document.getElementById('projectsGrid');
    const statsDiv = document.getElementById('stats');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const filterButtons = document.querySelectorAll('.filter-btn');

    loadUnwatchedProjects();

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProjects();
            updateStats();
        });
    });

    function showError(text) {
        console.error('Ошибка:', text);
        errorMessageDiv.style.display = 'block';
        errorMessageDiv.textContent = '❌ ' + text;
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 3000);
    }

    function showSuccess(text) {
        console.log('Успех:', text);
        successMessageDiv.style.display = 'block';
        successMessageDiv.textContent = '✅ ' + text;
        setTimeout(() => {
            successMessageDiv.style.display = 'none';
        }, 2000);
    }

    function detectTypeByGenres(film) {
        const genres = (film.genres || []).map(g => (g.genre || g).toLowerCase());
        if (genres.includes('аниме')) return 'Аниме';
        if (genres.includes('мультфильм') || genres.includes('анимация')) return 'Мультфильм';
        if (film.type === 'TV_SERIES' || film.type === 'MINI_SERIES') return 'Сериал';
        return 'Фильм';
    }

    async function loadUnwatchedProjects() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            const allProjects = await response.json();
            myProjects = allProjects.filter(p => !p.watched);
            renderProjects();
            updateStats();
        } catch (error) {
            showError('Не удалось загрузить проекты: ' + error.message);
        }
    }

    async function addProject(film) {
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
            ratings: { senya: null, vanya: null, pasha: null, volodya: null },
            notes: ''
        };

        try {
            const response = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (response.status === 409) {
                showError('Этот фильм уже есть в каталоге');
                return;
            }
            if (!response.ok) throw new Error(`Ошибка добавления: ${response.status}`);

            await loadUnwatchedProjects();
            showSuccess('Фильм добавлен!');
        } catch (error) {
            showError('Ошибка при добавлении: ' + error.message);
        }
    }

    async function updateProject(projectId, updates) {
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) throw new Error(`Ошибка обновления: ${response.status}`);

            const index = myProjects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                myProjects[index] = { ...myProjects[index], ...updates };
                renderProjects();
                updateStats();
            }
        } catch (error) {
            showError('Ошибка обновления: ' + error.message);
            throw error;
        }
    }

    async function deleteProject(projectId) {
        if (!confirm('Удалить проект?')) return;

        try {
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error(`Ошибка удаления: ${response.status}`);

            myProjects = myProjects.filter(p => p.id !== projectId);
            renderProjects();
            updateStats();
            showSuccess('Проект удалён');
        } catch (error) {
            showError('Ошибка удаления: ' + error.message);
        }
    }

    async function toggleInProgress(projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;
        await updateProject(projectId, { inProgress: !project.inProgress });
    }

    async function markAsWatched(projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;

        try {
            await updateProject(projectId, {
                watched: true,
                watchedDate: new Date().toISOString().split('T')[0]
            });

            myProjects = myProjects.filter(p => p.id !== projectId);
            renderProjects();
            updateStats();
            showSuccess('Фильм перемещён в просмотренное! ✨');
        } catch (error) {
            showError('Ошибка: ' + error.message);
        }
    }

    async function changeProjectType(projectId, newType) {
        await updateProject(projectId, { type: newType });
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

        statsDiv.textContent = statsText;
    }

    function getFilteredProjects() {
        if (currentFilter === 'all') return myProjects;
        return myProjects.filter(p => p.type === currentFilter);
    }

    function renderProjects() {
        const filtered = getFilteredProjects();

        if (filtered.length === 0) {
            let emptyMessage = 'Пока нет добавленных проектов';
            if (currentFilter !== 'all') {
                const filterName = Array.from(filterButtons).find(b => b.dataset.filter === currentFilter)?.textContent || '';
                emptyMessage = `В категории «${filterName}» пока нет проектов`;
            }

            projectsGrid.innerHTML = `
                        <div class="empty-state">
                            <span>🎬</span>
                            <p>${emptyMessage}</p>
                            <p style="font-size: 1rem; margin-top: 10px; color: #6b729b;">
                                Начните искать фильмы выше и добавляйте их в каталог
                            </p>
                        </div>
                    `;
            return;
        }

        const sorted = [...filtered].sort((a, b) => {
            if (a.inProgress && !b.inProgress) return -1;
            if (!a.inProgress && b.inProgress) return 1;
            return 0;
        });

        let html = '';
        sorted.forEach(project => {
            let posterEmoji = '🎬';
            if (project.type === 'Аниме') posterEmoji = '🇯🇵';
            else if (project.type === 'Сериал') posterEmoji = '📺';
            else if (project.type === 'Мультфильм') posterEmoji = '🖍️';

            const posterHtml = project.poster
                ? `<div class="poster" style="background-image: url('${project.poster}');">
                             ${project.rating !== '—' ? `<div class="rating-badge">${project.rating}</div>` : '<div class="rating-badge none">—</div>'}
                           </div>`
                : `<div class="poster">
                             <div class="no-poster">${posterEmoji}</div>
                             ${project.rating !== '—' ? `<div class="rating-badge">${project.rating}</div>` : '<div class="rating-badge none">—</div>'}
                           </div>`;

            html += `
                        <div class="card ${project.inProgress ? 'in-progress' : ''}" data-project-id="${project.id}">
                            <div class="card-buttons">
                                <button class="delete-card" onclick="window.deleteProject('${project.id}')" title="Удалить">✕</button>
                                <div style="display: flex; gap: 5px;">
                                    <button class="in-progress-btn ${project.inProgress ? 'active' : ''}" 
                                            onclick="window.toggleInProgress('${project.id}')" 
                                            title="${project.inProgress ? 'Убрать из процесса' : 'В процессе просмотра'}">
                                        🔥
                                    </button>
                                    <button class="watched-btn" 
                                            onclick="window.markAsWatched('${project.id}')" 
                                            title="Отметить просмотренным">
                                        ✅
                                    </button>
                                </div>
                            </div>
                            ${posterHtml}
                            <div class="card-content">
                                <div class="card-title">${project.title_ru || project.title}</div>
                                
                                <div class="type-selector">
                                    <button class="type-btn ${project.type === 'Фильм' ? 'active' : ''}" 
                                            onclick="window.changeProjectType('${project.id}', 'Фильм')" 
                                            title="Фильм">🎬</button>
                                    <button class="type-btn ${project.type === 'Сериал' ? 'active' : ''}" 
                                            onclick="window.changeProjectType('${project.id}', 'Сериал')" 
                                            title="Сериал">📺</button>
                                    <button class="type-btn ${project.type === 'Мультфильм' ? 'active' : ''}" 
                                            onclick="window.changeProjectType('${project.id}', 'Мультфильм')" 
                                            title="Мультфильм">🖍️</button>
                                    <button class="type-btn ${project.type === 'Аниме' ? 'active' : ''}" 
                                            onclick="window.changeProjectType('${project.id}', 'Аниме')" 
                                            title="Аниме">🇯🇵</button>
                                </div>
                                
                                <div class="card-meta">
                                    <span>📅 ${project.year}</span>
                                </div>
                                <div class="rating-details">
                                    <div class="rating-row">
                                        <span class="rating-label">Кинопоиск:</span>
                                        <span class="rating-value">${project.rating}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        });

        projectsGrid.innerHTML = html;
    }

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                searchResults.innerHTML = '<div class="loading" style="padding:20px; text-align:center;">🔍 Поиск на Кинопоиске...</div>';
                searchResults.classList.add('active');

                const response = await fetch(`https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`, {
                    headers: { 'X-API-KEY': KINOPOISK_TOKEN, 'Content-Type': 'application/json' }
                });

                if (!response.ok) throw new Error(`Ошибка ${response.status}`);

                const data = await response.json();

                if (!data.films || data.films.length === 0) {
                    searchResults.innerHTML = '<div style="padding:20px; text-align:center; color:#a3b7f0;">Ничего не найдено</div>';
                    return;
                }

                let resultsHtml = '';
                data.films.slice(0, 7).forEach(film => {
                    const type = detectTypeByGenres(film);
                    const posterUrl = film.posterUrlPreview || film.posterUrl;

                    resultsHtml += `
                                <div class="result-item" onclick="window.addMovieFromKinopoisk('${encodeURIComponent(JSON.stringify(film).replace(/'/g, "\\'"))}')">
                                    <div class="result-poster" style="background-image: url('${posterUrl || ''}'); background-size: cover; background-position: center;"></div>
                                    <div class="result-info">
                                        <div class="result-title">${film.nameRu || film.nameEn || 'Без названия'}</div>
                                        <div class="result-meta">
                                            <span>📅 ${film.year || '?'}</span>
                                            <span class="result-rating">⭐ ${film.rating || '—'}</span>
                                            <span class="result-type">${type}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                });

                searchResults.innerHTML = resultsHtml;

            } catch (error) {
                console.error('Ошибка поиска:', error);
                searchResults.innerHTML = `<div style="padding:20px; text-align:center; color:#ff8a8a;">Ошибка: ${error.message}</div>`;
            }
        }, 400);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });

    window.addMovieFromKinopoisk = function (encodedFilm) {
        try {
            const film = JSON.parse(decodeURIComponent(encodedFilm));
            addProject(film);
            searchResults.classList.remove('active');
            searchInput.value = '';
        } catch (e) {
            console.error('Ошибка парсинга фильма:', e);
            showError('Ошибка при добавлении');
        }
    };

    window.deleteProject = function (id) {
        deleteProject(id);
    };

    window.toggleInProgress = function (id) {
        toggleInProgress(id);
    };

    window.markAsWatched = function (id) {
        markAsWatched(id);
    };

    window.changeProjectType = function (id, newType) {
        changeProjectType(id, newType);
    };

})();