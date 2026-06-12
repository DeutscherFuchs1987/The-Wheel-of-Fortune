// ========== СТРАНИЦА ТИР-ЛИСТА ==========

const TIERLIST_API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

// Параметры из URL
const urlParams = new URLSearchParams(window.location.search);
const animeId = urlParams.get('anime_id');
const viewUserId = urlParams.get('user_id');
const isViewMode = viewUserId !== null;

// Переменные состояния
let characters = [];
let tiers = [];
let nextId = 1;
let draggedItem = null;
let saveTimeout = null;
let isSaving = false;

// DOM элементы
const tiersContainer = document.getElementById('tiersContainer');
const animeTitleEl = document.getElementById('animeTitle');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const backBtn = document.getElementById('backBtn');
const addTierBtn = document.getElementById('addTierBtn');
const tierModal = document.getElementById('tierModal');
const modalOverlay = document.getElementById('modalOverlay');
let currentEditTierId = null;
const authorInfoDiv = document.getElementById('authorInfo');
const authorAvatar = document.getElementById('authorAvatar');
const authorName = document.getElementById('authorName');

// ========== ИНИЦИАЛИЗАЦИЯ ==========

async function init() {
    if (!animeId) {
        showError('ID аниме не указан');
        return;
    }

    await loadCharacters();
    await loadTierList();

    if (isViewMode) {
        // Режим только для просмотра
        saveBtn.style.display = 'none';
        addTierBtn.style.display = 'none';
        const addPanel = document.querySelector('.add-tier-panel');
        if (addPanel) addPanel.style.display = 'none';
        const saveStatusEl = document.querySelector('.header-right .save-status');
        if (saveStatusEl) saveStatusEl.style.display = 'none';

        // Загружаем информацию об авторе
        if (viewUserId) {
            const author = await loadAuthorInfo(viewUserId);
            if (author) {
                authorInfoDiv.style.display = 'flex';
                authorName.textContent = author.username;

                if (author.avatar) {
                    authorAvatar.innerHTML = `<img src="${author.avatar}" alt="${author.username}">`;
                } else {
                    const initials = author.username.substring(0, 2).toUpperCase();
                    authorAvatar.innerHTML = `<div class="avatar-placeholder">${initials}</div>`;
                }
            }
        }
    }

    render();
    setupAutoScroll();
}

async function loadAuthorInfo(userId) {
    if (!userId) return null;

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${TIERLIST_API_URL}/api/user/${userId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (response.ok) {
            const user = await response.json();
            return user;
        }
    } catch (error) {
        console.error('Ошибка загрузки информации об авторе:', error);
    }
    return null;
}


async function loadCharacters() {
    try {
        tiersContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Загрузка персонажей...</p>
            </div>
        `;

        const response = await fetch(`${TIERLIST_API_URL}/api/anime/${animeId}/characters`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Ошибка загрузки');
        }

        characters = data.characters.map(char => ({
            id: char.id,
            name: char.name,
            image: char.image_url.startsWith('/')
                ? `${TIERLIST_API_URL}${char.image_url}`
                : char.image_url
        }));

        // Устанавливаем название аниме
        if (characters.length > 0) {
            animeTitleEl.textContent = `Аниме #${animeId}`;
        }

        return true;
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        showError('Ошибка загрузки персонажей: ' + error.message);
        return false;
    }
}

async function loadTierList() {
    try {
        let url = `${TIERLIST_API_URL}/api/tierlist/${animeId}`;
        if (isViewMode && viewUserId) {
            url = `${TIERLIST_API_URL}/api/tierlist/${animeId}/user/${viewUserId}`;
        }

        const token = localStorage.getItem('auth_token');
        const response = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        const data = await response.json();

        if (data.success && data.tiers) {
            if (data.tiers.S !== undefined) {
                convertFromOldFormat(data.tiers);
            } else if (Array.isArray(data.tiers) && data.tiers.length > 0) {
                tiers = data.tiers;
                updateNextId();
            } else {
                initDefaultTiers();
            }
        } else {
            initDefaultTiers();
        }
    } catch (error) {
        console.log('Нет сохранённого тир-листа, создаём новый');
        initDefaultTiers();
    }
}

function initDefaultTiers() {
    const defaultTiers = [
        { name: 'S', color: '#C75C5C' },
        { name: 'A', color: '#D4885C' },
        { name: 'B', color: '#D4A85C' },
        { name: 'C', color: '#8B7355' },
        { name: 'D', color: '#5C9E5C' }
    ];

    tiers = defaultTiers.map((tier, idx) => ({
        id: generateId(),
        name: tier.name,
        color: tier.color,
        position: idx,
        characters: []
    }));
}

