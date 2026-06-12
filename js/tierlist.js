// ========== ТИР-ЛИСТЫ: НОВАЯ ВЕРСИЯ ==========

const TIERLIST_API_URL = 'https://movie-server-deutscherfuchs.amvera.io';

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
    const toast = document.getElementById(type === 'success' ? 'successMessage' : 'errorMessage');
    if (toast) {
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    } else {
        console.log(`${type}:`, message);
    }
}

class TierListManager {
    constructor(container, options = {}) {
        this.container = container;
        this.readonly = options.readonly || false;
        this.onSave = options.onSave || null;
        this.onClose = options.onClose || null;

        this.animeId = null;
        this.animeTitle = null;
        this.characters = [];
        this.tiers = [];
        this.nextId = 1;
        this.draggedItem = null;
    }

    async init(animeId, animeTitle) {
        this.animeId = animeId;
        this.animeTitle = animeTitle;

        const charactersLoaded = await this.loadCharacters();
        if (!charactersLoaded) {
            this.showError('Не удалось загрузить персонажей');
            return false;
        }

        await this.loadExistingTierList();
        this.render();
        return true;
    }

    async loadCharacters() {
        try {
            this.showLoading();

            const response = await fetch(`${TIERLIST_API_URL}/api/anime/${this.animeId}/characters`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Ошибка загрузки');
            }

            this.characters = data.characters.map(char => ({
                id: char.id,
                name: char.name,
                image: char.image_url.startsWith('/')
                    ? `${TIERLIST_API_URL}${char.image_url}`
                    : char.image_url
            }));

            return true;
        } catch (error) {
            console.error('Ошибка загрузки персонажей:', error);
            this.showError('Ошибка загрузки персонажей: ' + error.message);
            return false;
        }
    }

