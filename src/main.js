import './style.css';
import { supabase } from './supabase.js';

// Initialize Lucide Icons
const initIcons = () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }
};

// State Management
let currentUser = null;
let studySessions = [];
let userData = {
    streak: 0,
    goal_completion: 0,
    aura_points: 0,
    username: ''
};

// Timer State
let timerInterval = null;
let timeLeft = 25 * 60;
let timerRunning = false;
let currentMode = 'pomodoro'; // 'pomodoro', 'short', 'long'

// Audio State
let ambientAudio = null;
const AMBIENT_SOUNDS = {
    'Rain': 'https://www.soundjay.com/nature/rain-01.mp3',
    'River': 'https://www.soundjay.com/nature/river-1.mp3',
    'Nature': 'https://assets.mixkit.co/active_storage/sfx/12/12-preview.mp3',
    'Lofi': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'
};

// Sync Logic
const fetchUserData = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    if (data) userData = data;
};

const pushUserData = async () => {
    if (!currentUser) return;
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: currentUser.id, ...userData });
};

const saveStudySession = async (duration, subject) => {
    if (!currentUser) return;
    const { error } = await supabase
        .from('study_logs')
        .insert({ user_id: currentUser.id, duration, subject });
    
    // Update aura points locally and sync
    userData.aura_points += Math.floor(duration * 2);
    await pushUserData();
};

const saveNote = async (title, content, status) => {
    if (!currentUser) return;
    const { error } = await supabase
        .from('revision_notes')
        .upsert({ user_id: currentUser.id, title, content, status });
    
    // Refresh the view if we are in vault
    if (document.getElementById('vault-notes-grid')) {
        switchView('vault');
    }
};

// Timer Functions
const startTimer = () => {
    if (timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            alert('Time is up! Great session.');
            saveStudySession(25, 'Focus Session');
        }
    }, 1000);
    const startBtn = document.querySelector('.timer-controls .btn-primary');
    if (startBtn) startBtn.innerHTML = '<i data-lucide="pause"></i> Pause';
    initIcons();
};

const pauseTimer = () => {
    clearInterval(timerInterval);
    timerRunning = false;
    const startBtn = document.querySelector('.timer-controls .btn-primary');
    if (startBtn) startBtn.innerHTML = '<i data-lucide="play"></i> Start';
    initIcons();
};

const resetTimer = () => {
    pauseTimer();
    if (currentMode === 'pomodoro') timeLeft = 25 * 60;
    else if (currentMode === 'short') timeLeft = 5 * 60;
    else timeLeft = 15 * 60;
    updateTimerDisplay();
};

const updateTimerDisplay = () => {
    const display = document.querySelector('.timer-display');
    if (!display) return;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Audio Functions
const toggleAmbientSound = (soundName, volume) => {
    if (ambientAudio) {
        ambientAudio.pause();
    }

    if (soundName === 'None') {
        ambientAudio = null;
        return;
    }

    const url = AMBIENT_SOUNDS[soundName];
    if (url) {
        ambientAudio = new Audio(url);
        ambientAudio.loop = true;
        ambientAudio.volume = volume / 100;
        ambientAudio.play().catch(e => console.log('Audio Autoplay blocked. Interaction required first.'));
    }
};

const updateVolume = (volume) => {
    if (ambientAudio) {
        ambientAudio.volume = volume / 100;
    }
};

// Auth Handlers
const handleSignUp = async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
        console.error('Signup Error:', error);
        return alert('Signup Failed: ' + error.message);
    }
    
    if (data.user) {
        currentUser = data.user;
        userData.username = username;
        
        try {
            await pushUserData();
            switchView('dashboard');
        } catch (syncError) {
            console.error('Profile Sync Error:', syncError);
            alert('Account created, but could not setup profile. Please ensure you have run the SQL script in Supabase.');
            switchView('dashboard'); // Still try to go to dashboard
        }
    } else {
        alert('Please check your email to confirm your account before logging in!');
    }
};

const handleLogin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('Login Error:', error);
        return alert('Login Failed: ' + error.message);
    }
    currentUser = data.user;
    await fetchUserData();
    switchView('dashboard');
};

const handleLogout = async () => {
    await supabase.auth.signOut();
    currentUser = null;
    switchView('login');
};

// Date & Time Logic
const updateClock = () => {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    if (!clockEl || !dateEl) return;

    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('en-US', options);
};

