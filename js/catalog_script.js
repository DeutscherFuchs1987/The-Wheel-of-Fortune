(function () {
    const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    let myProjects = [];
    let currentFilter = 'all';
    let searchCache = new Map(); // Кэш для поиска на Кинопоиске
    let seasonsCache = new Map(); // Кэш для сезонов

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

    function showInfo(text) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4a3f7a;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: fadeOut 3s forwards;
        `;
        infoDiv.textContent = 'ℹ️ ' + text;
        document.body.appendChild(infoDiv);
        
        setTimeout(() => infoDiv.remove(), 3000);
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

    // ========== ФУНКЦИИ ДЛЯ ЗАГРУЗКИ СЕЗОНОВ ==========

    async function loadSeasons(filmId) {
        const cacheKey = `seasons_${filmId}`;
        
        // Проверяем кэш
        if (seasonsCache.has(cacheKey)) {
            console.log('📦 Используем кэшированные сезоны');
            return seasonsCache.get(cacheKey);
        }

        try {
            console.log(`📺 Загружаем сезоны для filmId: ${filmId}`);
            
            const response = await fetch(
                `https://kinopoiskapiunofficial.tech/api/v2.2/films/${filmId}/seasons`,
                { headers: { 'X-API-KEY': KINOPOISK_TOKEN } }
            );

            if (!response.ok) {
                throw new Error(`Ошибка загрузки сезонов: ${response.status}`);
            }

            const data = await response.json();
            
            // Сохраняем в кэш
            seasonsCache.set(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки сезонов:', error);
            return null;
        }
    }

    // ========== ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ ВИДЕО ПО СЕРИИ ==========

    async function loadEpisodeVideo(projectId, title, year, originalTitle, seasonNum, episodeNum, contentType) {
        const playerDiv = document.getElementById(`rutube-player-${projectId}`);
        
        if (!playerDiv) return;

        // Проверяем, не смотрели ли мы эту серию раньше
        const savedProgress = window.watchProgress.get(projectId);
        let startTime = 0;
        
        if (savedProgress && 
            savedProgress.season === seasonNum && 
            savedProgress.episode === episodeNum && 
            !savedProgress.completed) {
            startTime = savedProgress.timecode;
            console.log(`⏱️ Восстанавливаем просмотр с ${window.watchProgress.formatTime(startTime)}`);
        }

        playerDiv.style.display = 'block';
        playerDiv.innerHTML = `<div class="loading-spinner" style="text-align:center; padding:50px;">🔍 Ищем ${seasonNum} сезон ${episodeNum} серию...</div>`;

        // ЧЁТКАЯ ИЕРАРХИЯ ПРИОРИТЕТОВ
        const searchQueries = [
            { text: `${title} ${seasonNum} сезон ${episodeNum} серия`, priority: 100 },
            { text: `${title} ${episodeNum} серия ${seasonNum} сезон`, priority: 95 },
            { text: `${title} ${seasonNum} сезон`, priority: 80 },
            { text: `${title} ${episodeNum} серия`, priority: 70 },
            { text: `${title} ${year}`, priority: 60 },
            { text: title, priority: 50 },
            { text: `${originalTitle} ${year}`, priority: 40 },
            { text: originalTitle, priority: 30 }
        ];
        
        let found = false;
        let lastError = null;
        
        for (const query of searchQueries) {
            if (found) break;
            
            console.log(`🔍 Пробуем запрос (приоритет ${query.priority}): ${query.text}`);
            
            try {
                const response = await fetch(`${API_URL}/api/search-rutube`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: query.text,
                        year: year,
                        original_title: originalTitle,
                        type: contentType,
                        priority: query.priority
                    })
                });

                const data = await response.json();

                if (data.success) {
                    playerDiv.innerHTML = embedPlayerWithProgress(
                        projectId, 
                        data.embed_code, 
                        seasonNum, 
                        episodeNum,
                        startTime,
                        title,
                        year,
                        originalTitle,
                        contentType
                    );
                    
                    // Показываем информацию о том, по какому запросу нашли
                    const qualityInfo = `
                        <div style="text-align:center; padding:5px; margin-top:5px; background:#4a3f7a; color:white; border-radius:4px; font-size:12px;">
                            ✅ Найдено по запросу: "${query.text}" (совпадение: ${data.quality || 'среднее'})
                        </div>
                    `;
                    playerDiv.insertAdjacentHTML('afterend', qualityInfo);
                    
                    setTimeout(() => {
                        const info = playerDiv.nextElementSibling;
                        if (info && info.style) info.remove();
                    }, 5000);
                    
                    showSuccess(`Загружена ${seasonNum} сезон ${episodeNum} серия`);
                    found = true;
                    break;
                } else {
                    console.log(`❌ Запрос "${query.text}" не дал результатов`);
                    lastError = `Не найдено по запросу: ${query.text}`;
                }
            } catch (error) {
                console.error(`Ошибка при запросе "${query.text}":`, error);
                lastError = error.message;
            }
        }
        
        if (!found) {
            playerDiv.innerHTML = `
                <div style="text-align:center; padding:30px; color:#ff8a8a;">
                    ❌ Не удалось найти видео<br>
                    <small style="color:#aaa;">Последняя ошибка: ${lastError || 'Неизвестная ошибка'}</small><br>
                    <button class="retry-btn" onclick="window.loadEpisodeVideo('${projectId}', '${title.replace(/'/g, "\\'")}', '${year}', '${originalTitle.replace(/'/g, "\\'")}', ${seasonNum}, ${episodeNum}, '${contentType}')">
                        🔄 Повторить
                    </button>
                    <button class="retry-btn" onclick="window.openManualSearch('${title}', ${seasonNum}, ${episodeNum})" style="margin-left:10px;">
                        🔍 Ручной поиск
                    </button>
                </div>
            `;
        }
    }

    // Функция для ручного поиска (открывает Rutube в новой вкладке)
    window.openManualSearch = function(title, seasonNum, episodeNum) {
        const searchQuery = `${title} ${seasonNum} сезон ${episodeNum} серия`;
        const url = `https://rutube.ru/search/?query=${encodeURIComponent(searchQuery)}`;
        window.open(url, '_blank');
        showInfo('Открыт Rutube для ручного поиска');
    };

    // Функция для встраивания плеера с отслеживанием прогресса
    function embedPlayerWithProgress(projectId, embedCode, season, episode, startTime = 0, title, year, originalTitle, contentType) {
        const playerId = `player-${projectId}-${season}-${episode}-${Date.now()}`;
        
        return `
            <div class="progress-player-wrapper" id="${playerId}" 
                 data-project="${projectId}" 
                 data-season="${season}" 
                 data-episode="${episode}"
                 data-title="${title}"
                 data-year="${year}"
                 data-original="${originalTitle}"
                 data-type="${contentType}">
                ${embedCode}
                <div class="progress-controls" style="margin-top: 10px; text-align: center;">
                    <button class="progress-save-btn" onclick="window.saveManualProgress('${projectId}', ${season}, ${episode})">
                        ⏱️ Сохранить позицию вручную
                    </button>
                    ${startTime > 0 ? `
                        <div class="progress-indicator" style="margin-top: 5px; color: #ffd700;">
                            ⏯️ Продолжить с ${window.watchProgress.formatTime(startTime)}
                        </div>
                    ` : ''}
                </div>
            </div>
            <script>
                (function() {
                    const wrapper = document.getElementById('${playerId}');
                    const projectId = '${projectId}';
                    const season = ${season};
                    const episode = ${episode};
                    const startTime = ${startTime};
                    
                    // Пытаемся получить доступ к плееру Rutube
                    setTimeout(() => {
                        const iframe = wrapper.querySelector('iframe');
                        if (!iframe) return;
                        
                        try {
                            // Пробуем достучаться до плеера
                            const player = iframe.contentWindow?.player;
                            
                            if (player && player.api) {
                                console.log('✅ Rutube API доступен');
                                
                                // Устанавливаем время начала
                                if (startTime > 0) {
                                    player.api.seek(startTime);
                                }
                                
                                // Отслеживаем прогресс
                                let lastSave = 0;
                                player.api.on('timeupdate', (data) => {
                                    const currentTime = data.currentTime;
                                    const duration = data.duration;
                                    
                                    // Сохраняем каждые 10 секунд
                                    if (Math.floor(currentTime / 10) > Math.floor(lastSave / 10)) {
                                        lastSave = currentTime;
                                        window.watchProgress.markStarted(
                                            projectId, season, episode, 
                                            currentTime, duration
                                        );
                                        
                                        // Обновляем индикатор
                                        updateProgressIndicator(currentTime, duration);
                                    }
                                });
                                
                                // Отслеживаем окончание
                                player.api.on('ended', () => {
                                    window.watchProgress.markWatched(projectId, season, episode);
                                    showInfo('✅ Серия отмечена как просмотренная');
                                    
                                    // Автоматически загружаем следующую серию
                                    setTimeout(() => {
                                        const nextBtn = document.querySelector('.next-episode-btn');
                                        if (nextBtn) nextBtn.click();
                                    }, 3000);
                                });
                            } else {
                                console.log('⚠️ Rutube API не доступен, используем ручное сохранение');
                                setupManualMode(wrapper, projectId, season, episode, startTime);
                            }
                        } catch (e) {
                            console.log('⚠️ Ошибка доступа к плееру:', e);
                            setupManualMode(wrapper, projectId, season, episode, startTime);
                        }
                    }, 2000);
                    
                    function updateProgressIndicator(current, total) {
                        let indicator = wrapper.querySelector('.live-progress');
                        if (!indicator) {
                            indicator = document.createElement('div');
                            indicator.className = 'live-progress';
                            indicator.style.cssText = 'margin-top:5px; font-size:12px; color:#4caf50;';
                            wrapper.querySelector('.progress-controls').appendChild(indicator);
                        }
                        indicator.textContent = \`▶️ Сейчас: \${window.watchProgress.formatTime(current)} / \${window.watchProgress.formatTime(total)}\`;
                    }
                    
                    function setupManualMode(wrapper, projectId, season, episode, startTime) {
                        // Добавляем кнопки для ручного управления
                        const controls = wrapper.querySelector('.progress-controls');
                        
                        if (startTime > 0) {
                            const resumeBtn = document.createElement('button');
                            resumeBtn.className = 'retry-btn';
                            resumeBtn.style.marginLeft = '10px';
                            resumeBtn.textContent = \`▶️ Продолжить с \${window.watchProgress.formatTime(startTime)}\`;
                            resumeBtn.onclick = () => {
                                alert('⏱️ Продолжить можно будет после внедрения полноценного плеера');
                            };
                            controls.appendChild(resumeBtn);
                        }
                    }
                })();
            <\/script>
        `;
    }

    // Функция для ручного сохранения прогресса
    window.saveManualProgress = function(projectId, season, episode) {
        const timeStr = prompt('Введите время в минутах (например, 24:30 или 1250 секунд):');
        if (timeStr) {
            const seconds = window.watchProgress.parseTime(timeStr);
            if (seconds > 0) {
                window.watchProgress.markStarted(projectId, season, episode, seconds, 0);
                alert(`✅ Позиция сохранена! При следующем просмотре начнём с ${window.watchProgress.formatTime(seconds)}`);
            }
        }
    };

    // ========== ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ СЕЗОНОВ ==========

    function renderSeasons(seasonsData, projectId, title, year, originalTitle, contentType) {
        const container = document.getElementById(`seasons-container-${projectId}`);
        if (!container) return;

        if (!seasonsData || !seasonsData.items || seasonsData.items.length === 0) {
            container.innerHTML = '<p class="no-data">Нет информации о сезонах</p>';
            return;
        }

        const progress = window.watchProgress.get(projectId);

        let html = '<div class="seasons-list">';
        
        seasonsData.items.forEach(season => {
            html += `
                <div class="season-item">
                    <h4 onclick="window.toggleSeason('${projectId}', ${season.number})" style="cursor: pointer;">
                        ${season.number}-й сезон 
                        <span style="color:#888; font-size:12px;">▼</span>
                    </h4>
                    <div class="episodes-list" id="season-${projectId}-${season.number}" style="display: none;">
            `;
            
            season.episodes.forEach(episode => {
                const isCurrentEpisode = progress && 
                                        progress.season === season.number && 
                                        progress.episode === episode.episodeNumber;
                
                const episodeClass = isCurrentEpisode ? 'episode-item current' : 'episode-item';
                const episodeStyle = isCurrentEpisode ? 'border-left: 4px solid #ffd700; background: rgba(255,215,0,0.1);' : '';
                
                html += `
                    <div class="${episodeClass}" 
                         style="${episodeStyle}"
                         onclick="window.loadEpisodeVideo('${projectId}', '${title.replace(/'/g, "\\'")}', '${year}', '${originalTitle.replace(/'/g, "\\'")}', ${season.number}, ${episode.episodeNumber}, '${contentType}')">
                        <span class="episode-number">Серия ${episode.episodeNumber}</span>
                        <span class="episode-title">${episode.nameRu || episode.nameEn || ''}</span>
                        ${isCurrentEpisode && !progress.completed ? 
                            `<span class="episode-progress">${Math.round((progress.timecode / progress.duration) * 100)}%</span>` : 
                            ''}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;

        // Автоматически раскрываем первый сезон и загружаем нужную серию
        if (seasonsData.items.length > 0) {
            let targetSeason = 1;
            let targetEpisode = 1;
            
            // Если есть прогресс, открываем на нужной серии
            if (progress && progress.season && progress.episode) {
                targetSeason = progress.season;
                targetEpisode = progress.episode;
            }
            
            // Раскрываем нужный сезон
            toggleSeason(projectId, targetSeason, true);
            
            // Загружаем нужную серию
            const season = seasonsData.items.find(s => s.number === targetSeason);
            if (season) {
                const episode = season.episodes.find(e => e.episodeNumber === targetEpisode);
                if (episode) {
                    loadEpisodeVideo(projectId, title, year, originalTitle, targetSeason, targetEpisode, contentType);
                } else {
                    // Если серия не найдена, грузим первую
                    loadEpisodeVideo(projectId, title, year, originalTitle, targetSeason, 1, contentType);
                }
            } else {
                // Если сезон не найден, грузим первый сезон первую серию
                loadEpisodeVideo(projectId, title, year, originalTitle, 1, 1, contentType);
            }
        }
    }

    // ========== ФУНКЦИЯ ДЛЯ РАСКРЫТИЯ/СКРЫТИЯ СЕЗОНА ==========

    window.toggleSeason = function(projectId, seasonNumber, forceOpen = false) {
        const seasonDiv = document.getElementById(`season-${projectId}-${seasonNumber}`);
        if (seasonDiv) {
            if (forceOpen) {
                seasonDiv.style.display = 'grid';
            } else {
                seasonDiv.style.display = seasonDiv.style.display === 'none' ? 'grid' : 'none';
            }
        }
    };

    // ========== МОДАЛЬНОЕ ОКНО ==========

    window.openModal = async function (projectId) {
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

        // Извлекаем filmId из project.id (удаляем префикс 'kp_')
        const filmId = project.id.replace('kp_', '');

        // Получаем прогресс для отображения кнопки "Продолжить"
        const progress = window.watchProgress.get(project.id);
        const continueButton = progress && !progress.completed ? `
            <button class="continue-watching-btn" onclick="window.continueWatching('${project.id}')">
                ▶️ Продолжить с ${progress.season} сезона ${progress.episode} серии (${window.watchProgress.formatTime(progress.timecode)})
            </button>
        ` : '';

        // Секция с Rutube и сезонами
        let playerSection = `
            <div class="modal-section">
                <h3>🎬 Смотреть на Rutube</h3>
                ${continueButton}
                <div class="rutube-simple-container">
                    <div class="rutube-player" id="rutube-player-${project.id}" style="display: block;">
                        <div class="loading-spinner" style="text-align:center; padding:50px;">🔍 Загружаем видео...</div>
                    </div>
                </div>
            </div>
            <div class="modal-section">
                <h3>📺 Сезоны и серии</h3>
                <div id="seasons-container-${project.id}" class="seasons-container">
                    <div class="loading-spinner" style="text-align:center; padding:30px;">⏳ Загружаем сезоны...</div>
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

        // Загружаем сезоны
        const seasonsData = await loadSeasons(filmId);
        
        // Отображаем сезоны с передачей типа контента
        renderSeasons(
            seasonsData, 
            project.id, 
            project.title_ru || project.title, 
            project.year, 
            project.title || '',
            project.type
        );
    };

    // Функция для кнопки "Продолжить"
    window.continueWatching = function(projectId) {
        const progress = window.watchProgress.get(projectId);
        if (progress) {
            const seasonDiv = document.getElementById(`season-${projectId}-${progress.season}`);
            if (seasonDiv) {
                // Раскрываем сезон
                window.toggleSeason(projectId, progress.season, true);
                
                // Находим и кликаем на нужную серию
                const episodeItems = seasonDiv.querySelectorAll('.episode-item');
                episodeItems.forEach(item => {
                    if (item.textContent.includes(`Серия ${progress.episode}`)) {
                        item.click();
                    }
                });
            }
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
            
            const progress = window.watchProgress.get(project.id);
            const progressPercent = progress && progress.duration ? (progress.timecode / progress.duration) * 100 : 0;
            const hasProgress = progress && !progress.completed && progressPercent > 0;

            return `
                <div class="card ${project.inProgress ? 'in-progress' : ''}" 
                     data-project-id="${project.id}" 
                     onclick="window.openModal('${project.id}')">
                    <div class="card-buttons" onclick="event.stopPropagation()">
                        <button class="delete-card" onclick="window.deleteProject('${project.id}')">✕</button>
                        <div style="display: flex; gap: 5px;">
                            <button class="in-progress-btn ${project.inProgress ? 'active' : ''}" onclick="window.toggleInProgress('${project.id}')">🔥</button>
                            <button class="watched-btn" onclick="window.markAsWatched('${project.id}')">✅</button>
                        </div>
                    </div>
                    <div class="poster" style="background-image: ${project.poster ? `url('${project.poster}')` : 'none'};">
                        ${!project.poster ? `<div class="no-poster">${posterEmoji}</div>` : ''}
                        ${hasProgress ? `
                            <div class="progress-overlay">
                                <div class="progress-bar" style="width: ${progressPercent}%;"></div>
                                <div class="progress-text">
                                    Сезон ${progress.season} серия ${progress.episode}
                                    <br><small>${Math.round(progressPercent)}%</small>
                                </div>
                            </div>
                        ` : ''}
                        <div class="rating-badge ${project.rating === '—' ? 'none' : ''}">${project.rating}</div>
                    </div>
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

    // Слушаем события обновления прогресса
    window.addEventListener('progress-updated', () => {
        renderProjects();
    });

    // ========== ПОИСК НА КИНОПОИСКЕ (ДЛЯ ДОБАВЛЕНИЯ) ==========

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
    window.loadEpisodeVideo = loadEpisodeVideo;
})();