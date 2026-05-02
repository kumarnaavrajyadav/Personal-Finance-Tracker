/**
 * FinanceFlow - Core Logic (Refactored for Robust Event Handling)
 * High-performance CRUD Table logic & PDF Reporting
 */

class FinanceFlow {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.currentUser = JSON.parse(localStorage.getItem('user')) || null;
        this.token = localStorage.getItem('token') || null;
        this.currentView = 'dashboard';
        this.activeCategory = 'All';
        this.transactions = [];
        this.budgets = [];
        this.charts = {};

        this.dom = {
            authOverlay: document.getElementById('authOverlay'),
            mainApp: document.getElementById('mainApp'),
            loginForm: document.getElementById('loginForm'),
            signupForm: document.getElementById('signupForm'),
            navItems: document.querySelectorAll('.nav-item'),
            views: document.querySelectorAll('.view-section'),
            displayUserName: document.getElementById('displayUserName'),
            welcomeName: document.getElementById('welcomeName'),
            logoutBtn: document.getElementById('logoutBtn'),
            transactionModal: document.getElementById('transactionModal'),
            transactionForm: document.getElementById('transactionForm'),
            budgetForm: document.getElementById('budgetForm'),
            notification: document.getElementById('notification'),
            totalBalance: document.getElementById('totalBalance'),
            totalIncome: document.getElementById('totalIncome'),
            totalExpense: document.getElementById('totalExpense'),
            profileUpload: document.getElementById('profileUpload'),
            userAvatar: document.getElementById('userAvatar'),
            settingsAvatar: document.getElementById('settingsAvatar'),
            transactionSearch: document.getElementById('transactionSearch'),
            filterBtns: document.querySelectorAll('.filter-btn'),
            transactionTableBody: document.getElementById('transactionTableBody'),
            dashboardRecentTransactions: document.getElementById('dashboardRecentTransactions'),
            dashboardBudgetTable: document.getElementById('dashboardBudgetTable'),
            editTaskId: document.getElementById('editTaskId'),
            modalTitle: document.getElementById('modalTitle'),
            totalInflow: document.getElementById('totalInflow'),
            totalOutflow: document.getElementById('totalOutflow'),
            netCashFlow: document.getElementById('netCashFlow'),
            downloadExcelBtn: document.getElementById('downloadExcelBtn'),
            exportStartDate: document.getElementById('exportStartDate'),
            exportEndDate: document.getElementById('exportEndDate'),
            confirmModal: document.getElementById('confirmModal'),
            cancelConfirm: document.getElementById('cancelConfirm'),
            submitConfirm: document.getElementById('submitConfirm'),
            currencySelect: document.getElementById('currencySelect'),
            themeToggle: document.getElementById('themeToggle'),
            incomeInput: document.getElementById('incomeInput'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            currentMonthYear: document.getElementById('currentMonthYear'),
            googleSetupView: document.getElementById('googleSetupView'),
            setupClientId: document.getElementById('setupClientId'),
            saveGoogleIdBtn: document.getElementById('saveGoogleIdBtn'),
            cancelGoogleSetup: document.getElementById('cancelGoogleSetup')
        };

        this.init();
    }

    init() {
        this.attachEventListeners();
        this.checkAuth();
        this.updateAppDate();
        this.initGoogleAuth();
        
        document.querySelectorAll('.open-transaction-modal').forEach(btn => {
            btn.addEventListener('click', () => this.toggleModal('transactionModal', true));
        });
        document.querySelector('.close-modal')?.addEventListener('click', () => this.toggleModal('transactionModal', false));
    }

