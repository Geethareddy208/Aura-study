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
    streak: 7,
    goal_completion: 75,
    aura_points: 1250,
    username: 'scholar'
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
};

// Auth Handlers
const handleSignUp = async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    
    // Create profile
    currentUser = data.user;
    userData.username = username;
    await pushUserData();
    switchView('dashboard');
};

const handleLogin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
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
    
    // Mock completed days (simulating historical data)
    const completedDays = [1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15]; 

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
            <h1>Welcome back, (username)</h1>
            <p>You've maintained a 7-day streak! Keep it up.</p>
        </div>
        
        <div class="grid-container">
            <div class="card stat-card">
                <div class="stat-header">
                    <i data-lucide="flame" class="icon-streak"></i>
                    <span>Current Streak</span>
                </div>
                <div class="stat-value">7 Days</div>
                <div class="stat-footer">Consistency is key!</div>
            </div>
            
            <div class="card stat-card">
                <div class="stat-header">
                    <i data-lucide="target" class="icon-goal"></i>
                    <span>Daily Goal</span>
                </div>
                <div class="stat-value">75%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 75%"></div>
                </div>
                <div class="stat-footer">4.5h / 6h studied</div>
            </div>

            <div class="card stat-card">
                <div class="stat-header">
                    <i data-lucide="award" class="icon-points"></i>
                    <span>Aura Points</span>
                </div>
                <div class="stat-value">1,250</div>
                <div class="stat-footer">250 points to next level</div>
            </div>
        </div>

        <div class="section-row" style="grid-template-columns: 1.5fr 1fr;">
            <div class="card activity-card">
                <h3 style="margin-bottom: 1.5rem;">Study Activity</h3>
                <div id="activity-calendar-container">
                    <!-- Calendar injected here -->
                </div>
            </div>
            
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
        </div>

        <div class="card side-list" style="margin-top: 1.5rem;">
            <h3>Today's Subjects</h3>
            <ul class="subject-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                <li>
                    <span class="subject-dot math"></span>
                    <span class="subject-name">Advanced Calculus</span>
                    <span class="subject-time">2h 15m</span>
                </li>
                <li>
                    <span class="subject-dot physics"></span>
                    <span class="subject-name">Quantum Mechanics</span>
                    <span class="subject-time">1h 45m</span>
                </li>
                <li>
                    <span class="subject-dot chem"></span>
                    <span class="subject-name">Organic Chemistry</span>
                    <span class="subject-time">45m</span>
                </li>
            </ul>
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
                    <div class="deadline-item">
                        <div class="deadline-info">
                            <span class="deadline-name">Chemistry Lab Draft</span>
                            <span class="deadline-sub">Due in 2 hours</span>
                        </div>
                        <i data-lucide="bell" style="color: var(--accent)"></i>
                    </div>
                </div>
            </div>

            <div class="card focus-options">
                <div class="setting-group">
                    <h3>Focus Pulse</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Current Energy Level</p>
                    <div class="energy-meter">
                        <div class="energy-step active"></div>
                        <div class="energy-step active"></div>
                        <div class="energy-step active"></div>
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
                            <span>Rain / Forest / White Noise</span>
                        </div>
                        <select style="background: transparent; color: var(--text-main); border: 1px solid var(--surface-border); border-radius: 4px; padding: 2px 5px;">
                            <option>Heavy Rain</option>
                            <option>Cozy Cafe</option>
                            <option>Nature Ambient</option>
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
                <div class="time-slots">
                    <div class="slot"><span>08:00</span> <div class="task active math">Calculus Revision</div></div>
                    <div class="slot"><span>09:00</span> <div class="task active math">Problem Set 4</div></div>
                    <div class="slot"><span>10:00</span> <div class="task break">Coffee Break</div></div>
                    <div class="slot"><span>11:00</span> <div class="task active physics">Thermodynamics</div></div>
                </div>
            </div>
            <div class="card exam-countdown">
                <div class="setting-group">
                    <h3>Exam Countdown</h3>
                    <div class="deadline-list">
                        <div class="deadline-item">
                            <div class="deadline-info">
                                <span class="deadline-name">Final Exams</span>
                                <span class="deadline-sub">June 2026</span>
                            </div>
                            <span class="days-left">12 Days</span>
                        </div>
                        <div class="deadline-item">
                            <div class="deadline-info">
                                <span class="deadline-name">Physics Midterm</span>
                                <span class="deadline-sub">Friday</span>
                            </div>
                            <span class="days-left">04 Days</span>
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1rem; background: rgba(255,180,162, 0.1);">
                    <p style="font-size: 0.85rem;"><i data-lucide="info" style="width: 14px; vertical-align: middle;"></i> Tip: Revision phase starts in 2 days.</p>
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
                    ${Array(24).fill(0).map(() => `<div style="background: var(--primary); opacity: ${Math.random()}; border-radius: 2px;"></div>`).join('')}
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
            <div class="notes-grid">
                <div class="note-card">
                    <h4>Vector Calculus</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Last edited 2h ago</p>
                    <span class="tag">Revision Done</span>
                </div>
                <div class="note-card">
                    <h4>Nervous System</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Last edited yesterday</p>
                    <span class="tag pending">Pending</span>
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
                            <span style="color: #10b981;">● Synced 2m ago</span>
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
                <div class="auth-form" id="login-form">
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="login-email" placeholder="scholar@example.com">
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="login-password" placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-large" style="width: 100%; justify-content: center;">Sign In</button>
                </div>
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
                <div class="auth-form" id="signup-form">
                    <div class="input-group">
                        <label>Full Name / Username</label>
                        <input type="text" id="signup-username" placeholder="John Doe">
                    </div>
                    <div class="input-group">
                        <label>Email Address</label>
                        <input type="email" id="signup-email" placeholder="john@example.com">
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="signup-password" placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-large" style="width: 100%; justify-content: center;">Create Account</button>
                </div>
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
        mainContent.innerHTML = views[viewName];
        if (pageTitle) pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        
        // Custom logic for dashboard (injecting calendar)
        if (viewName === 'dashboard') {
            const calendarContainer = document.getElementById('activity-calendar-container');
            if (calendarContainer) {
                calendarContainer.innerHTML = generateCalendarHTML();
            }
        }

        // Timer Logic Hook (Example)
        if (viewName === 'focus') {
            document.querySelector('.btn-primary')?.addEventListener('click', () => {
                // In a real app, this would be called when the timer reaches 0
                // For demonstration, we'll simulate saving a 25m session
                console.log('Timer started - will sync on finish');
            });
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
