// Core App State
let appData = {
  targetHours: 6,
  history: {}
};

// Timer Interval
let timerInterval = null;

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const remainingDisplay = document.getElementById('remaining-display');
const goalBadge = document.getElementById('goal-badge');
const progressRingBar = document.getElementById('progress-ring-bar');
const statusIndicator = document.getElementById('status-indicator');
const mainToggleBtn = document.getElementById('main-toggle-btn');
const targetDisplayValue = document.getElementById('target-display-value');

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const settingsTriggerBtn = document.getElementById('settings-trigger-btn');
const targetHoursInput = document.getElementById('target-hours-input');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

// --- Helper Utilities ---

// Load data from LocalStorage
function loadData() {
  const stored = localStorage.getItem('retainerData');
  if (stored) {
    try {
      appData = JSON.parse(stored);
      // Enforce base fields
      if (typeof appData.targetHours !== 'number') appData.targetHours = 6;
      if (!appData.history) appData.history = {};
    } catch (e) {
      console.error('Failed to parse retainerData, resetting to defaults.', e);
      saveData();
    }
  } else {
    saveData();
  }
}

// Save data to LocalStorage
function saveData() {
  localStorage.setItem('retainerData', JSON.stringify(appData));
}

// Get ISO Date YYYY-MM-DD in local time
function getLocalISODate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Format milliseconds to HH:MM:SS
function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Format milliseconds remaining to text (e.g. 1h 05m remaining)
function formatRemaining(ms) {
  if (ms <= 0) return 'Goal Met! 🎉';
  const minutes = Math.ceil(ms / (1000 * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m remaining`;
}

// Check if checked in (last session of today or any recent day has end = null)
function getActiveSession() {
  const dates = Object.keys(appData.history).sort().reverse();
  for (const date of dates) {
    const day = appData.history[date];
    if (day.sessions && day.sessions.length > 0) {
      const lastSession = day.sessions[day.sessions.length - 1];
      if (lastSession.end === null) {
        return { date, session: lastSession };
      }
    }
  }
  return null;
}

// Calculate total wear time for a specific date (in ms)
function calculateDayDuration(date) {
  const day = appData.history[date];
  if (!day || !day.sessions) return 0;
  
  return day.sessions.reduce((acc, session) => {
    const start = new Date(session.start).getTime();
    const end = session.end ? new Date(session.end).getTime() : Date.now();
    return acc + (end - start);
  }, 0);
}

// --- UI Rendering ---

// Update Progress Ring Visual
function setProgress(percent) {
  const circumference = 660; // 2 * pi * r (r=105)
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  progressRingBar.style.strokeDashoffset = offset;
}

// Full UI update
function updateUI() {
  const today = getLocalISODate();
  const targetMs = appData.targetHours * 60 * 60 * 1000;
  const todayTotalMs = calculateDayDuration(today);
  
  // Update Goal Display
  targetDisplayValue.textContent = appData.targetHours;
  targetHoursInput.value = appData.targetHours;
  
  // Update Clock / Progress
  timerDisplay.textContent = formatDuration(todayTotalMs);
  
  const remainingMs = targetMs - todayTotalMs;
  remainingDisplay.textContent = formatRemaining(remainingMs);
  
  const progressPercent = (todayTotalMs / targetMs) * 100;
  setProgress(progressPercent);
  
  if (todayTotalMs >= targetMs) {
    goalBadge.classList.remove('hidden');
  } else {
    goalBadge.classList.add('hidden');
  }
  
  // Check active state
  const active = getActiveSession();
  if (active) {
    statusIndicator.textContent = "Retainer is in";
    statusIndicator.className = "status-text text-primary-color"; // Custom visual tag
    statusIndicator.style.color = "var(--color-primary)";
    
    mainToggleBtn.className = "btn-check-in";
    mainToggleBtn.querySelector('span').textContent = "Check Out";
    
    // Make sure timer is ticking
    startVisualTicker();
  } else {
    statusIndicator.textContent = "Retainer is out";
    statusIndicator.className = "status-text text-muted";
    statusIndicator.style.color = "var(--text-muted)";
    
    mainToggleBtn.className = "btn-check-out";
    mainToggleBtn.querySelector('span').textContent = "Check In";
    
    stopVisualTicker();
  }
}

// Start visual ticker for HH:MM:SS update
function startVisualTicker() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    updateUI();
  }, 1000);
}

// Stop visual ticker
function stopVisualTicker() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --- Event Handlers & Core Action ---

// Toggle wear state
function handleToggle() {
  const today = getLocalISODate();
  const active = getActiveSession();
  const nowISO = new Date().toISOString();
  
  if (active) {
    // Check out: close the session
    active.session.end = nowISO;
  } else {
    // Check in: start session
    if (!appData.history[today]) {
      appData.history[today] = { sessions: [] };
    }
    appData.history[today].sessions.push({
      start: nowISO,
      end: null
    });
  }
  
  saveData();
  updateUI();
}

// Modal handling
function openSettings() {
  settingsModal.classList.remove('hidden');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
}

function saveSettings() {
  const val = parseInt(targetHoursInput.value, 10);
  if (val >= 1 && val <= 24) {
    appData.targetHours = val;
    saveData();
    closeSettings();
    updateUI();
  }
}

// Background Handling
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateUI();
  }
});

// Event Listeners
if (mainToggleBtn) {
  mainToggleBtn.addEventListener('click', handleToggle);
}
if (settingsTriggerBtn) {
  settingsTriggerBtn.addEventListener('click', openSettings);
}
if (settingsCancelBtn) {
  settingsCancelBtn.addEventListener('click', closeSettings);
}
if (settingsSaveBtn) {
  settingsSaveBtn.addEventListener('click', saveSettings);
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateUI();
});