    attachEventListeners() {
        // Auth navigation
        const toSignup = document.getElementById('toSignup');
        const toLogin = document.getElementById('toLogin');
        if (toSignup) toSignup.onclick = (e) => { e.preventDefault(); this.toggleAuthMode('signup'); };
        if (toLogin) toLogin.onclick = (e) => { e.preventDefault(); this.toggleAuthMode('login'); };

        // Forms
        if (this.dom.loginForm) this.dom.loginForm.onsubmit = (e) => this.handleAuth(e, 'login');
        if (this.dom.signupForm) this.dom.signupForm.onsubmit = (e) => this.handleAuth(e, 'signup');
        if (this.dom.transactionForm) this.dom.transactionForm.onsubmit = (e) => this.handleSubmitTransaction(e);
        if (this.dom.budgetForm) this.dom.budgetForm.onsubmit = (e) => this.handleUpdateBudget(e);
        if (this.dom.profileUpload) this.dom.profileUpload.onchange = (e) => this.handleProfileUpload(e);
        if (this.dom.downloadExcelBtn) this.dom.downloadExcelBtn.onclick = () => this.generateCSV();

        // Reports View Listeners
        if (this.dom.exportStartDate) this.dom.exportStartDate.onchange = () => this.updateReportsView();
        if (this.dom.exportEndDate) this.dom.exportEndDate.onchange = () => this.updateReportsView();

        // Transaction filters
        if (this.dom.filterBtns) {
            this.dom.filterBtns.forEach(btn => {
                btn.onclick = () => {
                    this.dom.filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeCategory = btn.dataset.category;
                    this.renderFullTransactionList();
                };
            });
        }

        if (this.dom.transactionSearch) this.dom.transactionSearch.oninput = () => this.renderFullTransactionList();

        // Nav
        if (this.dom.navItems) {
            this.dom.navItems.forEach(item => {
                item.onclick = (e) => { e.preventDefault(); this.switchView(item.dataset.view); };
            });
        }

        if (this.dom.saveSettingsBtn) this.dom.saveSettingsBtn.onclick = () => this.handleSaveSettings();

        document.querySelectorAll('.view-all-btn').forEach(btn => {
            btn.onclick = () => this.switchView(btn.dataset.view);
        });

        // Logout
        const logoutAction = () => this.logout();
        if (this.dom.logoutBtn) this.dom.logoutBtn.onclick = logoutAction;
        const finalLogout = document.querySelector('.logout-btn-large');
        if (finalLogout) finalLogout.onclick = logoutAction;

        // --- DELEGATED EVENT LISTENER FOR DYNAMIC ACTIONS ---
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;
            e.preventDefault();

            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const category = btn.dataset.category;

            console.info(`[Action Captured] action: ${action}, id: ${id}, category: ${category}`);

            if (action === 'edit-transaction') this.openEditModal(id);
            if (action === 'delete-transaction') this.handleDeleteTransaction(id);
            if (action === 'edit-budget') this.openEditBudget(category);
            if (action === 'delete-budget') this.handleDeleteBudget(category);
        });
        
        // Google Setup Events
        if (this.dom.saveGoogleIdBtn) {
            this.dom.saveGoogleIdBtn.onclick = () => this.handleSaveGoogleId();
        }
        if (this.dom.cancelGoogleSetup) {
            this.dom.cancelGoogleSetup.onclick = (e) => {
                e.preventDefault();
                this.toggleGoogleSetup(false);
            };
        }

        // Mobile Menu Toggle
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if (mobileBtn) {
            mobileBtn.onclick = () => {
                document.querySelector('.sidebar')?.classList.toggle('mobile-active');
                const icon = mobileBtn.querySelector('i');
                if (icon) icon.className = document.querySelector('.sidebar')?.classList.contains('mobile-active') ? 'fas fa-times' : 'fas fa-bars';
            };
        }

        // Close sidebar when clicking nav item on mobile
        this.dom.navItems?.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 850) {
                    document.querySelector('.sidebar')?.classList.remove('mobile-active');
                    if (mobileBtn) {
                        const icon = mobileBtn.querySelector('i');
                        if (icon) icon.className = 'fas fa-bars';
                    }
                }
            });
        });
    }

    // --- CUSTOM PROMISE-BASED CONFIRMATION ---
    async showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = this.dom.confirmModal;
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            
            modal.classList.remove('hidden');

            const handleCancel = () => {
                modal.classList.add('hidden');
                cleanup();
                resolve(false);
            };

            const handleSubmit = () => {
                modal.classList.add('hidden');
                cleanup();
                resolve(true);
            };

            const cleanup = () => {
                this.dom.cancelConfirm.removeEventListener('click', handleCancel);
                this.dom.submitConfirm.removeEventListener('click', handleSubmit);
            };

            this.dom.cancelConfirm.addEventListener('click', handleCancel);
            this.dom.submitConfirm.addEventListener('click', handleSubmit);
        });
    }

    // --- AUTH ---
    checkAuth() {
        if (this.token && this.currentUser) { this.showApp(); } 
        else { this.showAuth(); }
    }

    async handleAuth(e, type) {
        e.preventDefault();
        const endpoint = type === 'login' ? '/login' : '/signup';
        const data = type === 'login' ? {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        } : {
            name: document.getElementById('signupName').value,
            email: document.getElementById('signupEmail').value,
            password: document.getElementById('signupPassword').value
        };

        try {
            const res = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Auth failed');

            if (type === 'login') {
                this.token = result.token;
                this.currentUser = { id: result.user_id, username: result.name, email: data.email, profile_picture: result.profile_picture };
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.currentUser));
                this.showApp();
            } else {
                this.showNotification('Account created! Sign in.', 'success');
                this.toggleAuthMode('login');
            }
        } catch (err) { this.showNotification(err.message, 'error'); }
    }

    logout() { localStorage.clear(); location.reload(); }

    showAuth() {
        this.dom.authOverlay.classList.remove('hidden');
        this.dom.mainApp.classList.add('hidden');
    }

    showApp() {
        this.dom.authOverlay.classList.add('hidden');
        this.dom.mainApp.classList.remove('hidden');
        const userName = this.currentUser?.username || this.currentUser?.name || 'User';
        const userEmail = this.currentUser?.email || 'guest@example.com';

        this.dom.displayUserName.textContent = userName;
        this.dom.welcomeName.textContent = userName;
        
        // Update Settings View Info
        const settingsName = document.getElementById('settingsUserName');
        const settingsEmail = document.getElementById('settingsUserEmail');
        const editNameInput = document.getElementById('editName');
        const editEmailInput = document.getElementById('editEmail');

        if (settingsName) settingsName.textContent = userName;
        if (settingsEmail) settingsEmail.textContent = userEmail;
        if (editNameInput) editNameInput.value = userName;
        if (editEmailInput) editEmailInput.value = userEmail;

        this.updateAvatars(this.currentUser?.profile_picture);
        
        this.switchView(this.currentView); 
        this.refreshData();
        this.startLiveSync();
    }

    startLiveSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            // Only sync if user is logged in and page is visible
            if (this.token && !document.hidden && this.dom.authOverlay.classList.contains('hidden')) {
                this.fetchTransactions();
                this.fetchBudgets();
                this.updateUI();
                // We don't re-init charts every time to avoid flicker, just update them if needed
            }
        }, 15000); // 15 seconds polling for real-time feel
    }

    async updateAvatars(path) {
        const fallback = `https://ui-avatars.com/api/?name=${this.currentUser?.username || 'User'}&background=6366f1&color=fff`;
        
        // If no path, go straight to fallback
        if (!path) {
            if (this.dom.userAvatar) this.dom.userAvatar.src = fallback;
            if (this.dom.settingsAvatar) this.dom.settingsAvatar.src = fallback;
            return;
        }

        const url = path.startsWith('http') ? path : `${this.apiBaseUrl}${path}`;
        
        // Silent pre-check using a dummy Image object to avoid 404 console logs
        const img = new Image();
        img.onload = () => {
            if (this.dom.userAvatar) this.dom.userAvatar.src = url;
            if (this.dom.settingsAvatar) this.dom.settingsAvatar.src = url;
        };
        img.onerror = () => {
            if (this.dom.userAvatar) this.dom.userAvatar.src = fallback;
            if (this.dom.settingsAvatar) this.dom.settingsAvatar.src = fallback;
        };
        img.src = url;
    }

    toggleAuthMode(mode) {
        this.dom.loginForm.classList.toggle('hidden', mode === 'signup');
        this.dom.signupForm.classList.toggle('hidden', mode === 'login');
        
        const title = document.getElementById('authTitle');
        const subtitle = document.getElementById('authSubtitle');
        
        if (mode === 'signup') {
            title.textContent = 'Create Account';
            subtitle.textContent = 'Join FinanceFlow and start tracking';
        } else {
            title.textContent = 'Welcome Back';
            subtitle.textContent = 'Manage your wealth with confidence';
        }
    }

    // --- GOOGLE AUTH ---

    initGoogleAuth() {
        const userClientID = localStorage.getItem('google_client_id');
        const defaultID = "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com";
        const clientID = userClientID || defaultID;
        
        const btnContainer = document.getElementById("googleSignInBtn");
        if (!btnContainer) return;

        if (clientID.includes("YOUR_GOOGLE_CLIENT_ID_HERE")) {
            btnContainer.innerHTML = `
                <button class="google-login-btn-custom" id="triggerGoogleSetup">
                    <svg class="google-icon" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                </button>
                <div style="text-align: center; margin-top: 10px;">
                    <a href="#" style="font-size: 0.75rem; color: var(--text-muted); text-decoration: underline;" id="linkGoogleSetup">
                        <i class="fas fa-cog"></i> Setup Google Login
                    </a>
                </div>
            `;
            
            document.getElementById('triggerGoogleSetup').onclick = () => this.toggleGoogleSetup(true);
            document.getElementById('linkGoogleSetup').onclick = (e) => { e.preventDefault(); this.toggleGoogleSetup(true); };
            return;
        }

        if (typeof google === 'undefined') {
            setTimeout(() => this.initGoogleAuth(), 100);
            return;
        }

        google.accounts.id.initialize({
            client_id: clientID,
            callback: (resp) => this.handleGoogleCredentialResponse(resp)
        });
        google.accounts.id.renderButton(btnContainer, { theme: "outline", size: "large", width: 320 });
    }

    toggleGoogleSetup(show) {
        const header = document.querySelector('.auth-header');
        if (show) {
            this.dom.loginForm.classList.add('hidden');
            this.dom.signupForm.classList.add('hidden');
            this.dom.googleSetupView.classList.remove('hidden');
            if (header) header.classList.add('hidden');
        } else {
            this.dom.googleSetupView.classList.add('hidden');
            this.dom.loginForm.classList.remove('hidden');
            if (header) header.classList.remove('hidden');
        }
    }

    async handleSaveGoogleId() {
        const id = this.dom.setupClientId.value.trim();
        if (!id) {
            this.showNotification('Please enter a valid Client ID', 'error');
            return;
        }

        const btn = this.dom.saveGoogleIdBtn;
        const btnText = btn.querySelector('.btn-text');
        
        btn.classList.add('btn-loading');
        btn.disabled = true;

        // Simulate a small delay for UX feedback
        await new Promise(r => setTimeout(r, 800));

        localStorage.setItem('google_client_id', id);
        
        btn.classList.remove('btn-loading');
        btn.style.background = '#10b981'; // Success Green
        btnText.textContent = 'Success! Enabled';

        this.showNotification('Google Login enabled successfully!', 'success');

        setTimeout(() => {
            btn.style.background = '';
            btnText.textContent = 'Enable Google Login';
            btn.disabled = false;
            this.toggleGoogleSetup(false);
            this.initGoogleAuth(); // Re-init without reload
        }, 1500);
    }

    async handleGoogleCredentialResponse(response) {
        try {
            const res = await fetch(`${this.apiBaseUrl}/google-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Google login failed');

            this.token = result.token;
            this.currentUser = { id: result.user_id, name: result.name, profile_picture: result.profile_picture };
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.showNotification(`Welcome back, ${result.name}!`, 'success');
            this.showApp();
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }

    // --- AUTH EFFECTS ---

    initAuthEffects() {
        // Futuristic effects disabled for clean theme
    }

    typewriterEffect(elementId, text) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = '<span class="typing-cursor">_</span>';
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                el.innerHTML = text.substring(0, i + 1) + '<span class="typing-cursor">_</span>';
                i++;
            } else {
                clearInterval(interval);
            }
        }, 50);
    }

    initParticles() {
        const canvas = document.getElementById('particleCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouse = { x: null, y: null };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        canvas.addEventListener('mousemove', (e) => {
            mouse.x = e.x;
            mouse.y = e.y;
        });

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }
            draw() {
                ctx.fillStyle = 'rgba(99, 102, 241, 0.5)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const count = Math.min(80, Math.floor(window.innerWidth / 15));
        for (let i = 0; i < count; i++) particles.push(new Particle());

        const connectParticles = () => {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a + 1; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 - dist / 800})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
                // Mouse interaction
                if (mouse.x) {
                    const dx = particles[a].x - mouse.x;
                    const dy = particles[a].y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.strokeStyle = `rgba(168, 85, 247, ${0.3 - dist / 500})`;
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            connectParticles();
            requestAnimationFrame(animate);
        };
        animate();
    }

    updateAppDate() {
        const tick = () => {
            const now = new Date();
            const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
            const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            
            const timeStr = now.toLocaleTimeString('en-US', timeOpts);
            const dateStr = now.toLocaleDateString('en-US', dateOpts);
            
            if (this.dom.currentMonthYear) {
                this.dom.currentMonthYear.innerHTML = `<span class="live-time">${timeStr}</span> <span class="live-date">${dateStr}</span>`;
            }
        };
        tick();
        setInterval(tick, 1000);
    }

    // --- DATA FETCHING ---

    async refreshData() {
        await Promise.all([this.fetchTransactions(), this.fetchBudgets()]);
        this.updateUI();
        this.initCharts();
    }

    async fetchTransactions() {
        try {
            const res = await fetch(`${this.apiBaseUrl}/transactions`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.transactions = await res.json();
        } catch (err) { console.error(err); }
    }

    async fetchBudgets() {
        try {
            const res = await fetch(`${this.apiBaseUrl}/budget`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.budgets = await res.json();
        } catch (err) { console.error(err); }
    }

    // --- TRANSACTION CRUD ---

    async handleSubmitTransaction(e) {
        e.preventDefault();
        const id = this.dom.editTaskId.value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${this.apiBaseUrl}/transaction/${id}` : `${this.apiBaseUrl}/transaction`;

        const data = {
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            type: document.getElementById('type').value,
            category: document.getElementById('category').value,
            date: document.getElementById('date').value
        };

        console.info(`[Submit Transaction] Method: ${method}, URL: ${url}`, data);

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || result.message || 'Action failed');
            
            this.showNotification(id ? 'Transaction updated!' : 'Transaction added!', 'success');
            this.toggleModal('transactionModal', false);
            this.refreshData();
        } catch (err) { 
            console.error('[Transaction Error]', err);
            this.showNotification(err.message, 'error'); 
        }
    }

    async handleDeleteTransaction(id) {
        console.log(`[handleDeleteTransaction] ID: ${id}`);
        if (!id) return;
        
        const confirmed = await this.showConfirm('Delete Transaction', 'Are you sure you want to permanently remove this transaction?');
        if (!confirmed) return;

        try {
            const res = await fetch(`${this.apiBaseUrl}/transaction/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error('Delete failed');
            this.showNotification('Transaction deleted successfully.', 'success');
            this.refreshData();
        } catch (err) { this.showNotification(err.message, 'error'); }
    }

    openEditModal(id) {
        const t = this.transactions.find(item => item.id == id);
        if (!t) return;
        this.dom.modalTitle.textContent = 'Edit Transaction';
        this.dom.editTaskId.value = t.id;
        document.getElementById('description').value = t.description;
        document.getElementById('amount').value = parseFloat(t.amount);
        document.getElementById('type').value = t.type;
        document.getElementById('category').value = t.category;
        document.getElementById('date').value = t.date.split('T')[0];
        this.toggleModal('transactionModal', true);
    }

    // --- BUDGET CRUD ---

    async handleUpdateBudget(e) {
        e.preventDefault();
        const data = { 
            category: document.getElementById('budgetCategory').value, 
            budget_limit: parseFloat(document.getElementById('budgetLimit').value),
            month: new Date().getMonth() + 1, year: new Date().getFullYear()
        };
        try {
            const res = await fetch(`${this.apiBaseUrl}/budget`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Budget update failed');
            this.refreshData();
            this.showNotification('Budget limit updated!', 'success');
            this.dom.budgetForm.reset();
        } catch (err) { this.showNotification(err.message, 'error'); }
    }

    async handleDeleteBudget(category) {
        console.log(`[handleDeleteBudget] Category: ${category}`);
        if (!category) return;

        const confirmed = await this.showConfirm('Remove Budget', `Permanently delete the budget category for "${category}"?`);
        if (!confirmed) return;

        try {
            const res = await fetch(`${this.apiBaseUrl}/budget/${encodeURIComponent(category)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error('Delete budget failed');
            this.showNotification('Budget category removed.', 'success');
            this.refreshData();
        } catch (err) { this.showNotification(err.message, 'error'); }
    }

    openEditBudget(category) {
        const b = this.budgets.find(item => item.category === category);
        if (!b) return;
        this.switchView('budgets');
        document.getElementById('budgetCategory').value = b.category;
        document.getElementById('budgetLimit').value = b.budget_limit;
        document.getElementById('budgetLimit').focus();
    }

    // --- UI RENDERING ---

    updateUI() {
        const income = Array.isArray(this.transactions) ? this.transactions.filter(t => t.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0) : 0;
        const expense = Array.isArray(this.transactions) ? this.transactions.filter(t => t.type === 'expense').reduce((a, b) => a + parseFloat(b.amount), 0) : 0;
        const balance = income - expense;

        this.dom.totalBalance.textContent = `$${balance.toLocaleString()}`;
        this.dom.totalIncome.textContent = `$${income.toLocaleString()}`;
        this.dom.totalExpense.textContent = `$${expense.toLocaleString()}`;

        if (this.dom.totalInflow) {
            this.dom.totalInflow.textContent = `$${income.toLocaleString()}`;
            this.dom.totalOutflow.textContent = `$${expense.toLocaleString()}`;
            this.dom.netCashFlow.textContent = `$${balance.toLocaleString()}`;
        }

        this.renderDashboardTables();
        this.renderFullTransactionList();
        this.renderBudgetsView();
        this.updateReportsView();
        this.generateAIInsights();
    }

    renderDashboardTables() {
        // Recent Transactions
        const recentBody = this.dom.dashboardRecentTransactions;
        if (!Array.isArray(this.transactions) || this.transactions.length === 0) {
            recentBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent activity.</td></tr>';
        } else {
            recentBody.innerHTML = this.transactions.filter(t => t && t.date).slice(0, 5).map(t => `
                <tr>
                    <td>${new Date(t.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</td>
                    <td><div class="t-row-category"><i class="fas ${this.getCategoryIcon(t.category)}"></i> ${t.description}</div></td>
                    <td class="${t.type === 'income' ? 'text-success' : 'text-danger'} font-bold">$${parseFloat(t.amount).toLocaleString()}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn btn-edit" data-action="edit-transaction" data-id="${t.id}" title="Edit"><i class="fas fa-pen-to-square"></i></button>
                            <button class="action-btn btn-delete" data-action="delete-transaction" data-id="${t.id}" title="Delete"><i class="fas fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        // Budget Tracking
        const budgetBody = this.dom.dashboardBudgetTable;
        if (!Array.isArray(this.budgets) || this.budgets.length === 0) {
            budgetBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No budgets configured.</td></tr>';
        } else {
            budgetBody.innerHTML = this.budgets.slice(0, 4).map(b => {
                const percent = Math.min((b.spent / b.budget_limit) * 100, 100);
                const status = percent > 90 ? 'Critical' : percent > 70 ? 'Warning' : 'Healthy';
                const colorClass = percent > 90 ? 'text-danger' : percent > 70 ? 'text-warning' : 'text-success';
                return `
                    <tr>
                        <td class="font-bold">${b.category}</td>
                        <td>$${b.spent} / $${b.budget_limit}</td>
                        <td>
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
                                <span class="${colorClass} font-bold">${status}</span>
                                <div class="action-btns">
                                    <button class="action-btn btn-edit" data-action="edit-budget" data-category="${b.category}" title="Edit"><i class="fas fa-pen-to-square"></i></button>
                                    <button class="action-btn btn-delete" data-action="delete-budget" data-category="${b.category}" title="Delete"><i class="fas fa-trash-can"></i></button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    renderFullTransactionList() {
        const body = this.dom.transactionTableBody;
        if (!body) return;
        const searchTerm = (this.dom.transactionSearch?.value || '').toLowerCase();
        
        let filtered = Array.isArray(this.transactions) ? [...this.transactions] : [];
        if (this.activeCategory !== 'All') filtered = filtered.filter(t => t.category === this.activeCategory);
        if (searchTerm) filtered = filtered.filter(t => t.description && t.description.toLowerCase().includes(searchTerm));

        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">No matching records found.</td></tr>';
            return;
        }

        body.innerHTML = filtered.map(t => `
            <tr>
                <td><input type="checkbox" class="transaction-checkbox" data-id="${t.id}"></td>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td><div class="t-row-category"><i class="fas ${this.getCategoryIcon(t.category)}"></i> <span>${t.category}</span></div></td>
                <td>${t.description}</td>
                <td><span class="type-badge ${t.type}">${t.type}</span></td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'} font-bold">$${parseFloat(t.amount).toLocaleString()}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit" data-action="edit-transaction" data-id="${t.id}" title="Edit"><i class="fas fa-pen-to-square"></i></button>
                        <button class="action-btn btn-delete" data-action="delete-transaction" data-id="${t.id}" title="Delete"><i class="fas fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.attachBulkDeleteListeners();
    }

    attachBulkDeleteListeners() {
        const selectAll = document.getElementById('selectAllTransactions');
        const checkboxes = document.querySelectorAll('.transaction-checkbox');
        const bulkBtn = document.getElementById('bulkDeleteBtn');

        if (selectAll) {
            selectAll.onchange = () => {
                checkboxes.forEach(cb => cb.checked = selectAll.checked);
                this.toggleBulkDeleteButton();
            };
        }

        checkboxes.forEach(cb => {
            cb.onchange = () => {
                this.toggleBulkDeleteButton();
                if (!cb.checked && selectAll) selectAll.checked = false;
            };
        });

        if (bulkBtn) {
            bulkBtn.onclick = () => this.handleBulkDelete();
        }
    }

    toggleBulkDeleteButton() {
        const selected = document.querySelectorAll('.transaction-checkbox:checked');
        const bulkBtn = document.getElementById('bulkDeleteBtn');
        if (bulkBtn) {
            if (selected.length > 0) {
                bulkBtn.classList.remove('hidden');
                bulkBtn.style.display = 'flex';
            } else {
                bulkBtn.classList.add('hidden');
                bulkBtn.style.display = 'none';
            }
        }
    }

    async handleBulkDelete() {
        const selected = document.querySelectorAll('.transaction-checkbox:checked');
        const ids = Array.from(selected).map(cb => cb.getAttribute('data-id'));
        
        if (ids.length === 0) return;

        const confirmed = await this.showConfirm('Bulk Delete', `Are you sure you want to delete ${ids.length} selected transactions?`);
        if (!confirmed) return;

        try {
            const res = await fetch(`${this.apiBaseUrl}/transactions/bulk`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}` 
                },
                body: JSON.stringify({ ids })
            });
            
            if (!res.ok) throw new Error('Bulk delete failed');
            
            const result = await res.json();
            this.showNotification(result.message, 'success');
            this.refreshData();
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }

    renderBudgetsView() {
        const list = document.getElementById('activeBudgetsList');
        if (!list || !Array.isArray(this.budgets)) return;
        list.innerHTML = this.budgets.map(b => `
            <div class="glass-card" style="padding:20px; position:relative;">
                <div class="action-btns" style="position:absolute; top:15px; right:15px;">
                    <button class="action-btn btn-edit" data-action="edit-budget" data-category="${b.category}" title="Edit Budget"><i class="fas fa-pen-to-square"></i></button>
                    <button class="action-btn btn-delete" data-action="delete-budget" data-category="${b.category}" title="Delete Budget"><i class="fas fa-trash-can"></i></button>
                </div>
                <div class="budget-meta" style="margin-right:80px;"><strong>${b.category}</strong><span>$${b.spent} / $${b.budget_limit}</span></div>
                <div class="progress-bar" style="height:12px; margin-top:10px;"><div class="progress-fill" style="width: ${Math.min((b.spent/b.budget_limit)*100, 100)}%; background: var(--primary)"></div></div>
            </div>
        `).join('');
    }

    // --- EXCEL/CSV REPORT GENERATION ---

    generateCSV() {
        const startDate = this.dom.exportStartDate.value;
        const endDate = this.dom.exportEndDate.value;
        
        let filtered = Array.isArray(this.transactions) ? [...this.transactions] : [];
        
        if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter(t => new Date(t.date) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            // Include entire end date by setting time to end of day
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.date) <= end);
        }
        
        if (filtered.length === 0) {
            this.showNotification('No transactions found for this date range.', 'warning');
            return;
        }

        // CSV Header
        const headers = ['Date', 'Category', 'Description', 'Type', 'Amount'];
        
        // CSV Rows
        const rows = filtered.map(t => [
            new Date(t.date).toISOString().split('T')[0],
            `"${t.category}"`,
            `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
            t.type.toUpperCase(),
            t.amount
        ]);
        
        // Combine
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');
        
        // Create Blob and Download Link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `FinanceFlow_Statement_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Excel statement downloaded successfully.', 'success');
    }

    updateReportsView() {
        const startDate = this.dom.exportStartDate?.value;
        const endDate = this.dom.exportEndDate?.value;
        
        let filtered = Array.isArray(this.transactions) ? [...this.transactions] : [];
        
        if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter(t => new Date(t.date) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.date) <= end);
        }
        
        // Sort by date descending
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate Totals
        const inflow = filtered.filter(t => t.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0);
        const outflow = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + parseFloat(b.amount), 0);
        const net = inflow - outflow;
        
        // Update Summary Pills
        const inEl = document.getElementById('reportTotalIn');
        const outEl = document.getElementById('reportTotalOut');
        const netEl = document.getElementById('reportTotalNet');

        if (inEl) inEl.textContent = `$${inflow.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (outEl) outEl.textContent = `$${outflow.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (netEl) netEl.textContent = `$${net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        
        // Update Table
        const tbody = document.getElementById('reportsTableBody');
        if (!tbody) return;
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">No transactions found for this period.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filtered.map(t => `
            <tr>
                <td>${new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>${t.description}</td>
                <td><span class="type-badge" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border);">${t.category}</span></td>
                <td><span class="type-badge ${t.type}">${t.type}</span></td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'}">${t.type === 'income' ? '+' : '-'}$${parseFloat(t.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-delete" data-action="delete-transaction" data-id="${t.id}" title="Delete"><i class="fas fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // --- SETTINGS LOGIC ---

    async handleSaveSettings() {
        const data = {
            currency: this.dom.currencySelect.value,
            theme: this.dom.themeToggle.checked ? 'dark' : 'light',
            monthly_income: parseFloat(this.dom.incomeInput.value) || 0
        };

        try {
            const res = await fetch(`${this.apiBaseUrl}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to save settings');
            
            this.showNotification('Configuration Saved Successfully!', 'success');
            this.refreshData(); // Refresh UI to reflect new income targets
        } catch (err) { this.showNotification(err.message, 'error'); }
    }

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.toggle('hidden', !show);
        if (show && id === 'transactionModal' && !this.dom.editTaskId.value) {
            // Default to today's date for new transactions
            const dateInput = document.getElementById('date');
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        }
        if (!show) { 
            this.dom.transactionForm.reset(); 
            this.dom.editTaskId.value = ''; 
            this.dom.modalTitle.textContent = 'New Transaction'; 
        }
    }

    switchView(viewId) {
        this.dom.views.forEach(v => v.classList.add('hidden'));
        const targetView = document.getElementById(`${viewId}View`);
        if (targetView) targetView.classList.remove('hidden');
        this.dom.navItems.forEach(i => i.classList.toggle('active', i.dataset.view === viewId));
        this.currentView = viewId;

        // Initialize view-specific data
        if (viewId === 'reports') {
            this.updateReportsView();
        }
    }

    getCategoryIcon(cat) {
        const icons = { 'Salary': 'fa-money-bill-wave', 'Food': 'fa-utensils', 'Transport': 'fa-bus', 'Entertainment': 'fa-film', 'Shopping': 'fa-shopping-bag', 'Utilities': 'fa-bolt' };
        return icons[cat] || 'fa-receipt';
    }

    async handleProfileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch(`${this.apiBaseUrl}/upload-profile`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData
            });
            const result = await res.json();
            this.currentUser.profile_picture = result.imageUrl;
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            this.updateAvatars(result.imageUrl);
            this.showNotification('Profile updated!', 'success');
        } catch (err) { this.showNotification('Upload failed', 'error'); }
    }

    initCharts() {
        const trendsCtx = document.getElementById('trendsChart')?.getContext('2d');
        const catCtx = document.getElementById('categoryChart')?.getContext('2d');
        if (!trendsCtx) return;
        if (this.charts.trends) this.charts.trends.destroy();
        if (this.charts.category) this.charts.category.destroy();
        
        this.charts.trends = new Chart(trendsCtx, {
            type: 'line', 
            data: { 
                labels: ['M','T','W','T','F','S','S'], 
                datasets: [{ 
                    label: 'Trend',
                    data: [120, 190, 300, 500, 200, 300, 450], 
                    borderColor: '#f59e0b', 
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4 
                }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const catData = {};
        if (Array.isArray(this.transactions)) {
            this.transactions.filter(t => t.type === 'expense').forEach(t => { catData[t.category] = (catData[t.category] || 0) + parseFloat(t.amount); });
        }
        
        this.charts.category = new Chart(catCtx, {
            type: 'doughnut', 
            data: { 
                labels: Object.keys(catData), 
                datasets: [{ 
                    data: Object.values(catData), 
                    backgroundColor: ['#f59e0b', '#fbbf24', '#facc15', '#ffffff', '#94a3b8'] 
                }] 
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%'}
        });
    }

    showNotification(msg, type) {
        this.dom.notification.textContent = msg;
        this.dom.notification.className = `notification show ${type}`;
        setTimeout(() => this.dom.notification.classList.remove('show'), 3000);
    }

    // --- AI ADVISOR ENGINE ---

    async generateAIInsights() {
        const container = document.getElementById('aiInsightsContent');
        if (!container || !Array.isArray(this.transactions)) return;

        // Show loading state
        container.innerHTML = `<p class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Brainstorming financial strategies for you...</p>`;

        // Simulate "AI Thinking" delay
        await new Promise(r => setTimeout(r, 1200));

        const income = this.transactions.filter(t => t.type === 'income').reduce((a, b) => a + parseFloat(b.amount || 0), 0);
        const expense = this.transactions.filter(t => t.type === 'expense').reduce((a, b) => a + parseFloat(b.amount || 0), 0);
        const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
        
        const insights = [];

        // 1. Health Overview
        if (income > expense) {
            insights.push({ icon: 'fa-check-circle', text: `You're in the **Savings Zone**! Your savings rate is **${savingsRate.toFixed(1)}%**. Keep it above 20% for long-term wealth.` });
        } else if (expense > income && income > 0) {
            insights.push({ icon: 'fa-triangle-exclamation', text: `Warning: You are in a **Deficit Zone**. Expenses exceed income by **$${(expense - income).toLocaleString()}**. Consider reviewing your transport and food costs.` });
        }

        // 2. Category Analysis
        const catData = {};
        this.transactions.filter(t => t.type === 'expense').forEach(t => { catData[t.category] = (catData[t.category] || 0) + parseFloat(t.amount); });
        
        let topCat = null;
        let maxVal = 0;
        for (const [cat, val] of Object.entries(catData)) {
            if (val > maxVal) { maxVal = val; topCat = cat; }
        }

        if (topCat) {
            insights.push({ icon: 'fa-magnifying-glass-chart', text: `Your highest spend is in **${topCat}** ($${maxVal.toLocaleString()}). Check if there are recurring subscriptions you can cancel.` });
        }

        // 3. Budget Specifics
        const overBudgets = this.budgets.filter(b => b.spent > b.budget_limit);
        if (overBudgets.length > 0) {
            insights.push({ icon: 'fa-fire', text: `Alert: You've breached your budget in **${overBudgets.map(b => b.category).join(', ')}**. This is affecting your monthly goal.` });
        } else if (this.budgets.length > 0) {
            insights.push({ icon: 'fa-shield-halved', text: `Discipline confirmed! You are currently **within all budget limits**. This is rare—keep up the streak!` });
        }

        // 4. Pro-Tip
        if (insights.length < 3) {
            insights.push({ icon: 'fa-lightbulb', text: `Pro-Tip: Try the **50/30/20 rule**—50% for needs, 30% for wants, and 20% for savings.` });
        }

        container.innerHTML = insights.map(i => `
            <div class="ai-insight-item">
                <i class="fas ${i.icon}"></i>
                <span>${i.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</span>
            </div>
        `).join('');
    }
}

// Ensure global access early
const appInstance = new FinanceFlow();
window.app = appInstance;
