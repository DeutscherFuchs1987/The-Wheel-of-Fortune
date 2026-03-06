(function () {
    const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    let myProjects = [];
    let currentFilter = 'all';
    let animeCache = new Map(); // Кэш для данных аниме

    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const projectsGrid = document.getElementById('projectsGrid');
    const statsDiv = document.getElementById('stats');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Загружаем данные при старте
    loadUnwatchedProjects();

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

    // ========== ФУНКЦИОНАЛ ДЛЯ АНИМЕ (АДАПТИРОВАН ПОД anime-parsers-ru) ==========

    /**
     * Форматирование названия сезона
     */
    function formatSeasonName(seasonNumber) {
        if (seasonNumber === 1) return '1-й сезон';
        if (seasonNumber === 2) return '2-й сезон';
        if (seasonNumber === 3) return '3-й сезон';
        if (seasonNumber === 4) return '4-й сезон';
        return `${seasonNumber}-й сезон`;
    }

    /**
     * Форматирование названия эпизода
     */
    function formatEpisodeName(episodeNumber) {
        return `Серия ${episodeNumber}`;
    }

    /**
     * Автоматическая загрузка информации об аниме через новый API
     */
    async function loadAnimeInfo(projectId, animeTitle) {
        const loadingEl = document.getElementById(`anime-loading-${projectId}`);
        const selectorsEl = document.getElementById(`anime-selectors-${projectId}`);
        const sourceSelect = document.getElementById(`anime-source-${projectId}`);
        const seasonSelect = document.getElementById(`anime-season-${projectId}`);
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        const playerDiv = document.getElementById(`anime-player-${projectId}`);

        if (!loadingEl || !selectorsEl) return;

        try {
            console.log(`🔍 Поиск аниме: "${animeTitle}"`);

            loadingEl.style.display = 'block';
            selectorsEl.style.display = 'none';
            
            if (playerDiv) {
                playerDiv.innerHTML = '';
            }

            const cacheKey = `search_${animeTitle}`;
            
            // Проверяем кэш
            let animeData = animeCache.get(cacheKey);

            if (!animeData) {
                // ШАГ 1: Поиск аниме через новый эндпоинт
                const searchResponse = await fetch(`${API_URL}/api/anime/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: animeTitle
                    })
                });

                if (!searchResponse.ok) {
                    throw new Error(`Ошибка поиска: ${searchResponse.status}`);
                }

                const searchData = await searchResponse.json();
                console.log('📺 Результаты поиска:', searchData);

                if (!searchData.success || !searchData.anime?.length) {
                    throw new Error('Аниме не найдено');
                }

                const foundAnime = searchData.anime[0];
                
                animeData = {
                    id: foundAnime.id,
                    title: foundAnime.title,
                    title_ru: foundAnime.title_ru || foundAnime.title,
                    poster: foundAnime.poster,
                    year: foundAnime.year,
                    genres: foundAnime.genres || [],
                    description: foundAnime.description || '',
                    episodes_count: foundAnime.episodes_count || 0
                };

                // Получаем информацию о переводах (озвучках)
                if (foundAnime.id) {
                    try {
                        const infoResponse = await fetch(`${API_URL}/api/anime/info`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                anime_id: foundAnime.id,
                                id_type: 'shikimori'
                            })
                        });
                        
                        if (infoResponse.ok) {
                            const infoData = await infoResponse.json();
                            if (infoData.success && infoData.translations) {
                                animeData.translations = infoData.translations;
                            }
                        }
                    } catch (e) {
                        console.warn('Не удалось загрузить информацию о переводах');
                    }
                }

                animeCache.set(cacheKey, animeData);
            }

            // Показываем русское название
            if (animeData.title_ru && animeData.title_ru !== animeTitle) {
                const modalTitle = document.querySelector('.modal-title');
                if (modalTitle) {
                    modalTitle.innerHTML = `${modalTitle.innerHTML}<br><small style="font-size: 0.8rem; color: #aaa;">${animeData.title_ru}</small>`;
                }
            }

            // Заполняем информацию о количестве эпизодов
            if (animeData.episodes_count > 0) {
                // Создаем виртуальный список эпизодов
                const episodes = [];
                for (let i = 1; i <= animeData.episodes_count; i++) {
                    episodes.push({
                        episode: i,
                        number: i
                    });
                }
                
                // Группируем по сезонам (условно по 12-13 эпизодов)
                const seasons = [];
                const episodesPerSeason = 12;
                const seasonCount = Math.ceil(episodes.length / episodesPerSeason);
                
                for (let s = 1; s <= seasonCount; s++) {
                    const start = (s - 1) * episodesPerSeason;
                    const end = Math.min(start + episodesPerSeason, episodes.length);
                    const seasonEpisodes = episodes.slice(start, end);
                    
                    seasons.push({
                        number: s,
                        episodes: seasonEpisodes
                    });
                }
                
                animeData.seasons = seasons;
            }

            // Заполняем сезоны
            if (animeData.seasons?.length > 0) {
                seasonSelect.style.display = 'block';
                seasonSelect.innerHTML = '<option value="">Выберите сезон</option>';

                animeData.seasons.forEach((season, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = formatSeasonName(season.number);
                    option.dataset.seasonNumber = season.number;
                    option.dataset.episodes = JSON.stringify(season.episodes);
                    seasonSelect.appendChild(option);
                });

                seasonSelect.value = '0';
                await loadSeasonEpisodes(projectId, animeData.seasons[0], animeData.id);
            } else {
                seasonSelect.style.display = 'none';
                episodeSelect.innerHTML = '<option value="">Нет доступных эпизодов</option>';
                episodeSelect.disabled = true;
            }

            loadingEl.style.display = 'none';
            selectorsEl.style.display = 'block';

        } catch (error) {
            console.error('❌ Ошибка загрузки аниме:', error);
            loadingEl.innerHTML = `
                <div class="anime-error">
                    ❌ ${error.message}<br>
                    <button class="retry-btn" onclick="window.loadAnimeInfo('${projectId}', '${animeTitle.replace(/'/g, "\\'")}')">
                        🔄 Повторить
                    </button>
                </div>
            `;
        }
    }

    /**
     * Загрузка эпизодов для выбранного сезона
     */
    async function loadSeasonEpisodes(projectId, season, animeId) {
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        const dubberSelect = document.getElementById(`anime-dubber-${projectId}`);

        if (!episodeSelect) return;

        if (!season?.episodes?.length) {
            episodeSelect.innerHTML = '<option value="">Нет эпизодов</option>';
            episodeSelect.disabled = true;
            return;
        }

        // Сохраняем ID аниме для загрузки видео
        if (animeId) {
            episodeSelect.dataset.animeId = animeId;
        }

        episodeSelect.innerHTML = season.episodes.map((ep, index) => {
            return `<option value="${ep.episode}" data-episode='${JSON.stringify(ep)}'>${formatEpisodeName(ep.episode)}</option>`;
        }).join('');

        episodeSelect.disabled = false;

        if (dubberSelect) {
            dubberSelect.style.display = 'none';
        }

        setTimeout(() => {
            loadAnimeEpisode(projectId);
        }, 100);
    }

    /**
     * Загрузка и воспроизведение эпизода через новый API
     */
    window.loadAnimeEpisode = async function (projectId) {
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);
        const dubberSelect = document.getElementById(`anime-dubber-${projectId}`);
        const playerDiv = document.getElementById(`anime-player-${projectId}`);
        const modalTitle = document.querySelector('.modal-title');

        if (!episodeSelect || !playerDiv) {
            showError('Элементы плеера не найдены');
            return;
        }

        const selectedOption = episodeSelect.options[episodeSelect.selectedIndex];
        
        if (!selectedOption) {
            showError('Выберите эпизод');
            return;
        }

        const episodeNumber = parseInt(selectedOption.value);
        const animeId = episodeSelect.dataset.animeId;

        playerDiv.innerHTML = '<div class="anime-loading">🔍 Загружаем видео...</div>';

        try {
            let animeTitle = modalTitle?.childNodes[0]?.textContent?.trim() || '';

            if (!animeTitle) {
                throw new Error('Не удалось определить название аниме');
            }

            console.log(`▶️ Загружаю эпизод ${episodeNumber} для "${animeTitle}"`);

            // Получаем ссылку на видео через новый эндпоинт
            const linkResponse = await fetch(`${API_URL}/api/anime/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anime_id: animeId,
                    id_type: 'shikimori',
                    episode: episodeNumber,
                    translation_id: dubberSelect?.value || '0'
                })
            });

            if (!linkResponse.ok) {
                throw new Error(`Ошибка сервера: ${linkResponse.status}`);
            }

            const linkData = await linkResponse.json();
            console.log('🔗 Ссылка на видео:', linkData);

            if (!linkData.success || !linkData.url) {
                throw new Error(linkData.error || 'Не удалось получить ссылку на видео');
            }

            // Создаем виртуальный объект видео
            const video = {
                url: linkData.url,
                quality: linkData.quality || 'HD',
                type: 'video/mp4'
            };

            const dubberName = 'Озвучка';

            // Селектор озвучек (если есть информация о переводах)
            if (dubberSelect && linkData.translation_id) {
                dubberSelect.style.display = 'block';
                // Здесь можно добавить загрузку списка переводов через /api/anime/translations
            }

            // Запускаем видео через прокси
            playVideoWithProxy(playerDiv, video, dubberName);
            showSuccess(`Запущено видео (${video.quality}p)`);

        } catch (error) {
            console.error('❌ Ошибка:', error);
            playerDiv.innerHTML = `<div class="anime-error">❌ ${error.message}</div>`;
            showError(error.message);
        }
    };

    /**
     * Воспроизведение видео через прокси
     */
    function playVideoWithProxy(playerDiv, video, dubberName) {
        const originalUrl = video.url || video;
        const quality = video.quality || 'HD';
        const videoId = 'video_' + Math.random().toString(36).substr(2, 9);
        
        // Используем прокси для обхода CORS
        const proxyUrl = `${API_URL}/api/proxy/video?url=${encodeURIComponent(originalUrl)}`;
        
        const isHLS = video.type === 'application/x-mpegURL' || 
                      originalUrl.includes('.m3u8') || 
                      originalUrl.includes('hls');

        let playerHtml = '';

        if (isHLS) {
            playerHtml = `
                <div class="hls-player-container">
                    <video id="${videoId}" class="anime-video-player" controls width="100%" height="405" autoplay playsinline></video>
                </div>
                <script>
                    (function() {
                        var video = document.getElementById('${videoId}');
                        var proxyUrl = '${proxyUrl}';
                        
                        if (Hls.isSupported()) {
                            var hls = new Hls({
                                maxBufferLength: 30,
                                maxMaxBufferLength: 60,
                                enableWorker: true,
                                debug: false
                            });
                            
                            hls.loadSource(proxyUrl);
                            hls.attachMedia(video);
                            
                            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                                video.play().catch(e => console.log('Автовоспроизведение заблокировано'));
                            });
                            
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = proxyUrl;
                            video.addEventListener('loadedmetadata', function() {
                                video.play().catch(e => console.log('Автовоспроизведение заблокировано'));
                            });
                        }
                    })();
                <\/script>
            `;
        } else {
            playerHtml = `
                <video id="${videoId}" class="anime-video-player" controls width="100%" height="405" autoplay playsinline>
                    <source src="${proxyUrl}" type="video/mp4">
                    Ваш браузер не поддерживает видео.
                </video>
                <script>
                    document.getElementById('${videoId}').play().catch(e => console.log('Автовоспроизведение заблокировано'));
                <\/script>
            `;
        }

        playerDiv.innerHTML = `
            ${playerHtml}
            <div class="anime-info">
                <span class="anime-dubber">🎙️ ${dubberName}</span>
                <span class="anime-quality">📺 ${quality}p</span>
            </div>
        `;

        // Добавляем обработчик ошибок
        const videoElement = document.getElementById(videoId);
        if (videoElement) {
            videoElement.addEventListener('error', (e) => {
                console.error('❌ Ошибка видео:', e);
                playerDiv.innerHTML = `
                    <div class="anime-error">
                        ❌ Не удалось загрузить видео<br>
                        <button class="retry-btn" onclick="window.loadAnimeEpisode('${playerDiv.id.replace('anime-player-', '')}')">
                            🔄 Попробовать другую озвучку
                        </button>
                    </div>
                `;
            });
        }
    }

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

        // Секция для аниме
        let playerSection = project.type === 'Аниме'
            ? `
                <div class="modal-section anime-section">
                    <h3>🎬 Аниме плеер</h3>
                    <div class="anime-controls" id="anime-controls-${project.id}">
                        <div class="anime-loading" id="anime-loading-${project.id}" style="display: block;">
                            <div class="loading-spinner"></div>
                            <span>🔍 Загружаем информацию об аниме...</span>
                        </div>
                        
                        <div class="anime-selectors" id="anime-selectors-${project.id}" style="display: none;">
                            <div class="selector-row">
                                <select class="anime-season-select" id="anime-season-${project.id}" style="display: none;" onchange="window.changeAnimeSeason('${project.id}')">
                                    <option value="">Выберите сезон</option>
                                </select>
                                <select class="anime-episode-select" id="anime-episode-${project.id}" disabled onchange="window.loadAnimeEpisode('${project.id}')">
                                    <option value="">Сначала выберите сезон</option>
                                </select>
                            </div>
                            <div class="selector-row">
                                <select class="anime-dubber-select" id="anime-dubber-${project.id}" style="display: none;" onchange="window.changeAnimeDubber('${project.id}')">
                                    <option value="">Выберите озвучку</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="anime-player" id="anime-player-${project.id}"></div>
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

        // Автозагрузка для аниме
        if (project.type === 'Аниме') {
            const animeTitle = project.title_ru || project.title;
            setTimeout(() => {
                loadAnimeInfo(project.id, animeTitle);
            }, 500);
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

    // ========== ОБРАБОТЧИКИ ДЛЯ АНИМЕ ==========

    window.changeAnimeSeason = async function (projectId) {
        const seasonSelect = document.getElementById(`anime-season-${projectId}`);
        const episodeSelect = document.getElementById(`anime-episode-${projectId}`);

        if (!seasonSelect || !episodeSelect) return;

        const seasonIndex = parseInt(seasonSelect.value);
        if (isNaN(seasonIndex) || seasonIndex < 0) {
            episodeSelect.innerHTML = '<option value="">Выберите сезон</option>';
            episodeSelect.disabled = true;
            return;
        }

        const selectedOption = seasonSelect.options[seasonIndex];
        const episodes = JSON.parse(selectedOption.dataset.episodes || '[]');

        if (episodes.length > 0) {
            episodeSelect.innerHTML = episodes.map((ep) => {
                return `<option value="${ep.episode}" data-episode='${JSON.stringify(ep)}'>${formatEpisodeName(ep.episode)}</option>`;
            }).join('');
            episodeSelect.disabled = false;

            setTimeout(() => {
                loadAnimeEpisode(projectId);
            }, 100);
        } else {
            episodeSelect.innerHTML = '<option value="">Нет эпизодов</option>';
            episodeSelect.disabled = true;
        }
    };

    window.changeAnimeDubber = function (projectId) {
        loadAnimeEpisode(projectId);
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

    // Экспорт функций
    window.deleteProject = deleteProject;
    window.toggleInProgress = toggleInProgress;
    window.markAsWatched = markAsWatched;
    window.changeProjectType = changeProjectType;
    window.refreshProjectDetails = refreshProjectDetails;
    window.playOnRutube = playOnRutube;
    window.loadAnimeInfo = loadAnimeInfo;
    window.loadAnimeEpisode = loadAnimeEpisode;
    window.changeAnimeSeason = changeAnimeSeason;
    window.changeAnimeDubber = changeAnimeDubber;
})();