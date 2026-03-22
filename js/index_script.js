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

    // Переменные для голосования
    let filmBoosts = {};
    let userVotes = {};
    let isEliminationMode = false;
    let currentCycleId = null;

    // Карты для поиска
    let titleToIdMap = {};
    let idToTitleMap = {};

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

    // Элементы голосования
    const openVoteBtn = document.getElementById('openVoteBtn');
    const showStatsBtn = document.getElementById('showStatsBtn');
    const votingStats = document.getElementById('votingStats');
    const votersIndicator = document.getElementById('votersIndicator');
    const votersList = document.getElementById('votersList');

    // Элементы авторизации
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userBadge = document.getElementById('userBadge');

    // Модалки
    const modalOverlay = document.getElementById('modalOverlay');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const votingModal = document.getElementById('votingModal');
    const statsModal = document.getElementById('statsModal');

    // Скрываем вторую кнопку режима исключения
    if (spinEliminateBtn) {
        spinEliminateBtn.style.display = 'none';
    }

    // ========== ФУНКЦИИ АВТОРИЗАЦИИ (JWT версия) ==========
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

    window.showLoginModal = function() {
        modalOverlay.style.display = 'block';
        loginModal.style.display = 'flex';
    };

    window.showRegisterModal = function() {
        modalOverlay.style.display = 'block';
        registerModal.style.display = 'flex';
    };

    window.closeAuthModal = function() {
        modalOverlay.style.display = 'none';
        loginModal.style.display = 'none';
        registerModal.style.display = 'none';
    };

    window.closeVotingModal = function() {
        modalOverlay.style.display = 'none';
        votingModal.style.display = 'none';
    };

    window.closeStatsModal = function() {
        modalOverlay.style.display = 'none';
        statsModal.style.display = 'none';
        document.querySelectorAll('.temporary-effect').forEach(e => e.remove());
    };

    window.submitRegistration = async function() {
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

    window.submitLogin = async function() {
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
                // Сохраняем токен
                localStorage.setItem('auth_token', data.token);
                window.currentUser = data.user;
                updateAuthUI();
                window.closeAuthModal();
                showSuccess(`✅ Добро пожаловать, ${window.currentUser.username}!`);
                await loadAllVotes();
                await loadFilmBoosts();
                drawWheel();
            } else {
                showError(data.error || 'Ошибка входа');
            }
        } catch (error) {
            showError('Ошибка сети');
        }
    };

    window.logout = async function() {
        localStorage.removeItem('auth_token');
        window.currentUser = null;
        updateAuthUI();
        showSuccess('👋 До свидания!');
        await loadAllVotes();
        await loadFilmBoosts();
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

    // ========== ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ==========
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

    // ========== ФУНКЦИИ ГОЛОСОВАНИЯ (используем authFetch) ==========
    async function startVotingCycle() {
        try {
            const response = await window.authFetch(`${API_URL}/api/voting/start`, { 
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                currentCycleId = data.cycle_id;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка создания цикла:', error);
            return false;
        }
    }

    async function loadFilmBoosts() {
        try {
            const response = await window.authFetch(`${API_URL}/api/film-boosts`);
            if (response.ok) {
                filmBoosts = await response.json();
                updateVotingUI();
                drawWheel();
            }
        } catch (error) {
            console.error('Ошибка загрузки бустов:', error);
        }
    }

    async function loadAllVotes() {
        try {
            const response = await window.authFetch(`${API_URL}/api/voting/current-cycle`);
            if (response.ok) {
                const data = await response.json();
                userVotes = data.votes || {};
                currentCycleId = data.cycle_id;
                updateVotersIndicator();
            }
        } catch (error) {
            console.error('Ошибка загрузки голосов:', error);
        }
    }

    function updateVotingUI() {
        if (votingStats) {
            const totalVotes = Object.keys(filmBoosts).length;
            votingStats.textContent = `${totalVotes} фильмов с бустами`;
        }
    }

    function updateVotersIndicator() {
        if (!votersIndicator || !votersList) return;
        const voters = Object.keys(userVotes);
        if (voters.length > 0) {
            votersIndicator.style.display = 'flex';
            votersList.textContent = voters.map(v => {
                const names = { senya: 'Сеня', vanya: 'Ваня', pasha: 'Паша', volodya: 'Володя', artem: 'Артем' };
                return `👤 ${names[v] || v}`;
            }).join(' • ');
        } else {
            votersIndicator.style.display = 'none';
        }
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
                ctx.font = 'bold 14px "Segoe UI", sans-serif';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                const stars = Math.min(3, Math.ceil(boost * 10));
                ctx.fillText('★'.repeat(stars), radius - 45, -10);
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

    // ========== МОДАЛЬНЫЕ ОКНА ==========
    window.showVotingModal = async function() {
        if (!requireAuth()) return;

        const filteredItems = currentCategory === 'Все' ? allItems : allItems.filter(item => item.Жанр === currentCategory);
        const availableMovies = filteredItems.filter(item => item.id);

        if (availableMovies.length === 0) {
            showError('Нет фильмов в выбранной категории для голосования');
            return;
        }

        const currentUserVotes = userVotes[window.currentUser?.username] || [];
        
        document.getElementById('votingCategory').textContent = currentCategory === 'Все' ? '(все категории)' : `(${currentCategory})`;
        document.getElementById('votingUser').textContent = `Игрок: 👤 ${window.currentUser?.username}`;
        
        const moviesList = document.getElementById('votingMoviesList');
        moviesList.innerHTML = availableMovies.map(movie => {
            const isSelected = currentUserVotes.includes(movie.id);
            const boost = filmBoosts[movie.id] || 0;
            return `
                <div class="voting-movie-item ${isSelected ? 'selected' : ''}" 
                     data-film-id="${movie.id}" data-film-title="${movie.Название.toLowerCase()}">
                    <div class="movie-info">
                        <span class="movie-title">${movie.Название}</span>
                        ${boost > 0 ? `<span class="movie-boost">+${boost.toFixed(1)}</span>` : ''}
                    </div>
                    <span class="movie-check">✓</span>
                </div>
            `;
        }).join('');

        const movieItems = moviesList.querySelectorAll('.voting-movie-item');
        const submitBtn = document.getElementById('submitVoteBtn');
        const counter = document.getElementById('selectedCounter');
        const searchInput = document.getElementById('voteSearchInput');
        let selectedVotes = [...currentUserVotes];

        function filterMovies(searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            movieItems.forEach(item => {
                item.style.display = term === '' || item.dataset.filmTitle.includes(term) ? 'flex' : 'none';
            });
        }

        searchInput.oninput = (e) => filterMovies(e.target.value);
        searchInput.value = '';

        function updateSelection() {
            movieItems.forEach(item => {
                const filmId = item.dataset.filmId;
                item.classList.toggle('selected', selectedVotes.includes(filmId));
            });
            counter.textContent = `Выбрано: ${selectedVotes.length}/3`;
            submitBtn.disabled = selectedVotes.length !== 3;
        }

        movieItems.forEach(item => {
            item.onclick = () => {
                const filmId = item.dataset.filmId;
                if (selectedVotes.includes(filmId)) {
                    selectedVotes = selectedVotes.filter(id => id !== filmId);
                } else if (selectedVotes.length < 3) {
                    selectedVotes.push(filmId);
                } else {
                    showError('Можно выбрать только 3 фильма');
                    return;
                }
                updateSelection();
            };
        });

        submitBtn.onclick = async () => {
            if (!currentCycleId && !(await startVotingCycle())) {
                showError('Не удалось создать цикл голосования');
                return;
            }

            try {
                const response = await window.authFetch(`${API_URL}/api/voting/cast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cycle_id: currentCycleId,
                        user: window.currentUser?.username,
                        film_ids: selectedVotes,
                        boost: 0.1
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showSuccess('✓ Голоса сохранены!');
                    window.closeVotingModal();
                    await loadFilmBoosts();
                    await loadAllVotes();
                    drawWheel();
                } else {
                    showError('Ошибка: ' + data.error);
                }
            } catch (error) {
                showError('Ошибка сети: ' + error.message);
            }
        };

        updateSelection();
        modalOverlay.style.display = 'block';
        votingModal.style.display = 'flex';
    };

    window.showStatsModal = function() {
        const filteredItems = currentCategory === 'Все' ? allItems : allItems.filter(item => item.Жанр === currentCategory);
        const filteredIds = new Set(filteredItems.map(item => item.id));

        const boostEntries = Object.entries(filmBoosts)
            .filter(([id]) => filteredIds.has(id))
            .map(([id, boost]) => ({
                title: getFilmTitleById(id),
                boost: boost
            }))
            .filter(item => item.title)
            .sort((a, b) => b.boost - a.boost);

        document.getElementById('statsCategory').textContent = currentCategory === 'Все' ? '(все категории)' : `(${currentCategory})`;
        
        const statsList = document.getElementById('statsList');
        statsList.innerHTML = boostEntries.length > 0 
            ? boostEntries.map(item => `
                <div class="stat-item">
                    <span class="stat-film">${item.title}</span>
                    <span class="stat-boost">+${item.boost.toFixed(1)}</span>
                </div>
            `).join('')
            : '<p class="stats-empty">В этой категории пока нет бустов</p>';

        modalOverlay.style.display = 'block';
        statsModal.style.display = 'flex';
    };

    // ========== ЗАГРУЗКА ПРОЕКТОВ ==========
    async function loadProjectsFromServer() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            const allProjects = await response.json();
            const plannedProjects = allProjects.filter(p => !p.watched && !p.inProgress);

            const newItems = plannedProjects.map(p => ({
                Название: p.title_ru || p.title,
                Жанр: p.type || 'Фильм',
                id: p.id
            }));

            const currentTitles = new Set(allItems.map(item => item.Название));
            const newTitles = newItems.filter(item => !currentTitles.has(item.Название));

            if (newTitles.length > 0) {
                allItems = [...allItems, ...newTitles];
                updateMaps();
                showSuccess(`Добавлено ${newTitles.length} новых проектов`);
                updateFilters();

                if (currentCategory === 'Все') {
                    wheelItems = [...wheelItems, ...newTitles.map(item => item.Название)];
                } else {
                    const newInCategory = newTitles.filter(item => item.Жанр === currentCategory).map(item => item.Название);
                    wheelItems = [...wheelItems, ...newInCategory];
                }

                drawWheel();
                updatePoolView();
                updateEliminatedView();
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        }
    }

    async function fullReload() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            const allProjects = await response.json();
            const plannedProjects = allProjects.filter(p => !p.watched && !p.inProgress);

            allItems = plannedProjects.map(p => ({
                Название: p.title_ru || p.title,
                Жанр: p.type || 'Фильм',
                id: p.id
            }));

            updateMaps();
            showSuccess(`Загружено ${allItems.length} проектов в планах`);
            updateFilters();
            syncWheel();
            await loadFilmBoosts();
            await loadAllVotes();
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            allItems = [];
            updateFilters();
            syncWheel();
        }
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
            container.innerHTML = `<span>${item}</span><button class="delete-item" onclick="deleteItem('${item}')">✕</button>`;
            itemPoolDiv.appendChild(container);
        });
        itemCountSpan.textContent = wheelItems.length;
    }

    window.deleteItem = async function(itemName) {
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
                await fullReload();
                showSuccess(`Удалено: ${itemName}`);
            }
        } catch (error) {
            showError('Ошибка при удалении: ' + error.message);
        }
    };

    function updateEliminatedView() {
        eliminatedDiv.innerHTML = eliminatedLog.length === 0
            ? '<span>✖️ пока никого</span>'
            : eliminatedLog.map((name, idx) => `<span>❌ ${idx + 1}. ${name}</span>`).join('');
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

    if (openVoteBtn) openVoteBtn.addEventListener('click', window.showVotingModal);
    if (showStatsBtn) showStatsBtn.addEventListener('click', window.showStatsModal);

    console.log('🚀 Запуск колеса фортуны...');

    initModeToggle();
    loadCurrentUser();
    fullReload();
    setInterval(loadProjectsFromServer, 30000);
    drawWheel();
    updatePoolView();
    updateEliminatedView();
})();