(function() {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let pendingUsers = [];
    let allUsers = [];
    let currentRequestId = null;

    // ========== ЗАЩИТА АДМИНКИ ==========
    // Самое первое действие при загрузке страницы
    document.addEventListener('DOMContentLoaded', async () => {
        // Показываем заглушку загрузки
        showLoading();
        
        // Проверяем авторизацию и права
        const isAdmin = await checkAdminAccess();
        
        if (isAdmin) {
            // Если админ - загружаем данные
            hideLoading();
            loadDashboard();
        } else {
            // Если не админ - редирект на главную
            redirectToHome();
        }
    });

    // Функция проверки доступа админа
    async function checkAdminAccess() {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                credentials: 'include',
                // Добавляем таймаут, чтобы не ждать вечно
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

    // Редирект на главную
    function redirectToHome() {
        console.log('🔄 Редирект на главную...');
        
        // Показываем сообщение перед редиректом
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
        
        // Анимация
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
        
        // Редирект через 2 секунды
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }

    // Показать заглушку загрузки
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
            <div style="color: white; font-size: 1.2rem;">Проверка доступа...</div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(loader);
    }

    // Скрыть заглушку загрузки
    function hideLoading() {
        const loader = document.getElementById('admin-loader');
        if (loader) {
            loader.remove();
        }
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
                    // Если вдруг права потеряны - редирект
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