function convertFromOldFormat(oldTiers) {
    tiers = [];
    const order = ['S', 'A', 'B', 'C', 'D'];
    const colors = {
        S: '#C75C5C', A: '#D4885C', B: '#D4A85C', C: '#8B7355', D: '#5C9E5C'
    };

    order.forEach((tierName, idx) => {
        tiers.push({
            id: generateId(),
            name: tierName,
            color: colors[tierName],
            position: idx,
            characters: (oldTiers[tierName] || []).map(char => ({
                id: char.id,
                name: char.name,
                image: char.image
            }))
        });
    });
}

function generateId() {
    return `tier_${Date.now()}_${nextId++}`;
}

function updateNextId() {
    let maxId = 0;
    for (const tier of tiers) {
        const match = tier.id.match(/tier_\d+_(\d+)/);
        if (match && parseInt(match[1]) > maxId) {
            maxId = parseInt(match[1]);
        }
    }
    nextId = maxId + 1;
}

// ========== СОХРАНЕНИЕ ==========

function getDataForSave() {
    const tiersData = tiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        color: tier.color,
        position: tier.position,
        characters: tier.characters.map(c => c.id)
    }));

    const charactersData = {};
    for (const char of characters) {
        charactersData[char.id] = {
            name: char.name,
            image: char.image
        };
    }

    return { tiers: tiersData, characters_data: charactersData };
}

async function save() {
    if (isViewMode) return false;
    if (isSaving) return false;

    isSaving = true;
    saveStatus.textContent = '💾 Сохранение...';
    saveStatus.className = 'save-status saving';
    saveBtn.disabled = true;

    const saveData = getDataForSave();

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${TIERLIST_API_URL}/api/tierlist/${animeId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(saveData)
        });

        const data = await response.json();

        if (data.success) {
            saveStatus.textContent = '✅ Сохранено';
            saveStatus.className = 'save-status saved';
            setTimeout(() => {
                if (saveStatus.textContent === '✅ Сохранено') {
                    saveStatus.textContent = '💾 Сохранено';
                    saveStatus.className = 'save-status';
                }
            }, 2000);
        } else {
            throw new Error(data.error || 'Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        saveStatus.textContent = '❌ Ошибка';
        saveStatus.className = 'save-status error';
        showError('Ошибка сохранения: ' + error.message);
        setTimeout(() => {
            if (saveStatus.textContent === '❌ Ошибка') {
                saveStatus.textContent = '💾 Сохранить';
                saveStatus.className = 'save-status';
            }
        }, 3000);
    } finally {
        isSaving = false;
        saveBtn.disabled = false;
    }
}

function autoSave() {
    if (isViewMode) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        save();
    }, 1000);
}

// ========== УПРАВЛЕНИЕ ТИРАМИ ==========

function addTier(name, color) {
    const newId = generateId();
    tiers.push({
        id: newId,
        name: name,
        color: color,
        position: tiers.length,
        characters: []
    });
    render();
    autoSave();
    showToast(`Тир "${name}" добавлен`);
}

function editTier(tierId, newName, newColor) {
    const tier = tiers.find(t => t.id === tierId);
    if (tier) {
        tier.name = newName;
        tier.color = newColor;
        render();
        autoSave();
        showToast(`Тир "${newName}" обновлён`);
    }
}

function deleteTier(tierId) {
    const index = tiers.findIndex(t => t.id === tierId);
    if (index !== -1) {
        const tier = tiers[index];
        tiers.splice(index, 1);
        tiers.forEach((t, idx) => t.position = idx);
        render();
        autoSave();
        showToast(`Тир "${tier.name}" удалён`);
    }
}

function moveTierUp(tierId) {
    const index = tiers.findIndex(t => t.id === tierId);
    if (index > 0) {
        [tiers[index], tiers[index - 1]] = [tiers[index - 1], tiers[index]];
        tiers[index].position = index;
        tiers[index - 1].position = index - 1;
        render();
        autoSave();
    }
}

function moveTierDown(tierId) {
    const index = tiers.findIndex(t => t.id === tierId);
    if (index < tiers.length - 1) {
        [tiers[index], tiers[index + 1]] = [tiers[index + 1], tiers[index]];
        tiers[index].position = index;
        tiers[index + 1].position = index + 1;
        render();
        autoSave();
    }
}

// ========== ОТРИСОВКА ==========

function render() {
    tiersContainer.innerHTML = '';

    const sortedTiers = [...tiers].sort((a, b) => a.position - b.position);

    for (const tier of sortedTiers) {
        const tierEl = createTierElement(tier);
        tiersContainer.appendChild(tierEl);
    }

    const undistributed = getUndistributedCharacters();
    const undistributedEl = createUndistributedElement(undistributed);
    tiersContainer.appendChild(undistributedEl);
}

