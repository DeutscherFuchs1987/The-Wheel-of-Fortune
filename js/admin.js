(function() {
    'use strict';
    
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let pendingUsers = [];
    let allUsers = [];
    let currentRequestId = null;
    let confirmAction = null;

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
        const loginContainer = document.getElementById('loginContainer');
        
        if (statsGrid) statsGrid.style.display = 'none';
        if (adminContainer) adminContainer.style.display = 'none';
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
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (statsGrid) statsGrid.style.display = 'grid';
        if (adminContainer) adminContainer.style.display = 'flex';
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
})();