(function () {
    const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    let myProjects = [];
    let currentFilter = 'all';
    let animeSources = [];

    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const projectsGrid = document.getElementById('projectsGrid');
    const statsDiv = document.getElementById('stats');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const filterButtons = document.querySelectorAll('.filter-btn');

    loadUnwatchedProjects();
    loadAnimeSources();

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

    async function loadAnimeSources() {
        try {
            const response = await fetch(`${API_URL}/api/anime/sources/list`);
            const data = await response.json();
            if (data.success) {
                animeSources = data.sources;
                console.log('✅ Загружены источники аниме:', animeSources);
            }
        } catch (error) {
            console.error('Ошибка загрузки источников аниме:', error);
        }
    }

    async function refreshProjectDetails(projectId) {
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/refresh`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Ошибка обновления');

            const data = await response.json();

            const index = myProjects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                myProjects[index] = data.project;
                renderProjects();

                const modal = document.querySelector('.project-modal.active');
                if (modal && modal.dataset.projectId === projectId) {
                    openModal(projectId);
                }
            }

            showSuccess('Данные проекта обновлены!');
        } catch (error) {
            showError('Ошибка обновления: ' + error.message);
        }
    }

    async function loadUnwatchedProjects() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            const allProjects = await response.json();
            myProjects = allProjects.filter(p => !p.watched);

            for (let project of myProjects) {
                if (!project.genres || !project.description || project.genres.length === 0) {
                    console.log(`Обновляю данные для: ${project.title_ru}`);
                    await refreshProjectDetails(project.id);
                }
            }

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
            notes: '',
            genres: film.genres || [],
            description: film.description || 'Описание будет добавлено позже',
            filmId: film.filmId
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

                const modal = document.querySelector('.project-modal.active');
                if (modal && modal.dataset.projectId === projectId) {
                    openModal(projectId);
                }
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

            const modal = document.querySelector('.project-modal.active');
            if (modal && modal.dataset.projectId === projectId) {
                closeModal();
            }

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
            closeModal();
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

    // ========== ФУНКЦИИ ДЛЯ АНИМЕ ==========

    async function loadAnimeEpisodes(animeId, source = 'animego') {
        try {
            console.log(`📺 Загружаю эпизоды для ${animeId} из ${source}`);
            
            const response = await fetch(`${API_URL}/api/anime/episodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anime_id: animeId,
                    source: source
                })
            });
            
            console.log('📡 Статус ответа эпизодов:', response.status);
            
            if (!response.ok) {
                console.error('❌ Ошибка ответа эпизодов:', response.status);
                return [];
            }
            
            const data = await response.json();
            console.log('✅ Получены эпизоды:', data);
            
            if (data.success) {
                return data.episodes || [];
            }
            return [];
        } catch (error) {
            console.error('❌ Ошибка загрузки эпизодов:', error);
            return [];
        }
    }

    async function loadAnimeSources(animeId, episode, source = 'animego') {
        try {
            console.log(`🔊 Загружаю озвучки для ${animeId}, эпизод ${episode} из ${source}`);
            
            const response = await fetch(`${API_URL}/api/anime/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anime_id: animeId,
                    episode: parseInt(episode) || 1,
                    source: source
                })
            });
            
            console.log('📡 Статус ответа озвучек:', response.status);
            
            if (!response.ok) {
                console.error('❌ Ошибка ответа озвучек:', response.status);
                return [];
            }
            
            const data = await response.json();
            console.log('✅ Получены озвучки:', data);
            
            if (data.success) {
                return data.sources || [];
            }
            return [];
        } catch (error) {
            console.error('❌ Ошибка загрузки озвучек:', error);
            return [];
        }
    }

    // ========== ФУНКЦИИ ДЛЯ RUTUBE ==========

    window.playOnRutube = async function (projectId, title, year, originalTitle) {
        const btn = document.getElementById(`rutube-btn-${projectId}`);
        const playerDiv = document.getElementById(`rutube-player-${projectId}`);

        if (!btn || !playerDiv) return;

        const originalText = btn.textContent;
        btn.textContent = '🔍 Ищем видео...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/search-rutube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    year: year,
                    original_title: originalTitle,
                    movie_id: projectId
                })
            });

            const data = await response.json();

            if (data.success) {
                btn.style.display = 'none';
                playerDiv.style.display = 'block';
                playerDiv.innerHTML = data.embed_code;
                showSuccess('Видео загружено!');
            } else {
                alert('Не удалось найти видео на Rutube. Попробуйте найти вручную.');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при поиске видео');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    // ========== МОДАЛЬНОЕ ОКНО ==========

    window.openModal = function (projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;

        const existingModal = document.querySelector('.project-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.classList.add('modal-open');

        const modal = document.createElement('div');
        modal.className = 'project-modal active';
        modal.dataset.projectId = project.id;

        let posterEmoji = '🎬';
        if (project.type === 'Аниме') posterEmoji = '🇯🇵';
        else if (project.type === 'Сериал') posterEmoji = '📺';
        else if (project.type === 'Мультфильм') posterEmoji = '🖍️';

        // Форматируем жанры
        let genresHtml = '';
        if (project.genres && project.genres.length > 0) {
            genresHtml = project.genres.map(g => {
                const genreName = typeof g === 'string' ? g : (g.genre || g);
                return `<span class="modal-genre-tag">${genreName}</span>`;
            }).join('');
        } else {
            genresHtml = '<span class="modal-genre-tag">Жанры будут добавлены</span>';
        }

        // Форматируем описание
        let description = project.description || 'Описание будет загружено позже...';
        if (description.length > 500) {
            description = description.substring(0, 500) + '...';
        }

        // Формируем секцию плеера в зависимости от типа
        let playerSection = '';
        
        if (project.type === 'Аниме') {
            playerSection = `
                <div class="modal-section">
                    <h3>🎬 Аниме плеер</h3>
                    <div class="anime-controls" id="anime-controls-${project.id}">
                        <div class="anime-selectors">
                            <select class="anime-source-select" id="anime-source-${project.id}">
                                <option value="animego">AnimeGO</option>
                                <option value="anilibria">AniLibria</option>
                                <option value="animevost">AnimeVost</option>
                            </select>
                            <select class="anime-episode-select" id="anime-episode-${project.id}">
                                <option value="1">Эпизод 1</option>
                            </select>
                            <select class="anime-dubber-select" id="anime-dubber-${project.id}" style="display: none;">
                                <option value="">Выберите озвучку</option>
                            </select>
                        </div>
                        <button class="anime-play-btn" onclick="loadAnimeAndPlay('${project.id}')">
                            ▶️ Загрузить эпизод
                        </button>
                    </div>
                    <div class="anime-player" id="anime-player-${project.id}">
                        <div class="anime-loading" style="display: none;">🔍 Загружаем видео...</div>
                    </div>
                </div>
            `;
        } else {
            playerSection = `
                <div class="modal-section">
                    <h3>🎬 Смотреть на Rutube</h3>
                    <div class="rutube-simple-container">
                        <button class="rutube-simple-btn" id="rutube-btn-${project.id}" 
                                onclick="playOnRutube('${project.id}', '${project.title_ru || project.title}', '${project.year}', '${project.title || ''}')">
                            ▶️ Смотреть на Rutube
                        </button>
                        <div class="rutube-player" id="rutube-player-${project.id}" style="display: none;"></div>
                    </div>
                </div>
            `;
        }

        modal.innerHTML = `
        <div class="modal-overlay" onclick="window.closeModal()"></div>
        <div class="modal-content">
            <button class="modal-close" onclick="window.closeModal()">✕</button>
            
            <div class="modal-layout">
                <div class="modal-left">
                    <div class="modal-poster">
                        ${project.poster
                ? `<img src="${project.poster}" alt="${project.title_ru || project.title}">`
                : `<div class="modal-no-poster">${posterEmoji}</div>`
            }
                    </div>
                    
                    <div class="modal-quick-info">
                        <div class="modal-rating-badge">
                            <span>⭐</span>
                            <span>${project.rating}</span>
                        </div>
                        <div class="modal-year-badge">
                            <span>📅</span>
                            <span>${project.year}</span>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="modal-action-btn delete" onclick="window.deleteProject('${project.id}'); window.closeModal()" title="Удалить">
                            <span class="btn-icon">🗑️</span>
                            <span class="btn-text">Удалить</span>
                        </button>
                        <button class="modal-action-btn progress ${project.inProgress ? 'active' : ''}" 
                                onclick="window.toggleInProgress('${project.id}')" 
                                title="${project.inProgress ? 'Убрать из процесса' : 'В процессе'}">
                            <span class="btn-icon">🔥</span>
                            <span class="btn-text">${project.inProgress ? 'В процессе' : 'В процесс'}</span>
                        </button>
                        <button class="modal-action-btn watched" 
                                onclick="window.markAsWatched('${project.id}'); window.closeModal()" 
                                title="Просмотрено">
                            <span class="btn-icon">✅</span>
                            <span class="btn-text">Просмотрено</span>
                        </button>
                        <button class="modal-action-btn refresh" 
                                onclick="window.refreshProjectDetails('${project.id}')" 
                                title="Обновить данные">
                            <span class="btn-icon">🔄</span>
                            <span class="btn-text">Обновить</span>
                        </button>
                    </div>
                </div>
                
                <div class="modal-right">
                    <h2 class="modal-title">${project.title_ru || project.title}</h2>
                    
                    <div class="modal-section">
                        <h3>Жанры</h3>
                        <div class="modal-genres">
                            ${genresHtml}
                        </div>
                    </div>
                    
                    <div class="modal-section">
                        <h3>Описание</h3>
                        <p class="modal-description">${description}</p>
                    </div>
                    
                    ${playerSection}
                </div>
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        // Если это аниме, загружаем эпизоды
        if (project.type === 'Аниме') {
            const animeId = project.id.replace('kp_', '');
            console.log('🎯 Открыто аниме с ID:', animeId);
            
            // Загружаем эпизоды сразу
            setTimeout(() => loadAnimeData(project.id, animeId), 100);
        }
    };

    window.closeModal = function () {
        const modal = document.querySelector('.project-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => {
                if (modal && modal.parentNode) {
                    modal.remove();
                }
            }, 300);
        }
    };

    // ========== ФУНКЦИИ ДЛЯ ЗАГРУЗКИ АНИМЕ ==========

    window.loadAnimeData = async function (projectId, animeId) {
        const sourceSelect = document.getElementById(`anime-source-${projectId}`);
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        
        if (!sourceSelect || !episodeSelect) {
            console.error('❌ Не найдены селекторы для аниме');
            return;
        }

        const source = sourceSelect.value;
        
        // Показываем загрузку
        episodeSelect.innerHTML = '<option value="">Загрузка...</option>';
        
        // Загружаем эпизоды
        const episodes = await loadAnimeEpisodes(animeId, source);
        
        if (episodes && episodes.length > 0) {
            episodeSelect.innerHTML = episodes.map((ep, i) => 
                `<option value="${i + 1}">${ep.title || `Эпизод ${i + 1}`}</option>`
            ).join('');
            
            console.log(`✅ Загружено ${episodes.length} эпизодов`);
        } else {
            episodeSelect.innerHTML = '<option value="1">Эпизод 1 (нет данных)</option>';
            showError('Не удалось загрузить список эпизодов');
        }
    };

    window.loadAnimeAndPlay = async function (projectId) {
        const animeId = projectId.replace('kp_', '');
        const sourceSelect = document.getElementById(`anime-source-${projectId}`);
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        const dubberSelect = document.getElementById(`anime-dubber-${projectId}`);
        const playerDiv = document.getElementById(`anime-player-${projectId}`);
        
        if (!sourceSelect || !episodeSelect || !playerDiv) {
            showError('Не найдены элементы плеера');
            return;
        }

        const source = sourceSelect.value;
        const episode = parseInt(episodeSelect.value) || 1;

        console.log(`▶️ Загружаем аниме ID: ${animeId}, эпизод: ${episode}, источник: ${source}`);

        // Показываем загрузку
        playerDiv.innerHTML = '<div class="anime-loading">🔍 Загружаем видео...</div>';

        // Получаем все доступные озвучки
        const sources = await loadAnimeSources(animeId, episode, source);

        if (sources && sources.length > 0) {
            console.log(`✅ Получено ${sources.length} озвучек`);
            
            // Показываем селектор озвучек
            if (dubberSelect) {
                dubberSelect.style.display = 'block';
                dubberSelect.innerHTML = sources.map((s, index) => 
                    `<option value="${index}">${s.dubber} (${s.videos.length} качеств)</option>`
                ).join('');

                // Добавляем обработчик смены озвучки
                dubberSelect.onchange = () => {
                    const selectedIndex = parseInt(dubberSelect.value);
                    const selectedSource = sources[selectedIndex];
                    if (selectedSource && selectedSource.videos.length > 0) {
                        const bestVideo = selectedSource.videos.sort((a, b) => b.quality - a.quality)[0];
                        updateVideoPlayer(playerDiv, bestVideo, selectedSource.dubber);
                    }
                };
            }

            // Автоматически запускаем первую озвучку
            const bestSource = sources[0];
            if (bestSource && bestSource.videos.length > 0) {
                const bestVideo = bestSource.videos.sort((a, b) => b.quality - a.quality)[0];
                updateVideoPlayer(playerDiv, bestVideo, bestSource.dubber);
            } else {
                playerDiv.innerHTML = '<div class="anime-error">❌ Нет доступных видео для этой озвучки</div>';
            }
        } else {
            playerDiv.innerHTML = '<div class="anime-error">❌ Не удалось загрузить видео</div>';
        }
    };

    function updateVideoPlayer(playerDiv, video, dubberName) {
        playerDiv.innerHTML = `
            <video controls width="100%" height="405" autoplay>
                <source src="${video.url}" type="${video.type === 'mp4' ? 'video/mp4' : 'application/x-mpegURL'}">
                Ваш браузер не поддерживает видео.
            </video>
            <div class="anime-info">
                <span class="anime-dubber">🎙️ ${dubberName}</span>
                <span class="anime-quality">📺 ${video.quality}p</span>
            </div>
        `;
    }

    // ========== ОТРИСОВКА КАРТОЧЕК ==========

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
                <div class="card ${project.inProgress ? 'in-progress' : ''}" data-project-id="${project.id}" onclick="openModal('${project.id}')">
                    <div class="card-buttons" onclick="event.stopPropagation()">
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
                        
                        <div class="type-selector" onclick="event.stopPropagation()">
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

    // ========== ПОИСК НА КИНОПОИСКЕ ==========

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

    window.deleteProject = deleteProject;
    window.toggleInProgress = toggleInProgress;
    window.markAsWatched = markAsWatched;
    window.changeProjectType = changeProjectType;
    window.refreshProjectDetails = refreshProjectDetails;
})();