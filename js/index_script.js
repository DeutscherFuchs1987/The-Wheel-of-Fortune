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
    let currentUser = localStorage.getItem('voting_user') || null;
    let userVotes = {};
    let isEliminationMode = false; // Режим игры: false - обычный, true - исключение
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

    // Одна кнопка для кручения
    const spinBtn = document.getElementById('spinOnceBtn'); // Переиспользуем существующую кнопку
    const resetWheelBtn = document.getElementById('resetWheelBtn');

    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const rotationsSlider = document.getElementById('rotationsSlider');
    const rotationsValue = document.getElementById('rotationsValue');

    // Элементы голосования
    const openVoteBtn = document.getElementById('openVoteBtn');
    const resetBoostsBtn = document.getElementById('resetBoostsBtn');
    const showStatsBtn = document.getElementById('showStatsBtn');
    const votingStats = document.getElementById('votingStats');
    const votersIndicator = document.getElementById('votersIndicator');
    const votersList = document.getElementById('votersList');

    // Скрываем вторую кнопку режима исключения
    const spinEliminateBtn = document.getElementById('spinEliminateBtn');
    if (spinEliminateBtn) {
        spinEliminateBtn.style.display = 'none';
    }

    // Скрываем ненужные элементы
    const jsonUploadElement = document.querySelector('.json-upload');
    if (jsonUploadElement) jsonUploadElement.style.display = 'none';

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
                    // Обновляем текст кнопки
                    if (spinBtn) {
                        spinBtn.innerHTML = '⚔️ Крутить (Исключение)';
                        spinBtn.classList.add('eliminate-mode');
                    }
                } else {
                    normalLabel.classList.add('active');
                    elimLabel.classList.remove('active');
                    // Обновляем текст кнопки
                    if (spinBtn) {
                        spinBtn.innerHTML = '🎲 Крутить (Обычный)';
                        spinBtn.classList.remove('eliminate-mode');
                    }
                }
            }
        }

        // Устанавливаем начальное состояние
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

    // ========== ВЫБОР ПОЛЬЗОВАТЕЛЯ ==========
    function showUserSelection() {
        const modal = document.createElement('div');
        modal.className = 'user-modal';
        modal.innerHTML = `
            <div class="user-modal-content">
                <h3>🎮 Выберите игрока</h3>
                <div class="user-options">
                    <button class="user-option" data-user="senya">
                        <span class="user-icon">👤</span>
                        <span class="user-name">Сеня</span>
                    </button>
                    <button class="user-option" data-user="vanya">
                        <span class="user-icon">👤</span>
                        <span class="user-name">Ваня</span>
                    </button>
                    <button class="user-option" data-user="pasha">
                        <span class="user-icon">👤</span>
                        <span class="user-name">Паша</span>
                    </button>
                    <button class="user-option" data-user="volodya">
                        <span class="user-icon">👤</span>
                        <span class="user-name">Володя</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.querySelectorAll('.user-option').forEach(btn => {
            btn.addEventListener('click', () => {
                currentUser = btn.dataset.user;
                localStorage.setItem('voting_user', currentUser);
                modal.remove();
                showSuccess(`👤 Вы вошли как ${btn.querySelector('.user-name').textContent}`);
                updateVotingUI();
            });
        });
    }

    // ========== ФУНКЦИИ ГОЛОСОВАНИЯ ==========
    async function startVotingCycle() {
        try {
            const response = await fetch(`${API_URL}/api/voting/start`, { method: 'POST' });
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
            const response = await fetch(`${API_URL}/api/film-boosts`);
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
            const response = await fetch(`${API_URL}/api/voting/current-cycle`);
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
                const names = { senya: 'Сеня', vanya: 'Ваня', pasha: 'Паша', volodya: 'Володя' };
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
                Math.max(0.1, 1 - boost * 2) : // В режиме исключения бусты УМЕНЬШАЮТ шанс вылететь
                1 + boost * 2; // В обычном режиме бусты УВЕЛИЧИВАЮТ шанс победы
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

    // Основная функция вращения, которая вызывает нужный режим
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
    function showVotingModal() {
        if (!currentUser) {
            showUserSelection();
            return;
        }

        const filteredItems = currentCategory === 'Все' ? allItems : allItems.filter(item => item.Жанр === currentCategory);
        const availableMovies = filteredItems.filter(item => item.id);

        if (availableMovies.length === 0) {
            showError('Нет фильмов в выбранной категории для голосования');
            return;
        }

        const currentUserVotes = userVotes[currentUser] || [];

        const modal = document.createElement('div');
        modal.className = 'voting-modal';
        modal.innerHTML = `
            <div class="voting-modal-content">
                <h3>🗳️ Голосование (${currentCategory === 'Все' ? 'все категории' : currentCategory})</h3>
                <p class="voting-user">Игрок: 👤 ${currentUser === 'senya' ? 'Сеня' : currentUser === 'vanya' ? 'Ваня' : currentUser === 'pasha' ? 'Паша' : 'Володя'}</p>
                
                <div class="voting-search">
                    <input type="text" id="voteSearchInput" class="vote-search-input" placeholder="🔍 Поиск фильма...">
                </div>
                
                <p class="voting-hint">Выберите 3 фильма, чтобы повысить их шансы</p>
                
                <div class="voting-movies" id="votingMoviesList">
                    ${availableMovies.map(movie => {
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
                    }).join('')}
                </div>
                
                <div class="voting-footer">
                    <div class="selected-counter" id="selectedCounter">Выбрано: ${currentUserVotes.length}/3</div>
                    <div class="voting-buttons">
                        <button class="voting-btn cancel" id="cancelVoteBtn">Отмена</button>
                        <button class="voting-btn submit" id="submitVoteBtn" ${currentUserVotes.length !== 3 ? 'disabled' : ''}>Сохранить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const movieItems = modal.querySelectorAll('.voting-movie-item');
        const submitBtn = modal.querySelector('#submitVoteBtn');
        const cancelBtn = modal.querySelector('#cancelVoteBtn');
        const counter = modal.querySelector('#selectedCounter');
        const searchInput = modal.querySelector('#voteSearchInput');
        let selectedVotes = [...currentUserVotes];

        function filterMovies(searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            movieItems.forEach(item => {
                item.style.display = term === '' || item.dataset.filmTitle.includes(term) ? 'flex' : 'none';
            });
        }

        searchInput.addEventListener('input', (e) => filterMovies(e.target.value));

        function updateSelection() {
            movieItems.forEach(item => {
                const filmId = item.dataset.filmId;
                item.classList.toggle('selected', selectedVotes.includes(filmId));
            });
            counter.textContent = `Выбрано: ${selectedVotes.length}/3`;
            submitBtn.disabled = selectedVotes.length !== 3;
        }

        movieItems.forEach(item => {
            item.addEventListener('click', () => {
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
            });
        });

        submitBtn.addEventListener('click', async () => {
            if (!currentCycleId && !(await startVotingCycle())) {
                showError('Не удалось создать цикл голосования');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/voting/cast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cycle_id: currentCycleId,
                        user: currentUser,
                        film_ids: selectedVotes,
                        boost: 0.1
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showSuccess('✓ Голоса сохранены!');
                    modal.remove();
                    await loadFilmBoosts();
                    await loadAllVotes();
                    drawWheel();
                } else {
                    showError('Ошибка: ' + data.error);
                }
            } catch (error) {
                showError('Ошибка сети: ' + error.message);
            }
        });

        cancelBtn.addEventListener('click', () => modal.remove());
    }

    async function resetBoosts() {
        if (!confirm('Сбросить все накопленные бусты? Это действие нельзя отменить.')) return;
        try {
            const response = await fetch(`${API_URL}/api/voting/clear`, { method: 'POST' });
            if (response.ok) {
                filmBoosts = {};
                userVotes = {};
                currentCycleId = null;
                showSuccess('🔄 Все бусты сброшены');
                updateVotingUI();
                updateVotersIndicator();
                drawWheel();
            }
        } catch (error) {
            showError('Ошибка сброса: ' + error.message);
        }
    }

    function showStatsModal() {
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

        const modal = document.createElement('div');
        modal.className = 'stats-modal';
        modal.innerHTML = `
            <div class="stats-modal-content">
                <h3>📊 Статистика бустов (${currentCategory === 'Все' ? 'все категории' : currentCategory})</h3>
                <div class="stats-list">
                    ${boostEntries.length > 0 ? boostEntries.map(item => `
                        <div class="stat-item">
                            <span class="stat-film">${item.title}</span>
                            <span class="stat-boost">+${item.boost.toFixed(1)}</span>
                        </div>
                    `).join('') : '<p class="stats-empty">В этой категории пока нет бустов</p>'}
                </div>
                <button class="stats-close cosmic-close" id="cosmicCloseBtn">🌌 ЗАКРЫТЬ 🌌</button>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#cosmicCloseBtn');
        const effects = [createFireworks, createConfetti, createLasers, createGiantSkeleton];

        closeBtn.addEventListener('mouseenter', () => {
            document.querySelectorAll('.temporary-effect').forEach(e => e.remove());
            effects[Math.floor(Math.random() * effects.length)](closeBtn);
        });

        closeBtn.addEventListener('click', () => {
            document.querySelectorAll('.temporary-effect').forEach(e => e.remove());
            modal.remove();
        });
    }

    // ========== ЭФФЕКТЫ ==========
    function createFireworks() {
        const container = document.createElement('div');
        container.className = 'temporary-effect fireworks-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10002;';
        document.body.appendChild(container);

        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const firework = document.createElement('div');
                firework.style.cssText = `
                    position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 100}%;
                    width:10px;height:10px;background:hsl(${Math.random() * 360},100%,50%);
                    border-radius:50%;box-shadow:0 0 20px hsl(${Math.random() * 360},100%,50%);
                    animation:explode 1s ease-out forwards;
                `;
                container.appendChild(firework);

                for (let j = 0; j < 8; j++) {
                    const spark = document.createElement('div');
                    spark.style.cssText = `
                        position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 100}%;
                        width:4px;height:4px;background:hsl(${Math.random() * 360},100%,50%);
                        border-radius:50%;animation:spark ${0.5 + Math.random()}s ease-out forwards;
                    `;
                    container.appendChild(spark);
                }
            }, i * 100);
        }
        setTimeout(() => container.remove(), 3000);
    }

    function createConfetti() {
        const container = document.createElement('div');
        container.className = 'temporary-effect confetti-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10002;';
        document.body.appendChild(container);

        for (let i = 0; i < 200; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position:absolute;left:${Math.random() * 100}%;top:-20px;
                width:${5 + Math.random() * 10}px;height:${5 + Math.random() * 10}px;
                background:hsl(${Math.random() * 360},100%,50%);
                transform:rotate(${Math.random() * 360}deg);
                animation:confettiFall ${2 + Math.random() * 3}s linear forwards;
                animation-delay:${Math.random() * 2}s;
            `;
            container.appendChild(confetti);
        }
        setTimeout(() => container.remove(), 5000);
    }

    function createLasers() {
        const container = document.createElement('div');
        container.className = 'temporary-effect lasers-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10002;';
        document.body.appendChild(container);

        for (let i = 0; i < 10; i++) {
            const laser = document.createElement('div');
            laser.style.cssText = `
                position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 100}%;
                width:100%;height:2px;
                background:linear-gradient(90deg,transparent,hsl(${Math.random() * 360},100%,50%),transparent);
                transform:rotate(${Math.random() * 360}deg);
                animation:laserBeam 1s ease-out forwards;
                animation-delay:${i * 0.1}s;
                box-shadow:0 0 30px hsl(${Math.random() * 360},100%,50%);
            `;
            container.appendChild(laser);
        }
        setTimeout(() => container.remove(), 2000);
    }

    function createGiantSkeleton() {
        const container = document.createElement('div');
        container.className = 'temporary-effect skeleton-container';
        container.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            pointer-events:none;z-index:10002;
            display:flex;align-items:center;justify-content:center;
            animation:skeletonAppear 0.5s ease-out;
        `;

        const messages = [
            '💀 ТЫ ВЫЗВАЛ ПОВЕЛИТЕЛЯ СКЕЛЕТОВ? 💀',
            '☠️ СМЕРТЬ ПРИШЛА ЗА ТВОИМИ БУСТАМИ ☠️',
            '🦴 КОСТЯНОЙ КОРОЛЬ ПРИВЕТСТВУЕТ ТЕБЯ 🦴',
            '💀 НАЖАЛ НА КНОПКУ - ПОЛУЧИ СКЕЛЕТА 💀'
        ];

        container.innerHTML = `
            <div style="font-size:15rem;filter:drop-shadow(0 0 50px #0f0);animation:skeletonDance 2s infinite;">💀</div>
            <div style="position:absolute;bottom:20%;font-size:3rem;color:#fff;text-shadow:0 0 20px #f00;
                background:rgba(0,0,0,0.7);padding:20px 40px;border-radius:50px;border:3px solid #ff0;
                animation:messageGlitch 0.3s infinite;">${messages[Math.floor(Math.random() * messages.length)]}</div>
        `;

        for (let i = 0; i < 10; i++) {
            const mini = document.createElement('div');
            mini.style.cssText = `
                position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 100}%;
                font-size:${1 + Math.random() * 3}rem;
                animation:miniSkeletonFloat ${3 + Math.random() * 4}s infinite;
                animation-delay:${Math.random() * 2}s;
            `;
            mini.innerHTML = '💀';
            container.appendChild(mini);
        }

        document.body.appendChild(container);
        setTimeout(() => container.remove(), 4000);
    }

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
            document.querySelectorAll('.filter-badge button').forEach(b => b.classList.remove('active'));
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
                document.querySelectorAll('.filter-badge button').forEach(b => b.classList.remove('active'));
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

    async function deleteItem(itemName) {
        try {
            const response = await fetch(`${API_URL}/projects`);
            const projects = await response.json();
            const projectToDelete = projects.find(p =>
                (p.title_ru === itemName || p.title === itemName) && !p.watched && !p.inProgress
            );

            if (projectToDelete) {
                await fetch(`${API_URL}/projects/${projectToDelete.id}`, { method: 'DELETE' });
                await fullReload();
                showSuccess(`Удалено: ${itemName}`);
            }
        } catch (error) {
            showError('Ошибка при удалении: ' + error.message);
        }
    }

    function updateEliminatedView() {
        eliminatedDiv.innerHTML = eliminatedLog.length === 0
            ? '<span>✖️ пока никого</span>'
            : eliminatedLog.map((name, idx) => `<span>❌ ${idx + 1}. ${name}</span>`).join('');
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    // Привязываем одну кнопку к функции spinWheel
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

    if (openVoteBtn) openVoteBtn.addEventListener('click', showVotingModal);
    if (resetBoostsBtn) resetBoostsBtn.addEventListener('click', resetBoosts);
    if (showStatsBtn) showStatsBtn.addEventListener('click', showStatsModal);

    console.log('🚀 Запуск колеса фортуны...');

    initModeToggle();

    if (!currentUser) {
        showUserSelection();
    }

    fullReload();
    setInterval(loadProjectsFromServer, 30000);
    drawWheel();
    updatePoolView();
    updateEliminatedView();
})();