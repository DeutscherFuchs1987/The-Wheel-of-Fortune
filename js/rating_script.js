(function () {
    const API_URL = 'https://DeutscherFuchs.pythonanywhere.com';

    let myProjects = [];
    let currentFilter = 'all';
    let currentProject = null;

    const projectsGrid = document.getElementById('projectsGrid');
    const statsDiv = document.getElementById('stats');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const ratingModal = document.getElementById('ratingModal');
    const modalContent = document.getElementById('modalContent');
    const body = document.body;

    loadWatchedProjects();

    setInterval(loadWatchedProjects, 10000);

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProjects();
            updateStats();
        });
    });

    function showError(text) {
        errorMessageDiv.style.display = 'block';
        errorMessageDiv.textContent = '❌ ' + text;
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 3000);
    }

    function showSuccess(text) {
        successMessageDiv.style.display = 'block';
        successMessageDiv.textContent = '✅ ' + text;
        setTimeout(() => {
            successMessageDiv.style.display = 'none';
        }, 2000);
    }

    async function loadWatchedProjects() {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);

            const allProjects = await response.json();

            myProjects = allProjects.filter(p => p.watched === true);

            renderProjects();
            updateStats();

        } catch (error) {
            showError('Ошибка загрузки: ' + error.message);
        }
    }

    const deleteProject = async function (projectId) {
        if (!confirm('Удалить проект из оценок?')) return;

        try {
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error(`Ошибка удаления: ${response.status}`);

            myProjects = myProjects.filter(p => p.id !== projectId);
            renderProjects();
            updateStats();
            showSuccess('Проект удалён');

        } catch (error) {
            showError('Ошибка удаления: ' + error.message);
        }
    };

    window.deleteProject = deleteProject;

    async function saveRatings(projectId, ratings, notes) {
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ratings: ratings,
                    notes: notes
                })
            });

            if (!response.ok) throw new Error(`Ошибка сохранения: ${response.status}`);

            const index = myProjects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                myProjects[index].ratings = ratings;
                myProjects[index].notes = notes;
            }

            showSuccess('Оценки сохранены! ✨');
            closeRatingModal();

        } catch (error) {
            showError('Ошибка сохранения: ' + error.message);
        }
    }

    function getRatingClass(rating) {
        if (!rating && rating !== 0) return 'rating-null';
        const rounded = Math.round(rating);
        return `rating-${rounded}`;
    }

    function formatRating(rating) {
        if (!rating && rating !== 0) return '—';
        return rating.toFixed(1);
    }

    function setRating(name, value) {
        const slider = document.getElementById(`slider-${name}`);
        const input = document.getElementById(`input-${name}`);
        const display = document.getElementById(`display-${name}`);

        if (slider && input && display) {
            slider.value = value;
            input.value = value;
            updateRatingDisplay(name, value);
        }
    }

    function clearRating(name) {
        const slider = document.getElementById(`slider-${name}`);
        const input = document.getElementById(`input-${name}`);
        const display = document.getElementById(`display-${name}`);

        if (slider && input && display) {
            slider.value = 5;
            input.value = 5;
            display.textContent = '—';
            display.className = 'rating-display rating-null';
        }
    }

    window.openRatingModal = function (projectId) {
        const project = myProjects.find(p => p.id === projectId);
        if (!project) return;

        currentProject = project;

        body.classList.add('modal-open');

        const posterEmoji = project.type === 'Аниме' ? '🇯🇵' :
            project.type === 'Сериал' ? '📺' :
                project.type === 'Мультфильм' ? '🖍️' : '🎬';

        const posterHtml = project.poster
            ? `<div class="modal-poster" style="background-image: url('${project.poster}');"></div>`
            : `<div class="modal-poster no-poster">${posterEmoji}</div>`;

        modalContent.innerHTML = `
                    <div class="modal-header">
                        ${posterHtml}
                        <div class="modal-info">
                            <div class="modal-title">${project.title_ru || project.title}</div>
                            <div class="modal-year">${project.year}</div>
                            <div class="modal-rating">Кинопоиск: ${project.rating}</div>
                        </div>
                    </div>
                    
                    <div class="ratings-container">
                        <div class="rating-row">
                            <div class="rating-header">
                                <span class="rating-name">Сеня</span>
                                <span class="rating-display ${getRatingClass(project.ratings?.senya)}" id="display-senya">
                                    ${formatRating(project.ratings?.senya)}
                                </span>
                            </div>
                            <div class="rating-controls">
                                <input type="range" class="rating-slider" id="slider-senya" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.senya || 5}">
                                <input type="number" class="rating-input" id="input-senya" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.senya || 5}">
                                <button class="modal-btn clear" onclick="clearRating('senya')" style="background: #4a4f6e; color: white; padding: 8px 15px; border-radius: 30px; border: none; cursor: pointer;">Не смотрел</button>
                            </div>
                        </div>
                        
                        <div class="rating-row">
                            <div class="rating-header">
                                <span class="rating-name">Ваня</span>
                                <span class="rating-display ${getRatingClass(project.ratings?.vanya)}" id="display-vanya">
                                    ${formatRating(project.ratings?.vanya)}
                                </span>
                            </div>
                            <div class="rating-controls">
                                <input type="range" class="rating-slider" id="slider-vanya" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.vanya || 5}">
                                <input type="number" class="rating-input" id="input-vanya" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.vanya || 5}">
                                <button class="modal-btn clear" onclick="clearRating('vanya')" style="background: #4a4f6e; color: white; padding: 8px 15px; border-radius: 30px; border: none; cursor: pointer;">Не смотрел</button>
                            </div>
                        </div>
                        
                        <div class="rating-row">
                            <div class="rating-header">
                                <span class="rating-name">Паша</span>
                                <span class="rating-display ${getRatingClass(project.ratings?.pasha)}" id="display-pasha">
                                    ${formatRating(project.ratings?.pasha)}
                                </span>
                            </div>
                            <div class="rating-controls">
                                <input type="range" class="rating-slider" id="slider-pasha" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.pasha || 5}">
                                <input type="number" class="rating-input" id="input-pasha" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.pasha || 5}">
                                <button class="modal-btn clear" onclick="clearRating('pasha')" style="background: #4a4f6e; color: white; padding: 8px 15px; border-radius: 30px; border: none; cursor: pointer;">Не смотрел</button>
                            </div>
                        </div>
                        
                        <div class="rating-row">
                            <div class="rating-header">
                                <span class="rating-name">Володя</span>
                                <span class="rating-display ${getRatingClass(project.ratings?.volodya)}" id="display-volodya">
                                    ${formatRating(project.ratings?.volodya)}
                                </span>
                            </div>
                            <div class="rating-controls">
                                <input type="range" class="rating-slider" id="slider-volodya" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.volodya || 5}">
                                <input type="number" class="rating-input" id="input-volodya" 
                                       min="1" max="10" step="0.1" value="${project.ratings?.volodya || 5}">
                                <button class="modal-btn clear" onclick="clearRating('volodya')" style="background: #4a4f6e; color: white; padding: 8px 15px; border-radius: 30px; border: none; cursor: pointer;">Не смотрел</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-notes">
                        <label>📝 Заметки</label>
                        <textarea id="modal-notes" rows="3">${project.notes || ''}</textarea>
                    </div>
                    
                    <div class="modal-buttons">
                        <button class="modal-btn cancel" onclick="closeRatingModal()">Отмена</button>
                        <button class="modal-btn save" onclick="saveCurrentRatings()">Сохранить</button>
                    </div>
                `;

        ['senya', 'vanya', 'pasha', 'volodya'].forEach(name => {
            const slider = document.getElementById(`slider-${name}`);
            const input = document.getElementById(`input-${name}`);
            const display = document.getElementById(`display-${name}`);

            if (slider && input && display) {
                slider.addEventListener('input', () => {
                    input.value = slider.value;
                    updateRatingDisplay(name, slider.value);
                });

                input.addEventListener('input', () => {
                    let value = parseFloat(input.value);
                    if (isNaN(value)) value = 5;
                    if (value < 1) value = 1;
                    if (value > 10) value = 10;
                    input.value = value;
                    slider.value = value;
                    updateRatingDisplay(name, value);
                });
            }
        });

        ratingModal.classList.add('active');
    };

    function updateRatingDisplay(name, value) {
        const display = document.getElementById(`display-${name}`);
        if (display) {
            display.textContent = parseFloat(value).toFixed(1);
            display.className = `rating-display ${getRatingClass(parseFloat(value))}`;
        }
    }

    window.closeRatingModal = function () {
        body.classList.remove('modal-open');
        ratingModal.classList.remove('active');
        currentProject = null;
    };

    window.saveCurrentRatings = function () {
        if (!currentProject) return;

        const ratings = {
            senya: getRatingValue('senya'),
            vanya: getRatingValue('vanya'),
            pasha: getRatingValue('pasha'),
            volodya: getRatingValue('volodya')
        };

        const notes = document.getElementById('modal-notes')?.value || '';

        saveRatings(currentProject.id, ratings, notes);
    };

    function getRatingValue(name) {
        const display = document.getElementById(`display-${name}`);
        if (!display) return null;

        if (display.textContent === '—') return null;

        const input = document.getElementById(`input-${name}`);
        return input ? parseFloat(input.value) || null : null;
    }

    window.clearRating = function (name) {
        const slider = document.getElementById(`slider-${name}`);
        const input = document.getElementById(`input-${name}`);
        const display = document.getElementById(`display-${name}`);

        if (slider && input && display) {
            display.textContent = '—';
            display.className = 'rating-display rating-null';
        }
    };

    function updateStats() {
        const total = myProjects.length;
        statsDiv.textContent = `📊 Всего оценённых фильмов: ${total}`;
    }

    function getFilteredProjects() {
        if (currentFilter === 'all') return myProjects;
        return myProjects.filter(p => p.type === currentFilter);
    }

    function renderProjects() {
        const filtered = getFilteredProjects();

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                        <div class="empty-state">
                            <span>⭐</span>
                            <p>Пока нет просмотренных фильмов</p>
                            <p style="font-size: 1rem; margin-top: 10px; color: #6b729b;">
                                Отмечайте фильмы галочкой ✅ в каталоге
                            </p>
                        </div>
                    `;
            return;
        }

        let html = '';
        filtered.forEach(project => {
            let posterEmoji = '🎬';
            if (project.type === 'Аниме') posterEmoji = '🇯🇵';
            else if (project.type === 'Сериал') posterEmoji = '📺';
            else if (project.type === 'Мультфильм') posterEmoji = '🖍️';

            const posterHtml = project.poster
                ? `<div class="poster" style="background-image: url('${project.poster}');">
                             <div class="rating-badge">${project.rating}</div>
                           </div>`
                : `<div class="poster">
                             <div class="no-poster">${posterEmoji}</div>
                             <div class="rating-badge">${project.rating}</div>
                           </div>`;

            html += `
                        <div class="card" onclick="openRatingModal('${project.id}')">
                            <button class="delete-card" onclick="event.stopPropagation(); window.deleteProject('${project.id}')" title="Удалить">✕</button>
                            ${posterHtml}
                            <div class="card-content">
                                <div class="card-title">${project.title_ru || project.title}</div>
                                <span class="card-type">${project.type}</span>
                                <div class="card-meta">
                                    <span>📅 ${project.year}</span>
                                </div>
                            </div>
                        </div>
                    `;
        });

        projectsGrid.innerHTML = html;
    }

    loadWatchedProjects();

})();