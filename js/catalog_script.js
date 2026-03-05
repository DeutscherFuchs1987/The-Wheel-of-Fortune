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

    // Загружаем данные при старте
    loadUnwatchedProjects();
    loadAnimeSources();

    // Фильтры
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProjects();
            updateStats();
        });
    });

    // ========== УТИЛИТЫ ==========

    function showError(text) {
        console.error('❌ Ошибка:', text);
        errorMessageDiv.style.display = 'block';
        errorMessageDiv.textContent = '❌ ' + text;
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 3000);
    }

    function showSuccess(text) {
        console.log('✅ Успех:', text);
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

    // ========== ЗАГРУЗКА ДАННЫХ ==========

    async function loadAnimeSources() {
        try {
            const response = await fetch(`${API_URL}/api/anime/sources/list`);
            const data = await response.json();
            if (data.success) {
                animeSources = data.sources;
                console.log('✅ Загружены источники аниме:', animeSources);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки источников аниме:', error);
        }
    }

    async function loadUnwatchedProjects() {
        try {
            console.log('📡 Загружаем проекты с сервера...');
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);

            const allProjects = await response.json();
            console.log(`✅ Загружено ${allProjects.length} проектов`);

            myProjects = allProjects.filter(p => !p.watched);
            console.log(`📊 Непросмотренных: ${myProjects.length}`);

            renderProjects();
            updateStats();
        } catch (error) {
            showError('Не удалось загрузить проекты: ' + error.message);
        }
    }

    // ========== РАБОТА С ПРОЕКТАМИ ==========

    async function refreshProjectDetails(projectId) {
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/refresh`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Ошибка обновления');

            const index = myProjects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                const updatedResponse = await fetch(`${API_URL}/projects`);
                const allProjects = await updatedResponse.json();
                myProjects = allProjects.filter(p => !p.watched);
            }

            renderProjects();

            const modal = document.querySelector('.project-modal.active');
            if (modal && modal.dataset.projectId === projectId) {
                openModal(projectId);
            }

            showSuccess('Данные проекта обновлены!');
        } catch (error) {
            showError('Ошибка обновления: ' + error.message);
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

    // ========== СТАТИСТИКА ==========

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
                    original_title: originalTitle
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
        if (existingModal) existingModal.remove();

        document.body.classList.add('modal-open');

        const modal = document.createElement('div');
        modal.className = 'project-modal active';
        modal.dataset.projectId = project.id;

        let posterEmoji = '🎬';
        if (project.type === 'Аниме') posterEmoji = '🇯🇵';
        else if (project.type === 'Сериал') posterEmoji = '📺';
        else if (project.type === 'Мультфильм') posterEmoji = '🖍️';

        let genresHtml = project.genres?.length 
            ? project.genres.map(g => `<span class="modal-genre-tag">${typeof g === 'string' ? g : (g.genre || g)}</span>`).join('')
            : '<span class="modal-genre-tag">Жанры будут добавлены</span>';

        let description = project.description || 'Описание будет загружено позже...';
        if (description.length > 500) description = description.substring(0, 500) + '...';

        let playerSection = project.type === 'Аниме'
            ? `
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
                                <option value="1">Нажмите "Найти аниме"</option>
                            </select>
                            <select class="anime-dubber-select" id="anime-dubber-${project.id}" style="display: none;">
                                <option value="">Выберите озвучку</option>
                            </select>
                        </div>
                        <button class="anime-play-btn" onclick="window.findAnimeByTitle('${project.id}', '${(project.title_ru || project.title).replace(/'/g, "\\'")}')">
                            🔍 Найти аниме
                        </button>
                        <button class="anime-play-btn" onclick="window.loadAnimeAndPlay('${project.id}')" style="margin-top: 10px;">
                            ▶️ Загрузить эпизод
                        </button>
                    </div>
                    <div class="anime-player" id="anime-player-${project.id}">
                        <div class="anime-loading" style="display: none;">🔍 Загружаем видео...</div>
                    </div>
                </div>
            `
            : `
                <div class="modal-section">
                    <h3>🎬 Смотреть на Rutube</h3>
                    <div class="rutube-simple-container">
                        <button class="rutube-simple-btn" id="rutube-btn-${project.id}" 
                                onclick="window.playOnRutube('${project.id}', '${(project.title_ru || project.title).replace(/'/g, "\\'")}', '${project.year}', '${(project.title || '').replace(/'/g, "\\'")}')">
                            ▶️ Смотреть на Rutube
                        </button>
                        <div class="rutube-player" id="rutube-player-${project.id}" style="display: none;"></div>
                    </div>
                </div>
            `;

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
                            <div class="modal-rating-badge"><span>⭐</span><span>${project.rating}</span></div>
                            <div class="modal-year-badge"><span>📅</span><span>${project.year}</span></div>
                        </div>
                        <div class="modal-actions">
                            <button class="modal-action-btn delete" onclick="window.deleteProject('${project.id}'); window.closeModal()" title="Удалить"><span class="btn-icon">🗑️</span><span class="btn-text">Удалить</span></button>
                            <button class="modal-action-btn progress ${project.inProgress ? 'active' : ''}" onclick="window.toggleInProgress('${project.id}')" title="${project.inProgress ? 'Убрать из процесса' : 'В процессе'}"><span class="btn-icon">🔥</span><span class="btn-text">${project.inProgress ? 'В процессе' : 'В процесс'}</span></button>
                            <button class="modal-action-btn watched" onclick="window.markAsWatched('${project.id}'); window.closeModal()" title="Просмотрено"><span class="btn-icon">✅</span><span class="btn-text">Просмотрено</span></button>
                            <button class="modal-action-btn refresh" onclick="window.refreshProjectDetails('${project.id}')" title="Обновить данные"><span class="btn-icon">🔄</span><span class="btn-text">Обновить</span></button>
                        </div>
                    </div>
                    <div class="modal-right">
                        <h2 class="modal-title">${project.title_ru || project.title}</h2>
                        <div class="modal-section"><h3>Жанры</h3><div class="modal-genres">${genresHtml}</div></div>
                        <div class="modal-section"><h3>Описание</h3><p class="modal-description">${description}</p></div>
                        ${playerSection}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    };

    window.closeModal = function () {
        const modal = document.querySelector('.project-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            setTimeout(() => modal.remove(), 300);
        }
    };

    // ========== НОВЫЕ ФУНКЦИИ ДЛЯ АНИМЕ (С УЧЕТОМ ИЗМЕНЕНИЙ В СЕРВЕРЕ) ==========

    /**
     * Поиск аниме по названию и загрузка эпизодов
     * @param {string} projectId - ID проекта
     * @param {string} animeTitle - Название аниме (с Кинопоиска)
     */
    window.findAnimeByTitle = async function (projectId, animeTitle) {
        const sourceSelect = document.getElementById(`anime-source-${projectId}`);
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        
        if (!sourceSelect || !episodeSelect) {
            showError('Элементы плеера не найдены');
            return;
        }

        const source = sourceSelect.value;
        
        // Показываем загрузку
        episodeSelect.innerHTML = '<option value="">🔍 Поиск...</option>';
        episodeSelect.disabled = true;

        try {
            console.log(`🔍 ИЩУ АНИМЕ ПО НАЗВАНИЮ: "${animeTitle}" в источнике ${source}`);

            // ШАГ 1: Получаем эпизоды по названию (сервер сам найдёт аниме)
            const episodesResponse = await fetch(`${API_URL}/api/anime/episodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anime_title: animeTitle,  // ВАЖНО: передаём название!
                    source: source
                })
            });

            if (!episodesResponse.ok) {
                throw new Error(`Ошибка сервера: ${episodesResponse.status}`);
            }

            const episodesData = await episodesResponse.json();
            console.log('📺 Ответ от сервера:', episodesData);

            if (!episodesData.success) {
                throw new Error(episodesData.error || 'Не удалось загрузить эпизоды');
            }

            // Сохраняем информацию об аниме
            if (episodesData.anime_found_title) {
                episodeSelect.dataset.animeFoundTitle = episodesData.anime_found_title;
            }

            // Заполняем селектор эпизодов
            if (episodesData.episodes && episodesData.episodes.length > 0) {
                episodeSelect.innerHTML = episodesData.episodes.map((ep, i) => 
                    `<option value="${i + 1}">${ep.title || `Эпизод ${i + 1}`}</option>`
                ).join('');
                episodeSelect.disabled = false;
                
                showSuccess(`Найдено ${episodesData.episodes.length} эпизодов`);
                console.log(`✅ Загружено ${episodesData.episodes.length} эпизодов для "${episodesData.anime_found_title || animeTitle}"`);
            } else {
                throw new Error('У аниме нет эпизодов');
            }

        } catch (error) {
            console.error('❌ Ошибка:', error);
            episodeSelect.innerHTML = '<option value="1">❌ ' + error.message + '</option>';
            showError(error.message);
        }
    };

    /**
     * Загрузка и воспроизведение эпизода
     * @param {string} projectId - ID проекта
     */
    window.loadAnimeAndPlay = async function (projectId) {
        const sourceSelect = document.getElementById(`anime-source-${projectId}`);
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        const dubberSelect = document.getElementById(`anime-dubber-${projectId}`);
        const playerDiv = document.getElementById(`anime-player-${projectId}`);
        const animeTitle = episodeSelect?.dataset?.animeFoundTitle || 
                          document.querySelector('.modal-title')?.textContent;

        if (!sourceSelect || !episodeSelect || !playerDiv) {
            showError('Элементы плеера не найдены');
            return;
        }

        if (!animeTitle) {
            showError('Сначала нажмите "Найти аниме"');
            return;
        }

        const source = sourceSelect.value;
        const episode = parseInt(episodeSelect.value) || 1;

        playerDiv.innerHTML = '<div class="anime-loading">🔍 Загружаем видео...</div>';

        try {
            console.log(`▶️ Загружаю эпизод ${episode} для "${animeTitle}" из ${source}`);

            // ШАГ 2: Получаем озвучки по названию
            const sourcesResponse = await fetch(`${API_URL}/api/anime/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anime_title: animeTitle,  // ВАЖНО: передаём название!
                    episode: episode,
                    source: source
                })
            });

            if (!sourcesResponse.ok) {
                throw new Error(`Ошибка сервера: ${sourcesResponse.status}`);
            }

            const sourcesData = await sourcesResponse.json();
            console.log('🔊 Озвучки:', sourcesData);

            if (!sourcesData.success || !sourcesData.sources?.length) {
                throw new Error(sourcesData.error || 'Нет доступных озвучек');
            }

            const sources = sourcesData.sources;
            console.log(`✅ Получено ${sources.length} озвучек`);

            // Показываем селектор озвучек
            if (dubberSelect) {
                dubberSelect.style.display = 'block';
                dubberSelect.innerHTML = sources.map((s, i) => 
                    `<option value="${i}">${s.dubber} (${s.videos.length} качеств)</option>`
                ).join('');
                dubberSelect.disabled = false;

                dubberSelect.onchange = () => {
                    const idx = parseInt(dubberSelect.value);
                    const source = sources[idx];
                    const bestVideo = source.videos.sort((a, b) => 
                        (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0)
                    )[0];
                    if (bestVideo) {
                        updateVideoPlayer(playerDiv, bestVideo, source.dubber);
                    }
                };
            }

            // Автоматически запускаем первую озвучку
            const bestSource = sources[0];
            const bestVideo = bestSource.videos.sort((a, b) => 
                (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0)
            )[0];
            
            if (bestVideo) {
                updateVideoPlayer(playerDiv, bestVideo, bestSource.dubber);
                showSuccess(`Запущено: ${bestSource.dubber}`);
            }

        } catch (error) {
            console.error('❌ Ошибка:', error);
            playerDiv.innerHTML = `<div class="anime-error">❌ ${error.message}</div>`;
            showError(error.message);
        }
    };

    /**
     * Обновление видеоплеера
     */
    function updateVideoPlayer(playerDiv, video, dubberName) {
        const isHLS = video.type === 'application/x-mpegURL' || video.url?.includes('.m3u8');
        
        playerDiv.innerHTML = `
            ${isHLS 
                ? `<video controls width="100%" height="405" autoplay>
                     <source src="${video.url}" type="application/x-mpegURL">
                     Ваш браузер не поддерживает HLS видео.
                   </video>
                   <script>
                       if (Hls.isSupported()) {
                           var video = document.querySelector('video');
                           var hls = new Hls();
                           hls.loadSource('${video.url}');
                           hls.attachMedia(video);
                       }
                   <\/script>`
                : `<video controls width="100%" height="405" autoplay>
                     <source src="${video.url}" type="video/mp4">
                   </video>`
            }
            <div class="anime-info">
                <span class="anime-dubber">🎙️ ${dubberName}</span>
                <span class="anime-quality">📺 ${video.quality}p</span>
            </div>
        `;
    }

    /**
     * Отладочная функция для проверки поиска
     */
    window.debugAnimeSearch = async function (title) {
        console.log(`🔍 ОТЛАДКА ПОИСКА: "${title}"`);
        
        const sources = ['animego', 'anilibria', 'animevost'];
        
        for (const source of sources) {
            console.log(`\n📌 ИСТОЧНИК: ${source}`);
            
            try {
                const response = await fetch(`${API_URL}/api/anime/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title,
                        source: source,
                        limit: 5
                    })
                });
                
                const data = await response.json();
                
                if (data.success && data.anime) {
                    console.log(`Найдено ${data.anime.length} результатов:`);
                    data.anime.forEach((a, i) => {
                        console.log(`  ${i+1}. "${a.title}" (ID: ${a.id}, эпизодов: ${a.episodes_count})`);
                    });
                } else {
                    console.log('❌ Нет результатов');
                }
            } catch (e) {
                console.error(`Ошибка в ${source}:`, e);
            }
        }
    };

    // ========== ОТРИСОВКА КАРТОЧЕК ==========

    function renderProjects() {
        const filtered = getFilteredProjects();

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <span>🎬</span>
                    <p>${currentFilter === 'all' ? 'Пока нет добавленных проектов' : `В категории нет проектов`}</p>
                </div>
            `;
            return;
        }

        const sorted = [...filtered].sort((a, b) => (a.inProgress === b.inProgress) ? 0 : a.inProgress ? -1 : 1);

        projectsGrid.innerHTML = sorted.map(project => {
            const posterEmoji = project.type === 'Аниме' ? '🇯🇵' : project.type === 'Сериал' ? '📺' : project.type === 'Мультфильм' ? '🖍️' : '🎬';
            
            return `
                <div class="card ${project.inProgress ? 'in-progress' : ''}" data-project-id="${project.id}" onclick="window.openModal('${project.id}')">
                    <div class="card-buttons" onclick="event.stopPropagation()">
                        <button class="delete-card" onclick="window.deleteProject('${project.id}')">✕</button>
                        <div style="display: flex; gap: 5px;">
                            <button class="in-progress-btn ${project.inProgress ? 'active' : ''}" onclick="window.toggleInProgress('${project.id}')">🔥</button>
                            <button class="watched-btn" onclick="window.markAsWatched('${project.id}')">✅</button>
                        </div>
                    </div>
                    ${project.poster
                ? `<div class="poster" style="background-image: url('${project.poster}');"><div class="rating-badge ${project.rating === '—' ? 'none' : ''}">${project.rating}</div></div>`
                : `<div class="poster"><div class="no-poster">${posterEmoji}</div><div class="rating-badge ${project.rating === '—' ? 'none' : ''}">${project.rating}</div></div>`
            }
                    <div class="card-content">
                        <div class="card-title">${project.title_ru || project.title}</div>
                        <div class="type-selector" onclick="event.stopPropagation()">
                            <button class="type-btn ${project.type === 'Фильм' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Фильм')">🎬</button>
                            <button class="type-btn ${project.type === 'Сериал' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Сериал')">📺</button>
                            <button class="type-btn ${project.type === 'Мультфильм' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Мультфильм')">🖍️</button>
                            <button class="type-btn ${project.type === 'Аниме' ? 'active' : ''}" onclick="window.changeProjectType('${project.id}', 'Аниме')">🇯🇵</button>
                        </div>
                        <div class="card-meta"><span>📅 ${project.year}</span></div>
                    </div>
                </div>
            `;
        }).join('');
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
                searchResults.innerHTML = '<div class="loading">🔍 Поиск на Кинопоиске...</div>';
                searchResults.classList.add('active');

                const response = await fetch(`https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`, {
                    headers: { 'X-API-KEY': KINOPOISK_TOKEN }
                });

                if (!response.ok) throw new Error(`Ошибка ${response.status}`);

                const data = await response.json();

                if (!data.films?.length) {
                    searchResults.innerHTML = '<div style="padding:20px; text-align:center;">Ничего не найдено</div>';
                    return;
                }

                searchResults.innerHTML = data.films.slice(0, 7).map(film => {
                    const type = detectTypeByGenres(film);
                    const poster = film.posterUrlPreview || film.posterUrl;
                    
                    return `
                        <div class="result-item" onclick="window.addMovieFromKinopoisk('${encodeURIComponent(JSON.stringify(film).replace(/'/g, "\\'"))}')">
                            <div class="result-poster" style="background-image: url('${poster || ''}');"></div>
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
                }).join('');

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

    // Экспортируем функции в глобальную область
    window.deleteProject = deleteProject;
    window.toggleInProgress = toggleInProgress;
    window.markAsWatched = markAsWatched;
    window.changeProjectType = changeProjectType;
    window.refreshProjectDetails = refreshProjectDetails;
    window.playOnRutube = playOnRutube;
    // findAnimeByTitle уже экспортируется через window в определении
})();