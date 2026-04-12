(function() {
    'use strict';
    
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    const KINOPOISK_TOKEN = 'ea7304c3-e5e9-43cd-aca0-f47d1abd3621';
    let currentUser = null;
    let pendingUsers = [];
    let allUsers = [];
    let currentRequestId = null;
    let confirmAction = null;
    let demoMovies = [];
    let demoSearchTimeout;

    // ========== ПРОВЕРКА ПРИ ЗАГРУЗКЕ ==========
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('📱 Админ-панель загружается...');
        setupModalHandlers();
        setupEscapeHandler();
        await checkAndInit();
    });

    // ========== НАСТРОЙКА МОДАЛОК ==========
    function setupModalHandlers() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) {
            overlay.addEventListener('click', closeAllModals);
        }
    }

    function setupEscapeHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });
    }

    function closeAllModals() {
        const confirmModal = document.getElementById('confirmModal');
        const viewModal = document.getElementById('viewModal');
        const overlay = document.getElementById('modalOverlay');
        
        if (confirmModal) confirmModal.style.display = 'none';
        if (viewModal) viewModal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
        
        currentRequestId = null;
        confirmAction = null;
    }

    window.closeConfirmModal = function() {
        closeAllModals();
    };

    window.closeViewModal = function() {
        closeAllModals();
    };

    async function checkAndInit() {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
            console.log('❌ Нет токена');
            showLoginForm();
            return;
        }
        
        try {
            const response = await window.authFetch(`${API_URL}/api/auth/me`);
            const data = await response.json();
            
            if (data.authenticated && data.user.role === 'admin') {
                currentUser = data.user;
                console.log('✅ Админ авторизован:', currentUser.username);
                
                const userNameEl = document.getElementById('userName');
                if (userNameEl) userNameEl.textContent = currentUser.username;
                
                hideLoginForm();
                await loadDashboard();
                await loadDemoMovies();
                setupDemoSearch();
            } else if (data.authenticated && data.user.role !== 'admin') {
                console.log('❌ Пользователь не админ');
                showLoginForm();
                showNotification('⛔ У вас нет прав администратора', 'error');
                localStorage.removeItem('auth_token');
            } else {
                console.log('❌ Не авторизован');
                showLoginForm();
            }
        } catch (error) {
            console.error('❌ Ошибка проверки:', error);
            showLoginForm();
        }
    }

    // ========== ФОРМА ВХОДА ==========
    function showLoginForm() {
        console.log('🔐 Показываем форму входа');
        
        const statsGrid = document.querySelector('.stats-grid');
        const adminContainer = document.querySelector('.admin-container');
        const demoSection = document.querySelector('.demo-section');
        const loginContainer = document.getElementById('loginContainer');
        
        if (statsGrid) statsGrid.style.display = 'none';
        if (adminContainer) adminContainer.style.display = 'none';
        if (demoSection) demoSection.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'flex';
        
        setTimeout(() => {
            const submitBtn = document.getElementById('submitLoginBtn');
            const homeBtn = document.getElementById('goHomeBtn');
            const passwordInput = document.getElementById('adminPassword');
            const usernameInput = document.getElementById('adminUsername');
            
            if (submitBtn) {
                submitBtn.onclick = (e) => {
                    e.preventDefault();
                    submitAdminLogin();
                };
            }
            
            if (homeBtn) {
                homeBtn.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = 'index.html';
                };
            }
            
            if (passwordInput) {
                passwordInput.onkeypress = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submitAdminLogin();
                    }
                };
            }
            
            if (usernameInput) {
                usernameInput.focus();
            }
        }, 100);
    }

    function hideLoginForm() {
        const loginContainer = document.getElementById('loginContainer');
        const statsGrid = document.querySelector('.stats-grid');
        const adminContainer = document.querySelector('.admin-container');
        const demoSection = document.querySelector('.demo-section');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'grid';
        if (adminContainer) adminContainer.style.display = 'flex';
        if (demoSection) demoSection.style.display = 'block';
    }

    async function submitAdminLogin() {
        const username = document.getElementById('adminUsername')?.value.trim();
        const password = document.getElementById('adminPassword')?.value;
        
        if (!username || !password) {
            showNotification('❌ Заполните все поля', 'error');
            return;
        }
        
        showLoading();
        
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success && data.user.role === 'admin') {
                localStorage.setItem('auth_token', data.token);
                currentUser = data.user;
                
                const userNameEl = document.getElementById('userName');
                if (userNameEl) userNameEl.textContent = currentUser.username;
                
                showNotification('✅ Добро пожаловать, администратор!');
                hideLoading();
                hideLoginForm();
                
                setTimeout(async () => {
                    await loadDashboard();
                    await loadDemoMovies();
                }, 500);
                
            } else if (data.success && data.user.role !== 'admin') {
                hideLoading();
                showNotification('❌ У вас нет прав администратора', 'error');
                localStorage.removeItem('auth_token');
                showLoginForm();
            } else {
                hideLoading();
                showNotification(data.error || '❌ Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка:', error);
            hideLoading();
            showNotification('❌ Ошибка сети: ' + error.message, 'error');
        }
    }

    // ========== ЗАГРУЗКА ДАННЫХ ==========
    async function loadDashboard() {
        try {
            showLoading();
            console.log('📊 Загрузка данных админ-панели...');
            
            await loadStats();
            await loadPendingUsers();
            await loadAllUsers();
            setupSearch();
            
            hideLoading();
            console.log('✅ Все данные загружены');
        } catch (error) {
            hideLoading();
            console.error('❌ Ошибка загрузки данных:', error);
            showNotification('Ошибка загрузки данных', 'error');
        }
    }

    async function loadStats() {
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/stats`);
            
            if (!response.ok) {
                throw new Error(`Ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            const totalUsersEl = document.getElementById('totalUsers');
            const pendingUsersEl = document.getElementById('pendingUsers');
            const activeUsersEl = document.getElementById('activeUsers');
            const totalProjectsEl = document.getElementById('totalProjects');
            
            if (totalUsersEl) totalUsersEl.textContent = data.users?.total || 0;
            if (pendingUsersEl) pendingUsersEl.textContent = data.users?.pending || 0;
            if (activeUsersEl) activeUsersEl.textContent = data.users?.active || 0;
            if (totalProjectsEl) totalProjectsEl.textContent = data.projects || 0;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            showNotification('Ошибка загрузки статистики', 'error');
        }
    }

    async function loadPendingUsers() {
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/users/pending`);
            
            if (!response.ok) {
                throw new Error(`Ошибка: ${response.status}`);
            }
            
            pendingUsers = await response.json();
            console.log('📝 Найдено заявок:', pendingUsers.length);
            renderPendingUsers();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заявок:', error);
            showNotification('Ошибка загрузки заявок', 'error');
            pendingUsers = [];
            renderPendingUsers();
        }
    }

    async function loadAllUsers() {
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/users`);
            
            if (!response.ok) {
                throw new Error(`Ошибка: ${response.status}`);
            }
            
            allUsers = await response.json();
            const filteredUsers = allUsers.filter(user => user.status !== 'rejected');
            console.log('👥 Загружено пользователей (активные и ожидающие):', filteredUsers.length);
            renderUsersTable(filteredUsers);
            
            const usersCountEl = document.getElementById('usersCount');
            if (usersCountEl) usersCountEl.textContent = filteredUsers.length;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            showNotification('Ошибка загрузки пользователей', 'error');
            allUsers = [];
            renderUsersTable([]);
        }
    }

    // ========== ОТРИСОВКА ==========
    function renderPendingUsers() {
        const container = document.getElementById('requestsList');
        const pendingCountEl = document.getElementById('pendingCount');
        const rejectAllBtn = document.getElementById('rejectAllBtn');
        
        if (!container) return;
        
        if (pendingCountEl) pendingCountEl.textContent = pendingUsers.length;
        
        if (rejectAllBtn) {
            rejectAllBtn.style.display = pendingUsers.length > 0 ? 'flex' : 'none';
        }
        
        if (pendingUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span>✅</span>
                    <p>Нет новых заявок</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pendingUsers.map(user => `
            <div class="request-card pending" id="request-${user.id}">
                <div class="request-info" onclick="window.viewRequest(${user.id})">
                    <div class="request-avatar">👤</div>
                    <div class="request-details">
                        <span class="request-username">${escapeHtml(user.username)}</span>
                        <span class="request-date">${formatDate(user.registered_at)}</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="action-btn approve" onclick="window.approveUser(${user.id})" title="Подтвердить">✅</button>
                    <button class="action-btn reject" onclick="window.rejectUser(${user.id})" title="Отклонить и удалить">❌</button>
                </div>
            </div>
        `).join('');
    }

    function renderUsersTable(usersToShow) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        if (!usersToShow || usersToShow.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <span>👥</span>
                            <p>Нет пользователей</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = usersToShow.map(user => `
            <tr>
                <td>#${user.id}</td>
                <td>${escapeHtml(user.username)}</td>
                <td>
                    <span class="status-badge ${user.role === 'admin' ? 'admin' : ''}">
                        ${user.role === 'admin' ? 'ADMIN' : 'user'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.status}">
                        ${getStatusText(user.status)}
                    </span>
                </td>
                <td>${formatDate(user.registered_at)}</td>
                <td>${user.activated_at ? formatDate(user.activated_at) : '—'}</td>
                <td>${user.last_login ? formatDateTime(user.last_login) : '—'}</td>
                <td class="table-actions">
                    ${user.status === 'pending' ? `
                        <button class="table-btn approve" onclick="window.approveUser(${user.id})" title="Подтвердить">✅</button>
                        <button class="table-btn reject" onclick="window.rejectUser(${user.id})" title="Отклонить и удалить">❌</button>
                    ` : user.status === 'active' && user.role !== 'admin' ? `
                        <button class="table-btn reject" onclick="window.rejectUser(${user.id})" title="Заблокировать и удалить">🔒</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    // ========== ПОИСК ==========
    function setupSearch() {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                const filtered = allUsers.filter(user => 
                    user.status !== 'rejected' && user.username.toLowerCase().includes(search)
                );
                renderUsersTable(filtered);
            });
        }
    }

    // ========== ДЕЙСТВИЯ С ЗАЯВКАМИ ==========
    window.approveUser = async function(userId) {
        console.log('✅ Подтверждение пользователя:', userId);
        
        if (!confirm('Подтвердить регистрацию пользователя?')) {
            return;
        }
        
        showLoading();
        
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/users/${userId}/approve`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showNotification('✅ Пользователь успешно подтвержден');
                await loadPendingUsers();
                await loadAllUsers();
                await loadStats();
            } else {
                showNotification(data.error || '❌ Ошибка подтверждения', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка:', error);
            showNotification('❌ Ошибка сети: ' + error.message, 'error');
        } finally {
            hideLoading();
            closeAllModals();
        }
    };

    window.rejectUser = async function(userId) {
        console.log('❌ Отклонение пользователя:', userId);
        
        if (!confirm('Отклонить регистрацию и УДАЛИТЬ пользователя? Это действие нельзя отменить.')) {
            return;
        }
        
        showLoading();
        
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/users/${userId}/reject`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showNotification('✅ Пользователь удалён');
                await loadPendingUsers();
                await loadAllUsers();
                await loadStats();
            } else {
                showNotification(data.error || '❌ Ошибка удаления', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка:', error);
            showNotification('❌ Ошибка сети: ' + error.message, 'error');
        } finally {
            hideLoading();
            closeAllModals();
        }
    };

    window.rejectAllPending = async function() {
        if (pendingUsers.length === 0) {
            showNotification('Нет ожидающих заявок', 'error');
            return;
        }
        
        if (!confirm(`Отклонить и УДАЛИТЬ ВСЕ заявки на регистрацию (${pendingUsers.length} шт.)? Это действие нельзя отменить.`)) {
            return;
        }
        
        showLoading();
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const user of pendingUsers) {
            try {
                const response = await window.authFetch(`${API_URL}/api/admin/users/${user.id}/reject`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    successCount++;
                    console.log(`✅ Пользователь ${user.username} удалён`);
                } else {
                    errorCount++;
                    console.error(`Ошибка удаления пользователя ${user.username}:`, data.error);
                }
            } catch (error) {
                errorCount++;
                console.error(`Ошибка удаления пользователя ${user.username}:`, error);
            }
        }
        
        hideLoading();
        
        await loadPendingUsers();
        await loadAllUsers();
        await loadStats();
        
        if (successCount > 0) {
            showNotification(`✅ Удалено ${successCount} заявок${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`);
        } else {
            showNotification(`❌ Ошибок: ${errorCount}`, 'error');
        }
    };

    window.viewRequest = function(userId) {
        const user = pendingUsers.find(u => u.id === userId);
        if (user) {
            const viewUsernameEl = document.getElementById('viewUsername');
            const viewDateEl = document.getElementById('viewDate');
            const viewStatusEl = document.getElementById('viewStatus');
            const viewModal = document.getElementById('viewModal');
            const modalOverlay = document.getElementById('modalOverlay');
            
            if (viewUsernameEl) viewUsernameEl.textContent = user.username;
            if (viewDateEl) viewDateEl.textContent = formatDate(user.registered_at);
            if (viewStatusEl) viewStatusEl.textContent = 'Ожидает подтверждения';
            if (viewModal) viewModal.style.display = 'flex';
            if (modalOverlay) modalOverlay.style.display = 'block';
            
            currentRequestId = userId;
        }
    };

    window.approveFromView = function() {
        if (currentRequestId) {
            window.approveUser(currentRequestId);
        }
    };

    window.rejectFromView = function() {
        if (currentRequestId) {
            window.rejectUser(currentRequestId);
        }
    };

    // ========== УПРАВЛЕНИЕ ДЕМО-ФИЛЬМАМИ ==========
    
    async function loadDemoMovies() {
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/demo/movies`);
            if (response.ok) {
                demoMovies = await response.json();
                renderDemoMoviesList();
                
                const countEl = document.getElementById('demoMoviesCount');
                if (countEl) countEl.textContent = demoMovies.length;
            }
        } catch (error) {
            console.error('Ошибка загрузки демо-фильмов:', error);
            showNotification('Ошибка загрузки демо-фильмов', 'error');
        }
    }

    function renderDemoMoviesList(moviesToShow = null) {
        const container = document.getElementById('demoMoviesList');
        if (!container) return;
        
        const movies = moviesToShow || demoMovies;
        
        if (movies.length === 0) {
            container.innerHTML = '<div class="empty-state"><span>🎬</span><p>Нет демо-фильмов</p><p class="hint">Найдите фильм в поиске выше и нажмите на результат, чтобы добавить</p></div>';
            return;
        }
        
        container.innerHTML = movies.map(movie => `
            <div class="demo-movie-card" data-id="${movie.id}">
                <div class="demo-movie-poster" style="background-image: url('${movie.posterUrlPreview || ''}')">
                    ${!movie.posterUrlPreview ? '<span>🎬</span>' : ''}
                </div>
                <div class="demo-movie-info">
                    <div class="demo-movie-title">${escapeHtml(movie.nameRu || movie.nameEn || 'Без названия')}</div>
                    <div class="demo-movie-meta">
                        <span>📅 ${movie.year || '—'}</span>
                        <span>⭐ ${movie.rating || '—'}</span>
                        <span>🆔 ${movie.kinopoisk_id}</span>
                    </div>
                </div>
                <div class="demo-movie-actions">
                    <button class="table-btn refresh" onclick="window.refreshDemoMovie('${movie.kinopoisk_id}')" title="Обновить данные">🔄</button>
                    <button class="table-btn delete" onclick="window.deleteDemoMovie(${movie.id})" title="Удалить">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    window.refreshDemoList = function() {
        loadDemoMovies();
        showNotification('Список демо-фильмов обновлён');
    };

    window.deleteDemoMovie = async function(movieId) {
        if (!confirm('Удалить фильм из демо-списка?')) return;
        
        showLoading();
        
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/demo/movies/${movieId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Фильм удалён из демо-списка');
                await loadDemoMovies();
            } else {
                showNotification(data.error || 'Ошибка удаления', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showNotification('Ошибка сети', 'error');
        } finally {
            hideLoading();
        }
    };

    window.refreshDemoMovie = async function(kinopoiskId) {
        showLoading();
        
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/demo/movies/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kinopoisk_id: kinopoiskId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Данные фильма обновлены');
                await loadDemoMovies();
            } else {
                showNotification(data.error || 'Ошибка обновления', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showNotification('Ошибка сети', 'error');
        } finally {
            hideLoading();
        }
    };

    // Поиск фильмов для добавления в демо-список (как в каталоге)
    function setupDemoSearch() {
        const searchInput = document.getElementById('demoMovieSearch');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(demoSearchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                const resultsDiv = document.getElementById('demoSearchResults');
                if (resultsDiv) {
                    resultsDiv.innerHTML = '';
                    resultsDiv.classList.remove('active');
                }
                return;
            }
            
            demoSearchTimeout = setTimeout(async () => {
                try {
                    const resultsDiv = document.getElementById('demoSearchResults');
                    if (!resultsDiv) return;
                    
                    resultsDiv.innerHTML = '<div class="search-loading">🔍 Поиск...</div>';
                    resultsDiv.classList.add('active');
                    
                    const response = await fetch(`https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`, {
                        headers: { 'X-API-KEY': KINOPOISK_TOKEN }
                    });
                    
                    if (!response.ok) throw new Error('Ошибка поиска');
                    
                    const data = await response.json();
                    
                    if (!data.films?.length) {
                        resultsDiv.innerHTML = '<div class="search-empty">Ничего не найдено</div>';
                        return;
                    }
                    
                    resultsDiv.innerHTML = data.films.slice(0, 8).map(film => `
                        <div class="search-result-item" onclick="window.addDemoMovieFromSearch(${film.filmId})">
                            <div class="result-poster-mini" style="background-image: url('${film.posterUrlPreview || ''}')">
                                ${!film.posterUrlPreview ? '🎬' : ''}
                            </div>
                            <div class="result-info">
                                <div class="result-title">${escapeHtml(film.nameRu || film.nameEn)}</div>
                                <div class="result-meta">
                                    <span>📅 ${film.year || '?'}</span>
                                    <span>⭐ ${film.rating || '—'}</span>
                                </div>
                            </div>
                            <button class="add-demo-btn" title="Добавить в демо-список">➕</button>
                        </div>
                    `).join('');
                } catch (error) {
                    console.error('Ошибка поиска:', error);
                    const resultsDiv = document.getElementById('demoSearchResults');
                    if (resultsDiv) {
                        resultsDiv.innerHTML = `<div class="search-error">❌ Ошибка: ${error.message}</div>`;
                    }
                }
            }, 400);
        });
        
        // Закрываем результаты при клике вне
        document.addEventListener('click', (e) => {
            const resultsDiv = document.getElementById('demoSearchResults');
            const searchInputEl = document.getElementById('demoMovieSearch');
            if (resultsDiv && searchInputEl && !searchInputEl.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.classList.remove('active');
            }
        });
    }

    window.addDemoMovieFromSearch = async function(kinopoiskId) {
        showLoading();
        
        // Очищаем поиск и закрываем результаты
        const searchInput = document.getElementById('demoMovieSearch');
        const resultsDiv = document.getElementById('demoSearchResults');
        if (searchInput) searchInput.value = '';
        if (resultsDiv) resultsDiv.classList.remove('active');
        
        try {
            // Проверяем, есть ли уже такой фильм
            const existing = demoMovies.find(m => m.kinopoisk_id == kinopoiskId);
            if (existing) {
                showNotification('Этот фильм уже есть в демо-списке', 'error');
                hideLoading();
                return;
            }
            
            // Получаем данные фильма с Кинопоиска
            const searchResponse = await fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${kinopoiskId}`, {
                headers: { 'X-API-KEY': KINOPOISK_TOKEN }
            });
            
            if (!searchResponse.ok) {
                throw new Error(`Фильм с ID ${kinopoiskId} не найден`);
            }
            
            const filmData = await searchResponse.json();
            
            const movieData = {
                nameRu: filmData.nameRu,
                nameEn: filmData.nameEn,
                year: filmData.year,
                rating: filmData.ratingImdb || filmData.ratingKinopoisk,
                posterUrlPreview: filmData.posterUrlPreview,
                posterUrl: filmData.posterUrl,
                genres: filmData.genres || []
            };
            
            const response = await window.authFetch(`${API_URL}/api/admin/demo/movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kinopoisk_id: kinopoiskId.toString(),
                    movie_data: movieData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Фильм добавлен в демо-список');
                await loadDemoMovies();
            } else {
                showNotification(data.error || 'Ошибка добавления', 'error');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showNotification(error.message || 'Ошибка добавления фильма', 'error');
        } finally {
            hideLoading();
        }
    };

    // ========== ВЫХОД ==========
    window.logout = async function() {
        localStorage.removeItem('auth_token');
        window.location.href = 'index.html';
    };

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
        } catch (e) {
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
        } catch (e) {
            return '—';
        }
    }

    function getStatusText(status) {
        const statusMap = {
            'pending': 'Ожидает',
            'active': 'Активен',
            'rejected': 'Отклонен'
        };
        return statusMap[status] || status;
    }

    function showLoading() {
        const loader = document.getElementById('admin-loader');
        if (loader) loader.remove();

        const newLoader = document.createElement('div');
        newLoader.id = 'admin-loader';
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
            <div class="loading-spinner" style="width: 60px; height: 60px;"></div>
            <div style="color: #e0e0e0; font-size: 1.2rem; margin-top: 16px;">Загрузка...</div>
        `;
        document.body.appendChild(newLoader);
    }

    function hideLoading() {
        const loader = document.getElementById('admin-loader');
        if (loader) loader.remove();
    }

    function showNotification(text, type = 'success') {
        const notification = document.getElementById(type === 'success' ? 'successMessage' : 'errorMessage');
        if (notification) {
            notification.textContent = text;
            notification.style.display = 'block';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }
    }

    // Экспорт для глобального доступа
    window.approveUser = approveUser;
    window.rejectUser = rejectUser;
    window.rejectAllPending = rejectAllPending;
    window.viewRequest = viewRequest;
    window.approveFromView = approveFromView;
    window.rejectFromView = rejectFromView;
    window.logout = logout;
    window.closeConfirmModal = closeConfirmModal;
    window.closeViewModal = closeViewModal;
    window.deleteDemoMovie = deleteDemoMovie;
    window.refreshDemoMovie = refreshDemoMovie;
    window.refreshDemoList = refreshDemoList;
    window.addDemoMovieFromSearch = addDemoMovieFromSearch;
})();