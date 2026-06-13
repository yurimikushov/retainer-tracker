// Core App State
let appData = {
  targetHours: 6,
  history: {}
};

// Timer Interval
let timerInterval = null;

// Track which history cards are expanded (preserves state on redraw)
const expandedDates = new Set();

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

// Forgotten Checkout Elements
const forgottenModal = document.getElementById('forgotten-modal');
const forgottenTimeInput = document.getElementById('forgotten-time-input');
const forgottenSubmitBtn = document.getElementById('forgotten-submit-btn');
const forgottenKeepBtn = document.getElementById('forgotten-keep-btn');
const forgottenDeleteBtn = document.getElementById('forgotten-delete-btn');

// History Elements
const historyListContainer = document.getElementById('history-list');
const exportBtn = document.getElementById('export-btn');
const importTriggerBtn = document.getElementById('import-trigger-btn');
const importFileInput = document.getElementById('import-file-input');

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

// Format duration short (e.g. 5h 23m)
function formatDurationShort(ms) {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / (1000 * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// Format date key into display format (e.g. Wed, Oct 25, 2023)
function formatDateHeader(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Convert local date and time string (HH:MM) to UTC ISO string
function localTimeToUTC(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return localDate.toISOString();
}

// Helper to convert UTC date string to local HH:MM string
function utcToLocalTimeStr(utcStr) {
  if (!utcStr) return '';
  const date = new Date(utcStr);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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

// --- Day Crossover & Forgotten Checkout Handling ---

// Perform splits on midnight crossings
function checkDayCrossover() {
  let active = getActiveSession();
  if (!active) return;
  
  const todayStr = getLocalISODate();
  let activeDateStr = active.date;
  
  while (activeDateStr !== todayStr) {
    const [year, month, day] = activeDateStr.split('-').map(Number);
    // Local midnight of next day
    const nextDayStart = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    const nextDayISO = nextDayStart.toISOString();
    
    // Close current session at midnight
    active.session.end = nextDayISO;
    
    const nextDayStr = getLocalISODate(nextDayStart);
    if (!appData.history[nextDayStr]) {
      appData.history[nextDayStr] = { sessions: [] };
    }
    
    const newSession = {
      start: nextDayISO,
      end: null,
      ignoreForgottenPrompt: active.session.ignoreForgottenPrompt || false
    };
    appData.history[nextDayStr].sessions.push(newSession);
    
    saveData();
    activeDateStr = nextDayStr;
    active = { date: nextDayStr, session: newSession };
  }
}

// Verify if checked-in session exceeds 12h
function checkForgottenCheckout() {
  const active = getActiveSession();
  if (!active) {
    if (forgottenModal) forgottenModal.classList.add('hidden');
    return;
  }
  
  const startTime = new Date(active.session.start).getTime();
  const elapsed = Date.now() - startTime;
  
  if (elapsed > 12 * 60 * 60 * 1000 && !active.session.ignoreForgottenPrompt) {
    if (forgottenModal && forgottenModal.classList.contains('hidden')) {
      forgottenModal.classList.remove('hidden');
      
      const defaultEnd = new Date(startTime + appData.targetHours * 60 * 60 * 1000);
      let defaultTime = defaultEnd;
      if (defaultTime.getTime() > Date.now()) {
        defaultTime = new Date();
      }
      if (forgottenTimeInput) {
        forgottenTimeInput.value = utcToLocalTimeStr(defaultTime.toISOString());
      }
    }
  } else {
    if (forgottenModal) forgottenModal.classList.add('hidden');
  }
}

function handleForgottenSubmit() {
  const active = getActiveSession();
  if (!active) return;
  
  const timeVal = forgottenTimeInput.value;
  if (!timeVal) {
    alert('Please enter a valid time.');
    return;
  }
  
  const [year, month, day] = active.date.split('-').map(Number);
  const [hours, minutes] = timeVal.split(':').map(Number);
  const checkoutDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  const startMs = new Date(active.session.start).getTime();
  const checkoutMs = checkoutDate.getTime();
  
  if (checkoutMs <= startMs) {
    alert('Checkout time must be after check-in time: ' + utcToLocalTimeStr(active.session.start));
    return;
  }
  
  if (checkoutMs > Date.now()) {
    alert('Checkout time cannot be in the future.');
    return;
  }
  
  active.session.end = checkoutDate.toISOString();
  saveData();
  forgottenModal.classList.add('hidden');
  updateUI();
}

function handleForgottenKeep() {
  const active = getActiveSession();
  if (active) {
    active.session.ignoreForgottenPrompt = true;
    saveData();
  }
  forgottenModal.classList.add('hidden');
  updateUI();
}

// --- Import / Export Logic ---

function handleExport() {
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'retainer_tracker_backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      
      // Structure Validation
      if (typeof imported !== 'object' || imported === null) {
        throw new Error('Data must be a valid JSON object.');
      }
      
      if (typeof imported.targetHours !== 'number' || imported.targetHours < 1 || imported.targetHours > 24) {
        imported.targetHours = 6; // fallback/default
      }
      
      if (typeof imported.history !== 'object' || imported.history === null) {
        throw new Error('Data must contain a history object.');
      }
      
      // Validate history dates and sessions
      for (const date of Object.keys(imported.history)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error(`Invalid date key format: ${date}`);
        }
        
        const dayObj = imported.history[date];
        if (!dayObj.sessions || !Array.isArray(dayObj.sessions)) {
          throw new Error(`History for ${date} must contain a sessions array.`);
        }
        
        for (const session of dayObj.sessions) {
          if (!session.start || isNaN(Date.parse(session.start))) {
            throw new Error(`Session in ${date} contains an invalid start timestamp.`);
          }
          if (session.end !== null && (isNaN(Date.parse(session.end)) || Date.parse(session.end) < Date.parse(session.start))) {
            throw new Error(`Session in ${date} contains an invalid end timestamp.`);
          }
        }
      }
      
      // Validation passed! Save and refresh
      appData = imported;
      saveData();
      alert('History imported successfully!');
      
      if (historyListContainer) {
        renderHistory();
      } else {
        updateUI();
      }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    // Reset file input value to allow importing the same file again
    importFileInput.value = '';
  };
  reader.readAsText(file);
}

function handleForgottenDelete() {
  const active = getActiveSession();
  if (!active) return;
  
  const day = appData.history[active.date];
  if (day && day.sessions) {
    day.sessions = day.sessions.filter(s => s !== active.session);
    if (day.sessions.length === 0) {
      delete appData.history[active.date];
    }
    saveData();
  }
  forgottenModal.classList.add('hidden');
  updateUI();
}

// --- UI Rendering (Main Dashboard) ---

// Update Progress Ring Visual
function setProgress(percent) {
  if (!progressRingBar) return;
  const circumference = 660; // 2 * pi * r (r=105)
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  progressRingBar.style.strokeDashoffset = offset;
}

// Full UI update
function updateUI() {
  // Always verify crossover and forgotten limits first
  checkDayCrossover();
  checkForgottenCheckout();

  const today = getLocalISODate();
  const targetMs = appData.targetHours * 60 * 60 * 1000;
  const todayTotalMs = calculateDayDuration(today);
  
  // Update Goal Display
  if (targetDisplayValue) targetDisplayValue.textContent = appData.targetHours;
  if (targetHoursInput) targetHoursInput.value = appData.targetHours;
  
  // Update Clock / Progress
  if (timerDisplay) timerDisplay.textContent = formatDuration(todayTotalMs);
  
  const remainingMs = targetMs - todayTotalMs;
  if (remainingDisplay) remainingDisplay.textContent = formatRemaining(remainingMs);
  
  const progressPercent = (todayTotalMs / targetMs) * 100;
  setProgress(progressPercent);
  
  if (goalBadge) {
    if (todayTotalMs >= targetMs) {
      goalBadge.classList.remove('hidden');
    } else {
      goalBadge.classList.add('hidden');
    }
  }
  
  // Check active state
  const active = getActiveSession();
  if (active) {
    if (statusIndicator) {
      statusIndicator.textContent = "Retainer is in";
      statusIndicator.style.color = "var(--color-primary)";
    }
    
    if (mainToggleBtn) {
      mainToggleBtn.className = "btn-check-in";
      mainToggleBtn.querySelector('span').textContent = "Check Out";
    }
    
    // Make sure timer is ticking
    startVisualTicker();
  } else {
    if (statusIndicator) {
      statusIndicator.textContent = "Retainer is out";
      statusIndicator.style.color = "var(--text-muted)";
    }
    
    if (mainToggleBtn) {
      mainToggleBtn.className = "btn-check-out";
      mainToggleBtn.querySelector('span').textContent = "Check In";
    }
    
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

// --- History Page Rendering & Editing ---

function renderHistory() {
  if (!historyListContainer) return;
  
  // Sort dates in history in reverse chronological order
  const dates = Object.keys(appData.history).sort().reverse();
  
  if (dates.length === 0) {
    historyListContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>No history logged yet.</p>
        <p>Check in on the home screen to start tracking.</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  dates.forEach(date => {
    const day = appData.history[date];
    const totalMs = calculateDayDuration(date);
    const targetMs = appData.targetHours * 60 * 60 * 1000;
    const goalMet = totalMs >= targetMs;
    const isExpanded = expandedDates.has(date);
    
    let sessionsHtml = '';
    if (day.sessions && day.sessions.length > 0) {
      day.sessions.forEach((session, idx) => {
        const startStr = utcToLocalTimeStr(session.start);
        const endStr = session.end ? utcToLocalTimeStr(session.end) : '';
        const isActive = session.end === null;
        
        sessionsHtml += `
          <div class="session-edit-row">
            <div class="time-input-group">
              <label class="form-label">Check In</label>
              <input type="time" class="form-input start-time-input" value="${startStr}" data-session-idx="${idx}" data-date="${date}">
            </div>
            <div class="time-input-group">
              <label class="form-label">Check Out</label>
              <input type="time" class="form-input end-time-input" value="${endStr}" data-session-idx="${idx}" data-date="${date}" ${isActive ? 'disabled placeholder="Active"' : ''}>
            </div>
            <button class="delete-session-btn" data-session-idx="${idx}" data-date="${date}" aria-label="Delete Session">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `;
      });
    } else {
      sessionsHtml = '<p class="text-muted" style="font-size: 0.9rem;">No sessions logged.</p>';
    }
    
    html += `
      <div class="history-card ${isExpanded ? 'expanded' : ''}" data-date="${date}">
        <div class="history-card-header">
          <span class="history-date">${formatDateHeader(date)}</span>
          <div class="history-stats">
            <span class="history-duration">${formatDurationShort(totalMs)}</span>
            ${goalMet ? '<span class="badge badge-success">Goal Met</span>' : ''}
          </div>
        </div>
        <div class="history-card-details">
          <div class="sessions-title">Sessions</div>
          <div class="sessions-list" style="display: flex; flex-direction: column; gap: 12px;">
            ${sessionsHtml}
          </div>
          <div class="history-card-actions">
            <button class="btn btn-small btn-secondary add-session-btn" data-date="${date}">+ Add Session</button>
          </div>
        </div>
      </div>
    `;
  });
  
  historyListContainer.innerHTML = html;
}

// Find first non-overlapping hour slot on a day to pre-fill a new session
function findFreeSessionSlot(date) {
  const day = appData.history[date];
  if (!day || !day.sessions || day.sessions.length === 0) {
    return {
      start: localTimeToUTC(date, "12:00"),
      end: localTimeToUTC(date, "13:00")
    };
  }
  
  for (let h = 8; h < 23; h++) {
    const startStr = `${String(h).padStart(2, '0')}:00`;
    const endStr = `${String(h + 1).padStart(2, '0')}:00`;
    const startISO = localTimeToUTC(date, startStr);
    const endISO = localTimeToUTC(date, endStr);
    
    // Check overlap
    const overlap = day.sessions.some(s => {
      const sStart = new Date(s.start).getTime();
      const sEnd = s.end ? new Date(s.end).getTime() : Date.now();
      const testStart = new Date(startISO).getTime();
      const testEnd = new Date(endISO).getTime();
      return (testStart < sEnd && testEnd > sStart);
    });
    
    if (!overlap) {
      return { start: startISO, end: endISO };
    }
  }
  
  return {
    start: localTimeToUTC(date, "00:00"),
    end: localTimeToUTC(date, "00:30")
  };
}

// Handle session editing with validation
function handleTimeChange(date, sessionIdx, field, value) {
  const day = appData.history[date];
  if (!day || !day.sessions || !day.sessions[sessionIdx]) return;
  
  const session = day.sessions[sessionIdx];
  const oldVal = session[field];
  
  const newISO = localTimeToUTC(date, value);
  session[field] = newISO;
  
  // Rule 1: Check-in before check-out
  if (session.end !== null) {
    const sTime = new Date(session.start).getTime();
    const eTime = new Date(session.end).getTime();
    if (sTime >= eTime) {
      alert("Invalid time: Check-in time must be before check-out time.");
      session[field] = oldVal;
      renderHistory();
      return;
    }
  }
  
  // Rule 2: Overlapping check
  const sortedSessions = [...day.sessions].map((s, idx) => ({
    start: new Date(s.start).getTime(),
    end: s.end ? new Date(s.end).getTime() : Date.now(),
    originalIdx: idx
  })).sort((a, b) => a.start - b.start);
  
  let hasOverlap = false;
  for (let i = 0; i < sortedSessions.length - 1; i++) {
    if (sortedSessions[i].end > sortedSessions[i + 1].start) {
      hasOverlap = true;
      break;
    }
  }
  
  if (hasOverlap) {
    alert("Invalid time: Sessions cannot overlap on the same day.");
    session[field] = oldVal;
    renderHistory();
    return;
  }
  
  saveData();
  renderHistory();
}

// Add empty session slot
function handleAddSession(date) {
  if (!appData.history[date]) {
    appData.history[date] = { sessions: [] };
  }
  
  const slot = findFreeSessionSlot(date);
  appData.history[date].sessions.push(slot);
  
  saveData();
  renderHistory();
}

// Delete session
function handleDeleteSession(date, sessionIdx) {
  const day = appData.history[date];
  if (!day || !day.sessions) return;
  
  day.sessions.splice(sessionIdx, 1);
  if (day.sessions.length === 0) {
    delete appData.history[date];
  }
  
  saveData();
  renderHistory();
}

// --- Event Handlers & Core Action ---

// Toggle wear state
function handleToggle() {
  const today = getLocalISODate();
  // Sync days before toggling
  checkDayCrossover();
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
  if (settingsModal) settingsModal.classList.remove('hidden');
}

function closeSettings() {
  if (settingsModal) settingsModal.classList.add('hidden');
}

function saveSettings() {
  if (!targetHoursInput) return;
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

if (forgottenSubmitBtn) forgottenSubmitBtn.addEventListener('click', handleForgottenSubmit);
if (forgottenKeepBtn) forgottenKeepBtn.addEventListener('click', handleForgottenKeep);
if (forgottenDeleteBtn) forgottenDeleteBtn.addEventListener('click', handleForgottenDelete);

// History View Event Delegation
if (historyListContainer) {
  historyListContainer.addEventListener('click', (e) => {
    // Card header toggle
    const header = e.target.closest('.history-card-header');
    if (header) {
      const card = header.closest('.history-card');
      const date = card.dataset.date;
      if (card.classList.contains('expanded')) {
        card.classList.remove('expanded');
        expandedDates.delete(date);
      } else {
        card.classList.add('expanded');
        expandedDates.add(date);
      }
      return;
    }
    
    // Add session button
    const addBtn = e.target.closest('.add-session-btn');
    if (addBtn) {
      handleAddSession(addBtn.dataset.date);
      return;
    }
    
    // Delete session button
    const deleteBtn = e.target.closest('.delete-session-btn');
    if (deleteBtn) {
      const idx = parseInt(deleteBtn.dataset.sessionIdx, 10);
      handleDeleteSession(deleteBtn.dataset.date, idx);
      return;
    }
  });
  
  historyListContainer.addEventListener('change', (e) => {
    const input = e.target.closest('.start-time-input, .end-time-input');
    if (input) {
      const idx = parseInt(input.dataset.sessionIdx, 10);
      const date = input.dataset.date;
      const field = input.classList.contains('start-time-input') ? 'start' : 'end';
      handleTimeChange(date, idx, field, input.value);
    }
  });
}

// Import/Export Bindings
if (exportBtn) exportBtn.addEventListener('click', handleExport);
if (importTriggerBtn) {
  importTriggerBtn.addEventListener('click', () => {
    if (importFileInput) importFileInput.click();
  });
}
if (importFileInput) importFileInput.addEventListener('change', handleImport);

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Call split crossovers before rendering anything
  checkDayCrossover();
  
  if (historyListContainer) {
    renderHistory();
  } else {
    updateUI();
  }
});