function createTierElement(tier) {
    const tierDiv = document.createElement('div');
    tierDiv.className = 'tier-card';
    tierDiv.dataset.tierId = tier.id;

    const header = document.createElement('div');
    header.className = 'tier-header';
    header.innerHTML = `
        <div class="tier-info">
            <span class="tier-name" style="background: ${tier.color}20; color: ${tier.color}; border: 1px solid ${tier.color}40;">${escapeHtml(tier.name)}</span>
            <span class="tier-count">${tier.characters.length}</span>
        </div>
        ${!isViewMode ? `
            <div class="tier-actions">
                <button class="tier-action-btn move-up" title="Выше">↑</button>
                <button class="tier-action-btn move-down" title="Ниже">↓</button>
                <button class="tier-action-btn edit" title="Редактировать">✏️</button>
                <button class="tier-action-btn delete" title="Удалить">🗑️</button>
            </div>
        ` : ''}
    `;

    const charactersContainer = document.createElement('div');
    charactersContainer.className = 'tier-characters';
    charactersContainer.dataset.tierId = tier.id;

    for (const char of tier.characters) {
        const card = createCharacterCard(char, tier.id);
        charactersContainer.appendChild(card);
    }

    const placeholderCount = Math.max(0, 4 - tier.characters.length);
    for (let i = 0; i < placeholderCount; i++) {
        charactersContainer.appendChild(createPlaceholderCard());
    }

    tierDiv.appendChild(header);
    tierDiv.appendChild(charactersContainer);

    if (!isViewMode) {
        setupDropZone(charactersContainer, tier.id);

        const moveUpBtn = header.querySelector('.move-up');
        const moveDownBtn = header.querySelector('.move-down');
        const editBtn = header.querySelector('.edit');
        const deleteBtn = header.querySelector('.delete');

        if (moveUpBtn) moveUpBtn.onclick = () => moveTierUp(tier.id);
        if (moveDownBtn) moveDownBtn.onclick = () => moveTierDown(tier.id);
        if (editBtn) editBtn.onclick = () => openTierModal(tier.id);
        if (deleteBtn) deleteBtn.onclick = () => deleteTier(tier.id);
    }

    return tierDiv;
}