setInterval(updateClock, 1000);
updateClock();

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Registration Failed', err));
    });
}

// Activity Calendar Logic
const generateCalendarHTML = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthName = now.toLocaleString('default', { month: 'long' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    
    // Completed days will be fetched from database in a real scenario
    const completedDays = []; 

    let calendarHTML = `
        <div class="calendar-header">
            <h4>${monthName} ${year}</h4>
            <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.7rem; color: var(--text-muted);">
                <span style="display: flex; align-items: center; gap: 3px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary); opacity: 0.3;"></span> Missed</span>
                <span style="display: flex; align-items: center; gap: 3px;">📖 Completed</span>
            </div>
        </div>
        <div class="calendar-grid">
            <div class="day-label">Su</div>
            <div class="day-label">Mo</div>
            <div class="day-label">Tu</div>
            <div class="day-label">We</div>
            <div class="day-label">Th</div>
            <div class="day-label">Fr</div>
            <div class="day-label">Sa</div>
    `;

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today ? 'today' : '';
        const isCompleted = completedDays.includes(day) ? 'completed' : '';
        calendarHTML += `<div class="calendar-day ${isToday} ${isCompleted}">${day}</div>`;
    }

    calendarHTML += '</div>';
    return calendarHTML;
};

// View Management
const views = {
    dashboard: `
        <div class="view-header">
            <h1>Welcome back, {{username}}</h1>
            <p>You've maintained a 7-day streak! Keep it up.</p>
        </div>
        
        <div class="card activity-card" style="margin-top: 1.5rem;">
            <h3 style="margin-bottom: 1.5rem;">Study Activity</h3>
            <div id="activity-calendar-container">
                <!-- Calendar injected here -->
            </div>
        </div>

        <div class="grid-container" style="margin-top: 1.5rem;">
            <div class="card stat-card">
                <div class="stat-header">
                    <i data-lucide="flame" class="icon-streak"></i>
                    <span>Current Streak</span>
                </div>
                <div class="stat-value">0 Days</div>
                <div class="stat-footer">Start your first session!</div>
            </div>
            
            <div class="card stat-card">
                <div class="stat-header">
                    <i data-lucide="target" class="icon-goal"></i>
                    <span>Daily Goal</span>
                </div>
                <div class="stat-value">0%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="stat-footer">0h / 6h studied</div>
            </div>

            <div class="card stat-card">
                <div class="stat-header">
                    <i data-lucide="award" class="icon-points"></i>
                    <span>Aura Points</span>
                </div>
                <div class="stat-value">0</div>
                <div class="stat-footer">Earn points by studying</div>
            </div>
        </div>

        <div class="section-row" style="grid-template-columns: 1fr 1fr; margin-top: 1.5rem;">
            <div class="card main-stats">
              <h3>Weekly Performance</h3>
              <div class="chart-placeholder">
                  <div class="bar-chart">
                      <div class="bar" style="height: 40%"></div>
                      <div class="bar" style="height: 60%"></div>
                      <div class="bar" style="height: 80%"></div>
                      <div class="bar" style="height: 50%"></div>
                      <div class="bar" style="height: 90%"></div>
                      <div class="bar" style="height: 70%"></div>
                      <div class="bar" style="height: 30%"></div>
                  </div>
              </div>
            </div>

            <div class="card side-list">
                <h3>Today's Subjects</h3>
                <ul class="subject-list" id="today-subjects-list" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                    <li style="border: 1px dashed var(--surface-border); background: transparent; justify-content: center; color: var(--text-muted); font-size: 0.8rem;">
                        No subjects tracked today yet
                    </li>
                </ul>
            </div>
        </div>
    `,
    focus: `
        <div class="view-header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Focus Center</h1>
                    <p>Deep work mode. No distractions, just progress.</p>
                </div>
                <div class="card" style="padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                    <i data-lucide="zap" style="color: var(--secondary)"></i>
                    <strong>Strict Mode Active</strong>
                </div>
            </div>
        </div>
        
        <div class="focus-container">
            <div class="card timer-card">
                <div class="timer-display">25:00</div>
                <div class="timer-controls">
                    <button class="btn btn-secondary"><i data-lucide="rotate-ccw"></i></button>
                    <button class="btn btn-primary btn-large"><i data-lucide="play"></i> Start</button>
                    <button class="btn btn-secondary"><i data-lucide="skip-forward"></i></button>
                </div>
                <div class="timer-modes">
                    <span class="active">Pomodoro</span>
                    <span>Short Break</span>
                    <span>Long Break</span>
                </div>
                
                <div class="deadline-alerts" style="margin-top: 3rem; text-align: left;">
                    <h4 style="margin-bottom: 1rem;">Coming Up Next</h4>
                    <div style="border: 1px dashed var(--surface-border); padding: 1rem; border-radius: 0.75rem; color: var(--text-muted); font-size: 0.8rem; text-align: center;">
                        No pending deadlines
                    </div>
                </div>
            </div>

            <div class="card focus-options">
                <div class="setting-group">
                    <h3>Focus Pulse</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Current Energy Level</p>
                    <div class="energy-meter">
                        <div class="energy-step"></div>
                        <div class="energy-step"></div>
                        <div class="energy-step"></div>
                        <div class="energy-step"></div>
                        <div class="energy-step"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">
                        <span>Low 🪫</span><span>High 🔋</span>
                    </div>
                </div>

                <div class="setting-group">
                    <h3>Environment</h3>
                    <div class="option-item">
                        <div class="option-info">
                            <strong>Background Music</strong>
                            <span>Focus sounds & Lofi</span>
                        </div>
                        <div class="music-controls">
                            <input type="range" min="0" max="100" value="50">
                        </div>
                    </div>
                    <div class="option-item">
                        <div class="option-info">
                            <strong>Ambient Sound</strong>
                            <span>Pleasant nature loops</span>
                        </div>
                        <select id="ambient-select" style="background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--surface-border); border-radius: 4px; padding: 4px 8px;">
                            <option value="None">None</option>
                            <option value="Rain">🌦️ Falling Rain</option>
                            <option value="River">🌊 River Flow</option>
                            <option value="Nature">🍃 Nature Medley</option>
                            <option value="Lofi">🎧 Lo-Fi Study</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group">
                    <h3>Alert Config</h3>
                    <div class="option-item">
                        <span>Smart Missed Alert</span>
                        <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
                    </div>
                    <div class="option-item">
                        <span>Repeat Notification</span>
                        <label class="switch"><input type="checkbox"><span class="slider"></span></label>
                    </div>
                </div>
            </div>
        </div>
    `,
    planner: `
        <div class="view-header">
            <h1>Study Planner</h1>
            <p>Organize your day for maximum efficiency.</p>
        </div>
        <div class="planner-grid">
            <div class="card timetable">
                <h3>Daily Timetable</h3>
                <div class="time-slots" id="daily-timetable-slots">
                    <div class="slot" style="color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">No tasks planned for today</div>
                </div>
            </div>
            <div class="card exam-countdown">
                <div class="setting-group">
                    <h3>Exam Countdown</h3>
                    <div class="deadline-list">
                        <div style="border: 1px dashed var(--surface-border); padding: 1.5rem; border-radius: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
                            No upcoming exams tracked
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1rem; background: rgba(148, 163, 184, 0.05);">
                    <p style="font-size: 0.85rem;"><i data-lucide="info" style="width: 14px; vertical-align: middle;"></i> New exams can be added in the Vault.</p>
                </div>
            </div>
        </div>
    `,
    insights: `
        <div class="view-header">
            <h1>Productivity Insights</h1>
            <p>Analyze your study habits and peak performance hours.</p>
        </div>
        <div class="grid-container">
            <div class="card">
                <h3>Subject Distribution</h3>
                <div style="height: 200px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="pie-chart" style="width: 100px; height: 100px; opacity: 0.5;"></i>
                </div>
            </div>
            <div class="card">
                <h3>Peak Activity</h3>
                <div class="heatmap-grid" style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; height: 100px; margin-top: 2rem;">
                    ${Array(24).fill(0).map(() => `<div style="background: var(--primary); opacity: 0.05; border-radius: 2px;"></div>`).join('')}
                </div>
            </div>
        </div>
    `,
    vault: `
        <div class="view-header">
            <h1>Revision Vault</h1>
            <p>Your notes and revision status tracking.</p>
        </div>
        <div class="card">
            <div class="notes-header" style="display: flex; justify-content: space-between; margin-bottom: 2rem;">
                <h3>Study Notes</h3>
                <button class="btn btn-primary"><i data-lucide="plus"></i> New Note</button>
            </div>
            <div class="notes-grid" id="vault-notes-grid">
                <div class="note-card" style="border: 1px dashed var(--surface-border); background: transparent; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 100px; color: var(--text-muted);">
                    Your vault is empty. Click "New Note" to begin.
                </div>
            </div>
        </div>
    `,
    settings: `
        <div class="view-header">
            <h1>Settings & Preferences</h1>
        </div>
        <div class="settings-grid">
            <div class="card">
                <div class="setting-group">
                    <h3>Personalization</h3>
                    <div class="option-item">
                        <div class="option-info">
                            <strong>Dark Mode</strong>
                            <span>Switch between light and dark</span>
                        </div>
                        <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
                    </div>
                    <div class="option-item">
                        <div class="option-info">
                            <strong>Snooze Duration</strong>
                            <span>Alert delay time</span>
                        </div>
                        <select style="background: transparent; color: var(--text-main); border: 1px solid var(--surface-border); border-radius: 4px; padding: 2px 5px;">
                            <option>5 Minutes</option>
                            <option>10 Minutes</option>
                            <option>15 Minutes</option>
                        </select>
                    </div>
                </div>
                
                <div class="setting-group">
                    <h3>Reminders</h3>
                    <div class="option-item">
                        <span>Smart Notifications</span>
                        <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
                    </div>
                    <div class="option-item">
                        <span>Revision Alerts</span>
                        <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="setting-group">
                    <h3>Account & Cloud</h3>
                    <div class="option-item">
                        <div class="option-info">
                            <strong>Cloud Sync Status</strong>
                            <span style="color: var(--text-muted);">● Never Synced</span>
                        </div>
                        <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Sync Now</button>
                    </div>
                    <div class="option-item" style="border-bottom: none;">
                        <div class="option-info">
                            <strong>Backup Data</strong>
                            <span>Download study history</span>
                        </div>
                        <i data-lucide="download" style="cursor: pointer; color: var(--text-muted);"></i>
                    </div>
                </div>

                <div class="setting-group" style="margin-top: 3rem;">
                    <button id="logout-btn" class="btn btn-secondary" style="width: 100%; justify-content: center; margin-bottom: 0.75rem;"><i data-lucide="log-out"></i> Logout</button>
                    <button class="btn" style="width: 100%; justify-content: center; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">Delete Account</button>
                </div>
            </div>
        </div>
    `,
    login: `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <h1>Aura Study</h1>
                    <p>Enter your credentials to continue</p>
                </div>
                <form class="auth-form" id="login-form">
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="login-email" placeholder="scholar@example.com" required>
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="login-password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-large" style="width: 100%; justify-content: center;">Sign In</button>
                </form>
                <div class="auth-footer">
                    Don't have an account? <a id="go-signup">Create one</a>
                </div>
            </div>
        </div>
    `,
    signup: `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <h1>Join Aura Study</h1>
                    <p>Start tracking your study journey today</p>
                </div>
                <form class="auth-form" id="signup-form">
                    <div class="input-group">
                        <label>Full Name / Username</label>
                        <input type="text" id="signup-username" placeholder="John Doe" required>
                    </div>
                    <div class="input-group">
                        <label>Email Address</label>
                        <input type="email" id="signup-email" placeholder="john@example.com" required>
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="signup-password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-large" style="width: 100%; justify-content: center;">Create Account</button>
                </form>
                <div class="auth-footer">
                    Already have an account? <a id="go-login">Login here</a>
                </div>
            </div>
        </div>
    `
};

