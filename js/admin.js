(function() {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let pendingUsers = [];
    let allUsers = [];
    let currentRequestId = null;

    // ========== ПРОВЕРКА ПРИ ЗАГРУЗКЕ ==========
    document.addEventListener('DOMContentLoaded', async () => {
        // Сначала проверяем, может уже есть сессия
        const hasSession = await checkSession();
        
        if (!hasSession) {
            // Если нет сессии - показываем форму входа
            showLoginForm();
        } else {
            // Если есть сессия и пользователь админ - загружаем данные
            showLoading();
            const isAdmin = await checkAdminAccess();
            
            if (isAdmin) {
                hideLoading();
                hideLoginForm();
                loadDashboard();
            } else {
                hideLoading();
                showLoginForm();
                showNotification('❌ У вас нет прав администратора', 'error');
            }
        }
    });

    // ========== ПРОВЕРКА СЕССИИ ==========
    async function checkSession() {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                credentials: 'include',
                signal: AbortSignal.timeout(3000)
            });
            
            if (!response.ok) return false;
            
            const data = await response.json();
            return data.authenticated;
        } catch (error) {
            console.log('❌ Нет активной сессии');
            return false;
        }
    }

    // ========== ФОРМА ВХОДА ==========
    function showLoginForm() {
        // Скрываем основной контент
        document.querySelector('.stats-grid').style.display = 'none';
        document.querySelector('.admin-container').style.display = 'none';
        
        // Создаем форму входа
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
                        <button class="login-btn" onclick="window.submitAdminLogin()">🔑 Войти</button>
                        <button class="login-btn secondary" onclick="window.goToHome()">🏠 На главную</button>
                    </div>
                    <div class="login-hint">
                        <p>Доступ только для администраторов</p>
                        <p class="hint-small">Логин и пароль выдает администратор</p>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelector('.app').appendChild(loginContainer);
        
        // Добавляем стили для формы
        addLoginStyles();
    }

    function hideLoginForm() {
        const form = document.getElementById('adminLoginForm');
        if (form) form.remove();
        document.querySelector('.stats-grid').style.display = 'grid';
        document.querySelector('.admin-container').style.display = 'flex';
    }

    // Добавляем стили для формы входа
    function addLoginStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .login-container {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 60vh;
                animation: fadeIn 0.5s ease;
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
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ========== ОБРАБОТЧИК ВХОДА ==========
    window.submitAdminLogin = async function() {
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
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success && data.user.role === 'admin') {
                currentUser = data.user;
                hideLoading();
                hideLoginForm();
                showNotification('✅ Добро пожаловать, администратор!');
                loadDashboard();
            } else if (data.success && data.user.role !== 'admin') {
                hideLoading();
                showNotification('❌ У вас нет прав администратора', 'error');
                await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
            } else {
                hideLoading();
                showNotification(data.error || '❌ Ошибка входа', 'error');
            }
        } catch (error) {
            hideLoading();
            showNotification('❌ Ошибка сети', 'error');
        }
    };

    window.goToHome = function() {
        window.location.href = 'index.html';
    };

    // ========== ПРОВЕРКА ДОСТУПА АДМИНА ==========
    async function checkAdminAccess() {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                credentials: 'include',
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                console.log('❌ Не авторизован');
                return false;
            }

            const data = await response.json();
            
            if (data.authenticated && data.user.role === 'admin') {
                console.log('✅ Доступ разрешен для админа:', data.user.username);
                currentUser = data.user;
                return true;
            }
            
            console.log('❌ Нет прав администратора');
            return false;
            
        } catch (error) {
            console.error('❌ Ошибка проверки доступа:', error);
            return false;
        }
    }

    // ========== РЕДИРЕКТ НА ГЛАВНУЮ ==========
    function redirectToHome() {
        console.log('🔄 Редирект на главную...');
        
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff6b8b;
            color: white;
            padding: 20px 40px;
            border-radius: 30px;
            font-size: 1.2rem;
            font-weight: 600;
            z-index: 10002;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            animation: fadeInOut 2s ease;
        `;
        message.textContent = '⛔ Доступ запрещен. Перенаправление...';
        document.body.appendChild(message);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -60%); }
                20% { opacity: 1; transform: translate(-50%, -50%); }
                80% { opacity: 1; transform: translate(-50%, -50%); }
                100% { opacity: 0; transform: translate(-50%, -40%); }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }

    // ========== ЗАГРУЗЧИК ==========
    function showLoading() {
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
            <div style="
                width: 60px;
                height: 60px;
                border: 4px solid #5f4bb6;
                border-top-color: #ffd966;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            "></div>
            <div style="color: white; font-size: 1.2rem;">Загрузка...</div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(loader);
    }

    function hideLoading() {
        const loader = document.getElementById('admin-loader');
        if (loader) loader.remove();
    }

    // ========== ЗАГРУЗКА ДАННЫХ ==========
    async function loadDashboard() {
        try {
            await Promise.all([
                loadStats(),
                loadPendingUsers(),
                loadAllUsers()
            ]);
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            showNotification('Ошибка загрузки данных', 'error');
        }
    }

    // Загрузка статистики
    async function loadStats() {
        try {
            const response = await fetch(`${API_URL}/api/admin/stats`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    redirectToHome();
                    return;
                }
                throw new Error('Ошибка загрузки');
            }
            
            const data = await response.json();
            
            document.getElementById('totalUsers').textContent = data.users.total;
            document.getElementById('pendingUsers').textContent = data.users.pending;
            document.getElementById('activeUsers').textContent = data.users.active;
            document.getElementById('totalProjects').textContent = data.projects;
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    }

    // Загрузка заявок
    async function loadPendingUsers() {
        try {
            const response = await fetch(`${API_URL}/api/admin/users/pending`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    redirectToHome();
                    return;
                }
                throw new Error('Ошибка загрузки');
            }
            
            pendingUsers = await response.json();
            renderPendingUsers();
        } catch (error) {
            console.error('❌ Ошибка загрузки заявок:', error);
        }
    }

    // Загрузка всех пользователей
    async function loadAllUsers() {
        try {
            const response = await fetch(`${API_URL}/api/admin/users`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    redirectToHome();
                    return;
                }
                throw new Error('Ошибка загрузки');
            }
            
            allUsers = await response.json();
            renderUsersTable();
            document.getElementById('usersCount').textContent = allUsers.length;
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
        }
    }

    // ========== ОТРИСОВКА ==========
    function renderPendingUsers() {
        const container = document.getElementById('requestsList');
        document.getElementById('pendingCount').textContent = pendingUsers.length;
        
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
                <div class="request-info" onclick="viewRequest(${user.id})">
                    <div class="request-avatar">👤</div>
                    <div class="request-details">
                        <span class="request-username">${user.username}</span>
                        <span class="request-date">${formatDate(user.registered_at)}</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="action-btn approve" onclick="approveUser(${user.id})" title="Подтвердить">✅</button>
                    <button class="action-btn reject" onclick="rejectUser(${user.id})" title="Отклонить">❌</button>
                </div>
            </div>
        `).join('');
    }

    function renderUsersTable(filteredUsers = allUsers) {
        const tbody = document.getElementById('usersTableBody');
        
        tbody.innerHTML = filteredUsers.map(user => `
            <tr>
                <td>#${user.id}</td>
                <td>${user.username}</td>
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
                        <button class="table-btn approve" onclick="approveUser(${user.id})">✅</button>
                        <button class="table-btn reject" onclick="rejectUser(${user.id})">❌</button>
                    ` : user.status === 'active' ? `
                        <button class="table-btn edit" onclick="editUser(${user.id})">✏️</button>
                        <button class="table-btn reject" onclick="rejectUser(${user.id})">❌</button>
                    ` : `
                        <button class="table-btn approve" onclick="approveUser(${user.id})">✅</button>
                    `}
                </td>
            </tr>
        `).join('');
    }

    // ========== ПОИСК ==========
    document.getElementById('userSearch')?.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        const filtered = allUsers.filter(user => 
            user.username.toLowerCase().includes(search)
        );
        renderUsersTable(filtered);
    });

    // ========== ДЕЙСТВИЯ С ПОЛЬЗОВАТЕЛЯМИ ==========
    window.approveUser = async function(userId) {
        currentRequestId = userId;
        showConfirmModal(
            'Подтверждение регистрации',
            'Вы уверены, что хотите подтвердить этого пользователя?',
            async () => {
                try {
                    const response = await fetch(`${API_URL}/api/admin/users/${userId}/approve`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        showNotification('✅ Пользователь подтвержден');
                        await Promise.all([
                            loadPendingUsers(),
                            loadAllUsers(),
                            loadStats()
                        ]);
                    } else {
                        if (response.status === 403) {
                            redirectToHome();
                            return;
                        }
                        showNotification('❌ Ошибка подтверждения', 'error');
                    }
                } catch (error) {
                    showNotification('❌ Ошибка сети', 'error');
                }
                closeConfirmModal();
            }
        );
    };

    window.rejectUser = async function(userId) {
        currentRequestId = userId;
        showConfirmModal(
            'Отклонение регистрации',
            'Вы уверены, что хотите отклонить этого пользователя?',
            async () => {
                try {
                    const response = await fetch(`${API_URL}/api/admin/users/${userId}/reject`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        showNotification('✅ Пользователь отклонен');
                        await Promise.all([
                            loadPendingUsers(),
                            loadAllUsers(),
                            loadStats()
                        ]);
                    } else {
                        if (response.status === 403) {
                            redirectToHome();
                            return;
                        }
                        showNotification('❌ Ошибка отклонения', 'error');
                    }
                } catch (error) {
                    showNotification('❌ Ошибка сети', 'error');
                }
                closeConfirmModal();
            }
        );
    };

    window.viewRequest = function(userId) {
        const user = pendingUsers.find(u => u.id === userId);
        if (user) {
            document.getElementById('viewUsername').textContent = user.username;
            document.getElementById('viewDate').textContent = formatDate(user.registered_at);
            document.getElementById('viewStatus').textContent = 'Ожидает подтверждения';
            document.getElementById('viewModal').style.display = 'flex';
            document.getElementById('modalOverlay').style.display = 'block';
            currentRequestId = userId;
        }
    };

    window.approveFromView = function() {
        if (currentRequestId) {
            approveUser(currentRequestId);
            closeViewModal();
        }
    };

    window.rejectFromView = function() {
        if (currentRequestId) {
            rejectUser(currentRequestId);
            closeViewModal();
        }
    };

    window.editUser = function(userId) {
        showNotification('✏️ Редактирование будет доступно позже', 'info');
    };

    // ========== МОДАЛКИ ==========
    function showConfirmModal(title, message, onConfirm) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmYes').onclick = onConfirm;
        document.getElementById('confirmModal').style.display = 'flex';
        document.getElementById('modalOverlay').style.display = 'block';
    }

    window.closeConfirmModal = function() {
        document.getElementById('confirmModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        currentRequestId = null;
    };

    window.closeViewModal = function() {
        document.getElementById('viewModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        currentRequestId = null;
    };

    // ========== ФОРМАТИРОВАНИЕ ==========
    function formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function formatDateTime(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getStatusText(status) {
        const statusMap = {
            'pending': 'Ожидает',
            'active': 'Активен',
            'rejected': 'Отклонен'
        };
        return statusMap[status] || status;
    }

    // ========== УВЕДОМЛЕНИЯ ==========
    function showNotification(text, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = type === 'success' ? '✅ ' + text : '❌ ' + text;
        notification.className = 'notification ' + (type === 'error' ? 'error' : '');
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
})();