(function() {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
    let currentUser = null;
    let currentProject = null;

    // Загрузка данных при старте
    document.addEventListener('DOMContentLoaded', async () => {
        await loadCurrentUser();
        if (currentUser) {
            loadProfileData();
        } else {
            window.location.href = 'index.html';
        }
    });

    async function loadCurrentUser() {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.authenticated) {
                currentUser = data.user;
                document.getElementById('profileUsername').textContent = currentUser.username;
                if (currentUser.role === 'admin') {
                    document.getElementById('profileBadge').innerHTML = '<span>ADMIN</span>';
                }
            } else {
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            window.location.href = 'index.html';
        }
    }

    async function loadProfileData() {
        // Здесь будут загружаться:
        // - Статистика
        // - Списки проектов
        // - История голосований
        showSuccess('Профиль загружен');
    }

    window.switchTab = function(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
    };

    window.logout = async function() {
        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            window.location.href = 'index.html';
        } catch (error) {
            showError('Ошибка при выходе');
        }
    };

    window.showStatusModal = function(projectId, title) {
        currentProject = { id: projectId, title: title };
        document.getElementById('modalProjectTitle').textContent = title;
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('statusModal').style.display = 'flex';
    };

    window.closeStatusModal = function() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('statusModal').style.display = 'none';
        currentProject = null;
    };

    window.changeStatus = async function(status) {
        if (!currentProject) return;
        
        // Здесь будет логика изменения статуса
        console.log('Меняем статус:', currentProject.id, status);
        closeStatusModal();
        showSuccess('Статус обновлен');
    };

    function showSuccess(text) {
        const msg = document.createElement('div');
        msg.className = 'success-message';
        msg.textContent = '✅ ' + text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e3a2a;
            color: #a0ffa0;
            padding: 12px 24px;
            border-radius: 30px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    function showError(text) {
        const msg = document.createElement('div');
        msg.className = 'error-message';
        msg.textContent = '❌ ' + text;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3d1e2b;
            color: #ff8a8a;
            padding: 12px 24px;
            border-radius: 30px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }
})();