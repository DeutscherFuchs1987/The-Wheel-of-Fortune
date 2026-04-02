(function () {
    const API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

    // ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
    let allItems = [];
    let wheelItems = [];
    let eliminatedLog = [];
    let currentCategory = 'Все';
    let isSpinning = false;

    // Настройки вращения
    let spinSpeed = 2.0;
    let spinRotations = 8;

    // Переменные для голосования (теперь групповые)
    let filmBoosts = {};
    let isEliminationMode = false;

    // Карты для поиска
    let titleToIdMap = {};
    let idToTitleMap = {};

    // ========== ПЕРЕМЕННЫЕ ДЛЯ РЕЖИМА ==========
    let currentMode = localStorage.getItem('catalog_mode') || 'personal';
    let selectedGroupId = localStorage.getItem('selected_group') || null;
    let userGroups = [];

    const colorPalette = [
        '#FF6B8B', '#5F9EA0', '#FFD166', '#B185DB', '#FFB347', '#6A8D92', '#E5989B',
        '#6D6875', '#FF9AA2', '#B5838D', '#7B9C9E', '#F4A261', '#A7C4B5', '#CD9777',
        '#C44569', '#4A8FE4', '#E59866', '#A27E8E', '#82A7A6', '#FFC4D6'
    ];

    // ========== DOM ЭЛЕМЕНТЫ ==========
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const filterDiv = document.getElementById('filter-buttons');
    const winnerNameDiv = document.getElementById('winnerName');
    const eliminatedDiv = document.getElementById('eliminatedContainer');
    const itemPoolDiv = document.getElementById('itemPool');
    const itemCountSpan = document.getElementById('itemCount');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const spinIndicator = document.getElementById('spinIndicator');

    const spinBtn = document.getElementById('spinOnceBtn');
    const spinEliminateBtn = document.getElementById('spinEliminateBtn');
    const resetWheelBtn = document.getElementById('resetWheelBtn');

    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const rotationsSlider = document.getElementById('rotationsSlider');
    const rotationsValue = document.getElementById('rotationsValue');

    // Элементы авторизации
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userBadge = document.getElementById('userBadge');

    // Модалки
    const modalOverlay = document.getElementById('modalOverlay');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');

    // Скрываем вторую кнопку режима исключения
    if (spinEliminateBtn) {
        spinEliminateBtn.style.display = 'none';
    }

    // ========== ФУНКЦИИ АВТОРИЗАЦИИ ==========
    async function loadCurrentUser() {
        try {
            const response = await window.authFetch(`${API_URL}/api/auth/me`);
            const data = await response.json();

            if (data.authenticated) {
                window.currentUser = data.user;
                updateAuthUI();
                console.log(`👤 Авторизован как: ${window.currentUser.username} (${window.currentUser.role})`);
            } else {
                window.currentUser = null;
                updateAuthUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            window.currentUser = null;
            updateAuthUI();
        }
    }

    function updateAuthUI() {
        if (!authButtons || !userInfo) return;

        if (window.currentUser) {
            authButtons.style.display = 'none';
            userInfo.style.display = 'flex';
            userName.textContent = window.currentUser.username;
            userBadge.textContent = window.currentUser.role === 'admin' ? 'admin' : '';
            userBadge.style.display = window.currentUser.role === 'admin' ? 'inline-block' : 'none';
        } else {
            authButtons.style.display = 'flex';
            userInfo.style.display = 'none';
        }
    }

    window.showLoginModal = function () {
        modalOverlay.style.display = 'block';
        loginModal.style.display = 'flex';
    };

    window.showRegisterModal = function () {
        modalOverlay.style.display = 'block';
        registerModal.style.display = 'flex';
    };

    window.closeAuthModal = function () {
        modalOverlay.style.display = 'none';
        loginModal.style.display = 'none';
        registerModal.style.display = 'none';
    };

    window.submitRegistration = async function () {
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
                window.closeAuthModal();
            } else {
                showError(data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            showError('Ошибка сети');
        }
    };

    window.submitLogin = async function () {
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
                localStorage.setItem('auth_token', data.token);
                window.currentUser = data.user;
                updateAuthUI();
                window.closeAuthModal();
                showSuccess(`✅ Добро пожаловать, ${window.currentUser.username}!`);
                await loadGroupBoosts();
                await loadProjectsByMode();
                drawWheel();
            } else {
                showError(data.error || 'Ошибка входа');
            }
        } catch (error) {
            showError('Ошибка сети');
        }
    };

    window.logout = async function () {
        localStorage.removeItem('auth_token');
        window.currentUser = null;
        updateAuthUI();
        showSuccess('👋 До свидания!');
        await loadGroupBoosts();
        await loadProjectsByMode();
        drawWheel();
    };

    function requireAuth() {
        if (!window.currentUser) {
            showError('🔒 Требуется авторизация');
            window.showLoginModal();
            return false;
        }
        return true;
    }

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

    function showError(text) {
        console.error('Ошибка:', text);
        errorMessageDiv.style.display = 'block';
        errorMessageDiv.textContent = '❌ ' + text;
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 3000);
    }

    function showSuccess(text) {
        console.log('Успех:', text);
        successMessageDiv.style.display = 'block';
        successMessageDiv.textContent = '✅ ' + text;
        setTimeout(() => {
            successMessageDiv.style.display = 'none';
        }, 2000);
    }

    // ========== ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ИСКЛЮЧЕНИЯ ==========
    function initModeToggle() {
        const modeToggle = document.getElementById('modeToggle');
        const normalLabel = document.querySelector('.mode-label:first-child');
        const elimLabel = document.querySelector('.elimination-label');

        if (!modeToggle) return;

        function updateModeLabels(isElim) {
            if (normalLabel && elimLabel) {
                if (isElim) {
                    normalLabel.classList.remove('active');
                    elimLabel.classList.add('active');
                    if (spinBtn) {
                        spinBtn.innerHTML = '⚔️ Крутить (Исключение)';
                        spinBtn.classList.add('eliminate-mode');
                    }
                } else {
                    normalLabel.classList.add('active');
                    elimLabel.classList.remove('active');
                    if (spinBtn) {
                        spinBtn.innerHTML = '🎲 Крутить (Обычный)';
                        spinBtn.classList.remove('eliminate-mode');
                    }
                }
            }
        }

        updateModeLabels(false);

        modeToggle.addEventListener('click', () => {
            isEliminationMode = !isEliminationMode;
            modeToggle.classList.toggle('elimination', isEliminationMode);
            updateModeLabels(isEliminationMode);
            drawWheel();
            showSuccess(isEliminationMode ?
                '⚔️ Режим исключения: бусты уменьшают шанс вылететь' :
                '🎲 Обычный режим: бусты увеличивают шанс победы');
        });
    }

    // ========== РАБОТА С ID ФИЛЬМОВ ==========
    function updateMaps() {
        titleToIdMap = {};
        idToTitleMap = {};
        allItems.forEach(item => {
            if (item.id) {
                titleToIdMap[item.Название] = item.id;
                idToTitleMap[item.id] = item.Название;
            }
        });
    }

    function getFilmIdByTitle(title) {
        return titleToIdMap[title] || null;
    }

    function getFilmTitleById(id) {
        return idToTitleMap[id] || id;
    }

    // ========== ЗАГРУЗКА БУСТОВ (ГРУППОВЫХ ИЛИ ЛИЧНЫХ) ==========
    async function loadGroupBoosts() {
        if (currentMode === 'group' && selectedGroupId) {
            try {
                const response = await window.authFetch(`${API_URL}/api/voting/group/${selectedGroupId}/boosts`);
                if (response.ok) {
                    filmBoosts = await response.json();
                    console.log('📊 Загружены групповые бусты:', filmBoosts);
                    drawWheel();
                }
            } catch (error) {
                console.error('Ошибка загрузки групповых бустов:', error);
                filmBoosts = {};
            }
        } else {
            // Личный режим - загружаем глобальные бусты
            try {
                const response = await window.authFetch(`${API_URL}/api/film-boosts`);
                if (response.ok) {
                    filmBoosts = await response.json();
                    console.log('📊 Загружены личные бусты:', filmBoosts);
                    drawWheel();
                }
            } catch (error) {
                console.error('Ошибка загрузки личных бустов:', error);
                filmBoosts = {};
            }
        }
    }

    // ========== УПРАВЛЕНИЕ РЕЖИМАМИ (ЛИЧНЫЙ/ГРУППОВОЙ) ==========
    function syncModeAcrossPages() {
        localStorage.setItem('catalog_mode', currentMode);
        window.dispatchEvent(new CustomEvent('modeChanged', {
            detail: { mode: currentMode, groupId: selectedGroupId }
        }));
    }

    window.addEventListener('modeChanged', (event) => {
        if (event.detail.mode !== currentMode) {
            currentMode = event.detail.mode;
            selectedGroupId = event.detail.groupId;
            updateModeUI();
            loadProjectsByMode();
        }
    });

    async function loadUserGroupsForSelector() {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups`);
            if (response.ok) {
                userGroups = await response.json();
                console.log('👥 Загружены группы:', userGroups);
                renderGroupSelector();
            }
        } catch (error) {
            console.error('Ошибка загрузки групп:', error);
            userGroups = [];
        }
    }

    function renderGroupSelector() {
        const container = document.getElementById('groupSelector');
        if (!container) return;

        if (userGroups.length === 0) {
            container.innerHTML = '<select disabled><option>Нет групп</option></select>';
            return;
        }

        container.innerHTML = `
            <select id="groupSelect" onchange="window.selectGroup(this.value)">
                <option value="">-- Выберите группу --</option>
                ${userGroups.map(group => `
                    <option value="${group.id}" ${selectedGroupId === group.id ? 'selected' : ''}>
                        ${escapeHtml(group.name)} (${group.role === 'admin' ? 'admin' : 'участник'})
                    </option>
                `).join('')}
            </select>
            <button class="refresh-group-btn" onclick="window.refreshGroupProjects()">🔄</button>
        `;
    }

    window.selectGroup = function (groupId) {
        selectedGroupId = groupId || null;
        if (groupId) {
            localStorage.setItem('selected_group', groupId);
        } else {
            localStorage.removeItem('selected_group');
        }
        if (currentMode === 'group') {
            loadProjectsByMode();
        }
        syncModeAcrossPages();
    };

    window.refreshGroupProjects = function () {
        if (selectedGroupId && currentMode === 'group') {
            loadProjectsByMode();
            showSuccess('Проекты группы обновлены');
        }
    };

    async function loadProjectsByMode() {
        if (currentMode === 'personal') {
            await loadPersonalProjectsForWheel();
        } else if (selectedGroupId) {
            await loadGroupProjectsForWheel(selectedGroupId);
        } else {
            showError('Выберите группу для просмотра');
            allItems = [];
            wheelItems = [];
            updateFilters();
            drawWheel();
            updatePoolView();
        }
        // После загрузки проектов загружаем бусты
        await loadGroupBoosts();
    }

    async function loadPersonalProjectsForWheel() {
        try {
            const response = await window.authFetch(`${API_URL}/api/user/projects/list`);
            if (response.ok) {
                const projects = await response.json();
                const plannedProjects = projects.filter(p => p.status === 'planned');

                allItems = plannedProjects.map(p => ({
                    Название: p.data?.title_ru || p.data?.title || 'Без названия',
                    Жанр: p.data?.type || 'Фильм',
                    id: p.project_id
                }));

                updateMaps();
                updateFilters();
                syncWheel();
                drawWheel();
                updatePoolView();

                console.log(`📚 Загружено ${allItems.length} проектов в планах (личный режим)`);
            } else {
                console.error('Ошибка загрузки личных проектов:', response.status);
                fallbackToOldSystem();
            }
        } catch (error) {
            console.error('Ошибка загрузки личных проектов:', error);
            fallbackToOldSystem();
        }
    }

    async function loadGroupProjectsForWheel(groupId) {
        try {
            const response = await window.authFetch(`${API_URL}/api/groups/${groupId}/projects`);
            if (response.ok) {
                const projects = await response.json();
                const plannedProjects = projects.filter(p => p.status === 'planned');

                allItems = plannedProjects.map(p => ({
                    Название: p.data?.title_ru || p.data?.title || 'Без названия',
                    Жанр: p.data?.type || 'Фильм',
                    id: p.project_id
                }));

                updateMaps();
                updateFilters();
                syncWheel();
                drawWheel();
                updatePoolView();

                console.log(`📚 Загружено ${allItems.length} проектов в планах (групповой режим, группа: ${groupId})`);
            } else {
                console.error('Ошибка загрузки групповых проектов:', response.status);
                fallbackToOldSystem();
            }
        } catch (error) {
            console.error('Ошибка загрузки групповых проектов:', error);
            fallbackToOldSystem();
        }
    }

    async function fallbackToOldSystem() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (response.ok) {
                const allProjects = await response.json();
                const plannedProjects = allProjects.filter(p => !p.watched && !p.inProgress);

                allItems = plannedProjects.map(p => ({
                    Название: p.title_ru || p.title,
                    Жанр: p.type || 'Фильм',
                    id: p.id
                }));

                updateMaps();
                updateFilters();
                syncWheel();
                drawWheel();
                updatePoolView();

                console.log(`📚 Загружено ${allItems.length} проектов из старой системы`);
            }
        } catch (error) {
            console.error('Ошибка загрузки из старой системы:', error);
        }
    }

    function updateModeUI() {
        const catalogModeToggle = document.getElementById('catalogModeToggle');
        const personalLabel = document.querySelector('.mode-label.personal');
        const groupLabel = document.querySelector('.mode-label.group');
        const groupSelector = document.getElementById('groupSelector');

        if (!catalogModeToggle) return;

        if (currentMode === 'personal') {
            if (personalLabel) personalLabel.classList.add('active');
            if (groupLabel) groupLabel.classList.remove('active');
            if (groupSelector) groupSelector.style.display = 'none';
            catalogModeToggle.classList.remove('group-mode');
        } else {
            if (personalLabel) personalLabel.classList.remove('active');
            if (groupLabel) groupLabel.classList.add('active');
            if (groupSelector) groupSelector.style.display = 'flex';
            catalogModeToggle.classList.add('group-mode');
        }
    }

    function setupModeToggle() {
        const catalogModeToggle = document.getElementById('catalogModeToggle');
        if (!catalogModeToggle) {
            console.warn('⚠️ catalogModeToggle не найден на странице');
            return;
        }

        const newToggle = catalogModeToggle.cloneNode(true);
        catalogModeToggle.parentNode.replaceChild(newToggle, catalogModeToggle);

        newToggle.addEventListener('click', () => {
            currentMode = currentMode === 'personal' ? 'group' : 'personal';
            localStorage.setItem('catalog_mode', currentMode);
            updateModeUI();
            loadProjectsByMode();
            syncModeAcrossPages();
        });

        updateModeUI();
    }

    // ========== ФУНКЦИИ КОЛЕСА ==========
    function getWeightedRandomIndex(items) {
        const weights = items.map(item => {
            const filmId = getFilmIdByTitle(item);
            const boost = filmBoosts[filmId] || 0;
            return isEliminationMode ?
                Math.max(0.1, 1 - boost * 2) :
                1 + boost * 2;
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < weights.length; i++) {
            if (random < weights[i]) return i;
            random -= weights[i];
        }
        return 0;
    }

    function drawWheel(rotateAngle = 0) {
        const count = wheelItems.length;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (count === 0) {
            ctx.beginPath();
            ctx.arc(300, 300, 280, 0, 2 * Math.PI);
            ctx.fillStyle = '#262d4a';
            ctx.fill();
            ctx.strokeStyle = '#5f6a9e';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = '#b5c2ff';
            ctx.font = 'bold 22px Segoe UI';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Нет элементов', 300, 300);
            return;
        }

        const weights = wheelItems.map(item => {
            const filmId = getFilmIdByTitle(item);
            const boost = filmBoosts[filmId] || 0;
            return isEliminationMode ?
                Math.max(0.3, 1 - boost * 2) :
                1 + boost * 2;
        });

        const positiveWeights = weights.map(w => Math.max(0.3, w));
        const totalWeight = positiveWeights.reduce((a, b) => a + b, 0);
        const radius = 280;
        const centerX = 300, centerY = 300;

        let startAngle = rotateAngle;
        for (let i = 0; i < count; i++) {
            const angle = (positiveWeights[i] / totalWeight) * 2 * Math.PI;
            const endAngle = startAngle + angle;
            const color = colorPalette[i % colorPalette.length];

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#0b0e1a';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + angle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#121212';
            ctx.font = 'bold 16px "Segoe UI", sans-serif';
            ctx.shadowColor = 'rgba(255,255,255,0.5)';
            ctx.shadowBlur = 4;

            let text = wheelItems[i];
            if (text.length > 20) text = text.substr(0, 18) + '…';
            ctx.fillText(text, radius - 24, 8);
            ctx.restore();

            const filmId = getFilmIdByTitle(wheelItems[i]);
            const boost = filmBoosts[filmId] || 0;
            if (boost > 0) {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(startAngle + angle / 2);
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 12px "Segoe UI", sans-serif';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;

                // Показываем количество голосов числом со звездой
                const votes = Math.floor(boost);
                if (votes <= 5) {
                    ctx.fillText('★'.repeat(votes), radius - 45, -10);
                } else {
                    ctx.fillText(`★${votes}`, radius - 45, -10);
                }
                ctx.restore();
            }

            startAngle = endAngle;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
        ctx.fillStyle = '#f2e9c0';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#d4af37';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius - 10);
        ctx.lineTo(centerX - 10, centerY - radius + 20);
        ctx.lineTo(centerX + 10, centerY - radius + 20);
        ctx.closePath();
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function spinWheel() {
        if (isEliminationMode) {
            spinElimination();
        } else {
            spinNormal();
        }
    }

    function spinNormal() {
        spinAnimation((selected, index) => {
            winnerNameDiv.textContent = selected;
        });
    }

    function spinElimination() {
        if (wheelItems.length === 0) {
            showError('Колесо пустое');
            return;
        }
        if (wheelItems.length === 1) {
            winnerNameDiv.textContent = wheelItems[0] + ' 🏆';
            return;
        }

        spinAnimation((selected, index) => {
            const removed = wheelItems.splice(index, 1)[0];
            eliminatedLog.push(removed);
            updateEliminatedView();
            drawWheel();
            updatePoolView();
        });
    }

    function spinAnimation(onComplete) {
        if (wheelItems.length === 0) {
            showError('Добавьте элементы на колесо');
            return;
        }

        isSpinning = true;
        spinBtn.disabled = true;

        const startTime = performance.now();
        const duration = spinSpeed * 1000;
        const startAngle = 0;
        const targetIndex = getWeightedRandomIndex(wheelItems);
        const pointerAngle = (3 * Math.PI) / 2;
        const segmentSize = (2 * Math.PI) / wheelItems.length;
        const targetStartAngle = pointerAngle - (targetIndex * segmentSize) - segmentSize / 2;
        const finalAngle = targetStartAngle - (spinRotations * 2 * Math.PI);

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentAngle = startAngle + (finalAngle * easeOut);

            drawWheel(currentAngle);
            spinIndicator.textContent = `⚡ Вращение... ${Math.round(progress * 100)}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                isSpinning = false;
                spinBtn.disabled = false;
                spinIndicator.textContent = '';

                const selected = wheelItems[targetIndex];
                winnerNameDiv.textContent = selected;

                const tags = document.querySelectorAll('.tag');
                tags.forEach(tag => {
                    if (tag.textContent.includes(selected)) {
                        tag.style.background = '#5f4bb6';
                        tag.style.boxShadow = '0 0 15px #a990ff';
                        setTimeout(() => {
                            tag.style.background = '';
                            tag.style.boxShadow = '';
                        }, 1000);
                    }
                });

                if (onComplete) onComplete(selected, targetIndex);
            }
        }

        requestAnimationFrame(animate);
    }

    // ========== ФИЛЬТРЫ ==========
    function updateFilters() {
        const genres = extractGenres();
        filterDiv.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.textContent = 'Все';
        allBtn.dataset.filter = 'Все';
        if (currentCategory === 'Все') allBtn.classList.add('active');
        allBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-buttons button').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            currentCategory = 'Все';
            syncWheel();
        });
        filterDiv.appendChild(allBtn);

        genres.forEach(genre => {
            const btn = document.createElement('button');
            btn.textContent = genre;
            btn.dataset.filter = genre;
            if (currentCategory === genre) btn.classList.add('active');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-buttons button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = genre;
                syncWheel();
            });
            filterDiv.appendChild(btn);
        });
    }

    function extractGenres() {
        return [...new Set(allItems.map(item => item.Жанр).filter(Boolean))].sort();
    }

    function getCurrentItems() {
        return currentCategory === 'Все'
            ? allItems.map(item => item.Название)
            : allItems.filter(item => item.Жанр === currentCategory).map(item => item.Название);
    }

    function syncWheel() {
        wheelItems = getCurrentItems();
        eliminatedLog = [];
        winnerNameDiv.textContent = '—';
        drawWheel();
        updatePoolView();
        updateEliminatedView();
    }

    function updatePoolView() {
        itemPoolDiv.innerHTML = '';
        if (wheelItems.length === 0) {
            itemPoolDiv.innerHTML = '<span class="tag">❌ пусто</span>';
            itemCountSpan.textContent = '0';
            return;
        }

        wheelItems.forEach(item => {
            const container = document.createElement('span');
            container.className = 'tag';
            container.innerHTML = `<span>${escapeHtml(item)}</span><button class="delete-item" onclick="deleteItem('${escapeHtml(item)}')">✕</button>`;
            itemPoolDiv.appendChild(container);
        });
        itemCountSpan.textContent = wheelItems.length;
    }

    window.deleteItem = async function (itemName) {
        try {
            const response = await fetch(`${API_URL}/projects`);
            const projects = await response.json();
            const projectToDelete = projects.find(p =>
                (p.title_ru === itemName || p.title === itemName) && !p.watched && !p.inProgress
            );

            if (projectToDelete) {
                await fetch(`${API_URL}/projects/${projectToDelete.id}`, {
                    method: 'DELETE'
                });
                await loadProjectsByMode();
                showSuccess(`Удалено: ${itemName}`);
            }
        } catch (error) {
            showError('Ошибка при удалении: ' + error.message);
        }
    };

    function updateEliminatedView() {
        eliminatedDiv.innerHTML = eliminatedLog.length === 0
            ? '<span>✖️ пока никого</span>'
            : eliminatedLog.map((name, idx) => `<span>❌ ${idx + 1}. ${escapeHtml(name)}</span>`).join('');
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    spinBtn.addEventListener('click', spinWheel);
    resetWheelBtn.addEventListener('click', syncWheel);

    speedSlider.addEventListener('input', () => {
        spinSpeed = parseFloat(speedSlider.value);
        speedValue.textContent = spinSpeed.toFixed(1) + ' сек';
    });

    rotationsSlider.addEventListener('input', () => {
        spinRotations = parseInt(rotationsSlider.value);
        rotationsValue.textContent = spinRotations;
    });

    console.log('🚀 Запуск колеса фортуны...');

    initModeToggle();
    loadCurrentUser();
    loadUserGroupsForSelector();
    setupModeToggle();
    loadProjectsByMode();
    setInterval(loadProjectsByMode, 30000);
    drawWheel();
    updatePoolView();
    updateEliminatedView();
})();