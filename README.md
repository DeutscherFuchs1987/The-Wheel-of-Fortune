# The-Wheel-of-Fortune


<!-- <script>
        (function () {
            // ========== КОНФИГУРАЦИЯ ==========
            const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';

            // ========== ПОДКЛЮЧЕНИЕ К SUPABASE ==========
            const SUPABASE_URL = 'https://iiaqffifefwicfzztjcs.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYXFmZmlmZWZ3aWNmenp0amNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODY0OTAsImV4cCI6MjA4Nzc2MjQ5MH0.9vQi6EG-UPS5sd1ehBtlYjf6MiNAv0AnRTGBJTolf64';

            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // ========== ХРАНИЛИЩЕ ==========
            let myProjects = [];
            let currentFilter = 'all';
            let currentUser = null;

            // ========== DOM ЭЛЕМЕНТЫ ==========
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');
            const projectsGrid = document.getElementById('projectsGrid');
            const statsDiv = document.getElementById('stats');
            const errorMessageDiv = document.getElementById('errorMessage');
            const successMessageDiv = document.getElementById('successMessage');
            const filterButtons = document.querySelectorAll('.filter-btn');
            const userStatusSpan = document.getElementById('userStatus');

            // ========== АВТОРИЗАЦИЯ ==========
            async function initAuth() {
                try {
                    // Проверяем существующую сессию
                    const { data: { session } } = await supabase.auth.getSession();

                    if (session?.user) {
                        currentUser = session.user;
                        userStatusSpan.textContent = `👤 ${currentUser.email || 'Анонимный пользователь'}`;
                        userStatusSpan.classList.add('connected');
                    } else {
                        // Создаём анонимного пользователя
                        const { data, error } = await supabase.auth.signInAnonymously();
                        if (error) throw error;

                        currentUser = data.user;
                        userStatusSpan.textContent = `👤 Анонимный пользователь`;
                        userStatusSpan.classList.add('connected');
                    }

                    // Загружаем проекты
                    await loadUserProjects();

                    // Подписываемся на изменения
                    supabase
                        .channel('user_films_changes')
                        .on('postgres_changes', {
                            event: '*',
                            schema: 'public',
                            table: 'user_films',
                            filter: `user_id=eq.${currentUser.id}`
                        }, () => {
                            loadUserProjects();
                        })
                        .subscribe();

                } catch (error) {
                    showError('Ошибка авторизации: ' + error.message);
                    userStatusSpan.textContent = '❌ Ошибка подключения';
                }
            }

            // ========== ЗАГРУЗКА ПРОЕКТОВ ПОЛЬЗОВАТЕЛЯ ==========
            async function loadUserProjects() {
                if (!currentUser) return;

                try {
                    const { data, error } = await supabase
                        .from('user_films')
                        .select(`
                            *,
                            films (*)
                        `)
                        .eq('user_id', currentUser.id);

                    if (error) throw error;

                    // Преобразуем в удобный формат
                    myProjects = data.map(uf => ({
                        id: uf.film_id,
                        title: uf.films.title,
                        title_ru: uf.films.title_ru,
                        year: uf.films.year,
                        rating: uf.films.kinopoisk_rating,
                        poster: uf.films.poster,
                        type: uf.type,
                        inProgress: uf.in_progress
                    }));

                    renderProjects();
                    updateStats();

                } catch (error) {
                    showError('Ошибка загрузки проектов: ' + error.message);
                }
            }

            // ========== ФИЛЬТРАЦИЯ ==========
            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.dataset.filter;
                    renderProjects();
                    updateStats();
                });
            });

            // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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

            // ========== УМНОЕ ОПРЕДЕЛЕНИЕ ТИПА ПО ЖАНРАМ ==========
            function detectTypeByGenres(film) {
                const genres = (film.genres || []).map(g => (g.genre || g).toLowerCase());

                if (genres.includes('аниме')) {
                    return 'Аниме';
                }

                if (genres.includes('мультфильм') || genres.includes('анимация')) {
                    return 'Мультфильм';
                }

                if (film.type === 'TV_SERIES' || film.type === 'MINI_SERIES') {
                    return 'Сериал';
                }

                return 'Фильм';
            }

            // ========== ДОБАВЛЕНИЕ ФИЛЬМА ==========
            async function addProject(film) {
                if (!currentUser) return;

                try {
                    // 1. Добавляем/обновляем фильм в таблицу films
                    const { error: filmError } = await supabase
                        .from('films')
                        .upsert({
                            id: 'kp_' + film.filmId,
                            title: film.nameEn || film.nameRu,
                            title_ru: film.nameRu || film.nameEn,
                            year: film.year || 'Неизвестно',
                            poster: film.posterUrlPreview || film.posterUrl,
                            kinopoisk_rating: film.rating || '—'
                        }, { onConflict: 'id' });

                    if (filmError) throw filmError;

                    // 2. Определяем тип
                    const type = detectTypeByGenres(film);

                    // 3. Добавляем связь с пользователем
                    const { error: userFilmError } = await supabase
                        .from('user_films')
                        .upsert({
                            user_id: currentUser.id,
                            film_id: 'kp_' + film.filmId,
                            type: type,
                            in_progress: false
                        }, { onConflict: 'user_id, film_id' });

                    if (userFilmError) throw userFilmError;

                    // 4. Перезагружаем список (или обновляем локально)
                    await loadUserProjects();
                    showSuccess('Добавлено!');

                } catch (error) {
                    showError('Ошибка при добавлении: ' + error.message);
                }
            }

            // ========== УДАЛЕНИЕ ПРОЕКТА ==========
            async function deleteProject(filmId) {
                if (!currentUser) return;

                try {
                    const { error } = await supabase
                        .from('user_films')
                        .delete()
                        .eq('user_id', currentUser.id)
                        .eq('film_id', filmId);

                    if (error) throw error;

                    myProjects = myProjects.filter(p => p.id !== filmId);
                    renderProjects();
                    updateStats();
                    showSuccess('Проект удалён');

                } catch (error) {
                    showError('Ошибка при удалении: ' + error.message);
                }
            }

            // ========== ПЕРЕКЛЮЧЕНИЕ СТАТУСА "В ПРОЦЕССЕ" ==========
            async function toggleInProgress(filmId) {
                if (!currentUser) return;

                const project = myProjects.find(p => p.id === filmId);
                if (!project) return;

                try {
                    const { error } = await supabase
                        .from('user_films')
                        .update({ in_progress: !project.inProgress })
                        .eq('user_id', currentUser.id)
                        .eq('film_id', filmId);

                    if (error) throw error;

                    project.inProgress = !project.inProgress;
                    renderProjects();
                    updateStats();
                    showSuccess(project.inProgress ? 'В процессе просмотра' : 'Убрано из процесса');

                } catch (error) {
                    showError('Ошибка обновления: ' + error.message);
                }
            }

            // ========== СМЕНА ТИПА ПРОЕКТА ==========
            async function changeProjectType(filmId, newType) {
                if (!currentUser) return;

                try {
                    const { error } = await supabase
                        .from('user_films')
                        .update({ type: newType })
                        .eq('user_id', currentUser.id)
                        .eq('film_id', filmId);

                    if (error) throw error;

                    const project = myProjects.find(p => p.id === filmId);
                    if (project) {
                        project.type = newType;
                        renderProjects();
                        showSuccess(`Тип изменён на ${newType}`);
                    }

                } catch (error) {
                    showError('Ошибка обновления: ' + error.message);
                }
            }

            // ========== ФУНКЦИЯ ДЛЯ ОЦЕНИВАНИЯ ==========
            async function markAsWatched(filmId) {
                const project = myProjects.find(p => p.id === filmId);
                if (!project) return;

                // Создаём модальное окно
                const modal = document.createElement('div');
                modal.className = 'rating-modal';
                modal.innerHTML = `
        <div class="rating-modal-content">
            <h3>⭐ Оцените фильм</h3>
            <p class="rating-modal-title">${project.title_ru || project.title} (${project.year})</p>
            
            <div class="rating-modal-grid">
                <div class="rating-modal-item">
                    <label>Сеня</label>
                    <select id="rating-senya" class="rating-select">
                        <option value="">Не смотрел</option>
                        ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                    </select>
                </div>
                
                <div class="rating-modal-item">
                    <label>Ваня</label>
                    <select id="rating-vanya" class="rating-select">
                        <option value="">Не смотрел</option>
                        ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                    </select>
                </div>
                
                <div class="rating-modal-item">
                    <label>Паша</label>
                    <select id="rating-pasha" class="rating-select">
                        <option value="">Не смотрел</option>
                        ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                    </select>
                </div>
                
                <div class="rating-modal-item">
                    <label>Володя</label>
                    <select id="rating-volodya" class="rating-select">
                        <option value="">Не смотрел</option>
                        ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div class="rating-modal-notes">
                <label>📝 Заметки (необязательно):</label>
                <textarea id="rating-notes" rows="2" placeholder="Ваши впечатления..."></textarea>
            </div>
            
            <div class="rating-modal-buttons">
                <button class="rating-btn cancel" onclick="this.closest('.rating-modal').remove()">Отмена</button>
                <button class="rating-btn save" id="saveRatingBtn">Сохранить</button>
            </div>
        </div>
    `;

                document.body.appendChild(modal);

                // Обработчик сохранения
                document.getElementById('saveRatingBtn').addEventListener('click', async () => {
                    const ratings = {
                        senya: document.getElementById('rating-senya').value,
                        vanya: document.getElementById('rating-vanya').value,
                        pasha: document.getElementById('rating-pasha').value,
                        volodya: document.getElementById('rating-volodya').value
                    };

                    const notes = document.getElementById('rating-notes').value;

                    await saveRatings(filmId, ratings, notes);
                    modal.remove();
                });
            }

            // ========== СОХРАНЕНИЕ ОЦЕНОК В БД ==========
            async function saveRatings(filmId, ratings, notes) {
                if (!currentUser) return;

                try {
                    const { error } = await supabase
                        .from('user_films')
                        .update({
                            rating_senya: ratings.senya || null,
                            rating_vanya: ratings.vanya || null,
                            rating_pasha: ratings.pasha || null,
                            rating_volodya: ratings.volodya || null,
                            notes: notes || null,
                            watched_date: new Date().toISOString().split('T')[0] // Сегодняшняя дата
                        })
                        .eq('user_id', currentUser.id)
                        .eq('film_id', filmId);

                    if (error) throw error;

                    showSuccess('Оценки сохранены! ✨');

                    // Обновляем локальные данные
                    const project = myProjects.find(p => p.id === filmId);
                    if (project) {
                        project.ratings = {
                            senya: ratings.senya || null,
                            vanya: ratings.vanya || null,
                            pasha: ratings.pasha || null,
                            volodya: ratings.volodya || null
                        };
                        project.notes = notes;
                        project.watched_date = new Date().toISOString().split('T')[0];
                    }

                } catch (error) {
                    showError('Ошибка при сохранении: ' + error.message);
                }
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

            // ========== ПОЛУЧЕНИЕ ОТФИЛЬТРОВАННЫХ ПРОЕКТОВ ==========
            function getFilteredProjects() {
                if (currentFilter === 'all') return myProjects;
                return myProjects.filter(p => p.type === currentFilter);
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

                // Сортируем: сначала "в процессе"
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
                                    <button class="watched-btn" onclick="window.markAsWatched('${project.id}')" title="Отметить просмотренным">✅</button>
                                </div>
                            </div>
                            ${posterHtml}
                            <div class="card-content">
                                <div class="card-title">${project.title_ru || project.title}</div>
                                
                                <!-- Кнопки выбора типа -->
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
                            headers: {
                                'X-API-KEY': KINOPOISK_TOKEN,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (!response.ok) throw new Error(`Ошибка ${response.status}`);

                        const data = await response.json();

                        if (!data.films || data.films.length === 0) {
                            searchResults.innerHTML = '<div style="padding:20px; text-align:center; color:#a3b7f0;">Ничего не найдено на Кинопоиске</div>';
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
                        searchResults.innerHTML = `<div style="padding:20px; text-align:center; color:#ff8a8a;">Ошибка: ${error.message}</div>`;
                    }
                }, 400);
            });

            // ========== ЗАКРЫТИЕ РЕЗУЛЬТАТОВ ==========
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                    searchResults.classList.remove('active');
                }
            });

            // ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========
            window.addMovieFromKinopoisk = function (encodedFilm) {
                try {
                    const film = JSON.parse(decodeURIComponent(encodedFilm));
                    addProject(film);
                    searchResults.classList.remove('active');
                    searchInput.value = '';
                } catch (e) {
                    showError('Ошибка при добавлении');
                    console.error(e);
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

            // ========== ЗАПУСК ==========
            initAuth();

        })();
    </script> -->