// ========== УПРАВЛЕНИЕ АВТОРИЗАЦИЕЙ (JWT версия) ==========

const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
let currentUser = null;

// Работа с токеном
function saveToken(token) {
    if (token) {
        localStorage.setItem('auth_token', token);
    } else {
        localStorage.removeItem('auth_token');
    }
}

function getToken() {
    return localStorage.getItem('auth_token');
}

// Универсальный fetch с авторизацией
async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, {
        ...options,
        headers,
        credentials: 'omit'
    });
}

// Загружаем информацию о текущем пользователе
async function loadCurrentUser() {
    const token = getToken();
    
    if (!token) {
        currentUser = null;
        updateAuthUI();
        return;
    }
    
    try {
        const response = await authFetch(`${API_URL}/api/auth/me`);
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            updateAuthUI();
            console.log(`👤 Авторизован как: ${currentUser.username} (${currentUser.role})`);
        } else {
            saveToken(null);
            currentUser = null;
            updateAuthUI();
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        currentUser = null;
        saveToken(null);
        updateAuthUI();
    }
}

// Обновление UI в зависимости от статуса
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userBadge = document.getElementById('userBadge');
    
    if (!authButtons || !userInfo) return;
    
    if (currentUser) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = currentUser.username;
        userBadge.textContent = currentUser.role === 'admin' ? 'admin' : '';
        userBadge.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}

// Показать модалку входа
function showLoginModal() {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('loginModal');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'flex';
}

// Показать модалку регистрации
function showRegisterModal() {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('registerModal');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'flex';
}

// Закрыть все модалки авторизации
function closeAuthModal() {
    const overlay = document.getElementById('modalOverlay');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (overlay) overlay.style.display = 'none';
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
}

// Отправка регистрации
async function submitRegistration() {
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    
    if (!username || !password) {
        showError('Заполните все поля');
        return;
    }
    
    if (username.length < 3) {
        showError('Логин должен быть минимум 3 символа');
        return;
    }
    
    if (password.length < 4) {
        showError('Пароль должен быть минимум 4 символа');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('✅ Заявка отправлена! Ждите подтверждения админа.');
            closeAuthModal();
        } else {
            showError(data.error || 'Ошибка регистрации');
        }
    } catch (error) {
        showError('Ошибка сети');
    }
}

// Отправка входа
async function submitLogin() {
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        showError('Заполните все поля');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            saveToken(data.token);
            currentUser = data.user;
            updateAuthUI();
            closeAuthModal();
            showSuccess(`✅ Добро пожаловать, ${currentUser.username}!`);
            
            // Обновляем страницу, если нужно
            if (typeof loadUserVotes === 'function') loadUserVotes();
            if (typeof updateVotingUI === 'function') updateVotingUI();
            if (typeof loadDashboard === 'function') loadDashboard();
            
            // Если это админка, перезагружаем данные
            if (window.location.pathname.includes('admin.html')) {
                setTimeout(() => window.location.reload(), 500);
            }
        } else {
            showError(data.error || 'Ошибка входа');
        }
    } catch (error) {
        showError('Ошибка сети');
    }
}

// Выход
async function logout() {
    saveToken(null);
    currentUser = null;
    updateAuthUI();
    showSuccess('👋 До свидания!');
    
    // Обновляем страницу, если нужно
    if (typeof loadUserVotes === 'function') loadUserVotes();
    if (typeof updateVotingUI === 'function') updateVotingUI();
    if (typeof loadDashboard === 'function') loadDashboard();
    
    // Если это админка или профиль, переходим на главную
    if (window.location.pathname.includes('admin.html') || window.location.pathname.includes('profile.html')) {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } else {
        // Просто перезагружаем текущую страницу
        setTimeout(() => window.location.reload(), 500);
    }
}

// Проверка авторизации для действий
function requireAuth() {
    if (!currentUser) {
        showError('🔒 Требуется авторизация');
        showLoginModal();
        return false;
    }
    return true;
}

// Проверка прав администратора
function requireAdmin() {
    if (!currentUser) {
        showError('🔒 Требуется авторизация');
        showLoginModal();
        return false;
    }
    if (currentUser.role !== 'admin') {
        showError('⛔ Требуются права администратора');
        return false;
    }
    return true;
}

// Показать сообщение об ошибке
function showError(text) {
    console.error('Ошибка:', text);
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = '❌ ' + text;
        setTimeout(() => errorDiv.style.display = 'none', 3000);
    } else {
        alert('❌ ' + text);
    }
}

// Показать сообщение об успехе
function showSuccess(text) {
    console.log('Успех:', text);
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.style.display = 'block';
        successDiv.textContent = '✅ ' + text;
        setTimeout(() => successDiv.style.display = 'none', 2000);
    }
}

// Добавить в конец auth.js
window.setGlobalMode = function(mode, groupId) {
    localStorage.setItem('catalog_mode', mode);
    if (groupId) localStorage.setItem('selected_group', groupId);
    window.dispatchEvent(new CustomEvent('modeChanged', { 
        detail: { mode: mode, groupId: groupId } 
    }));
};

window.getGlobalMode = function() {
    return {
        mode: localStorage.getItem('catalog_mode') || 'personal',
        groupId: localStorage.getItem('selected_group') || null
    };
};

// Загружаем пользователя при старте
document.addEventListener('DOMContentLoaded', loadCurrentUser);

// Экспортируем функции в глобальную область
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeAuthModal = closeAuthModal;
window.submitRegistration = submitRegistration;
window.submitLogin = submitLogin;
window.logout = logout;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.authFetch = authFetch;
window.currentUser = currentUser;