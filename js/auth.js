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

// Показать ошибку внутри модалки
function showModalError(modalId, message) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const errorDiv = modal.querySelector('.auth-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    }
}

// Очистить ошибки в модалках
function clearModalErrors() {
    document.querySelectorAll('.auth-error').forEach(error => {
        error.style.display = 'none';
        error.textContent = '';
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
        if (userName) userName.textContent = currentUser.username;
        if (userBadge) {
            userBadge.textContent = currentUser.role === 'admin' ? 'admin' : '';
            userBadge.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
        }
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}

// Показать модалку входа
function showLoginModal() {
    clearModalErrors();
    const overlay = document.getElementById('modalOverlay');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (overlay) overlay.style.display = 'block';
    if (loginModal) loginModal.style.display = 'flex';
    if (registerModal) registerModal.style.display = 'none';
    
    // Очищаем поля
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
}

// Показать модалку регистрации
function showRegisterModal() {
    clearModalErrors();
    const overlay = document.getElementById('modalOverlay');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (overlay) overlay.style.display = 'block';
    if (registerModal) registerModal.style.display = 'flex';
    if (loginModal) loginModal.style.display = 'none';
    
    // Очищаем поля
    const regUsername = document.getElementById('regUsername');
    const regPassword = document.getElementById('regPassword');
    if (regUsername) regUsername.value = '';
    if (regPassword) regPassword.value = '';
}

// Переключение с регистрации на вход
window.switchToLogin = function() {
    clearModalErrors();
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    if (loginModal) loginModal.style.display = 'flex';
    if (registerModal) registerModal.style.display = 'none';
};

// Переключение со входа на регистрацию
window.switchToRegister = function() {
    clearModalErrors();
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'flex';
};

// Закрыть все модалки авторизации
function closeAuthModal() {
    const overlay = document.getElementById('modalOverlay');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (overlay) overlay.style.display = 'none';
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
    clearModalErrors();
}

// Отправка регистрации
async function submitRegistration() {
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    
    if (!username || !password) {
        showModalError('registerModal', 'Заполните все поля');
        return;
    }
    
    if (username.length < 3) {
        showModalError('registerModal', 'Логин должен быть минимум 3 символа');
        return;
    }
    
    if (password.length < 4) {
        showModalError('registerModal', 'Пароль должен быть минимум 4 символа');
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
            showModalError('registerModal', '✅ Заявка отправлена! Ждите подтверждения админа.');
            setTimeout(() => {
                closeAuthModal();
                showLoginModal();
            }, 2000);
        } else {
            showModalError('registerModal', data.error || 'Ошибка регистрации');
        }
    } catch (error) {
        showModalError('registerModal', 'Ошибка сети. Попробуйте позже.');
    }
}

// Отправка входа
async function submitLogin() {
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        showModalError('loginModal', 'Заполните все поля');
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
            showSuccessMessage(`Добро пожаловать, ${currentUser.username}!`);
            
            // Обновляем страницу, если нужно
            if (typeof loadProjectsByMode === 'function') {
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                setTimeout(() => window.location.reload(), 500);
            }
        } else {
            // Обобщённое сообщение об ошибке
            showModalError('loginModal', 'Неверный логин или пароль');
        }
    } catch (error) {
        showModalError('loginModal', 'Ошибка сети. Попробуйте позже.');
    }
}

// Выход
async function logout() {
    saveToken(null);
    currentUser = null;
    updateAuthUI();
    showSuccessMessage('До свидания!');
    
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

// Показать сообщение об успехе (тост)
function showSuccessMessage(text) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = text;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}

// Проверка авторизации для действий
function requireAuth() {
    if (!currentUser) {
        showLoginModal();
        return false;
    }
    return true;
}

// Проверка прав администратора
function requireAdmin() {
    if (!currentUser) {
        showLoginModal();
        return false;
    }
    if (currentUser.role !== 'admin') {
        alert('⛔ Требуются права администратора');
        return false;
    }
    return true;
}

// Загружаем пользователя при старте
document.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
    setupModalCloseHandlers();
});

// Настройка закрытия модалок
function setupModalCloseHandlers() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeAuthModal);
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAuthModal();
        }
    });
}

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
window.switchToLogin = switchToLogin;
window.switchToRegister = switchToRegister;