const switchView = (viewName) => {
    const mainContent = document.getElementById('main-content');
    const pageTitle = document.getElementById('page-title');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('header');
    
    // Close sidebar on mobile after navigation
    sidebar.classList.remove('open');

    // Auth views hide sidebar and header for focus
    if (viewName === 'login' || viewName === 'signup') {
        sidebar.style.display = 'none';
        header.style.display = 'none';
        document.querySelector('.main-layout').style.marginLeft = '0';
    } else {
        sidebar.style.display = 'flex';
        header.style.display = 'flex';
        document.querySelector('.main-layout').style.marginLeft = 'var(--sidebar-width)';
    }

    if (views[viewName]) {
        let viewHtml = views[viewName];
        
        // Dynamic Variable Injection
        if (viewName === 'dashboard') {
            viewHtml = viewHtml.replace('{{username}}', userData.username || 'scholar');
        }
        
        mainContent.innerHTML = viewHtml;
        if (pageTitle) pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        
        // Custom logic for dashboard (injecting calendar)
        if (viewName === 'dashboard') {
            const calendarContainer = document.getElementById('activity-calendar-container');
            if (calendarContainer) {
                calendarContainer.innerHTML = generateCalendarHTML();
            }
        }

        // Timer Logic Hook
        if (viewName === 'focus') {
            updateTimerDisplay();
            const startBtn = document.querySelector('.timer-controls .btn-primary');
            const resetBtn = document.querySelector('.timer-controls .btn-secondary:first-child');
            const skipBtn = document.querySelector('.timer-controls .btn-secondary:last-child');
            
            startBtn?.addEventListener('click', () => {
                if (timerRunning) pauseTimer();
                else startTimer();
            });
            
            resetBtn?.addEventListener('click', resetTimer);
            
            skipBtn?.addEventListener('click', () => {
                alert('Skipping session...');
                resetTimer();
            });

            // Mode switches
            document.querySelectorAll('.timer-modes span').forEach(modeSpan => {
                modeSpan.addEventListener('click', () => {
                    document.querySelectorAll('.timer-modes span').forEach(s => s.classList.remove('active'));
                    modeSpan.classList.add('active');
                    currentMode = modeSpan.textContent.toLowerCase().replace(' ', '');
                    resetTimer();
                });
            });

            // Timer Customization
            document.querySelector('.timer-display')?.addEventListener('click', () => {
                const newMins = prompt('Set study time (minutes):', Math.floor(timeLeft / 60));
                if (newMins && !isNaN(newMins)) {
                    timeLeft = parseInt(newMins) * 60;
                    updateTimerDisplay();
                }
            });

            // Ambient Audio Controls
            const ambientSelect = document.getElementById('ambient-select');
            const volumeSlider = document.querySelector('.music-controls input');
            
            ambientSelect?.addEventListener('change', (e) => {
                toggleAmbientSound(e.target.value, volumeSlider.value);
            });
            
            volumeSlider?.addEventListener('input', (e) => {
                updateVolume(e.target.value);
            });

            // Energy Pulse
            document.querySelectorAll('.energy-step').forEach((step, index) => {
                step.addEventListener('click', () => {
                    document.querySelectorAll('.energy-step').forEach((s, idx) => {
                        s.classList.toggle('active', idx <= index);
                    });
                });
            });
        }

        // Vault Logic
        if (viewName === 'vault') {
            document.querySelector('.notes-header .btn-primary')?.addEventListener('click', async () => {
                const title = prompt('Enter note title:');
                if (title) {
                    await saveNote(title, 'New study notes content...', 'Pending');
                    alert('Note saved to your account!');
                }
            });
        }

        // Planner Logic
        if (viewName === 'planner') {
            // Simplified: Refresh timetable display logic could go here
        }

        // Auth Form Listeners
        if (viewName === 'login') {
            document.getElementById('login-form')?.addEventListener('submit', (e) => {
                e.preventDefault();
                handleLogin(document.getElementById('login-email').value, document.getElementById('login-password').value);
            });
            document.getElementById('go-signup')?.addEventListener('click', (e) => { e.preventDefault(); switchView('signup'); });
        }
        if (viewName === 'signup') {
            document.getElementById('signup-form')?.addEventListener('submit', (e) => {
                e.preventDefault();
                handleSignUp(document.getElementById('signup-email').value, document.getElementById('signup-password').value, document.getElementById('signup-username').value);
            });
            document.getElementById('go-login')?.addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });
        }

        // Update active nav state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
        
        // Dynamic event listeners
        if (viewName === 'settings') {
            document.getElementById('logout-btn')?.addEventListener('click', () => handleLogout());
        }
        
        initIcons();
    }
};

// Nav Click Listeners
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        switchView(view);
    });
});

// App Initialization: Check for existing session
const initApp = async () => {
    try {
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        const session = data?.session;
        if (session) {
            currentUser = session.user;
            await fetchUserData();
            switchView('dashboard');
        } else {
            switchView('login');
        }
    } catch (error) {
        console.warn('Auth system unavailable or session check failed. Defaulting to login.');
        switchView('login');
    }
};

// Start App
initApp();

// Mobile Sidebar Toggle
document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
});

initIcons();

// Export for console testing
window.switchView = switchView;
