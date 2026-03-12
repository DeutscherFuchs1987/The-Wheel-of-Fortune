// ========== УПРАВЛЕНИЕ АВТОРИЗАЦИЕЙ ==========

const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';
let currentUser = null;

// Загружаем информацию о текущем пользователе
async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            updateAuthUI();
            console.log(`👤 Авторизован как: ${currentUser.username} (${currentUser.role})`);
        } else {
            currentUser = null;
            updateAuthUI();
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        currentUser = null;
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
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('loginModal').style.display = 'flex';
}

// Показать модалку регистрации
function showRegisterModal() {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('registerModal').style.display = 'flex';
}

// Закрыть все модалки авторизации
function closeAuthModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('registerModal').style.display = 'none';
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
            credentials: 'include',
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
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateAuthUI();
            closeAuthModal();
            showSuccess(`✅ Добро пожаловать, ${currentUser.username}!`);
            
            // Обновляем страницу, если нужно
            if (typeof loadUserVotes === 'function') loadUserVotes();
            if (typeof updateVotingUI === 'function') updateVotingUI();
        } else {
            showError(data.error || 'Ошибка входа');
        }
    } catch (error) {
        showError('Ошибка сети');
    }
}

// Выход
async function logout() {
    try {
        await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        currentUser = null;
        updateAuthUI();
        showSuccess('👋 До свидания!');
        
        // Обновляем страницу
        if (typeof loadUserVotes === 'function') loadUserVotes();
        if (typeof updateVotingUI === 'function') updateVotingUI();
    } catch (error) {
        showError('Ошибка при выходе');
    }
}

// Проверка авторизации для действий
function requireAuth(action) {
    if (!currentUser) {
        showError('🔒 Требуется авторизация');
        showLoginModal();
        return false;
    }
    return true;
}

// Проверка прав администратора
function requireAdmin(action) {
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
window.currentUser = currentUser;