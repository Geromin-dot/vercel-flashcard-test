document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM Elements =====
    const timerDisplay = document.getElementById('timerDisplay');
    const timerLabel = document.getElementById('timerLabel');
    const timerCircle = document.getElementById('timerCircle');
    const startTimerBtn = document.getElementById('startTimerBtn');
    const resetTimerBtn = document.getElementById('resetTimerBtn');
    const presets = document.querySelectorAll('.pomodoro-preset');
    const sessionDotsContainer = document.getElementById('sessionDots');
    const sessionLabel = document.getElementById('sessionLabel');

    // Stats
    const statSessions = document.getElementById('statSessions');
    const statMinutes = document.getElementById('statMinutes');
    const statStreak = document.getElementById('statStreak');

    // ===== Timer State =====
    let workDuration = 25 * 60;
    let breakDuration = 5 * 60;
    let timeLeft = workDuration;
    let totalTime = workDuration;
    let timerInterval = null;
    let timerRunning = false;
    let isBreak = false;
    let currentSession = 1;
    let totalSessions = 4;
    let completedSessions = 0;

    // ===== Focus Stats =====
    function loadFocusStats() {
        const today = new Date().toDateString();
        const stored = localStorage.getItem('ifocus_focus_stats');
        if (stored) {
            const stats = JSON.parse(stored);
            if (stats.date === today) return stats;
        }
        return { date: today, sessions: 0, minutes: 0, streak: 0 };
    }

    function saveFocusStats(stats) {
        localStorage.setItem('ifocus_focus_stats', JSON.stringify(stats));
    }

    function updateStatsDisplay() {
        const stats = loadFocusStats();
        if (statSessions) statSessions.textContent = stats.sessions;
        if (statMinutes) statMinutes.textContent = stats.minutes;
        if (statStreak) statStreak.textContent = stats.streak;
    }

    updateStatsDisplay();

    // ===== Timer Logic =====
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update circular progress
        const progress = ((totalTime - timeLeft) / totalTime) * 100;
        timerCircle.style.setProperty('--progress', `${progress}%`);
    }

    function startTimer() {
        if (timerRunning) {
            // Pause
            clearInterval(timerInterval);
            timerRunning = false;
            startTimerBtn.textContent = 'Resume';
            return;
        }

        timerRunning = true;
        startTimerBtn.textContent = 'Pause';

        // Enable exit prompting
        window.addEventListener('beforeunload', exitPromptHandler);

        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                timerRunning = false;
                startTimerBtn.textContent = 'Start';

                if (!isBreak) {
                    // Work session completed
                    completedSessions++;
                    const stats = loadFocusStats();
                    stats.sessions++;
                    stats.minutes += Math.round(workDuration / 60);
                    stats.streak++;
                    saveFocusStats(stats);
                    updateStatsDisplay();
                    updateSessionDots();

                    // Save to analytics history
                    saveSessionToHistory(workDuration / 60);

                    if (completedSessions >= totalSessions) {
                        showAlertModal("Great Work!", "All sessions completed!");
                        completedSessions = 0;
                        currentSession = 1;
                        updateSessionDots();
                        window.removeEventListener('beforeunload', exitPromptHandler);
                    } else {
                        // Switch to break
                        initBreakGate();
                    }
                } else {
                    // Break completed
                    isBreak = false;
                    currentSession++;
                    timeLeft = workDuration;
                    totalTime = workDuration;
                    timerLabel.textContent = 'Focus Time';
                    timerCircle.style.setProperty('--progress', '0%');
                    updateTimerDisplay();
                    updateSessionDots();
                    showAlertModal("Break Over!", `Ready for session ${currentSession}?`);
                }
            }
        }, 1000);
    }

    // ===== Break-Gate System (Pomodoro Ice Breakers) =====
    const bgModal = document.getElementById('breakGateModal');
    const bgNoDeckState = document.getElementById('bgNoDeckState');
    const bgQuizState = document.getElementById('bgQuizState');
    const bgSkipBtn = document.getElementById('bgSkipBtn');
    
    const bgDeckName = document.getElementById('bgDeckName');
    const bgCardCounter = document.getElementById('bgCardCounter');
    const bgFlashcard = document.getElementById('bgFlashcard');
    const bgCardTag = document.getElementById('bgCardTag');
    const bgCardFront = document.getElementById('bgCardFront');
    const bgCardBack = document.getElementById('bgCardBack');
    
    const bgRevealControls = document.getElementById('bgRevealControls');
    const bgRevealBtn = document.getElementById('bgRevealBtn');
    const bgResultControls = document.getElementById('bgResultControls');
    const bgNeedReviewBtn = document.getElementById('bgNeedReviewBtn');
    const bgGotItBtn = document.getElementById('bgGotItBtn');
    
    let bgCurrentCards = [];
    let bgCurrentIndex = 0;
    
    function startBreakSession() {
        if (bgModal) bgModal.classList.add('hidden');
        isBreak = true;
        timeLeft = breakDuration;
        totalTime = breakDuration;
        timerLabel.textContent = 'Break Time';
        timerCircle.style.setProperty('--progress', '0%');
        updateTimerDisplay();
        startTimer(); // auto-start break
    }

    function initBreakGate() {
        if (!bgModal) {
            startBreakSession();
            return;
        }
        
        bgModal.classList.remove('hidden');
        
        // Load collections
        const stored = localStorage.getItem('ifocus_flashcard_collections');
        const collections = stored ? JSON.parse(stored) : [];
        
        if (collections.length === 0 || !collections[0].cards || collections[0].cards.length === 0) {
            bgNoDeckState.classList.remove('hidden');
            bgQuizState.classList.add('hidden');
            return;
        }
        
        bgNoDeckState.classList.add('hidden');
        bgQuizState.classList.remove('hidden');
        
        // Grab the most recent deck
        const activeDeck = collections[0];
        bgDeckName.textContent = activeDeck.name;
        
        // Sort cards: prioritize ones with 'needsReview' flag
        let cards = [...activeDeck.cards];
        cards.sort((a, b) => {
            if (a.needsReview && !b.needsReview) return -1;
            if (!a.needsReview && b.needsReview) return 1;
            return 0;
        });
        
        // Take up to 5 cards
        bgCurrentCards = cards.slice(0, 5);
        bgCurrentIndex = 0;
        
        renderBgCard();
    }
    
    function renderBgCard() {
        if (bgCurrentIndex >= bgCurrentCards.length) {
            // Finished the quiz!
            updateSpacedRepetition();
            startBreakSession();
            return;
        }
        
        const card = bgCurrentCards[bgCurrentIndex];
        bgCardCounter.textContent = `${bgCurrentIndex + 1} / ${bgCurrentCards.length}`;
        bgCardTag.textContent = card.tag || 'Flashcard';
        bgCardFront.textContent = card.front;
        bgCardBack.textContent = card.back;
        
        bgFlashcard.classList.remove('flipped');
        bgRevealControls.classList.remove('hidden');
        bgResultControls.classList.add('hidden');
    }
    
    function updateSpacedRepetition() {
        const stored = localStorage.getItem('ifocus_flashcard_collections');
        if (!stored) return;
        const collections = JSON.parse(stored);
        if (collections.length > 0) {
            const activeDeck = collections[0];
            bgCurrentCards.forEach(quizCard => {
                const match = activeDeck.cards.find(c => c.front === quizCard.front && c.back === quizCard.back);
                if (match) {
                    match.needsReview = quizCard.needsReview;
                }
            });
            localStorage.setItem('ifocus_flashcard_collections', JSON.stringify(collections));
        }
    }
    
    if (bgSkipBtn) bgSkipBtn.addEventListener('click', startBreakSession);
    if (bgRevealBtn) {
        bgRevealBtn.addEventListener('click', () => {
            bgFlashcard.classList.add('flipped');
            bgRevealControls.classList.add('hidden');
            bgResultControls.classList.remove('hidden');
        });
    }
    if (bgFlashcard) {
        bgFlashcard.addEventListener('click', () => {
            if (bgRevealControls && !bgRevealControls.classList.contains('hidden')) {
                bgRevealBtn.click();
            }
        });
    }
    if (bgNeedReviewBtn) {
        bgNeedReviewBtn.addEventListener('click', () => {
            bgCurrentCards[bgCurrentIndex].needsReview = true;
            bgCurrentIndex++;
            renderBgCard();
        });
    }
    if (bgGotItBtn) {
        bgGotItBtn.addEventListener('click', () => {
            bgCurrentCards[bgCurrentIndex].needsReview = false;
            bgCurrentIndex++;
            renderBgCard();
        });
    }
    // ===== End Break-Gate System =====

    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playCuteWarningSound() {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2);
    }

    function playAlertSound() {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1);
    }

    function showAlertModal(title, message) {
        const modal = document.getElementById('alertModal');
        const titleEl = document.getElementById('alertModalTitle');
        const msgEl = document.getElementById('alertModalMessage');
        const btn = document.getElementById('alertModalBtn');
        
        if (modal) {
            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.classList.remove('hidden');
            playAlertSound();
            
            btn.onclick = () => {
                modal.classList.add('hidden');
            };
        }
    }

    function resetTimer() {
        clearInterval(timerInterval);
        timerRunning = false;
        isBreak = false;
        timeLeft = workDuration;
        totalTime = workDuration;
        timerLabel.textContent = 'Focus Time';
        startTimerBtn.textContent = 'Start';
        updateTimerDisplay();
        timerCircle.style.setProperty('--progress', '0%');
        window.removeEventListener('beforeunload', exitPromptHandler);
    }

    startTimerBtn.addEventListener('click', startTimer);
    resetTimerBtn.addEventListener('click', resetTimer);

    // ===== Presets =====
    presets.forEach(preset => {
        preset.addEventListener('click', () => {
            if (timerRunning) return;
            
            if (preset.id === 'customPresetBtn') {
                const modal = document.getElementById('customTimerModal');
                if (modal) modal.classList.remove('hidden');
                return; // Wait for modal action
            } else {
                workDuration = parseInt(preset.dataset.work) * 60;
                breakDuration = parseInt(preset.dataset.break) * 60;
                
                // Reset custom button text if another preset is clicked
                const customBtn = document.getElementById('customPresetBtn');
                if (customBtn) customBtn.textContent = 'Custom';
            }

            presets.forEach(p => p.classList.remove('active'));
            preset.classList.add('active');
            
            timeLeft = workDuration;
            totalTime = workDuration;
            isBreak = false;
            timerLabel.textContent = 'Focus Time';
            updateTimerDisplay();
            timerCircle.style.setProperty('--progress', '0%');
        });
    });

    // ===== Custom Timer Modal Logic =====
    const customModal = document.getElementById('customTimerModal');
    const saveCustomBtn = document.getElementById('saveCustomBtn');
    const cancelCustomBtn = document.getElementById('cancelCustomBtn');
    const customWorkMin = document.getElementById('customWorkMin');
    const customWorkSec = document.getElementById('customWorkSec');
    const customBreakMin = document.getElementById('customBreakMin');
    const customBreakSec = document.getElementById('customBreakSec');
    const customSessionsInput = document.getElementById('customSessionsInput');
    const customPresetBtn = document.getElementById('customPresetBtn');

    if (customModal && saveCustomBtn && cancelCustomBtn) {
        cancelCustomBtn.addEventListener('click', () => {
            customModal.classList.add('hidden');
        });

        saveCustomBtn.addEventListener('click', () => {
            let wMin = parseInt(customWorkMin.value) || 0;
            let wSec = parseInt(customWorkSec.value) || 0;
            let bMin = parseInt(customBreakMin.value) || 0;
            let bSec = parseInt(customBreakSec.value) || 0;
            let sessions = parseInt(customSessionsInput.value) || 4;
            
            if (wMin === 0 && wSec === 0) wMin = 25;
            if (bMin === 0 && bSec === 0) bMin = 5;

            workDuration = (wMin * 60) + wSec;
            breakDuration = (bMin * 60) + bSec;
            totalSessions = sessions;
            completedSessions = 0;
            currentSession = 1;

            if (customPresetBtn) {
                presets.forEach(p => p.classList.remove('active'));
                customPresetBtn.classList.add('active');
                
                let formatStr = wSec > 0 ? `${wMin}m ${wSec}s` : `${wMin}m`;
                customPresetBtn.textContent = `Custom (${formatStr})`;
            }

            timeLeft = workDuration;
            totalTime = workDuration;
            isBreak = false;
            timerLabel.textContent = 'Focus Time';
            updateTimerDisplay();
            updateSessionDots();
            timerCircle.style.setProperty('--progress', '0%');
            
            customModal.classList.add('hidden');
        });
    }

    // ===== Session Dots =====
    function updateSessionDots() {
        // Regenerate dots if totalSessions changed
        let currentDotCount = sessionDotsContainer.children.length;
        if (currentDotCount !== totalSessions) {
            sessionDotsContainer.innerHTML = '';
            for (let i = 0; i < totalSessions; i++) {
                const dot = document.createElement('div');
                dot.className = 'session-dot';
                sessionDotsContainer.appendChild(dot);
            }
        }
        
        const dots = sessionDotsContainer.querySelectorAll('.session-dot');
        dots.forEach((dot, i) => {
            dot.className = 'session-dot';
            if (i < completedSessions) {
                dot.classList.add('completed');
            } else if (i === completedSessions) {
                dot.classList.add('current');
            }
        });
        sessionLabel.textContent = `Session ${Math.min(currentSession, totalSessions)} of ${totalSessions}`;
    }

    // ===== Cross-Platform Exit Prompting =====
    function exitPromptHandler(e) {
        e.preventDefault();
        e.returnValue = 'Leave site? Your Pomodoro session will be completely reset.';
        
        // Reset session on actual leave
        resetTimer();
        
        return e.returnValue;
    }

    // ===== Save Session to Analytics History =====
    function saveSessionToHistory(minutes) {
        const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
        history.push({
            date: new Date().toISOString(),
            duration: minutes,
            type: 'pomodoro'
        });
        // Keep last 100 sessions
        if (history.length > 100) history.splice(0, history.length - 100);
        localStorage.setItem('ifocus_session_history', JSON.stringify(history));
    }

    // ===== Local Audio Player =====
    const localAudioPlayer = document.getElementById('localAudioPlayer');
    const volumeSlider = document.getElementById('volumeSlider');
    const audioTracks = document.querySelectorAll('.audio-track');
    let currentTrackSrc = null;

    if (localAudioPlayer && volumeSlider && audioTracks) {
        localAudioPlayer.volume = volumeSlider.value / 100;
        
        volumeSlider.addEventListener('input', () => {
            localAudioPlayer.volume = volumeSlider.value / 100;
        });

        audioTracks.forEach(track => {
            track.addEventListener('click', () => {
                const src = track.dataset.src;
                
                if (currentTrackSrc === src) {
                    // Toggle play/pause
                    if (!localAudioPlayer.paused) {
                        localAudioPlayer.pause();
                        track.classList.remove('playing');
                        track.querySelector('.track-status').textContent = 'Play';
                    } else {
                        localAudioPlayer.play();
                        track.classList.add('playing');
                        track.querySelector('.track-status').textContent = 'Playing';
                    }
                    return;
                }

                // Play new track
                audioTracks.forEach(t => {
                    t.classList.remove('playing');
                    t.querySelector('.track-status').textContent = 'Play';
                });

                currentTrackSrc = src;
                localAudioPlayer.src = src;
                localAudioPlayer.play();
                track.classList.add('playing');
                track.querySelector('.track-status').textContent = 'Playing';
            });
        });
    }

    // ===== Distraction Tracking =====
    let distractedWhileHidden = false;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (timerRunning && !isBreak) {
                // User left the tab during a focus session!
                distractedWhileHidden = true;
                
                // 1. Reset timer
                resetTimer();
                
                // 2. Play alarm
                playCuteWarningSound();

                // 3. Reset streak
                const stats = loadFocusStats();
                stats.streak = 0; 
                saveFocusStats(stats);
                updateStatsDisplay();
            }
        } else {
            // User returned to the tab
            if (distractedWhileHidden) {
                distractedWhileHidden = false;
                setTimeout(() => {
                    showAlertModal("Distraction Detected", "You left the focus tab. Your timer and streak have been reset.");
                }, 100);
            }
        }
    });

    // ===== Initial Display =====
    updateTimerDisplay();
    updateSessionDots();
    
    // ===== React to Sentiment / Reflection =====
    window.addEventListener('ReflectionSubmitted', (e) => {
        const state = e.detail?.state || '';
        const actionPlan = e.detail?.actionPlan || '';
        
        clearInterval(timerInterval);
        timerRunning = false;
        startTimerBtn.textContent = 'Start';
        
        if (state === "Stressed") {
            timeLeft = 15 * 60;
            totalTime = 15 * 60;
            timerLabel.innerText = "Gentle Focus (Stressed)";
        } else if (state === "Distracted") {
            timeLeft = 20 * 60;
            totalTime = 20 * 60;
            timerLabel.innerText = "Strict Pomodoro (Distracted)";
        } else if (state === "Engaged" || state === "Motivated") {
            timeLeft = 60 * 60;
            totalTime = 60 * 60;
            timerLabel.innerText = "Flow State (Engaged)";
        } else {
            timeLeft = 25 * 60;
            totalTime = 25 * 60;
            timerLabel.innerText = "Focus Time";
        }
        
        updateTimerDisplay();
        setTimeout(() => showAlertModal(`AI Adjusted Timer: ${timerLabel.innerText}`, actionPlan || "Your timer and tasks have been adjusted."), 100);
    });
});
