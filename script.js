// Data & State
const STORAGE_KEY = 'cosmic_flow_data';
let currentUser = null;
let projects = [];
let authMode = 'login';
let currentPage = 'landing';

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTheme();
    initRouting();
    initAuth();
    initProjects();
    initLogout();
});

// Routing (Hash-based for SPA)
function initRouting() {
    const pages = { landing: '#landing', auth: '#auth', dashboard: '#dashboard' };
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#landing';
        Object.keys(pages).forEach(key => {
            const section = document.getElementById(key);
            section.classList.toggle('active', hash === pages[key]);
        });
        currentPage = Object.keys(pages).find(key => pages[key] === hash);
        if (currentPage === 'dashboard') renderProjects();
    });
    // Initial load
    window.location.hash = '#landing';
    document.getElementById('getStartedBtn').addEventListener('click', () => window.location.hash = '#auth');
}

// Theme Toggle (Updated for Icons)
function initTheme() {
    const toggle = document.getElementById('themeToggle');
    const icon = toggle.querySelector('i');
    const isLight = localStorage.getItem('theme') === 'light';
    document.body.classList.toggle('light-theme', isLight);
    icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
    toggle.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
        document.body.classList.toggle('light-theme');
        icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', newTheme);
    });
}

// Auth (Merged - Fixed Projects Init)
function initAuth() {
    const authForm = document.getElementById('authForm');
    const loginToggle = document.getElementById('loginToggle');
    const signupToggle = document.getElementById('signupToggle');
    const submitBtn = document.getElementById('submitBtn');
    const confirmGroup = document.getElementById('confirmGroup');
    const authError = document.getElementById('authError');
    const submitIcon = submitBtn.querySelector('i');

    function setMode(mode) {
        authMode = mode;
        const text = mode.charAt(0).toUpperCase() + mode.slice(1);
        submitBtn.innerHTML = `<i class="fas fa-arrow-right"></i> ${text}`;
        confirmGroup.style.display = mode === 'signup' ? 'block' : 'none';
        document.getElementById('confirmPassword').required = mode === 'signup';
        authError.textContent = '';
        loginToggle.classList.toggle('active', mode === 'login');
        signupToggle.classList.toggle('active', mode === 'signup');
    }

    loginToggle.addEventListener('click', () => setMode('login'));
    signupToggle.addEventListener('click', () => setMode('signup'));

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: {} };
        data.projects = data.projects || {}; // Fix: Ensure projects is an object

        if (authMode === 'signup') {
            if (data.users[email]) return authError.textContent = 'User exists!';
            if (password.length < 6) return authError.textContent = 'Password too short!';
            if (password !== confirmPass) return authError.textContent = 'Passwords mismatch!';
            data.users[email] = password;
            data.projects[email] = []; // Now safe
        } else {
            if (!data.users[email] || data.users[email] !== password) return authError.textContent = 'Invalid login!';
            data.projects[email] = data.projects[email] || []; // Ensure for login too
        }
        currentUser = email;
        data.currentUser = email;
        saveData();
        document.getElementById('userMenu').style.display = 'flex';
        document.getElementById('logoutBtn').style.display = 'flex';
        window.location.hash = '#dashboard';
    });
}

// Projects
function initProjects() {
    const addForm = document.getElementById('addProjectForm');
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('projectName').value.trim();
        if (name && currentUser) {
            projects.push({ name, tasks: [], id: Date.now() });
            saveData();
            renderProjects();
            addForm.reset();
        }
    });
    initDragDrop();
}

function renderProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = projects.map((proj, index) => {
        const completed = proj.tasks.filter(t => t.completed).length;
        const total = proj.tasks.length;
        const progress = total ? (completed / total) * 100 : 0;
        return `
            <div class="project-card" data-id="${proj.id}" style="animation-delay: ${index * 0.1}s;">
                <h3>${proj.name}</h3>
                <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
                <ul class="task-list" data-project="${proj.id}">
                    ${proj.tasks.map((task, idx) => `
                        <li class="task-item ${task.completed ? 'completed' : ''}" draggable="true" data-task="${idx}">
                            <span>${task.text}</span>
                            <div class="task-actions">
                                <button onclick="toggleTask('${proj.id}', ${idx})">
                                    <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                                </button>
                                <button onclick="deleteTask('${proj.id}', ${idx})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
                <div class="add-task-form">
                    <input type="text" placeholder="New task..." onkeypress="if(event.key==='Enter') addTask('${proj.id}', this)" />
                </div>
            </div>
        `;
    }).join('');
}

function addTask(projId, input) {
    const text = input.value.trim();
    if (text) {
        const proj = projects.find(p => p.id == projId);
        proj.tasks.push({ text, completed: false });
        saveData();
        renderProjects();
        input.value = '';
    }
}

function toggleTask(projId, taskIdx) {
    const proj = projects.find(p => p.id == projId);
    proj.tasks[taskIdx].completed = !proj.tasks[taskIdx].completed;
    saveData();
    renderProjects();
}

function deleteTask(projId, taskIdx) {
    const proj = projects.find(p => p.id == projId);
    proj.tasks.splice(taskIdx, 1);
    saveData();
    renderProjects();
}

// Drag-Drop for Tasks (Enhanced Feedback)
function initDragDrop() {
    let draggedItem = null;
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-item')) {
            draggedItem = e.target;
            e.target.classList.add('dragging');
            setTimeout(() => e.target.style.display = 'none', 0); // Ghost effect
        }
    });
    document.addEventListener('dragend', (e) => {
        if (draggedItem) {
            draggedItem.style.display = 'flex';
            draggedItem.classList.remove('dragging');
        }
        draggedItem = null;
    });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItem && e.target.closest('.task-list')) {
            const list = e.target.closest('.task-list');
            const projId = list.dataset.project;
            const proj = projects.find(p => p.id == projId);
            const newIdx = Array.from(list.children).indexOf(e.target.closest('.task-item') || { parentNode: list });
            const oldIdx = Array.from(draggedItem.parentNode.children).indexOf(draggedItem);
            proj.tasks.splice(newIdx, 0, proj.tasks.splice(oldIdx, 1)[0]);
            saveData();
            renderProjects();
        }
    });
}

function initLogout() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem(STORAGE_KEY);
        window.location.hash = '#landing';
        document.getElementById('userMenu').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
    });
}

// Data Persistence (Fixed Projects Init)
function loadData() {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data) {
        currentUser = data.currentUser;
        if (currentUser) {
            projects = data.projects[currentUser] || [];
            document.getElementById('userMenu').style.display = 'flex';
            document.getElementById('logoutBtn').style.display = 'flex';
            if (window.location.hash !== '#landing') window.location.hash = '#dashboard';
        }
    }
}

function saveData() {
    if (currentUser) {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: {} };
        data.projects = data.projects || {}; // Fix: Ensure projects is an object
        data.currentUser = currentUser;
        data.projects[currentUser] = projects; // Now safe
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}