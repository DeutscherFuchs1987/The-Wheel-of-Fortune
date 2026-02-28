(function () {
    const API_URL = 'https://movie-project-server-1tzp.onrender.com';

    let allItems = [];
    let wheelItems = [];
    let eliminatedLog = [];
    let currentCategory = 'Все';
    let isSpinning = false;

    let spinSpeed = 2.0;
    let spinRotations = 8;

    const colorPalette = [
        '#FF6B8B', '#5F9EA0', '#FFD166', '#B185DB', '#FFB347', '#6A8D92', '#E5989B',
        '#6D6875', '#FF9AA2', '#B5838D', '#7B9C9E', '#F4A261', '#A7C4B5', '#CD9777',
        '#C44569', '#4A8FE4', '#E59866', '#A27E8E', '#82A7A6', '#FFC4D6'
    ];

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
    const fileNameSpan = document.getElementById('fileName');

    const spinOnceBtn = document.getElementById('spinOnceBtn');
    const spinEliminateBtn = document.getElementById('spinEliminateBtn');
    const resetWheelBtn = document.getElementById('resetWheelBtn');

    const addManualBtn = document.getElementById('addManualBtn');
    const manualInput = document.getElementById('manualInput');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const jsonFileBtn = document.getElementById('jsonFileBtn');
    const jsonFileInput = document.getElementById('jsonFileInput');

    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const rotationsSlider = document.getElementById('rotationsSlider');
    const rotationsValue = document.getElementById('rotationsValue');

    const jsonUploadElement = document.querySelector('.json-upload');
    if (jsonUploadElement) {
        jsonUploadElement.style.display = 'none';
    }

    async function loadProjectsFromServer() {
        try {
            console.log('Загружаем проекты с сервера...');
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);

            const allProjects = await response.json();
            console.log('Загружено проектов:', allProjects.length);

            const plannedProjects = allProjects.filter(p =>
                !p.watched && !p.inProgress
            );

            console.log('Проектов в планах:', plannedProjects.length);

            allItems = plannedProjects.map(p => ({
                Название: p.title_ru || p.title,
                Жанр: p.type || 'Фильм'
            }));

            if (allItems.length > 0) {
                showSuccess(`Загружено ${allItems.length} проектов в планах`);
            } else {
                console.log('Нет проектов в планах');
            }

            updateFilters();
            syncWheel();

        } catch (error) {
            console.error('Ошибка загрузки:', error);
            showError('Ошибка загрузки с сервера: ' + error.message);
            allItems = [];
            updateFilters();
            syncWheel();
        }
    }

    if (addManualBtn && manualInput) {
        addManualBtn.addEventListener('click', () => {
            const val = manualInput.value.trim();
            if (val === '') return;

            addManualProject(val);
        });
    }

    async function addManualProject(name) {
        const newProject = {
            id: 'manual_' + Date.now(),
            title: name,
            title_ru: name,
            year: '—',
            rating: '—',
            poster: null,
            type: 'Разное',
            inProgress: false,
            watched: false,
            watchedDate: null,
            ratings: { senya: null, vanya: null, pasha: null, volodya: null },
            notes: ''
        };

        try {
            const response = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (response.status === 409) {
                showError('Такой проект уже есть');
                return;
            }
            if (!response.ok) throw new Error(`Ошибка добавления: ${response.status}`);

            await loadProjectsFromServer();
            if (manualInput) manualInput.value = '';

        } catch (error) {
            showError('Ошибка при добавлении: ' + error.message);
        }
    }

    async function deleteItem(itemName) {
        try {
            const response = await fetch(`${API_URL}/projects`);
            const projects = await response.json();

            const projectToDelete = projects.find(p =>
                (p.title_ru === itemName || p.title === itemName) &&
                !p.watched && !p.inProgress
            );

            if (projectToDelete) {
                const deleteResponse = await fetch(`${API_URL}/projects/${projectToDelete.id}`, {
                    method: 'DELETE'
                });

                if (!deleteResponse.ok) throw new Error('Ошибка удаления');

                await loadProjectsFromServer();
                showSuccess(`Удалено: ${itemName}`);
            }
        } catch (error) {
            showError('Ошибка при удалении: ' + error.message);
        }
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            if (!confirm('Очистить все проекты из планов?')) return;

            try {
                const response = await fetch(`${API_URL}/projects`);
                const projects = await response.json();

                const plannedProjects = projects.filter(p => !p.watched && !p.inProgress);

                for (const project of plannedProjects) {
                    await fetch(`${API_URL}/projects/${project.id}`, {
                        method: 'DELETE'
                    });
                }

                await loadProjectsFromServer();
                showSuccess('Все проекты удалены');

            } catch (error) {
                showError('Ошибка при очистке: ' + error.message);
            }
        });
    }

    speedSlider.addEventListener('input', () => {
        spinSpeed = parseFloat(speedSlider.value);
        speedValue.textContent = spinSpeed.toFixed(1) + ' сек';
    });

    rotationsSlider.addEventListener('input', () => {
        spinRotations = parseInt(rotationsSlider.value);
        rotationsValue.textContent = spinRotations;
    });

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
        const genres = new Set();
        allItems.forEach(item => {
            if (item.Жанр) genres.add(item.Жанр);
        });
        return Array.from(genres).sort();
    }

    function getCurrentItems() {
        if (currentCategory === 'Все') {
            return allItems.map(item => item.Название);
        } else {
            return allItems
                .filter(item => item.Жанр === currentCategory)
                .map(item => item.Название);
        }
    }

    function syncWheel() {
        wheelItems = getCurrentItems();
        eliminatedLog = [];
        winnerNameDiv.textContent = '—';
        drawWheel();
        updatePoolView();
        updateEliminatedView();
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

        const angleStep = (Math.PI * 2) / count;
        const radius = 280;
        const centerX = 300, centerY = 300;

        for (let i = 0; i < count; i++) {
            const startAngle = i * angleStep + rotateAngle;
            const endAngle = startAngle + angleStep;
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
            ctx.rotate(startAngle + angleStep / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#121212';
            ctx.font = 'bold 16px "Segoe UI", sans-serif';
            ctx.shadowColor = 'rgba(255,255,255,0.5)';
            ctx.shadowBlur = 4;

            let text = wheelItems[i];
            if (text.length > 20) text = text.substr(0, 18) + '…';
            ctx.fillText(text, radius - 24, 8);
            ctx.restore();
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

    function updatePoolView() {
        itemPoolDiv.innerHTML = '';
        if (wheelItems.length === 0) {
            itemPoolDiv.innerHTML = '<span class="tag">❌ пусто</span>';
            itemCountSpan.textContent = '0';
            return;
        }

        wheelItems.forEach((item) => {
            const container = document.createElement('span');
            container.className = 'tag';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = item;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-item';
            deleteBtn.innerHTML = '✕';
            deleteBtn.title = 'Удалить';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteItem(item);
            });

            container.appendChild(nameSpan);
            container.appendChild(deleteBtn);
            itemPoolDiv.appendChild(container);
        });

        itemCountSpan.textContent = wheelItems.length;
    }

    function updateEliminatedView() {
        if (eliminatedLog.length === 0) {
            eliminatedDiv.innerHTML = '<span>✖️ пока никого</span>';
            return;
        }
        eliminatedDiv.innerHTML = eliminatedLog.map((name, idx) => `<span>❌ ${idx + 1}. ${name}</span>`).join('');
    }

    function spinAnimation(onComplete) {
        if (wheelItems.length === 0) {
            showError('Добавьте элементы на колесо');
            return;
        }

        isSpinning = true;
        spinOnceBtn.disabled = true;
        spinEliminateBtn.disabled = true;

        const startTime = performance.now();
        const duration = spinSpeed * 1000;
        const startAngle = 0;

        const targetIndex = Math.floor(Math.random() * wheelItems.length);

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
                spinOnceBtn.disabled = false;
                spinEliminateBtn.disabled = false;
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

                if (onComplete) {
                    onComplete(selected, targetIndex);
                }
            }
        }

        requestAnimationFrame(animate);
    }

    function spinOnce() {
        spinAnimation();
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

    spinOnceBtn.addEventListener('click', spinOnce);
    spinEliminateBtn.addEventListener('click', spinElimination);
    resetWheelBtn.addEventListener('click', syncWheel);

    console.log('Запуск колеса фортуны...');
    loadProjectsFromServer();

    setInterval(loadProjectsFromServer, 30000);

    drawWheel();
    updatePoolView();
    updateEliminatedView();
})();