(function() {
    'use strict';
    
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let pendingUsers = [];
    let allUsers = [];
    let currentRequestId = null;

    // ========== ПРОВЕРКА ПРИ ЗАГРУЗКЕ ==========
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('📱 Админ-панель загружается...');
        
        setTimeout(async () => {
            await checkAndInit();
        }, 100);
    });

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

    // ========== ФОРМА ВХОДА (та же, что и была) ==========
    function showLoginForm() {
        console.log('🔐 Показываем форму входа');
        
        const statsGrid = document.querySelector('.stats-grid');
        const adminContainer = document.querySelector('.admin-container');
        
        if (statsGrid) statsGrid.style.display = 'none';
        if (adminContainer) adminContainer.style.display = 'none';
        
        const existingForm = document.getElementById('adminLoginForm');
        if (existingForm) existingForm.remove();
        
        const loginContainer = document.createElement('div');
        loginContainer.className = 'login-container';
        loginContainer.id = 'adminLoginForm';
        loginContainer.innerHTML = `
            <div class="login-box">
                <h2>👑 Вход в админ-панель</h2>
                <div class="login-form">
                    <div class="form-group">
                        <label for="adminUsername">Логин</label>
                        <input type="text" id="adminUsername" class="login-input" placeholder="Введите логин" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="adminPassword">Пароль</label>
                        <input type="password" id="adminPassword" class="login-input" placeholder="Введите пароль">
                    </div>
                    <div class="login-actions">
                        <button class="login-btn" id="submitLoginBtn">🔑 Войти</button>
                        <button class="login-btn secondary" id="goHomeBtn">🏠 На главную</button>
                    </div>
                    <div class="login-hint">
                        <p>Доступ только для администраторов</p>
                        <p class="hint-small">Логин: admin, пароль: admin123</p>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelector('.app').appendChild(loginContainer);
        
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
        
        addLoginStyles();
    }

    function hideLoginForm() {
        const form = document.getElementById('adminLoginForm');
        if (form) form.remove();
        
        const statsGrid = document.querySelector('.stats-grid');
        const adminContainer = document.querySelector('.admin-container');
        
        if (statsGrid) statsGrid.style.display = 'grid';
        if (adminContainer) adminContainer.style.display = 'flex';
    }

    function addLoginStyles() {
        if (document.getElementById('admin-login-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'admin-login-styles';
        style.textContent = `
            .login-container {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 60vh;
                animation: fadeIn 0.5s ease;
                padding: 20px;
            }
            .login-box {
                background: #1a1f33;
                border-radius: 40px;
                padding: 40px;
                width: 100%;
                max-width: 400px;
                border: 2px solid #5f4bb6;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            .login-box h2 {
                color: #ffd966;
                text-align: center;
                margin-bottom: 30px;
                font-size: 1.8rem;
            }
            .form-group {
                margin-bottom: 20px;
            }
            .form-group label {
                display: block;
                color: #a3b7f0;
                margin-bottom: 8px;
                font-size: 0.9rem;
            }
            .login-input {
                width: 100%;
                padding: 12px 20px;
                background: #0c1020;
                border: 2px solid #3d435b;
                border-radius: 30px;
                color: white;
                font-size: 1rem;
                outline: none;
                transition: all 0.3s;
                box-sizing: border-box;
            }
            .login-input:focus {
                border-color: #5f4bb6;
                box-shadow: 0 0 0 3px rgba(95, 75, 182, 0.3);
            }
            .login-actions {
                display: flex;
                gap: 15px;
                margin-top: 30px;
            }
            .login-btn {
                flex: 1;
                padding: 12px;
                background: #5f4bb6;
                color: white;
                border: none;
                border-radius: 30px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                border-bottom: 4px solid #352b66;
            }
            .login-btn:hover {
                transform: translateY(-2px);
                background: #6f5bc6;
            }
            .login-btn.secondary {
                background: #283153;
                border-bottom-color: #0e142b;
            }
            .login-btn.secondary:hover {
                background: #323d62;
            }
            .login-hint {
                margin-top: 25px;
                text-align: center;
                color: #a3b7f0;
                font-size: 0.9rem;
            }
            .hint-small {
                font-size: 0.8rem;
                opacity: 0.7;
                margin-top: 5px;
                color: #ffd966;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
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

    function showLoading() {
        hideLoading();
        
        const loader = document.createElement('div');
        loader.id = 'admin-loader';
        loader.style.cssText = `
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
        
        loader.innerHTML = `
            <div style="width: 60px; height: 60px; border: 4px solid #5f4bb6; border-top-color: #ffd966; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <div style="color: white; font-size: 1.2rem;">Загрузка...</div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        
        document.body.appendChild(loader);
    }

    function hideLoading() {
        const loader = document.getElementById('admin-loader');
        if (loader) loader.remove();
    }

    async function loadDashboard() {
        try {
            showLoading();
            console.log('📊 Загрузка данных админ-панели...');
            
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('❌ Нет токена');
                hideLoading();
                showLoginForm();
                return;
            }
            
            await loadStats();
            await loadPendingUsers();
            await loadAllUsers();
            
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
            
            document.getElementById('totalUsers').textContent = data.users?.total || 0;
            document.getElementById('pendingUsers').textContent = data.users?.pending || 0;
            document.getElementById('activeUsers').textContent = data.users?.active || 0;
            document.getElementById('totalProjects').textContent = data.projects || 0;
            
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
            console.log('👥 Загружено пользователей:', allUsers.length);
            renderUsersTable();
            
            const usersCountEl = document.getElementById('usersCount');
            if (usersCountEl) usersCountEl.textContent = allUsers.length;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            showNotification('Ошибка загрузки пользователей', 'error');
            allUsers = [];
            renderUsersTable();
        }
    }

    function renderPendingUsers() {
        const container = document.getElementById('requestsList');
        const pendingCountEl = document.getElementById('pendingCount');
        
        if (!container) return;
        
        if (pendingCountEl) pendingCountEl.textContent = pendingUsers.length;
        
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
                    <button class="action-btn reject" onclick="window.rejectUser(${user.id})" title="Отклонить">❌</button>
                </div>
            </div>
        `).join('');
    }

    function renderUsersTable(filteredUsers = null) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        const usersToShow = filteredUsers || allUsers;
        
        if (!usersToShow || usersToShow.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        Нет пользователей
                    <td>
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
                        <button class="table-btn reject" onclick="window.rejectUser(${user.id})" title="Отклонить">❌</button>
                    ` : user.status === 'active' && user.role !== 'admin' ? `
                        <button class="table-btn reject" onclick="window.rejectUser(${user.id})" title="Заблокировать">🔒</button>
                    ` : user.status === 'rejected' ? `
                        <button class="table-btn approve" onclick="window.approveUser(${user.id})" title="Активировать">✅</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
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

    function setupSearch() {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                const filtered = allUsers.filter(user => 
                    user.username.toLowerCase().includes(search)
                );
                renderUsersTable(filtered);
            });
        }
    }

    // ========== ОСНОВНЫЕ ДЕЙСТВИЯ С ЗАЯВКАМИ ==========
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
                // Обновляем все данные
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
            closeConfirmModal();
            closeViewModal();
        }
    };

    window.rejectUser = async function(userId) {
        console.log('❌ Отклонение пользователя:', userId);
        
        if (!confirm('Отклонить регистрацию пользователя?')) {
            return;
        }
        
        showLoading();
        
        try {
            const response = await window.authFetch(`${API_URL}/api/admin/users/${userId}/reject`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showNotification('✅ Пользователь отклонен');
                // Обновляем все данные
                await loadPendingUsers();
                await loadAllUsers();
                await loadStats();
            } else {
                showNotification(data.error || '❌ Ошибка отклонения', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка:', error);
            showNotification('❌ Ошибка сети: ' + error.message, 'error');
        } finally {
            hideLoading();
            closeConfirmModal();
            closeViewModal();
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
            approveUser(currentRequestId);
        }
    };

    window.rejectFromView = function() {
        if (currentRequestId) {
            rejectUser(currentRequestId);
        }
    };

    function closeConfirmModal() {
        const confirmModal = document.getElementById('confirmModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (confirmModal) confirmModal.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
        
        window.confirmAction = null;
        currentRequestId = null;
    }

    function closeViewModal() {
        const viewModal = document.getElementById('viewModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (viewModal) viewModal.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
        
        currentRequestId = null;
    }

    window.closeConfirmModal = closeConfirmModal;
    window.closeViewModal = closeViewModal;

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

    function showNotification(text, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = type === 'success' ? '✅ ' + text : '❌ ' + text;
        notification.className = 'notification ' + (type === 'error' ? 'error' : '');
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    setTimeout(setupSearch, 1000);
})();