    async loadExistingTierList() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${TIERLIST_API_URL}/api/tierlist/${this.animeId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            const data = await response.json();

            if (data.success && data.tiers) {
                if (data.tiers.S !== undefined) {
                    this.convertFromOldFormat(data.tiers);
                } else if (Array.isArray(data.tiers) && data.tiers.length > 0) {
                    this.tiers = data.tiers;
                    this.updateNextId();
                } else {
                    this.initDefaultTiers();
                }
            } else {
                this.initDefaultTiers();
            }
        } catch (error) {
            console.log('Нет сохранённого тир-листа, создаём новый');
            this.initDefaultTiers();
        }
    }

    initDefaultTiers() {
        const defaultTiers = [
            { name: 'S', color: '#C75C5C' },
            { name: 'A', color: '#D4885C' },
            { name: 'B', color: '#D4A85C' },
            { name: 'C', color: '#8B7355' },
            { name: 'D', color: '#5C9E5C' }
        ];

        this.tiers = defaultTiers.map((tier, idx) => ({
            id: this.generateId(),
            name: tier.name,
            color: tier.color,
            position: idx,
            characters: []
        }));
    }

    convertFromOldFormat(oldTiers) {
        this.tiers = [];
        const order = ['S', 'A', 'B', 'C', 'D'];
        const colors = {
            S: '#C75C5C', A: '#D4885C', B: '#D4A85C', C: '#8B7355', D: '#5C9E5C'
        };

        order.forEach((tierName, idx) => {
            this.tiers.push({
                id: this.generateId(),
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

    generateId() {
        return `tier_${Date.now()}_${this.nextId++}`;
    }

    updateNextId() {
        let maxId = 0;
        for (const tier of this.tiers) {
            const match = tier.id.match(/tier_\d+_(\d+)/);
            if (match && parseInt(match[1]) > maxId) {
                maxId = parseInt(match[1]);
            }
        }
        this.nextId = maxId + 1;
    }

    getDataForSave() {
        const tiersData = this.tiers.map(tier => ({
            id: tier.id,
            name: tier.name,
            color: tier.color,
            position: tier.position,
            characters: tier.characters.map(c => c.id)
        }));

        const charactersData = {};
        for (const char of this.characters) {
            charactersData[char.id] = {
                name: char.name,
                image: char.image
            };
        }

        return { tiers: tiersData, characters_data: charactersData };
    }

    async save() {
        if (this.readonly) {
            showToast('Нельзя редактировать чужой тир-лист', 'error');
            return false;
        }

        const saveData = this.getDataForSave();

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${TIERLIST_API_URL}/api/tierlist/${this.animeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(saveData)
            });

            const data = await response.json();

            if (data.success) {
                showToast('Тир-лист сохранён!');
                if (this.onSave) this.onSave();
                return true;
            } else {
                showToast(data.error || 'Ошибка сохранения', 'error');
                return false;
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            showToast('Ошибка сети при сохранении', 'error');
            return false;
        }
    }

    // ========== УПРАВЛЕНИЕ ТИРАМИ ==========

    addTier(name, color) {
        const newId = this.generateId();
        this.tiers.push({
            id: newId,
            name: name,
            color: color,
            position: this.tiers.length,
            characters: []
        });
        this.render();
        showToast(`Тир "${name}" добавлен`);
    }

    editTier(tierId, newName, newColor) {
        const tier = this.tiers.find(t => t.id === tierId);
        if (tier) {
            tier.name = newName;
            tier.color = newColor;
            this.render();
            showToast(`Тир "${newName}" обновлён`);
        }
    }

    deleteTier(tierId) {
        const index = this.tiers.findIndex(t => t.id === tierId);
        if (index !== -1) {
            const tier = this.tiers[index];
            this.tiers.splice(index, 1);
            this.tiers.forEach((t, idx) => t.position = idx);
            this.render();
            showToast(`Тир "${tier.name}" удалён`);
        }
    }

    moveTierUp(tierId) {
        const index = this.tiers.findIndex(t => t.id === tierId);
        if (index > 0) {
            [this.tiers[index], this.tiers[index - 1]] = [this.tiers[index - 1], this.tiers[index]];
            this.tiers[index].position = index;
            this.tiers[index - 1].position = index - 1;
            this.render();
        }
    }

    moveTierDown(tierId) {
        const index = this.tiers.findIndex(t => t.id === tierId);
        if (index < this.tiers.length - 1) {
            [this.tiers[index], this.tiers[index + 1]] = [this.tiers[index + 1], this.tiers[index]];
            this.tiers[index].position = index;
            this.tiers[index + 1].position = index + 1;
            this.render();
        }
    }

    // ========== ОТРИСОВКА ==========

    render() {
        this.container.innerHTML = '';
        this.container.className = `tierlist-container ${this.readonly ? 'readonly' : ''}`;

        // Сортируем тиры
        const sortedTiers = [...this.tiers].sort((a, b) => a.position - b.position);

        for (const tier of sortedTiers) {
            const tierEl = this.createTierElement(tier);
            this.container.appendChild(tierEl);
        }

        // Нераспределённые персонажи
        const undistributed = this.getUndistributedCharacters();
        const undistributedEl = this.createUndistributedElement(undistributed);
        this.container.appendChild(undistributedEl);

        // Кнопки управления
        if (!this.readonly) {
            const controls = this.createControls();
            this.container.appendChild(controls);
        }
    }

    createTierElement(tier) {
        const tierDiv = document.createElement('div');
        tierDiv.className = 'tier-card';
        tierDiv.dataset.tierId = tier.id;

        // Заголовок
        const header = document.createElement('div');
        header.className = 'tier-header';
        header.innerHTML = `
            <div class="tier-info">
                <span class="tier-name" style="background: ${tier.color}20; color: ${tier.color}; border: 1px solid ${tier.color}40;">${escapeHtml(tier.name)}</span>
                <span class="tier-count">${tier.characters.length}</span>
            </div>
            ${!this.readonly ? `
                <div class="tier-actions">
                    <button class="tier-action-btn move-up" title="Выше">↑</button>
                    <button class="tier-action-btn move-down" title="Ниже">↓</button>
                    <button class="tier-action-btn edit" title="Редактировать">✏️</button>
                    <button class="tier-action-btn delete" title="Удалить">🗑️</button>
                </div>
            ` : ''}
        `;

        // Контейнер для персонажей
        const charactersContainer = document.createElement('div');
        charactersContainer.className = 'tier-characters';
        charactersContainer.dataset.tierId = tier.id;

        // Добавляем реальных персонажей
        for (const char of tier.characters) {
            const card = this.createCharacterCard(char, tier.id);
            charactersContainer.appendChild(card);
        }

        // Добавляем плейсхолдеры до 4 штук, чтобы место всегда было видно
        const placeholderCount = Math.max(0, 4 - tier.characters.length);
        for (let i = 0; i < placeholderCount; i++) {
            const placeholder = this.createPlaceholderCard();
            charactersContainer.appendChild(placeholder);
        }

        tierDiv.appendChild(header);
        tierDiv.appendChild(charactersContainer);

        // Настройка drop-зоны
        if (!this.readonly) {
            this.setupDropZone(charactersContainer, tier.id);

            const moveUpBtn = header.querySelector('.move-up');
            const moveDownBtn = header.querySelector('.move-down');
            const editBtn = header.querySelector('.edit');
            const deleteBtn = header.querySelector('.delete');

            if (moveUpBtn) moveUpBtn.onclick = () => this.moveTierUp(tier.id);
            if (moveDownBtn) moveDownBtn.onclick = () => this.moveTierDown(tier.id);
            if (editBtn) editBtn.onclick = () => this.openEditTierModal(tier.id);
            if (deleteBtn) deleteBtn.onclick = () => this.deleteTier(tier.id);
        }

        return tierDiv;
    }

    createCharacterCard(character, currentTierId) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.setAttribute('draggable', !this.readonly);
        card.setAttribute('data-id', character.id);
        card.setAttribute('data-tier-id', currentTierId);

        const hasImage = character.image && !character.image.includes('undefined') && character.image !== '';

        card.innerHTML = `
            <div class="character-image ${!hasImage ? 'no-image' : ''}" style="${hasImage ? `background-image: url('${character.image}'); background-size: cover; background-position: center;` : ''}">
                ${!hasImage ? '🎭' : ''}
            </div>
            <div class="character-name" title="${escapeHtml(character.name)}">${escapeHtml(character.name)}</div>
        `;

        if (!this.readonly) {
            card.addEventListener('dragstart', (e) => {
                this.draggedItem = { character, sourceTierId: currentTierId };
                e.dataTransfer.setData('text/plain', character.id);
                e.dataTransfer.effectAllowed = 'move';
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                this.draggedItem = null;
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

                if (!this.draggedItem) return;

                const { character: sourceChar, sourceTierId } = this.draggedItem;
                if (sourceChar.id === character.id) return;

                // Находим целевой тир
                const targetTier = this.tiers.find(t => t.id === currentTierId);
                if (!targetTier) return;

                // Удаляем из исходного тира
                if (sourceTierId !== 'undistributed') {
                    const sourceTier = this.tiers.find(t => t.id === sourceTierId);
                    if (sourceTier) {
                        sourceTier.characters = sourceTier.characters.filter(c => c.id !== sourceChar.id);
                    }
                }

                // Вставляем перед целевым персонажем
                const targetIndex = targetTier.characters.findIndex(c => c.id === character.id);
                if (targetIndex !== -1) {
                    targetTier.characters.splice(targetIndex, 0, sourceChar);
                } else {
                    targetTier.characters.push(sourceChar);
                }

                this.render();
            });
        }

        return card;
    }

    createPlaceholderCard() {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-card';
        placeholder.innerHTML = `
            <div class="placeholder-icon">⬚</div>
            <div class="placeholder-text">место для персонажа</div>
        `;
        return placeholder;
    }

    createUndistributedElement(characters) {
        const section = document.createElement('div');
        section.className = 'undistributed-section';

        const header = document.createElement('div');
        header.className = 'undistributed-header';
        header.innerHTML = `
            <span>🎲 Нераспределённые персонажи</span>
            ${!this.readonly ? `<button class="distribute-all-btn">Распределить всех в последний тир</button>` : ''}
        `;

        const container = document.createElement('div');
        container.className = 'undistributed-characters';
        container.dataset.tierId = 'undistributed';

        for (const char of characters) {
            const card = this.createCharacterCard(char, 'undistributed');
            container.appendChild(card);
        }

        section.appendChild(header);
        section.appendChild(container);

        if (!this.readonly) {
            this.setupDropZone(container, 'undistributed');

            const distributeBtn = header.querySelector('.distribute-all-btn');
            if (distributeBtn) {
                distributeBtn.onclick = () => this.distributeAllToLastTier();
            }
        }

        return section;
    }

    distributeAllToLastTier() {
        if (this.tiers.length === 0) return;
        const lastTier = [...this.tiers].sort((a, b) => a.position - b.position).pop();
        const undistributed = this.getUndistributedCharacters();

        for (const char of undistributed) {
            lastTier.characters.push(char);
        }

        this.render();
        showToast(`Персонажи перемещены в тир "${lastTier.name}"`);
    }

    getUndistributedCharacters() {
        const assignedIds = new Set();
        for (const tier of this.tiers) {
            for (const char of tier.characters) {
                assignedIds.add(char.id);
            }
        }
        return this.characters.filter(c => !assignedIds.has(c.id));
    }

    setupDropZone(container, tierId) {
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

            if (!this.draggedItem) return;

            const { character, sourceTierId } = this.draggedItem;

            // Удаляем из исходного тира
            if (sourceTierId !== 'undistributed') {
                const sourceTier = this.tiers.find(t => t.id === sourceTierId);
                if (sourceTier) {
                    sourceTier.characters = sourceTier.characters.filter(c => c.id !== character.id);
                }
            }

            // Добавляем в целевой тир
            if (tierId !== 'undistributed') {
                const targetTier = this.tiers.find(t => t.id === tierId);
                if (targetTier) {
                    targetTier.characters.push(character);
                }
            }

            this.render();
        });
    }

    createControls() {
        const controls = document.createElement('div');
        controls.className = 'tierlist-controls';
        controls.innerHTML = `
            <button class="btn-primary" id="addTierBtn">➕ Добавить тир</button>
            <button class="btn-outline" id="cancelTierlistBtn">Отмена</button>
            <button class="btn-primary" id="saveTierlistBtn">💾 Сохранить тир-лист</button>
        `;

        const addBtn = controls.querySelector('#addTierBtn');
        const saveBtn = controls.querySelector('#saveTierlistBtn');
        const cancelBtn = controls.querySelector('#cancelTierlistBtn');

        if (addBtn) addBtn.onclick = () => this.openAddTierModal();
        if (saveBtn) saveBtn.onclick = () => this.save();
        if (cancelBtn) cancelBtn.onclick = () => {
            if (this.onClose) this.onClose();
        };

        return controls;
    }

    openAddTierModal() {
        const modal = document.createElement('div');
        modal.className = 'tierlist-modal small';
        modal.innerHTML = `
            <div class="tierlist-modal-header">
                <h3>➕ Добавить тир</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="tierlist-modal-content">
                <div class="form-group">
                    <label>Название тира</label>
                    <input type="text" id="tierName" placeholder="Например: GOD, MASTER, TRASH">
                </div>
                <div class="form-group">
                    <label>Цвет</label>
                    <input type="color" id="tierColor" class="color-input" value="#8B7355">
                </div>
            </div>
            <div class="tierlist-actions">
                <button class="btn-outline cancel-btn">Отмена</button>
                <button class="btn-primary create-btn">Создать</button>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-btn').onclick = closeModal;
        modal.querySelector('.create-btn').onclick = () => {
            const name = modal.querySelector('#tierName').value.trim();
            if (!name) {
                showToast('Введите название тира', 'error');
                return;
            }
            const color = modal.querySelector('#tierColor').value;
            this.addTier(name, color);
            closeModal();
        };
    }

    openEditTierModal(tierId) {
        const tier = this.tiers.find(t => t.id === tierId);
        if (!tier) return;

        const modal = document.createElement('div');
        modal.className = 'tierlist-modal small';
        modal.innerHTML = `
            <div class="tierlist-modal-header">
                <h3>✏️ Редактировать тир</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="tierlist-modal-content">
                <div class="form-group">
                    <label>Название тира</label>
                    <input type="text" id="tierName" value="${escapeHtml(tier.name)}">
                </div>
                <div class="form-group">
                    <label>Цвет</label>
                    <input type="color" id="tierColor" class="color-input" value="${tier.color}">
                </div>
            </div>
            <div class="tierlist-actions">
                <button class="btn-outline cancel-btn">Отмена</button>
                <button class="btn-primary save-btn">Сохранить</button>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-btn').onclick = closeModal;
        modal.querySelector('.save-btn').onclick = () => {
            const name = modal.querySelector('#tierName').value.trim();
            if (!name) {
                showToast('Введите название тира', 'error');
                return;
            }
            const color = modal.querySelector('#tierColor').value;
            this.editTier(tierId, name, color);
            closeModal();
        };
    }

    showLoading() {
        this.container.innerHTML = `
            <div class="tierlist-loading">
                <div class="spinner"></div>
                <div>Загрузка персонажей...</div>
            </div>
        `;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="tierlist-error">
                ❌ ${escapeHtml(message)}
            </div>
        `;
    }
}

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========

window.openTierListEditor = async function(animeId, animeTitle, onSaveCallback) {
    const overlay = document.getElementById('modalOverlay');
    
    // Создаём оверлей, если его нет
    if (!overlay) {
        const newOverlay = document.createElement('div');
        newOverlay.id = 'modalOverlay';
        newOverlay.className = 'modal-overlay';
        newOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(4px);
            z-index: 9999;
            display: block;
        `;
        document.body.appendChild(newOverlay);
    } else {
        overlay.style.display = 'block';
    }
    
    // Создаём модалку с inline-стилями для гарантии
    const modal = document.createElement('div');
    modal.className = 'tierlist-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10001;
        width: 90%;
        max-width: 1200px;
        height: 85vh;
        background: #0a0a0a;
        border-radius: 28px;
        border: 1px solid #2a2a2a;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    `;
    
    modal.innerHTML = `
        <div class="tierlist-modal-header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 24px;
            border-bottom: 1px solid #2a2a2a;
            background: #0f0f0f;
            flex-shrink: 0;
        ">
            <h3 style="color: #e0e0e0; font-size: 1.2rem; font-weight: 600; margin: 0;">🏆 Тир-лист: ${escapeHtml(animeTitle)}</h3>
            <button class="modal-close" style="
                width: 32px;
                height: 32px;
                background: #1a1a1a;
                border: none;
                border-radius: 50%;
                color: #888;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            ">✕</button>
        </div>
        <div class="tierlist-modal-content" id="tierlist-editor-content" style="
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            min-height: 0;
        "></div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.remove();
        const currentOverlay = document.getElementById('modalOverlay');
        if (currentOverlay) {
            currentOverlay.style.display = 'none';
        }
        document.body.classList.remove('modal-open');
    };
    
    // Закрытие по крестику
    modal.querySelector('.modal-close').onclick = closeModal;
    
    // Закрытие по клику на оверлей
    const currentOverlay = document.getElementById('modalOverlay');
    if (currentOverlay) {
        currentOverlay.onclick = (e) => {
            if (e.target === currentOverlay) {
                closeModal();
            }
        };
    }
    
    // Закрытие по ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.classList.add('modal-open');
    
    const container = document.getElementById('tierlist-editor-content');
    const manager = new TierListManager(container, {
        readonly: false,
        onSave: async () => {
            const success = await manager.save();
            if (success && onSaveCallback) onSaveCallback();
            closeModal();
            document.removeEventListener('keydown', escHandler);
        },
        onClose: closeModal
    });
    
    await manager.init(animeId, animeTitle);
};

window.openTierListViewer = async function(animeId, animeTitle, userId, username) {
    const overlay = document.getElementById('modalOverlay');
    
    if (!overlay) {
        const newOverlay = document.createElement('div');
        newOverlay.id = 'modalOverlay';
        newOverlay.className = 'modal-overlay';
        newOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(4px);
            z-index: 9999;
            display: block;
        `;
        document.body.appendChild(newOverlay);
    } else {
        overlay.style.display = 'block';
    }
    
    const modal = document.createElement('div');
    modal.className = 'tierlist-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10001;
        width: 90%;
        max-width: 1200px;
        height: 85vh;
        background: #0a0a0a;
        border-radius: 28px;
        border: 1px solid #2a2a2a;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    `;
    
    modal.innerHTML = `
        <div class="tierlist-modal-header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 24px;
            border-bottom: 1px solid #2a2a2a;
            background: #0f0f0f;
            flex-shrink: 0;
        ">
            <h3 style="color: #e0e0e0; font-size: 1.2rem; font-weight: 600; margin: 0;">🏆 Тир-лист: ${escapeHtml(animeTitle)} — ${escapeHtml(username)}</h3>
            <button class="modal-close" style="
                width: 32px;
                height: 32px;
                background: #1a1a1a;
                border: none;
                border-radius: 50%;
                color: #888;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            ">✕</button>
        </div>
        <div class="tierlist-modal-content" id="tierlist-viewer-content" style="
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            min-height: 0;
        "></div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.remove();
        const currentOverlay = document.getElementById('modalOverlay');
        if (currentOverlay) {
            currentOverlay.style.display = 'none';
        }
        document.body.classList.remove('modal-open');
    };
    
    modal.querySelector('.modal-close').onclick = closeModal;
    
    const currentOverlay = document.getElementById('modalOverlay');
    if (currentOverlay) {
        currentOverlay.onclick = (e) => {
            if (e.target === currentOverlay) {
                closeModal();
            }
        };
    }
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.classList.add('modal-open');
    
    const container = document.getElementById('tierlist-viewer-content');
    
    try {
        const response = await fetch(`${TIERLIST_API_URL}/api/anime/${animeId}/characters`);
        const data = await response.json();
        
        if (!data.success) {
            container.innerHTML = '<div class="tierlist-error">❌ Не удалось загрузить персонажей</div>';
            return;
        }
        
        const characters = data.characters.map(char => ({
            id: char.id,
            name: char.name,
            image: char.image_url.startsWith('/') 
                ? `${TIERLIST_API_URL}${char.image_url}`
                : char.image_url
        }));
        
        const token = localStorage.getItem('auth_token');
        const tierResponse = await fetch(`${TIERLIST_API_URL}/api/tierlist/${animeId}/user/${userId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        const tierData = await tierResponse.json();
        
        if (!tierData.success || !tierData.tiers) {
            container.innerHTML = '<div class="tierlist-empty">📭 Пользователь ещё не создал тир-лист для этого аниме</div>';
            return;
        }
        
        const viewerManager = new TierListManager(container, { readonly: true });
        viewerManager.characters = characters;
        
        if (tierData.tiers.S !== undefined) {
            viewerManager.convertFromOldFormat(tierData.tiers);
        } else if (Array.isArray(tierData.tiers)) {
            viewerManager.tiers = tierData.tiers;
        } else {
            viewerManager.initDefaultTiers();
        }
        
        viewerManager.render();
        
    } catch (error) {
        console.error('Ошибка:', error);
        container.innerHTML = `<div class="tierlist-error">❌ Ошибка загрузки: ${error.message}</div>`;
    }
};