function createCharacterCard(character, currentTierId) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.setAttribute('draggable', !isViewMode);
    card.setAttribute('data-id', character.id);
    card.setAttribute('data-tier-id', currentTierId);

    const hasImage = character.image && !character.image.includes('undefined') && character.image !== '';

    card.innerHTML = `
        <div class="character-image ${!hasImage ? 'no-image' : ''}" style="${hasImage ? `background-image: url('${character.image}'); background-size: cover; background-position: center;` : ''}">
            ${!hasImage ? '🎭' : ''}
        </div>
        <div class="character-name" title="${escapeHtml(character.name)}">${escapeHtml(character.name)}</div>
    `;

    if (!isViewMode) {
        card.addEventListener('dragstart', (e) => {
            draggedItem = { character, sourceTierId: currentTierId };
            e.dataTransfer.setData('text/plain', character.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            draggedItem = null;
            card.classList.remove('dragging');
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        card.addEventListener('dragenter', (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('drag-over');

            if (!draggedItem) return;

            const { character: sourceChar, sourceTierId } = draggedItem;
            if (sourceChar.id === character.id) return;

            const targetTier = tiers.find(t => t.id === currentTierId);
            if (!targetTier) return;

            if (sourceTierId !== 'undistributed') {
                const sourceTier = tiers.find(t => t.id === sourceTierId);
                if (sourceTier) {
                    sourceTier.characters = sourceTier.characters.filter(c => c.id !== sourceChar.id);
                }
            }

            const targetIndex = targetTier.characters.findIndex(c => c.id === character.id);
            if (targetIndex !== -1) {
                targetTier.characters.splice(targetIndex, 0, sourceChar);
            } else {
                targetTier.characters.push(sourceChar);
            }

            render();
            autoSave();
        });
    }

    return card;
}

function createPlaceholderCard() {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder-card';
    placeholder.innerHTML = `
        <div class="placeholder-icon">⬚</div>
        <div class="placeholder-text">место для персонажа</div>
    `;
    return placeholder;
}

function createUndistributedElement(characters) {
    const section = document.createElement('div');
    section.className = 'undistributed-section';

    const header = document.createElement('div');
    header.className = 'undistributed-header';
    header.innerHTML = `
        <span>🎲 Нераспределённые персонажи</span>
        ${!isViewMode ? `<button class="distribute-all-btn">Распределить всех в последний тир</button>` : ''}
    `;

    const container = document.createElement('div');
    container.className = 'undistributed-characters';
    container.dataset.tierId = 'undistributed';

    for (const char of characters) {
        const card = createCharacterCard(char, 'undistributed');
        container.appendChild(card);
    }

    section.appendChild(header);
    section.appendChild(container);

    if (!isViewMode) {
        setupDropZone(container, 'undistributed');

        const distributeBtn = header.querySelector('.distribute-all-btn');
        if (distributeBtn) {
            distributeBtn.onclick = () => distributeAllToLastTier();
        }
    }

    return section;
}

function distributeAllToLastTier() {
    if (tiers.length === 0) return;
    const lastTier = [...tiers].sort((a, b) => a.position - b.position).pop();
    const undistributed = getUndistributedCharacters();

    for (const char of undistributed) {
        lastTier.characters.push(char);
    }

    render();
    autoSave();
    showToast(`Персонажи перемещены в тир "${lastTier.name}"`);
}



// ========== АВТОСКРОЛЛ ПРИ ПЕРЕТАСКИВАНИИ ==========

let autoScrollInterval = null;
let dragActiveGlobal = false;

function setupAutoScroll() {
    const handleDragMove = (e) => {
        if (!dragActiveGlobal) return;

        const scrollZone = 80;
        const scrollSpeed = 15;
        const windowHeight = window.innerHeight;
        const mouseY = e.clientY;

        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }

        if (mouseY > windowHeight - scrollZone) {
            autoScrollInterval = setInterval(() => {
                window.scrollBy(0, scrollSpeed);
            }, 16);
        } else if (mouseY < scrollZone) {
            autoScrollInterval = setInterval(() => {
                window.scrollBy(0, -scrollSpeed);
            }, 16);
        }
    };

    const stopAutoScroll = () => {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    };

    document.addEventListener('dragstart', () => {
        dragActiveGlobal = true;
    });

    document.addEventListener('dragend', () => {
        dragActiveGlobal = false;
        stopAutoScroll();
    });

    document.addEventListener('dragover', handleDragMove);

    document.addEventListener('dragleave', (e) => {
        if (e.clientY <= 0 || e.clientY >= window.innerHeight) {
            stopAutoScroll();
        }
    });
}


function getUndistributedCharacters() {
    const assignedIds = new Set();
    for (const tier of tiers) {
        for (const char of tier.characters) {
            assignedIds.add(char.id);
        }
    }
    return characters.filter(c => !assignedIds.has(c.id));
}

function setupDropZone(container, tierId) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
        container.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');

        if (!draggedItem) return;

        const { character, sourceTierId } = draggedItem;

        if (sourceTierId !== 'undistributed') {
            const sourceTier = tiers.find(t => t.id === sourceTierId);
            if (sourceTier) {
                sourceTier.characters = sourceTier.characters.filter(c => c.id !== character.id);
            }
        }

        if (tierId !== 'undistributed') {
            const targetTier = tiers.find(t => t.id === tierId);
            if (targetTier) {
                targetTier.characters.push(character);
            }
        }

        render();
        autoSave();
    });
}

// ========== МОДАЛКИ ==========

function openTierModal(tierId = null) {
    currentEditTierId = tierId;
    const title = document.getElementById('tierModalTitle');
    const nameInput = document.getElementById('tierName');
    const colorInput = document.getElementById('tierColor');

    if (tierId) {
        const tier = tiers.find(t => t.id === tierId);
        if (tier) {
            title.textContent = '✏️ Редактировать тир';
            nameInput.value = tier.name;
            colorInput.value = tier.color;
        }
    } else {
        title.textContent = '➕ Добавить тир';
        nameInput.value = '';
        colorInput.value = '#8B7355';
    }

    tierModal.style.display = 'block';
    modalOverlay.style.display = 'block';
}

function closeTierModal() {
    tierModal.style.display = 'none';
    modalOverlay.style.display = 'none';
    currentEditTierId = null;
}

function confirmTier() {
    const name = document.getElementById('tierName').value.trim();
    const color = document.getElementById('tierColor').value;

    if (!name) {
        showToast('Введите название тира', 'error');
        return;
    }

    if (currentEditTierId) {
        editTier(currentEditTierId, name, color);
    } else {
        addTier(name, color);
    }

    closeTierModal();
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-message ${type === 'success' ? 'success' : 'error'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    toast.style.display = 'block';
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showError(message) {
    showToast(message, 'error');
}

// ========== ОБРАБОТЧИКИ ==========

backBtn.onclick = () => {
    window.location.href = 'profile.html';
};

saveBtn.onclick = () => {
    save();
};

addTierBtn.onclick = () => {
    openTierModal();
};

document.getElementById('cancelTierBtn').onclick = closeTierModal;
document.getElementById('confirmTierBtn').onclick = confirmTier;

modalOverlay.onclick = closeTierModal;

// Запуск
init();