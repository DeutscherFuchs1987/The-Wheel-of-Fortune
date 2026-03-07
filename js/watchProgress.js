// ========== УПРАВЛЕНИЕ ПРОГРЕССОМ ПРОСМОТРА ==========
(function() {
    const WATCH_PROGRESS_KEY = 'anime_watch_progress';

    // Загрузить прогресс из localStorage
    function loadProgress() {
        try {
            const saved = localStorage.getItem(WATCH_PROGRESS_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Ошибка загрузки прогресса:', e);
            return {};
        }
    }

    // Сохранить прогресс
    function saveProgress(progress) {
        try {
            localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(progress));
        } catch (e) {
            console.error('Ошибка сохранения прогресса:', e);
        }
    }

    // Обновить прогресс для конкретного проекта
    function updateProgress(projectId, data) {
        const progress = loadProgress();
        
        progress[projectId] = {
            ...progress[projectId],
            ...data,
            lastWatched: new Date().toISOString()
        };
        
        saveProgress(progress);
        
        // Триггерим событие для обновления UI
        window.dispatchEvent(new CustomEvent('progress-updated', { 
            detail: { projectId, data: progress[projectId] }
        }));
        
        return progress[projectId];
    }

    // Получить прогресс для проекта
    function getProjectProgress(projectId) {
        const progress = loadProgress();
        return progress[projectId] || null;
    }

    // Отметить серию как просмотренную
    function markEpisodeWatched(projectId, season, episode) {
        updateProgress(projectId, {
            season: season,
            episode: episode,
            timecode: 0,
            completed: true
        });
    }

    // Отметить серию как начатую (с таймкодом)
    function markEpisodeStarted(projectId, season, episode, timecode, duration) {
        updateProgress(projectId, {
            season: season,
            episode: episode,
            timecode: timecode,
            duration: duration,
            completed: false
        });
    }

    // Получить следующую непросмотренную серию
    function getNextEpisode(projectId, totalSeasons, episodesPerSeason) {
        const progress = getProjectProgress(projectId);
        
        if (!progress) {
            return { season: 1, episode: 1 }; // Начинаем с первой
        }
        
        const { season = 1, episode = 1, completed = false } = progress;
        
        if (!completed) {
            // Если не досмотрел текущую - возвращаем её же
            return { season, episode };
        }
        
        // Если досмотрел - переходим к следующей
        let nextSeason = season;
        let nextEpisode = episode + 1;
        
        // Проверяем, не вышли ли за пределы сезона
        const maxEpisodes = episodesPerSeason[season] || 12; // fallback
        
        if (nextEpisode > maxEpisodes) {
            nextSeason = season + 1;
            nextEpisode = 1;
        }
        
        return { season: nextSeason, episode: nextEpisode };
    }

    // Прогресс в процентах
    function getProgressPercent(projectId) {
        const progress = getProjectProgress(projectId);
        if (!progress || !progress.duration || progress.duration === 0) return 0;
        
        const percent = (progress.timecode / progress.duration) * 100;
        return Math.min(100, Math.max(0, percent));
    }

    // Парсинг времени из строки (для ручного ввода)
    function parseTimeToSeconds(timeStr) {
        // Парсим форматы "24:30" или "1250"
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return parseInt(timeStr) || 0;
    }

    // Форматирование секунд в читаемый вид
    function formatTime(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Экспортируем в глобальную область
    window.watchProgress = {
        load: loadProgress,
        save: saveProgress,
        update: updateProgress,
        get: getProjectProgress,
        markWatched: markEpisodeWatched,
        markStarted: markEpisodeStarted,
        getNext: getNextEpisode,
        getPercent: getProgressPercent,
        parseTime: parseTimeToSeconds,
        formatTime: formatTime
    };
})();