// Infrastructure Manual - 메인 애플리케이션 스크립트

class AuthManager {
    constructor() {
        this.tokenKey = 'infraManualAuthToken';
        this.token = localStorage.getItem(this.tokenKey);
        this.profile = null;
        this.overlay = document.getElementById('auth-overlay');
        this.statusText = document.getElementById('auth-status');
        this.loginForm = document.getElementById('auth-login-form');
        this.usernameInput = document.getElementById('auth-username');
        this.passwordInput = document.getElementById('auth-password');
        this.logoutBtn = document.getElementById('logout-btn');
        this.accountBtn = document.getElementById('account-manage-btn');
        this.accountsModal = document.getElementById('accounts-modal');
        this.accountCloseBtn = document.getElementById('close-accounts');
        this.accountList = document.getElementById('account-list');
        this.accountCreateForm = document.getElementById('account-create-form');
        this.accountCreateUsername = document.getElementById('account-create-username');
        this.accountCreatePassword = document.getElementById('account-create-password');
        this.listeners = new Set();
        this.loginInProgress = false;
        this.bindEvents();
        document.body?.classList.add('auth-lock');
        this.updateInteractiveState(false);
    }

    bindEvents() {
        this.loginForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.login();
        });

        this.logoutBtn?.addEventListener('click', () => this.logout());
        this.accountBtn?.addEventListener('click', () => this.openAccountsModal());
        this.accountCloseBtn?.addEventListener('click', () => this.closeAccountsModal());
        this.accountsModal?.addEventListener('click', (event) => {
            if (event.target === this.accountsModal) {
                this.closeAccountsModal();
            }
        });
        this.accountCreateForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.createAccountFromForm();
        });
        this.accountList?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            const row = button.closest('[data-account-id]');
            if (!row) {
                return;
            }
            const accountId = Number(row.dataset.accountId);
            const username = row.dataset.username || '';
            this.handleAccountAction(accountId, button.dataset.action, username);
        });
    }

    onAuthChange(listener) {
        if (typeof listener === 'function') {
            this.listeners.add(listener);
        }
    }

    emitAuthChange(isAuthenticated = this.isAuthenticated()) {
        this.listeners.forEach((listener) => {
            try {
                listener(isAuthenticated, this.profile);
            } catch (error) {
                console.warn('Auth listener error:', error);
            }
        });
    }

    isAuthenticated() {
        return !!(this.token && this.profile);
    }

    setStatus(message, type = 'info') {
        if (!this.statusText) {
            return;
        }
        this.statusText.textContent = message || '';
        this.statusText.classList.remove('success', 'error', 'info');
        if (message) {
            if (type === 'success') {
                this.statusText.classList.add('success');
            } else if (type === 'error') {
                this.statusText.classList.add('error');
            } else {
                this.statusText.classList.add('info');
            }
        }
    }

    updateInteractiveState(isAuthenticated) {
        const isAdmin = Boolean(isAuthenticated && this.profile?.isAdmin);
        if (this.accountBtn) {
            this.accountBtn.disabled = !isAdmin;
            this.accountBtn.classList.toggle('disabled', !isAdmin);
            this.accountBtn.title = isAdmin ? '' : '관리자 계정만 접근할 수 있습니다.';
        }
        if (this.logoutBtn) {
            this.logoutBtn.disabled = !isAuthenticated;
        }
    }

    showOverlay() {
        this.overlay?.classList.remove('hidden');
        document.body?.classList.add('auth-lock');
    }

    hideOverlay() {
        this.overlay?.classList.add('hidden');
        document.body?.classList.remove('auth-lock');
        this.setStatus('');
    }

    storeToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem(this.tokenKey, token);
        }
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem(this.tokenKey);
    }

    async bootstrap() {
        if (!this.token) {
            this.showOverlay();
            return false;
        }
        const ok = await this.refreshSession();
        if (ok) {
            this.hideOverlay();
            this.updateInteractiveState(true);
            return true;
        }
        this.handleUnauthorized(true);
        return false;
    }

    async login() {
        if (this.loginInProgress) {
            return;
        }
        const username = (this.usernameInput?.value || '').trim();
        const password = this.passwordInput?.value || '';
        if (!username || !password) {
            this.setStatus('아이디와 비밀번호를 입력하세요.', 'error');
            return;
        }
        this.loginInProgress = true;
        this.setStatus('로그인 중...', 'info');
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = this.translateAuthError(payload?.error) || '로그인에 실패했습니다.';
                this.setStatus(message, 'error');
                return;
            }
            this.storeToken(payload.token);
            this.profile = payload.user;
            this.hideOverlay();
            this.updateInteractiveState(true);
            this.emitAuthChange(true);
            this.loginForm?.reset();
        } catch (error) {
            console.warn('로그인 오류:', error);
            this.setStatus('서버에 연결할 수 없습니다.', 'error');
        } finally {
            this.loginInProgress = false;
        }
    }

    translateAuthError(code) {
        switch (code) {
            case 'INVALID_CREDENTIALS':
                return '아이디 또는 비밀번호가 올바르지 않습니다.';
            case 'INVALID_USERNAME':
                return '아이디를 다시 확인하세요.';
            case 'INVALID_PASSWORD':
                return '비밀번호 조건을 확인하세요.';
            default:
                return '';
        }
    }

    async refreshSession() {
        try {
            const response = await this.authFetch('/api/auth/session', {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                return false;
            }
            const payload = await response.json().catch(() => null);
            if (!payload?.user) {
                return false;
            }
            this.profile = payload.user;
            this.updateInteractiveState(true);
            return true;
        } catch (error) {
            if (error?.code !== 'AUTH_REQUIRED') {
                console.warn('세션 확인 실패:', error);
            }
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.warn('로그아웃 요청 실패:', error);
        }
        this.handleUnauthorized(true);
        this.setStatus('로그아웃되었습니다.', 'info');
    }

    handleUnauthorized(silent = false) {
        this.clearToken();
        this.profile = null;
        this.updateInteractiveState(false);
        this.accountsModal?.classList.remove('active');
        if (!silent) {
            this.setStatus('세션이 만료되었습니다. 다시 로그인하세요.', 'error');
        }
        this.showOverlay();
        this.emitAuthChange(false);
    }

    async authFetch(url, options = {}) {
        const headers = new Headers(options.headers || {});
        if (this.token) {
            headers.set('Authorization', `Bearer ${this.token}`);
        }
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            const error = new Error('AUTH_REQUIRED');
            error.code = 'AUTH_REQUIRED';
            this.handleUnauthorized();
            throw error;
        }
        if (response.status === 403) {
            const error = new Error('ADMIN_REQUIRED');
            error.code = 'ADMIN_REQUIRED';
            throw error;
        }
        return response;
    }

    openAccountsModal() {
        if (!this.isAuthenticated()) {
            this.setStatus('먼저 로그인하세요.', 'error');
            return;
        }
        if (!this.profile?.isAdmin) {
            this.setStatus('계정 관리는 관리자만 이용할 수 있습니다.', 'error');
            return;
        }
        this.accountsModal?.classList.add('active');
        this.loadAccounts();
    }

    closeAccountsModal() {
        this.accountsModal?.classList.remove('active');
    }

    async loadAccounts() {
        if (!this.accountList) {
            return;
        }
        this.accountList.innerHTML = '<p class="account-hint">계정 정보를 불러오는 중입니다...</p>';
        try {
            const response = await this.authFetch('/api/accounts', {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                throw new Error('LIST_FAILED');
            }
            const payload = await response.json();
            this.renderAccountList(payload?.users || []);
        } catch (error) {
            console.warn('계정 목록 조회 실패:', error);
            this.accountList.innerHTML = '<p class="account-hint">계정 정보를 불러오지 못했습니다.</p>';
        }
    }

    renderAccountList(users) {
        if (!this.accountList) {
            return;
        }
        if (!users.length) {
            this.accountList.innerHTML = '<p class="account-hint">등록된 계정이 없습니다.</p>';
            return;
        }
        const disableDelete = users.length <= 1;
        const fragment = document.createDocumentFragment();
        users.forEach((user) => {
            const row = document.createElement('div');
            row.className = 'account-row';
            row.dataset.accountId = user.id;
            row.dataset.username = user.username;
            row.innerHTML = `
                <div class="account-meta">
                    <strong>${this.escapeHtml(user.username)}</strong>
                    <span>${this.formatTimestamp(user.createdAt)}</span>
                </div>
                <div class="account-row-actions">
                    <button type="button" class="ghost-btn mini" data-action="rename">아이디 변경</button>
                    <button type="button" class="ghost-btn mini" data-action="password">비밀번호 변경</button>
                    <button type="button" class="ghost-btn danger mini" data-action="delete" ${disableDelete ? 'disabled' : ''}>삭제</button>
                </div>
            `;
            fragment.appendChild(row);
        });
        this.accountList.innerHTML = '';
        this.accountList.appendChild(fragment);
    }

    async createAccountFromForm() {
        const username = (this.accountCreateUsername?.value || '').trim();
        const password = this.accountCreatePassword?.value || '';
        if (!username || !password) {
            this.notify('아이디와 비밀번호를 입력하세요.', 'error');
            return;
        }
        try {
            const response = await this.authFetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.error || 'CREATE_FAILED');
            }
            this.accountCreateForm?.reset();
            this.notify('새 계정을 추가했습니다.', 'success');
            this.loadAccounts();
        } catch (error) {
            if (error?.code === 'AUTH_REQUIRED' || error?.code === 'ADMIN_REQUIRED') {
                return;
            }
            this.notify(this.translateAccountError(error.message), 'error');
        }
    }

    async handleAccountAction(accountId, action, username) {
        if (!accountId || !action) {
            return;
        }
        try {
            if (action === 'rename') {
                const nextUsername = prompt('새 아이디를 입력하세요.', username);
                if (!nextUsername || nextUsername.trim() === username) {
                    return;
                }
                await this.updateAccount(accountId, { username: nextUsername.trim() });
                this.notify('아이디를 변경했습니다.', 'success');
            } else if (action === 'password') {
                const nextPassword = prompt('새 비밀번호를 입력하세요. (6자 이상)');
                if (!nextPassword) {
                    return;
                }
                await this.updateAccount(accountId, { password: nextPassword });
                this.notify('비밀번호를 변경했습니다.', 'success');
            } else if (action === 'delete') {
                if (!confirm('정말 이 계정을 삭제할까요?')) {
                    return;
                }
                await this.deleteAccount(accountId);
                this.notify('계정을 삭제했습니다.', 'success');
            }
            this.loadAccounts();
        } catch (error) {
            if (error?.code === 'AUTH_REQUIRED' || error?.code === 'ADMIN_REQUIRED') {
                return;
            }
            this.notify(this.translateAccountError(error.message), 'error');
        }
    }

    async updateAccount(accountId, payload) {
        const response = await this.authFetch(`/api/accounts/${accountId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.error || 'ACCOUNT_UPDATE_FAILED');
        }
        return response.json();
    }

    async deleteAccount(accountId) {
        const response = await this.authFetch(`/api/accounts/${accountId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.error || 'ACCOUNT_DELETE_FAILED');
        }
        return response.json();
    }

    translateAccountError(code) {
        switch (code) {
            case 'INVALID_USERNAME':
                return '아이디 형식을 확인하세요.';
            case 'INVALID_PASSWORD':
                return '비밀번호는 6자 이상입니다.';
            case 'USERNAME_EXISTS':
                return '이미 사용 중인 아이디입니다.';
            case 'ACCOUNT_NOT_FOUND':
                return '계정을 찾을 수 없습니다.';
            case 'LAST_USER_PROTECTED':
                return '마지막 계정은 삭제할 수 없습니다.';
            default:
                return '요청을 처리할 수 없습니다.';
        }
    }

    escapeHtml(value) {
        if (!value) {
            return '';
        }
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    formatTimestamp(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString('ko-KR');
    }

    notify(message, type = 'info') {
        const target = window.app;
        if (target && typeof target.showSuccess === 'function' && typeof target.showError === 'function') {
            if (type === 'error') {
                target.showError(message);
            } else {
                target.showSuccess(message);
            }
            return;
        }
        if (type === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
    }
}

class InfrastructureManual {
    constructor(authManager = null) {
        this.auth = authManager;
        this.currentContent = null;
        this.isEditMode = false;
        this.editRichArea = null;
        this.editorToolbar = null;
        this.editorLayoutElement = null;
        this.fontSizeSelect = null;
        this.fontFamilySelect = null;
        this.fontColorPalette = null;
        this.highlightPalette = null;
        this.fontColorContainers = [];
        this.highlightColorContainers = [];
        this.fontColorSwatches = [];
        this.highlightColorSwatches = [];
        this.fontCustomColorInput = null;
        this.highlightCustomColorInput = null;
        this.defaultFontColor = '';
        this.defaultHighlightColor = 'transparent';
        this.canEdit = Boolean(this.auth?.profile?.isAdmin);
        this.readOnlyMode = !this.canEdit;
        this.viewOnlyBadge = null;
        this.editButton = null;
        this.addSectionButton = null;
        this.dividerControl = null;
        this.dividerMainButton = null;
        this.dividerToggleButton = null;
        this.dividerMenu = null;
        this.dividerMenuButtons = [];
        this.lastDividerVariant = 'primary';
        this.boundDividerMenuCloser = null;
        this.boundDividerKeyHandler = null;
        this.colorDropdownButtons = [];
        this.activeColorDropdown = null;
        this.activeColorTrigger = null;
        this.boundColorDropdownCloser = null;
        this.colorControlsInitialized = false;
        this.tableGridTrigger = null;
        this.tableGridPopover = null;
        this.tableGridElement = null;
        this.tableGridHint = null;
        this.objectToolsPanel = null;
        this.objectWidthSlider = null;
        this.objectWidthValue = null;
        this.objectSliderLabel = null;
        this.tableAddRowBtn = null;
        this.tableAddColBtn = null;
        this.tableDeleteRowBtn = null;
        this.tableDeleteColBtn = null;
        this.imageInsertBtn = null;
        this.imageFileInput = null;
        this.imageLayoutGroup = null;
        this.imageLayoutButtons = [];
        this.imageInteractionBound = false;
        this.currentImageElement = null;
        this.imageResizeState = null;
        this.boundImageResizeMove = (event) => this.handleImageResizeMove(event);
        this.boundImageResizeEnd = (event) => this.stopImageResize(event);
        this.imageResizeOverlay = null;
        this.imageResizeHandles = [];
        this.imageResizeBox = null;
        this.boundOverlayRefresh = () => this.refreshImageResizeOverlay();
        this.activeImageFigure = null;
        this.highlightedImageFigure = null;
        this.editModalElement = null;
        this.initialEditorSnapshot = '';
        this.hasUnsavedChanges = false;
        this.currentTableElement = null;
        this.currentTableCell = null;
        this.savedSelectionRange = null;
        this.navContainer = null;
        this.navUpdatesContainer = null;
        this.expandedSections = new Set();
        this.pendingFormatBoundary = false;
        this.managerSelection = null;
        this.structureModal = null;
        this.managerModal = null;
        this.adminConfig = InfrastructureData.getAdminConfig();
        this.isAdminUnlocked = !this.adminConfig.enabled;
        this.pendingAdminAction = null;
        this.adminModalMode = 'setup';
        this.pastePopover = null;
        this.pastePreviewPanel = null;
        this.pastePreviewOriginal = null;
        this.pastePreviewResult = null;
        this.pastePreviewSummary = null;
        this.pastePreviewModeSelect = null;
        this.pasteCopyHtmlBtn = null;
        this.pasteCopyTextBtn = null;
        this.pasteInsertPreviewBtn = null;
        this.lastPasteBundle = null;
        this.lastPasteRange = null;
        this.pasteSettingsModal = null;
        this.wordStyleTable = null;
        this.pasteTableControls = null;
        this.pasteTableList = null;
        this.pasteTableSelectAllBtn = null;
        this.pasteTableClearBtn = null;
        this.pasteTablePreviewResetBtn = null;
        this.pasteInsertSelectedBtn = null;
        this.pasteCopySelectedBtn = null;
        this.selectedTableIndexes = new Set();
        this.tablePreviewFocus = null;
        this.serverSyncTimer = null;
        this.serverSyncStatus = {
            lastSyncedAt: null,
            lastError: null,
            isSyncing: false
        };
        this.initialSyncPerformed = false;
        this.recentUpdateHours = 24 * 30;
        this.navUpdatesExpanded = false;
        this.init();
    }

    authFetch(url, options = {}) {
        if (this.auth && typeof this.auth.authFetch === 'function') {
            return this.auth.authFetch(url, options);
        }
        return fetch(url, options);
    }

    setupEditorToolbar() {
        if (!this.editorToolbar || !this.editRichArea) return;

        this.bindImageInteractionEvents();

        this.editorToolbar.querySelectorAll('button[data-command]').forEach(button => {
            button.addEventListener('click', () => {
                const command = button.dataset.command;
                this.executeEditorCommand(command);
            });
        });

        this.fontSizeSelect?.addEventListener('change', (event) => {
            const value = event.target.value;
            this.applyFontSize(value);
        });

        this.fontFamilySelect?.addEventListener('change', (event) => {
            const value = event.target.value || '';
            this.applyFontFamily(value);
        });

        this.setupColorControls();
        this.initDividerControl();

        // 기본 붙여넣기를 커스터마이징하여 Word/Excel 데이터를 정리
        this.editRichArea.addEventListener('paste', (event) => this.handleEditorPaste(event));
        this.editRichArea.addEventListener('input', () => {
            this.handleEditorInputChange();
            this.updateToolbarFloatingState();
        });

        this.toolbarExcelBtn?.addEventListener('click', () => {
            this.openExcelModal();
        });

        this.tableGridTrigger?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleTableGridPopover();
        });

        if (this.tableGridElement) {
            this.buildTableGrid();
            this.tableGridElement.addEventListener('mouseover', (event) => {
                const cell = event.target.closest('button');
                if (!cell) return;
                const rows = Number(cell.dataset.row);
                const cols = Number(cell.dataset.col);
                this.highlightTableGrid(rows, cols);
            });
            this.tableGridElement.addEventListener('click', (event) => {
                const cell = event.target.closest('button');
                if (!cell) return;
                const rows = Number(cell.dataset.row);
                const cols = Number(cell.dataset.col);
                if (!rows || !cols) return;
                this.insertCustomTable(rows, cols);
                this.tableGridPopover?.classList.remove('active');
            });
        }

        document.addEventListener('click', (event) => {
            if (!this.tableGridPopover || !this.tableGridTrigger) return;
            const target = event.target;
            if (this.tableGridPopover.contains(target) || this.tableGridTrigger.contains(target)) {
                return;
            }
            this.tableGridPopover.classList.remove('active');
        });

        this.tableAddRowBtn?.addEventListener('click', () => this.addTableRow());
        this.tableAddColBtn?.addEventListener('click', () => this.addTableColumn());
        this.tableDeleteRowBtn?.addEventListener('click', () => this.deleteTableRow());
        this.tableDeleteColBtn?.addEventListener('click', () => this.deleteTableColumn());

        this.objectWidthSlider?.addEventListener('input', (event) => {
            const value = Number(event.target.value);
            if (this.objectWidthValue && !Number.isNaN(value)) {
                this.objectWidthValue.textContent = `${value}%`;
            }
            if (this.currentImageElement) {
                this.setImageWidth(value);
            } else if (this.currentTableElement) {
                this.setActiveTableWidth(value);
            }
        });

        this.imageLayoutButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const layout = button.dataset.layout || 'inline';
                this.applyImageLayout(layout);
            });
        });

        this.imageInsertBtn?.addEventListener('click', () => {
            this.imageFileInput?.click();
        });

        this.imageFileInput?.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            this.insertImageFromFile(file);
            event.target.value = '';
        });

        const defaultFontSwatch = this.fontColorSwatches[0] || this.fontColorPalette?.querySelector('[data-color]');
        if (defaultFontSwatch?.dataset.color) {
            this.defaultFontColor = defaultFontSwatch.dataset.color.toLowerCase();
            this.setActiveFontColor(this.defaultFontColor);
        }

        const defaultHighlightSwatch = this.highlightColorSwatches[0] || this.highlightPalette?.querySelector('[data-highlight]');
        if (defaultHighlightSwatch?.dataset.highlight) {
            this.defaultHighlightColor = defaultHighlightSwatch.dataset.highlight.toLowerCase();
            this.setActiveHighlightColor(this.defaultHighlightColor);
        } else {
            this.setActiveHighlightColor(this.defaultHighlightColor);
        }

        this.updateObjectToolsState();
        this.updateToolbarFloatingState();

        document.addEventListener('scroll', () => this.updateToolbarFloatingState(), true);
        window.addEventListener('scroll', () => this.updateToolbarFloatingState());
        window.addEventListener('resize', () => this.updateToolbarFloatingState());
    }

    bindImageInteractionEvents() {
        if (!this.editRichArea || this.imageInteractionBound) {
            return;
        }
        this.imageInteractionBound = true;
        this.editRichArea.addEventListener('click', (event) => {
            if (!this.isEditModalOpen()) {
                return;
            }
            const image = this.resolveImageTargetFromEvent(event.target);
            if (!image) {
                return;
            }
            this.focusImageFigure(image);
        });
    }

    resolveImageTargetFromEvent(target) {
        if (!target) {
            return null;
        }
        if (target instanceof HTMLImageElement) {
            return target.closest('.editor-image') ? target : null;
        }
        if (!(target instanceof Element)) {
            return null;
        }
        const figure = target.closest('figure.editor-image');
        if (!figure) {
            return null;
        }
        return figure.querySelector('img');
    }

    focusImageFigure(image, options = {}) {
        if (!this.editRichArea || !image) {
            return false;
        }
        const figure = image.closest('.editor-image');
        if (!figure) {
            return false;
        }
        const range = document.createRange();
        try {
            range.selectNode(figure);
        } catch (error) {
            console.warn('이미지 선택 실패:', error);
            return false;
        }
        const selection = window.getSelection();
        if (!selection) {
            return false;
        }
        selection.removeAllRanges();
        selection.addRange(range);
        this.currentImageElement = image;
        this.currentTableCell = null;
        this.currentTableElement = null;
        this.savedSelectionRange = range.cloneRange();
        if (!options.skipFocus) {
            try {
                this.editRichArea.focus({ preventScroll: options.preventScroll === true });
            } catch (error) {
                this.editRichArea.focus();
            }
        }
        this.updateImageSelectionHighlight(figure);
        this.refreshImageResizeOverlay();
        return true;
    }

    updateImageSelectionHighlight(nextFigure) {
        if (this.highlightedImageFigure === nextFigure) {
            return;
        }
        if (this.highlightedImageFigure) {
            this.highlightedImageFigure.classList.remove('is-selected');
        }
        this.highlightedImageFigure = nextFigure || null;
        if (nextFigure) {
            nextFigure.classList.add('is-selected');
        }
    }

    initDividerControl() {
        if (!this.dividerControl || !this.dividerMainButton) {
            return;
        }
        this.setDividerVariantState(this.lastDividerVariant || 'primary');
        this.dividerMainButton.addEventListener('click', () => {
            this.insertStyledDivider();
        });
        this.dividerToggleButton?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleDividerMenu();
        });
        this.dividerMenuButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const variant = button.dataset.dividerVariant || 'primary';
                this.insertStyledDivider(variant);
                this.closeDividerMenu();
            });
        });
        this.boundDividerMenuCloser = (event) => {
            if (!this.dividerControl) {
                return;
            }
            if (this.dividerControl.contains(event.target)) {
                return;
            }
            this.closeDividerMenu();
        };
        this.boundDividerKeyHandler = (event) => {
            if (event.key === 'Escape' && this.isDividerMenuOpen()) {
                this.closeDividerMenu();
                this.dividerToggleButton?.focus();
            }
        };
    }

    toggleDividerMenu(forceState = null) {
        const shouldOpen = typeof forceState === 'boolean'
            ? forceState
            : !this.isDividerMenuOpen();
        if (shouldOpen) {
            this.openDividerMenu();
        } else {
            this.closeDividerMenu();
        }
    }

    openDividerMenu() {
        if (!this.dividerControl || !this.dividerMenu || this.isDividerMenuOpen()) {
            return;
        }
        this.dividerControl.classList.add('open');
        this.dividerToggleButton?.setAttribute('aria-expanded', 'true');
        this.updateDividerMenuSelection();
        const targetButton = this.dividerMenu.querySelector('.active') || this.dividerMenuButtons[0];
        if (targetButton) {
            requestAnimationFrame(() => {
                try {
                    targetButton.focus({ preventScroll: true });
                } catch (error) {
                    targetButton.focus();
                }
            });
        }
        if (this.boundDividerMenuCloser) {
            document.addEventListener('click', this.boundDividerMenuCloser);
        }
        if (this.boundDividerKeyHandler) {
            document.addEventListener('keydown', this.boundDividerKeyHandler);
        }
    }

    closeDividerMenu() {
        if (!this.isDividerMenuOpen()) {
            return;
        }
        this.dividerControl?.classList.remove('open');
        this.dividerToggleButton?.setAttribute('aria-expanded', 'false');
        if (this.boundDividerMenuCloser) {
            document.removeEventListener('click', this.boundDividerMenuCloser);
        }
        if (this.boundDividerKeyHandler) {
            document.removeEventListener('keydown', this.boundDividerKeyHandler);
        }
    }

    isDividerMenuOpen() {
        return this.dividerControl?.classList.contains('open');
    }

    setDividerVariantState(nextVariant, updateMenu = true) {
        const normalized = this.normalizeDividerVariant(nextVariant);
        this.lastDividerVariant = normalized;
        if (this.dividerControl) {
            this.dividerControl.dataset.activeVariant = normalized;
        }
        if (updateMenu) {
            this.updateDividerMenuSelection(normalized);
        }
        return normalized;
    }

    updateDividerMenuSelection(targetVariant = this.lastDividerVariant) {
        if (!this.dividerMenuButtons?.length) {
            return;
        }
        const normalized = this.normalizeDividerVariant(targetVariant);
        this.dividerMenuButtons.forEach((button) => {
            const buttonVariant = this.normalizeDividerVariant(button.dataset.dividerVariant);
            const isActive = buttonVariant === normalized;
            button.classList.toggle('active', isActive);
            if (button.hasAttribute('aria-checked')) {
                button.setAttribute('aria-checked', isActive ? 'true' : 'false');
            }
        });
    }

    normalizeDividerVariant(variant) {
        return variant === 'neutral' ? 'neutral' : 'primary';
    }

    setupImageResizeOverlay() {
        if (!this.editRichArea || this.imageResizeOverlay) {
            return;
        }
        const host = this.editRichArea.parentElement;
        if (!host) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'image-resize-overlay';
        overlay.className = 'image-resize-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const box = document.createElement('div');
        box.className = 'image-resize-box';
        overlay.appendChild(box);
        this.imageResizeBox = box;

        const directions = ['w', 'e', 'nw', 'ne', 'sw', 'se'];
        this.imageResizeHandles = directions.map((direction) => {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = `image-resize-handle handle-${direction}`;
            handle.dataset.direction = direction;
            handle.setAttribute('aria-label', `이미지 크기 조절 (${direction.toUpperCase()})`);
            handle.tabIndex = -1;
            handle.addEventListener('pointerdown', (event) => this.startImageResize(event, direction));
            overlay.appendChild(handle);
            return handle;
        });

        host.appendChild(overlay);
        this.imageResizeOverlay = overlay;

        this.editRichArea.addEventListener('scroll', this.boundOverlayRefresh);
        window.addEventListener('resize', this.boundOverlayRefresh);
    }

    startImageResize(event, direction) {
        if (!this.isEditModalOpen() || !this.editRichArea) {
            return;
        }
        if (event.button !== undefined && event.button !== 0) {
            return;
        }
        const figure = this.activeImageFigure || this.currentImageElement?.closest('.editor-image');
        const image = this.currentImageElement || figure?.querySelector('img');
        if (!figure || !image) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.editRichArea?.focus();

        const figureRect = figure.getBoundingClientRect();
        const parentWidth = figure.parentElement?.getBoundingClientRect?.().width
            || this.editRichArea.clientWidth
            || figureRect.width
            || 1;

        this.imageResizeState = {
            figure,
            image,
            direction,
            pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
            startX: event.clientX,
            startWidth: figureRect.width,
            parentWidth: parentWidth || 1
        };

        if (event.target?.setPointerCapture && typeof event.pointerId === 'number') {
            try {
                event.target.setPointerCapture(event.pointerId);
            } catch (captureError) {
                // Ignore browsers that disallow pointer capture on this element.
            }
        }

        document.addEventListener('pointermove', this.boundImageResizeMove);
        document.addEventListener('pointerup', this.boundImageResizeEnd);
        document.addEventListener('pointercancel', this.boundImageResizeEnd);
        this.imageResizeOverlay?.classList.add('resizing');
    }

    handleImageResizeMove(event) {
        if (!this.imageResizeState) {
            return;
        }
        if (this.imageResizeState.pointerId !== null && event.pointerId !== this.imageResizeState.pointerId) {
            return;
        }
        event.preventDefault();

        const { figure, image, direction, startX, startWidth } = this.imageResizeState;
        if (!figure || !image) {
            return;
        }

        const deltaX = event.clientX - startX;
        const directionFactor = direction?.includes('w') ? -1 : 1;
        const referenceWidth = figure.parentElement?.getBoundingClientRect?.().width
            || this.editRichArea?.clientWidth
            || this.imageResizeState.parentWidth
            || startWidth
            || 1;
        const rawWidth = startWidth + (deltaX * directionFactor);
        const minWidth = referenceWidth * 0.1;
        const maxWidth = referenceWidth * 1.5;
        const clampedWidth = Math.min(maxWidth, Math.max(minWidth, rawWidth));
        const percent = Math.min(150, Math.max(10, Math.round((clampedWidth / referenceWidth) * 100)));

        figure.style.width = `${percent}%`;
        image.style.width = '100%';
        image.style.height = 'auto';
        this.currentImageElement = image;
        this.updateObjectToolsState();
    }

    stopImageResize(event) {
        if (!this.imageResizeState) {
            return;
        }
        if (this.imageResizeState.pointerId !== null
            && event.pointerId !== undefined
            && event.pointerId !== this.imageResizeState.pointerId) {
            return;
        }

        if (event.target?.releasePointerCapture && typeof event.pointerId === 'number') {
            try {
                event.target.releasePointerCapture(event.pointerId);
            } catch (releaseError) {
                // Ignore failures triggered by unsupported pointer release.
            }
        }

        document.removeEventListener('pointermove', this.boundImageResizeMove);
        document.removeEventListener('pointerup', this.boundImageResizeEnd);
        document.removeEventListener('pointercancel', this.boundImageResizeEnd);
        this.imageResizeOverlay?.classList.remove('resizing');
        this.imageResizeState = null;
        this.updateObjectToolsState();
        this.handleEditorInputChange();
    }

    refreshImageResizeOverlay() {
        if (!this.imageResizeOverlay || !this.editRichArea) {
            return;
        }
        if (!this.isEditModalOpen()) {
            this.imageResizeOverlay.classList.remove('active', 'resizing');
            this.activeImageFigure = null;
            this.updateImageSelectionHighlight(null);
            return;
        }

        const figure = this.currentImageElement?.closest('.editor-image');
        this.activeImageFigure = figure || null;
        this.updateImageSelectionHighlight(figure || null);
        if (!figure || !this.currentImageElement) {
            this.imageResizeOverlay.classList.remove('active');
            return;
        }

        const host = this.imageResizeOverlay.parentElement;
        if (!host) {
            return;
        }
        const hostRect = host.getBoundingClientRect();
        const areaRect = this.editRichArea.getBoundingClientRect();
        this.imageResizeOverlay.style.width = `${areaRect.width}px`;
        this.imageResizeOverlay.style.height = `${areaRect.height}px`;
        this.imageResizeOverlay.style.left = `${areaRect.left - hostRect.left}px`;
        this.imageResizeOverlay.style.top = `${areaRect.top - hostRect.top}px`;

        const figureRect = this.currentImageElement.getBoundingClientRect();
        const fallbackRect = figure.getBoundingClientRect();
        const targetRect = (figureRect?.width && figureRect?.height) ? figureRect : fallbackRect;
        const box = {
            left: targetRect.left - areaRect.left,
            top: targetRect.top - areaRect.top,
            width: targetRect.width,
            height: targetRect.height
        };

        if (!this.imageResizeBox || box.width <= 0 || box.height <= 0) {
            this.imageResizeOverlay.classList.remove('active');
            return;
        }

        this.imageResizeBox.style.transform = `translate(${box.left}px, ${box.top}px)`;
        this.imageResizeBox.style.width = `${box.width}px`;
        this.imageResizeBox.style.height = `${box.height}px`;

        this.imageResizeHandles.forEach((handle) => {
            if (!handle?.dataset?.direction) {
                return;
            }
            const coords = this.calculateHandlePosition(handle.dataset.direction, box);
            handle.style.left = `${coords.left}px`;
            handle.style.top = `${coords.top}px`;
            handle.hidden = false;
        });

        this.imageResizeOverlay.classList.add('active');
    }

    calculateHandlePosition(direction, box) {
        const { left, top, width, height } = box;
        const centerX = left + (width / 2);
        const centerY = top + (height / 2);
        switch (direction) {
            case 'w':
                return { left, top: centerY };
            case 'e':
                return { left: left + width, top: centerY };
            case 'nw':
                return { left, top };
            case 'ne':
                return { left: left + width, top };
            case 'sw':
                return { left, top: top + height };
            case 'se':
            default:
                return { left: left + width, top: top + height };
        }
    }

    setupColorControls() {
        if (this.colorControlsInitialized) {
            return;
        }

        const hasModernControls = Boolean(
            (this.fontColorSwatches && this.fontColorSwatches.length) ||
            (this.highlightColorSwatches && this.highlightColorSwatches.length) ||
            this.fontCustomColorInput ||
            this.highlightCustomColorInput ||
            (this.colorDropdownButtons && this.colorDropdownButtons.length)
        );

        if (!hasModernControls) {
            this.setupLegacyColorControls();
            return;
        }

        this.colorControlsInitialized = true;

        const attachSwatchHandler = (swatch, type) => {
            if (!swatch) {
                return;
            }
            swatch.addEventListener('mousedown', (event) => {
                event.preventDefault();
            });
            swatch.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (type === 'font') {
                    const color = swatch.dataset.color;
                    if (!color) {
                        return;
                    }
                    this.applyTextColor(color);
                    this.setActiveFontColor(color);
                } else {
                    const highlight = swatch.dataset.highlight || 'transparent';
                    this.applyHighlightColor(highlight);
                    this.setActiveHighlightColor(highlight);
                }
            });
        };

        this.fontColorSwatches?.forEach((swatch) => attachSwatchHandler(swatch, 'font'));
        this.highlightColorSwatches?.forEach((swatch) => attachSwatchHandler(swatch, 'highlight'));

        this.fontCustomColorInput?.addEventListener('input', (event) => {
            const value = (event.target.value || '').trim();
            if (!value) {
                return;
            }
            this.applyTextColor(value);
            this.setActiveFontColor(value);
        });

        this.highlightCustomColorInput?.addEventListener('input', (event) => {
            const value = (event.target.value || '').trim() || 'transparent';
            this.applyHighlightColor(value);
            this.setActiveHighlightColor(value);
        });

        if (this.colorDropdownButtons?.length) {
            this.colorDropdownButtons.forEach((button) => {
                button.setAttribute('aria-haspopup', 'true');
                button.setAttribute('aria-expanded', 'false');
                button.addEventListener('mousedown', (event) => {
                    event.preventDefault();
                });
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const targetKey = button.dataset.colorToggle;
                    const container = this.colorTargetToContainer(targetKey) || button.nextElementSibling;
                    this.toggleColorDropdown(container, button);
                });
            });
            if (!this.boundColorDropdownCloser) {
                this.boundColorDropdownCloser = (event) => this.handleDocumentColorClick(event);
                document.addEventListener('click', this.boundColorDropdownCloser);
            }
        }
    }

    setupLegacyColorControls() {
        if (this.colorControlsInitialized) {
            return;
        }
        this.colorControlsInitialized = true;

        this.fontColorPalette?.addEventListener('click', (event) => {
            const swatch = event.target.closest('[data-color]');
            if (!swatch) {
                return;
            }
            const color = swatch.dataset.color;
            if (color) {
                this.applyTextColor(color);
                this.setActiveFontColor(color);
            }
        });

        this.highlightPalette?.addEventListener('click', (event) => {
            const swatch = event.target.closest('[data-highlight]');
            if (!swatch) {
                return;
            }
            const highlight = swatch.dataset.highlight || 'transparent';
            this.applyHighlightColor(highlight);
            this.setActiveHighlightColor(highlight);
        });
    }

    colorTargetToContainer(targetKey) {
        if (!targetKey) {
            return null;
        }
        if (targetKey === 'font') {
            return this.fontColorContainers[0] || this.fontColorPalette;
        }
        if (targetKey === 'highlight') {
            return this.highlightColorContainers[0] || this.highlightPalette;
        }
        return document.querySelector(`[data-color-target="${targetKey}"]`);
    }

    toggleColorDropdown(container, trigger) {
        if (!container) {
            return;
        }
        if (this.activeColorDropdown === container) {
            this.closeActiveColorDropdown();
            return;
        }
        this.closeActiveColorDropdown();
        container.classList.add('expanded');
        trigger?.setAttribute('aria-expanded', 'true');
        this.activeColorDropdown = container;
        this.activeColorTrigger = trigger || null;
    }

    closeActiveColorDropdown() {
        if (this.activeColorDropdown) {
            this.activeColorDropdown.classList.remove('expanded');
            this.activeColorDropdown = null;
        }
        if (this.activeColorTrigger) {
            this.activeColorTrigger.setAttribute('aria-expanded', 'false');
            this.activeColorTrigger = null;
        }
    }

    handleDocumentColorClick(event) {
        if (!this.activeColorDropdown) {
            return;
        }
        const target = event.target;
        if (this.activeColorDropdown.contains(target) || this.activeColorTrigger?.contains(target)) {
            return;
        }
        this.closeActiveColorDropdown();
    }

    async handleEditorPaste(event) {
        if (!event || !event.clipboardData) {
            return;
        }
        const clipboard = event.clipboardData;
        const htmlData = clipboard.getData('text/html');
        const plainData = clipboard.getData('text/plain');
        const imageFiles = this.collectClipboardImageFiles(clipboard);
        const hasStructuredContent = Boolean(htmlData || plainData);

        event.preventDefault();

        const imagePayloads = imageFiles.length
            ? await this.readClipboardImageFiles(imageFiles)
            : [];

        const bundle = this.buildPasteBundle(htmlData, plainData, imagePayloads);

        if (!bundle || !bundle.defaultHtml) {
            const fallback = InfrastructureData.cleanHtml(plainData || htmlData || '');
            document.execCommand('insertHTML', false, fallback);
            return;
        }

        this.lastPasteRange = this.captureCurrentRange();
        this.lastPasteBundle = bundle;
        const autoHtml = this.resolveAutoPasteHtml(bundle);
        const html = autoHtml || bundle.defaultHtml;
        if (html) {
            this.insertPasteHtml(html);
            this.normalizeEditorImages();
            this.handleEditorInputChange();
            this.dismissPasteOverlay(true);
            return;
        }

        const fallback = InfrastructureData.cleanHtml(plainData || htmlData || '');
        document.execCommand('insertHTML', false, fallback);
        this.handleEditorInputChange();
    }

    collectClipboardImageFiles(clipboard) {
        const files = [];
        const seen = new Set();
        const buildKey = (file) => {
            if (!file) {
                return '';
            }
            const name = file.name || 'clipboard-image';
            const size = Number.isFinite(file.size) ? file.size : 0;
            const modified = Number.isFinite(file.lastModified) ? file.lastModified : 0;
            return `${name}|${size}|${modified}`;
        };
        const pushUnique = (file) => {
            if (!file || (file.type && !file.type.startsWith('image/'))) {
                return;
            }
            const key = buildKey(file);
            if (key && seen.has(key)) {
                return;
            }
            if (key) {
                seen.add(key);
            }
            files.push(file);
        };
        if (clipboard?.items?.length) {
            Array.from(clipboard.items).forEach((item) => {
                if (item.kind === 'file' && item.type?.startsWith('image/')) {
                    pushUnique(item.getAsFile());
                }
            });
        }
        if (clipboard?.files?.length) {
            Array.from(clipboard.files).forEach((file) => {
                pushUnique(file);
            });
        }
        return files;
    }

    async readClipboardImageFiles(files = []) {
        if (!files.length) {
            return [];
        }
        const payloads = [];
        const seenSrc = new Set();
        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            if (!file) {
                continue;
            }
            try {
                const src = await this.readBlobAsDataUrl(file);
                if (src && !seenSrc.has(src)) {
                    seenSrc.add(src);
                    payloads.push({
                        src,
                        name: file.name || `clipboard-image-${index + 1}`,
                        type: file.type || 'image/png'
                    });
                }
            } catch (error) {
                console.warn('클립보드 이미지 변환 실패:', error);
            }
        }
        return payloads;
    }

    readBlobAsDataUrl(blob) {
        return new Promise((resolve, reject) => {
            if (!blob) {
                reject(new Error('BLOB_MISSING'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('READ_FAILED'));
            reader.readAsDataURL(blob);
        });
    }

    executeEditorCommand(command) {
        if (!this.editRichArea) return;
        this.editRichArea.focus();
        this.restoreSelection();

        const formatBlock = (block) => document.execCommand('formatBlock', false, block);

        switch (command) {
            case 'undo':
            case 'redo':
                document.execCommand(command);
                break;
            case 'bold':
            case 'italic':
            case 'underline':
                document.execCommand(command);
                break;
            case 'align-left':
                document.execCommand('justifyLeft');
                break;
            case 'align-center':
                document.execCommand('justifyCenter');
                break;
            case 'align-right':
                document.execCommand('justifyRight');
                break;
            case 'align-justify':
                document.execCommand('justifyFull');
                break;
            case 'indent':
                document.execCommand('indent');
                break;
            case 'outdent':
                document.execCommand('outdent');
                break;
            case 'h1':
                formatBlock('h1');
                break;
            case 'h2':
                formatBlock('h2');
                break;
            case 'list':
                document.execCommand('insertUnorderedList');
                break;
            case 'olist':
                document.execCommand('insertOrderedList');
                break;
            case 'quote':
                formatBlock('blockquote');
                break;
            case 'code':
                formatBlock('pre');
                break;
            case 'separator':
                this.insertStyledDivider();
                break;
            case 'table':
                this.insertDefaultTable();
                break;
            case 'clean':
                document.execCommand('removeFormat');
                break;
            default:
                break;
        }

        this.handleEditorInputChange();
    }

    applyFontSize(sizeValue) {
        if (!this.editRichArea) {
            return;
        }
        this.editRichArea.focus();
        this.restoreSelection();
        if (sizeValue) {
            const caretHandled = this.applyCollapsedInlineStyle((span) => {
                span.style.fontSize = sizeValue;
            });
            if (caretHandled) {
                return;
            }
        }
        document.execCommand('fontSize', false, '7');
        this.replaceFontSizePlaceholders(sizeValue);
        this.queueFormatBoundary();
        this.handleEditorInputChange();
    }

    applyFontFamily(familyValue) {
        if (!this.editRichArea) {
            return;
        }
        this.editRichArea.focus();
        this.restoreSelection();
        if (familyValue) {
            const caretHandled = this.applyCollapsedInlineStyle((span) => {
                span.style.fontFamily = familyValue;
            });
            if (caretHandled) {
                return;
            }
        }
        if (!familyValue) {
            document.execCommand('styleWithCSS', true, null);
            document.execCommand('fontName', false, 'inherit');
            document.execCommand('styleWithCSS', false, null);
            this.handleEditorInputChange();
            return;
        }
        document.execCommand('styleWithCSS', true, null);
        document.execCommand('fontName', false, familyValue);
        document.execCommand('styleWithCSS', false, null);
        this.queueFormatBoundary();
        this.handleEditorInputChange();
    }

    replaceFontSizePlaceholders(sizeValue) {
        if (!this.editRichArea) {
            return;
        }
        const placeholders = this.editRichArea.querySelectorAll('font[size="7"]');
        placeholders.forEach((node) => {
            const fragment = document.createDocumentFragment();
            while (node.firstChild) {
                fragment.appendChild(node.firstChild);
            }
            if (sizeValue) {
                const span = document.createElement('span');
                span.style.fontSize = sizeValue;
                span.appendChild(fragment);
                node.replaceWith(span);
            } else {
                node.replaceWith(fragment);
            }
        });

        const keywordSizes = new Set([
            'xx-small',
            'x-small',
            'small',
            'medium',
            'large',
            'x-large',
            'xx-large',
            'xxx-large'
        ]);

        const cssPlaceholderNodes = Array.from(this.editRichArea.querySelectorAll('[style*="font-size"]'))
            .filter((element) => {
                const inlineSize = element.style?.fontSize?.trim().toLowerCase();
                return inlineSize && keywordSizes.has(inlineSize);
            });

        cssPlaceholderNodes.forEach((node) => {
            if (sizeValue) {
                node.style.fontSize = sizeValue;
            } else {
                node.style.removeProperty('font-size');
                if (!node.getAttribute('style')) {
                    node.removeAttribute('style');
                }
            }
        });
    }

    applyTextColor(colorValue) {
        if (!this.editRichArea || !colorValue) {
            return;
        }
        this.editRichArea.focus({ preventScroll: true });
        this.restoreSelection();
        const selection = window.getSelection();
        const caretHandled = this.applyCollapsedInlineStyle((span) => {
            span.style.color = colorValue;
        });
        if (caretHandled) {
            this.pendingFormatBoundary = false;
            this.updateActiveColorIndicators(selection);
            return;
        }
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const isCollapsed = !range || range.collapsed;
        document.execCommand('styleWithCSS', true, null);
        document.execCommand('foreColor', false, colorValue);
        document.execCommand('styleWithCSS', false, null);
        if (!isCollapsed) {
            this.queueFormatBoundary();
        } else {
            this.pendingFormatBoundary = false;
        }
        this.handleEditorInputChange();
        this.updateActiveColorIndicators(selection);
    }

    setActiveFontColor(colorValue) {
        const normalized = (colorValue || '').toLowerCase();
        const targetColor = normalized || this.defaultFontColor || '';
        let handled = false;

        if (this.fontColorSwatches?.length) {
            this.fontColorSwatches.forEach((button) => {
                const buttonColor = button.dataset.color?.toLowerCase();
                button.classList.toggle('active', Boolean(targetColor) && buttonColor === targetColor);
            });
            handled = true;
        }

        if (!handled && this.fontColorPalette) {
            this.fontColorPalette.querySelectorAll('.color-swatch').forEach((button) => {
                const buttonColor = button.dataset.color?.toLowerCase();
                button.classList.toggle('active', Boolean(targetColor) && buttonColor === targetColor);
            });
        }

        if (this.fontCustomColorInput) {
            if (targetColor.startsWith('#')) {
                this.fontCustomColorInput.value = targetColor;
            } else if (this.defaultFontColor?.startsWith('#')) {
                this.fontCustomColorInput.value = this.defaultFontColor;
            }
        }
    }

    applyHighlightColor(colorValue) {
        if (!this.editRichArea) {
            return;
        }
        this.editRichArea.focus({ preventScroll: true });
        this.restoreSelection();
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const isCollapsed = !range || range.collapsed;
        const targetColor = colorValue === 'transparent' ? 'transparent' : colorValue;
        if (!targetColor) {
            return;
        }
        if (targetColor !== 'transparent') {
            const caretHandled = this.applyCollapsedInlineStyle((span) => {
                span.style.backgroundColor = targetColor;
            });
            if (caretHandled) {
                this.pendingFormatBoundary = false;
                this.updateActiveColorIndicators(selection);
                return;
            }
        } else if (isCollapsed) {
            this.removeCaretHighlightContext();
            this.pendingFormatBoundary = false;
            this.updateActiveColorIndicators(selection);
            return;
        }
        const supportsHilite = typeof document.queryCommandSupported === 'function'
            ? document.queryCommandSupported('hiliteColor')
            : false;
        const command = supportsHilite ? 'hiliteColor' : 'backColor';
        document.execCommand('styleWithCSS', true, null);
        document.execCommand(command, false, targetColor);
        document.execCommand('styleWithCSS', false, null);
        if (!isCollapsed) {
            this.queueFormatBoundary();
        } else {
            this.pendingFormatBoundary = false;
        }
        if (targetColor === 'transparent') {
            this.removeCaretHighlightContext();
        }
        this.handleEditorInputChange();
        this.updateActiveColorIndicators(selection);
    }

    setActiveHighlightColor(colorValue) {
        const normalized = (colorValue || '').toLowerCase();
        const target = normalized || this.defaultHighlightColor || 'transparent';
        let handled = false;

        if (this.highlightColorSwatches?.length) {
            this.highlightColorSwatches.forEach((button) => {
                const fallbackValue = button.dataset.highlight ? button.dataset.highlight.toLowerCase() : '';
                button.classList.toggle('active', fallbackValue === target);
            });
            handled = true;
        }

        if (!handled && this.highlightPalette) {
            this.highlightPalette.querySelectorAll('.color-swatch').forEach((button) => {
                const fallbackValue = button.dataset.highlight ? button.dataset.highlight.toLowerCase() : '';
                button.classList.toggle('active', fallbackValue === target);
            });
        }

        if (this.highlightCustomColorInput) {
            if (target.startsWith('#')) {
                this.highlightCustomColorInput.value = target;
            } else if (this.defaultHighlightColor?.startsWith('#')) {
                this.highlightCustomColorInput.value = this.defaultHighlightColor;
            }
        }
    }

    applyCollapsedInlineStyle(mutator) {
        if (!this.editRichArea || typeof mutator !== 'function') {
            return false;
        }
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            return false;
        }
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            return false;
        }
        let targetSpan = this.findCaretStyleWrapper(range.startContainer);
        if (!targetSpan) {
            targetSpan = document.createElement('span');
            targetSpan.dataset.caretStyle = 'true';
            targetSpan.style.display = 'inline';
            const placeholder = document.createTextNode('\u200B');
            targetSpan.appendChild(placeholder);
            range.insertNode(targetSpan);
            range.setStart(placeholder, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            this.savedSelectionRange = range.cloneRange();
        }
        try {
            mutator(targetSpan);
        } catch (error) {
            console.warn('Caret style update failed:', error);
            return false;
        }
        return true;
    }

    findCaretStyleWrapper(node) {
        if (!node) {
            return null;
        }
        let current = node instanceof Element ? node : node.parentElement;
        while (current && current !== this.editRichArea) {
            if (current.dataset?.caretStyle === 'true') {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    cleanupCaretPlaceholders(forceRemove = false) {
        if (!this.editRichArea) {
            return;
        }
        const placeholders = this.editRichArea.querySelectorAll('[data-caret-style="true"]');
        placeholders.forEach((span) => {
            const textContent = span.textContent || '';
            const sanitized = textContent.replace(/\u200B/g, '');
            if (!sanitized) {
                if (forceRemove) {
                    span.remove();
                }
                return;
            }
            Array.from(span.childNodes).forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE && child.textContent) {
                    child.textContent = child.textContent.replace(/\u200B/g, '');
                }
            });
            span.removeAttribute('data-caret-style');
            if (!span.getAttribute('style')) {
                const parent = span.parentNode;
                if (!parent) {
                    return;
                }
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                span.remove();
            }
        });
    }

    handleEditorInputChange() {
        if (!this.editRichArea) {
            return;
        }
        this.cleanupCaretPlaceholders();
        this.normalizeEditorImages(this.editRichArea);
        const sanitized = InfrastructureData.cleanHtml(this.editRichArea.innerHTML || '');
        this.hasUnsavedChanges = sanitized !== this.initialEditorSnapshot;
    }

    setEditorBaseline(html = '') {
        this.initialEditorSnapshot = InfrastructureData.cleanHtml(html || '');
        this.hasUnsavedChanges = false;
    }

    isEditModalOpen() {
        return !!this.editModalElement?.classList.contains('active');
    }

    requestCloseEditModal() {
        if (!this.isEditModalOpen()) {
            return;
        }
        if (this.hasUnsavedChanges) {
            const shouldSave = confirm('변경사항이 저장되지 않았습니다. 저장하고 닫을까요?');
            if (shouldSave) {
                this.saveEdit();
                return;
            }
            const discard = confirm('저장하지 않고 닫으시겠습니까?');
            if (!discard) {
                return;
            }
        }
        this.forceCloseEditModal();
    }

    forceCloseEditModal() {
        this.hasUnsavedChanges = false;
        if (this.editRichArea) {
            this.cleanupCaretPlaceholders(true);
            this.initialEditorSnapshot = InfrastructureData.cleanHtml(this.editRichArea.innerHTML || '');
        }
        this.currentTableCell = null;
        this.currentTableElement = null;
        this.currentImageElement = null;
        this.updateObjectToolsState();
        this.tableGridPopover?.classList.remove('active');
        this.hideModal('edit-modal');
    }

    insertDefaultTable() {
        if (!this.editRichArea) return;
        const html = `
            <table>
                <thead>
                    <tr>
                        <th>헤더 1</th>
                        <th>헤더 2</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>셀 1</td>
                        <td>셀 2</td>
                    </tr>
                </tbody>
            </table>
        `;
        document.execCommand('insertHTML', false, html);
        this.handleEditorInputChange();
    }

    insertStyledDivider(preferredVariant = null) {
        if (!this.editRichArea) {
            return;
        }
        this.closeDividerMenu();
        this.editRichArea.focus({ preventScroll: true });
        this.restoreSelection();
        const variant = this.setDividerVariantState(preferredVariant || this.lastDividerVariant || 'primary');
        const html = `<hr class="editor-divider" data-divider="${variant}">`;
        document.execCommand('insertHTML', false, html);
        this.handleEditorInputChange();
    }

    toggleTableGridPopover() {
        if (!this.tableGridPopover) {
            return;
        }
        const willShow = !this.tableGridPopover.classList.contains('active');
        this.tableGridPopover.classList.toggle('active', willShow);
        if (willShow) {
            this.highlightTableGrid(0, 0);
        }
    }

    buildTableGrid(rows = 8, cols = 8) {
        if (!this.tableGridElement) {
            return;
        }
        const fragment = document.createDocumentFragment();
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.row = row;
                button.dataset.col = col;
                fragment.appendChild(button);
            }
        }
        this.tableGridElement.innerHTML = '';
        this.tableGridElement.appendChild(fragment);
    }

    highlightTableGrid(rows = 0, cols = 0) {
        if (!this.tableGridElement) {
            return;
        }
        this.tableGridElement.querySelectorAll('button').forEach((button) => {
            const buttonRow = Number(button.dataset.row);
            const buttonCol = Number(button.dataset.col);
            if (buttonRow <= rows && buttonCol <= cols) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        if (this.tableGridHint) {
            this.tableGridHint.textContent = rows && cols ? `${rows} × ${cols}` : '0 × 0';
        }
    }

    insertCustomTable(rows = 2, cols = 2) {
        if (!this.editRichArea) {
            return;
        }
        const safeRows = Math.max(1, rows);
        const safeCols = Math.max(1, cols);
        const header = Array.from({ length: safeCols }, (_, index) => `<th>헤더 ${index + 1}</th>`).join('');
        const body = Array.from({ length: safeRows }, () => {
            const cells = Array.from({ length: safeCols }, () => '<td><br></td>').join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        const html = `
            <table data-editor-table="true" style="width:100%">
                <thead><tr>${header}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        `;
        document.execCommand('insertHTML', false, html);
        this.handleEditorInputChange();
    }

    handleSelectionChange() {
        if (!this.isEditModalOpen() || !this.editRichArea) {
            return;
        }
        let selection = document.getSelection();
        if (!selection?.anchorNode) {
            return;
        }
        const selectionInsideEditor = this.editRichArea.contains(selection.anchorNode);
        if (!selectionInsideEditor) {
            const activeElement = document.activeElement;
            const isToolbarInteraction = Boolean(
                (this.editorToolbar && this.editorToolbar.contains(activeElement))
                || (this.objectToolsPanel && this.objectToolsPanel.contains(activeElement))
                || (this.imageResizeOverlay && this.imageResizeOverlay.contains(activeElement))
            );
            if (!isToolbarInteraction) {
                this.currentTableCell = null;
                this.currentTableElement = null;
                this.currentImageElement = null;
                this.savedSelectionRange = null;
                this.updateObjectToolsState();
                this.resetActiveColorStates();
                this.updateImageSelectionHighlight(null);
            }
            return;
        }
        if (this.pendingFormatBoundary && selection.isCollapsed) {
            const applied = this.insertFormattingBoundary(selection);
            if (applied) {
                selection = document.getSelection();
                if (!selection?.rangeCount) {
                    return;
                }
            }
        }
        if (selection.rangeCount > 0) {
            this.savedSelectionRange = selection.getRangeAt(0).cloneRange();
        }
        this.currentTableCell = this.closestEditableAncestor(selection.anchorNode, 'td,th');
        this.currentTableElement = this.currentTableCell
            ? this.currentTableCell.closest('table')
            : this.closestEditableAncestor(selection.anchorNode, 'table');
        this.currentImageElement = this.findSelectedImage(selection.anchorNode);
        if (this.currentTableElement) {
            this.currentImageElement = null;
        }
        const activeFigure = this.currentImageElement?.closest('.editor-image') || null;
        this.updateImageSelectionHighlight(activeFigure);
        this.updateObjectToolsState();
        this.updateActiveColorIndicators(selection);
    }

    updateActiveColorIndicators(selection = null) {
        if (!this.editRichArea) {
            return;
        }
        const selectionColor = this.getSelectionFontColor(selection);
        this.setActiveFontColor(selectionColor);
        const highlightColor = this.getSelectionHighlightColor(selection);
        this.setActiveHighlightColor(highlightColor || 'transparent');
    }

    resetActiveColorStates() {
        this.setActiveFontColor('');
        this.setActiveHighlightColor('');
    }

    getSelectionFontColor(selection = null) {
        if (!selection) {
            selection = window.getSelection();
        }
        if (!selection?.rangeCount) {
            return '';
        }
        let value = '';
        try {
            value = document.queryCommandValue('foreColor');
        } catch (error) {
            value = '';
        }
        if (value && typeof value === 'string') {
            const normalized = this.normalizeColorValue(value);
            if (normalized) {
                return normalized;
            }
        }
        const node = selection.anchorNode instanceof Element
            ? selection.anchorNode
            : selection.anchorNode?.parentElement;
        const computed = node ? window.getComputedStyle(node).color : '';
        return this.normalizeColorValue(computed);
    }

    getSelectionHighlightColor(selection = null) {
        if (!selection) {
            selection = window.getSelection();
        }
        if (!selection?.rangeCount) {
            return '';
        }
        let value = '';
        try {
            if (document.queryCommandSupported?.('hiliteColor')) {
                value = document.queryCommandValue('hiliteColor');
            } else {
                value = document.queryCommandValue('backColor');
            }
        } catch (error) {
            value = '';
        }
        const normalized = this.normalizeColorValue(value);
        if (normalized) {
            return normalized;
        }
        const node = selection.anchorNode instanceof Element
            ? selection.anchorNode
            : selection.anchorNode?.parentElement;
        const bgValue = node ? window.getComputedStyle(node).backgroundColor : '';
        return this.normalizeColorValue(bgValue);
    }

    normalizeColorValue(value) {
        if (!value) {
            return '';
        }
        const trimmed = value.trim().toLowerCase();
        if (!trimmed || trimmed === 'initial' || trimmed === 'inherit' || trimmed === 'none') {
            return '';
        }
        if (trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') {
            return '';
        }
        if (trimmed.startsWith('#')) {
            return trimmed;
        }
        const rgbMatch = trimmed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (rgbMatch) {
            const [, r, g, b] = rgbMatch;
            return this.rgbToHex(Number(r), Number(g), Number(b));
        }
        if (/^[a-z]+$/i.test(trimmed) && document.body) {
            const probe = document.createElement('span');
            probe.style.color = trimmed;
            probe.style.position = 'absolute';
            probe.style.left = '-9999px';
            document.body.appendChild(probe);
            const computed = window.getComputedStyle(probe).color;
            probe.remove();
            return this.normalizeColorValue(computed);
        }
        return trimmed;
    }

    rgbToHex(r, g, b) {
        const clamp = (value) => Math.max(0, Math.min(255, Number(value) || 0));
        const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    closestEditableAncestor(node, selector) {
        if (!node) {
            return null;
        }
        let current = node instanceof Element ? node : node.parentElement;
        while (current && current !== this.editRichArea) {
            if (current.matches?.(selector)) {
                return current;
            }
            current = current.parentElement;
        }
        if (current?.matches?.(selector)) {
            return current;
        }
        return null;
    }

    restoreSelection() {
        if (!this.savedSelectionRange) {
            return;
        }
        const selection = window.getSelection();
        selection.removeAllRanges();
        try {
            selection.addRange(this.savedSelectionRange.cloneRange());
        } catch (error) {
            selection.addRange(this.savedSelectionRange);
        }
    }

    queueFormatBoundary() {
        if (!this.editRichArea) {
            return;
        }
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            this.pendingFormatBoundary = true;
            return;
        }
        const range = selection.getRangeAt(0);
        if (!this.editRichArea.contains(range.startContainer)) {
            this.pendingFormatBoundary = true;
            return;
        }
        this.insertFormattingBoundary(selection);
    }

    insertFormattingBoundary(selection = null) {
        if (!this.editRichArea) {
            return false;
        }
        const activeSelection = selection || window.getSelection();
        if (!activeSelection?.rangeCount) {
            return false;
        }
        const range = activeSelection.getRangeAt(0);
        if (!this.editRichArea.contains(range.startContainer)) {
            return false;
        }
        const collapseRange = range.cloneRange();
        collapseRange.collapse(false);

        // Remove trailing nodes that carry inline styles on the new boundary
        this.stripTrailingFormatNodes(collapseRange.endContainer);

        const marker = document.createElement('span');
        marker.dataset.formatBoundary = 'true';
        marker.style.display = 'inline';
        marker.style.lineHeight = '0';
        marker.style.fontSize = '0';
        marker.textContent = String.fromCharCode(8203);
        collapseRange.insertNode(marker);
        const newRange = document.createRange();
        newRange.setStartAfter(marker);
        newRange.collapse(true);
        activeSelection.removeAllRanges();
        activeSelection.addRange(newRange);
        this.savedSelectionRange = newRange.cloneRange();
        marker.remove();
        this.pendingFormatBoundary = false;
        return true;
    }

    stripTrailingFormatNodes(node) {
        let boundaryNode = node;
        if (boundaryNode?.nodeType === Node.TEXT_NODE && boundaryNode.textContent === '') {
            const parent = boundaryNode.parentElement;
            boundaryNode.remove();
            boundaryNode = parent;
        }
        while (boundaryNode && boundaryNode !== this.editRichArea) {
            if (boundaryNode.nodeType === Node.ELEMENT_NODE) {
                boundaryNode.removeAttribute('style');
                boundaryNode.classList?.remove('active-font-color', 'active-highlight-color');
            }
            if (!boundaryNode.textContent?.trim()) {
                const removeTarget = boundaryNode;
                boundaryNode = boundaryNode.parentElement;
                removeTarget.remove();
            } else {
                break;
            }
        }
    }

    removeCaretHighlightContext() {
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            return;
        }
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            return;
        }
        const highlightElement = this.findHighlightAncestor(range.startContainer);
        if (!highlightElement || !highlightElement.parentNode) {
            return;
        }
        range.setStartAfter(highlightElement);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    findHighlightAncestor(node) {
        if (!node) {
            return null;
        }
        let current = node instanceof Element ? node : node.parentElement;
        while (current && current !== this.editRichArea) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const bgValue = current.style?.backgroundColor || '';
                if (bgValue && bgValue !== 'transparent') {
                    return current;
                }
            }
            current = current.parentElement;
        }
        return null;
    }

    findSelectedImage(node) {
        if (!node) {
            return null;
        }
        let current = node instanceof Element ? node : node.parentElement;
        while (current && current !== this.editRichArea) {
            if (current instanceof HTMLImageElement && current.closest('.editor-image')) {
                return current;
            }
            if (current.classList?.contains('editor-image')) {
                return current.querySelector('img');
            }
            current = current.parentElement;
        }
        return null;
    }

    updateObjectToolsState() {
        if (!this.objectToolsPanel || !this.objectWidthSlider || !this.objectWidthValue) {
            this.refreshImageResizeOverlay();
            return;
        }
        const hasImage = !!this.currentImageElement;
        const hasTable = !!this.currentTableElement;
        const hasObject = hasImage || hasTable;
        this.objectToolsPanel.classList.toggle('active', hasObject);
        if (!hasObject) {
            this.objectWidthValue.textContent = '100%';
            this.imageLayoutGroup?.classList.remove('active');
            return;
        }

        if (hasImage) {
            const width = this.getImageWidthPercentage(this.currentImageElement);
            this.objectWidthSlider.min = 10;
            this.objectWidthSlider.max = 150;
            this.objectWidthSlider.value = width;
            this.objectWidthValue.textContent = `${width}%`;
            if (this.objectSliderLabel) {
                this.objectSliderLabel.textContent = '이미지 너비';
            }
            this.imageLayoutGroup?.classList.add('active');
            this.syncImageLayoutButtons();
        } else if (hasTable) {
            const width = this.getTableWidthPercentage(this.currentTableElement);
            this.objectWidthSlider.min = 40;
            this.objectWidthSlider.max = 100;
            this.objectWidthSlider.value = width;
            this.objectWidthValue.textContent = `${width}%`;
            if (this.objectSliderLabel) {
                this.objectSliderLabel.textContent = '표 너비';
            }
            this.imageLayoutGroup?.classList.remove('active');
        }
        this.refreshImageResizeOverlay();
    }

    updateToolbarFloatingState() {
        if (!this.editorToolbar) {
            return;
        }
        this.editorToolbar.classList.remove('is-floating');
    }

    getTableWidthPercentage(table) {
        if (!table) {
            return 100;
        }
        const inlineWidth = table.style.width;
        if (inlineWidth && inlineWidth.endsWith('%')) {
            return Math.min(100, Math.max(40, Number.parseInt(inlineWidth, 10) || 100));
        }
        const parentWidth = table.parentElement?.clientWidth || 1;
        const tableWidth = table.clientWidth || parentWidth;
        return Math.min(100, Math.max(40, Math.round((tableWidth / parentWidth) * 100)));
    }

    getImageWidthPercentage(image) {
        if (!image) {
            return 100;
        }
        const figure = image.closest('.editor-image');
        const inlineWidth = figure?.style.width;
        if (inlineWidth && inlineWidth.endsWith('%')) {
            return Math.min(150, Math.max(10, Number.parseInt(inlineWidth, 10) || 100));
        }
        const parentWidth = figure?.parentElement?.clientWidth || this.editRichArea?.clientWidth || 1;
        const rect = figure?.getBoundingClientRect();
        const width = rect?.width || image.clientWidth || parentWidth;
        return Math.min(150, Math.max(10, Math.round((width / parentWidth) * 100)));
    }

    setActiveTableWidth(percent) {
        if (!this.currentTableElement) {
            return;
        }
        const safeValue = Math.min(100, Math.max(40, Number(percent) || 100));
        this.currentTableElement.style.width = `${safeValue}%`;
        this.handleEditorInputChange();
        this.updateObjectToolsState();
    }

    setImageWidth(percent) {
        if (!this.currentImageElement) {
            return;
        }
        const safeValue = Math.min(150, Math.max(10, Number(percent) || 100));
        const figure = this.currentImageElement.closest('.editor-image');
        if (figure) {
            figure.style.width = `${safeValue}%`;
        }
        this.currentImageElement.style.width = '100%';
        this.currentImageElement.style.height = 'auto';
        this.handleEditorInputChange();
        this.updateObjectToolsState();
    }

    applyImageLayout(layout) {
        if (!this.currentImageElement) {
            return;
        }
        const figure = this.currentImageElement.closest('.editor-image');
        if (!figure) {
            return;
        }
        const layouts = ['inline', 'center', 'left', 'right'];
        layouts.forEach((item) => figure.classList.remove(`layout-${item}`));
        const targetLayout = layouts.includes(layout) ? layout : 'inline';
        figure.classList.add(`layout-${targetLayout}`);
        this.syncImageLayoutButtons(targetLayout);
        this.handleEditorInputChange();
        this.refreshImageResizeOverlay();
    }

    syncImageLayoutButtons(forceLayout = null) {
        if (!this.imageLayoutButtons.length) {
            return;
        }
        const figure = this.currentImageElement?.closest('.editor-image');
        const layouts = ['inline', 'center', 'left', 'right'];
        const activeLayout = forceLayout
            || layouts.find((item) => figure?.classList.contains(`layout-${item}`))
            || 'inline';
        this.imageLayoutButtons.forEach((button) => {
            button.classList.toggle('active', button.dataset.layout === activeLayout);
        });
    }

    addTableRow() {
        if (!this.currentTableCell || !this.currentTableElement) {
            this.showError('표 안을 선택한 뒤 사용하세요.');
            return;
        }
        const row = this.currentTableCell.closest('tr');
        if (!row) {
            return;
        }
        const colCount = row.children.length;
        const targetSection = row.parentElement?.tagName === 'THEAD'
            ? (this.currentTableElement.querySelector('tbody') || this.currentTableElement.appendChild(document.createElement('tbody')))
            : row.parentElement;
        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement('td');
            cell.innerHTML = '<br>';
            newRow.appendChild(cell);
        }
        targetSection.insertBefore(newRow, row.parentElement?.tagName === 'THEAD' ? targetSection.firstChild : row.nextSibling);
        this.focusCell(newRow.children[0]);
        this.handleEditorInputChange();
    }

    addTableColumn() {
        if (!this.currentTableCell || !this.currentTableElement) {
            this.showError('표 안을 선택한 뒤 사용하세요.');
            return;
        }
        const columnIndex = this.currentTableCell.cellIndex;
        Array.from(this.currentTableElement.rows).forEach((row) => {
            const isHeader = row.parentElement?.tagName === 'THEAD';
            const cell = document.createElement(isHeader ? 'th' : 'td');
            cell.innerHTML = '<br>';
            if (columnIndex + 1 < row.children.length) {
                row.insertBefore(cell, row.children[columnIndex + 1]);
            } else {
                row.appendChild(cell);
            }
        });
        this.handleEditorInputChange();
    }

    deleteTableRow() {
        if (!this.currentTableCell) {
            this.showError('삭제할 행을 선택하세요.');
            return;
        }
        const row = this.currentTableCell.closest('tr');
        if (!row?.parentElement) {
            return;
        }
        if (row.parentElement.children.length <= 1) {
            this.showError('마지막 행은 삭제할 수 없습니다.');
            return;
        }
        const nextFocus = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        if (nextFocus) {
            const targetCell = nextFocus.querySelector('td,th');
            this.focusCell(targetCell);
        }
        this.handleEditorInputChange();
    }

    deleteTableColumn() {
        if (!this.currentTableCell || !this.currentTableElement) {
            this.showError('삭제할 열을 선택하세요.');
            return;
        }
        const columnIndex = this.currentTableCell.cellIndex;
        const totalColumns = this.currentTableElement.rows?.[0]?.cells?.length || 0;
        if (totalColumns <= 1) {
            this.showError('마지막 열은 삭제할 수 없습니다.');
            return;
        }
        Array.from(this.currentTableElement.rows).forEach((row) => {
            if (row.cells[columnIndex]) {
                row.deleteCell(columnIndex);
            }
        });
        const firstRow = this.currentTableElement.rows?.[0];
        if (firstRow && firstRow.cells.length) {
            const nextIndex = Math.min(columnIndex, firstRow.cells.length - 1);
            const targetCell = Array.from(this.currentTableElement.rows).map((row) => row.cells[nextIndex]).find(Boolean);
            this.focusCell(targetCell);
        }
        this.handleEditorInputChange();
    }

    focusCell(cell) {
        if (!cell) {
            return;
        }
        const range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        this.editRichArea?.focus();
    }

    insertImageFromFile(file) {
        if (!file) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            this.showError('이미지 파일을 선택하세요.');
            return;
        }
        this.readBlobAsDataUrl(file)
            .then((src) => this.insertImageFromSrc(src, file.name || 'image'))
            .catch((error) => console.warn('이미지 파일 로드 실패:', error));
    }

    insertImageFromBlob(blob) {
        if (!blob) {
            return;
        }
        this.readBlobAsDataUrl(blob)
            .then((src) => this.insertImageFromSrc(src, blob.name || 'clipboard-image'))
            .catch((error) => console.warn('클립보드 이미지 로드 실패:', error));
    }

    insertImageFromSrc(src, altText = '') {
        if (!src || !this.editRichArea) {
            return;
        }
        const figure = `
            <figure class="editor-image layout-inline">
                <img src="${src}" alt="${this.escapeHtml(altText)}" style="max-width:100%;height:auto;">
            </figure>
        `;
        this.editRichArea.focus();
        document.execCommand('insertHTML', false, figure);
        this.handleEditorInputChange();
    }

    // 애플리케이션 초기화
    init() {
        this.editRichArea = document.getElementById('edit-richarea');
        this.editorToolbar = document.getElementById('editor-toolbar');
        this.editorLayoutElement = document.querySelector('.editor-layout');
        this.fontSizeSelect = document.getElementById('font-size-select');
        this.fontFamilySelect = document.getElementById('font-family-select');
        this.fontColorPalette = document.getElementById('font-color-swatches');
        this.highlightPalette = document.getElementById('highlight-color-swatches');
        this.fontColorContainers = Array.from(document.querySelectorAll('[data-color-target="font"]'));
        this.highlightColorContainers = Array.from(document.querySelectorAll('[data-color-target="highlight"]'));
        this.fontColorSwatches = Array.from(document.querySelectorAll('[data-color-type="font"]'));
        this.highlightColorSwatches = Array.from(document.querySelectorAll('[data-color-type="highlight"]'));
        this.fontCustomColorInput = document.querySelector('[data-custom-color="font"]');
        this.highlightCustomColorInput = document.querySelector('[data-custom-color="highlight"]');
        this.colorDropdownButtons = Array.from(document.querySelectorAll('[data-color-toggle]'));
        this.dividerControl = document.getElementById('divider-control');
        this.dividerMainButton = document.getElementById('divider-main-btn');
        this.dividerToggleButton = document.getElementById('divider-toggle-btn');
        this.dividerMenu = document.getElementById('divider-menu');
        this.dividerMenuButtons = Array.from(this.dividerMenu?.querySelectorAll('[data-divider-variant]') || []);
        this.tableGridTrigger = document.getElementById('table-grid-trigger');
        this.tableGridPopover = document.getElementById('table-grid-popover');
        this.tableGridElement = document.getElementById('table-grid');
        this.tableGridHint = document.getElementById('table-grid-hint');
        this.objectToolsPanel = document.getElementById('object-tools-panel');
        this.objectWidthSlider = document.getElementById('object-width-slider');
        this.objectWidthValue = document.getElementById('object-width-value');
        this.objectSliderLabel = document.getElementById('object-slider-label');
        this.tableAddRowBtn = document.getElementById('table-add-row');
        this.tableAddColBtn = document.getElementById('table-add-col');
        this.tableDeleteRowBtn = document.getElementById('table-delete-row');
        this.tableDeleteColBtn = document.getElementById('table-delete-col');
        this.imageInsertBtn = document.getElementById('insert-image-btn');
        this.imageFileInput = document.getElementById('image-file-input');
        this.imageLayoutGroup = document.getElementById('image-layout-group');
        this.imageLayoutButtons = Array.from(this.imageLayoutGroup?.querySelectorAll('[data-layout]') || []);
        this.editModalElement = document.getElementById('edit-modal');
        this.navContainer = document.getElementById('nav-sections');
        this.navUpdatesContainer = document.getElementById('nav-updates');
        this.managerModal = document.getElementById('manager-modal');
        this.managerListElement = document.getElementById('manager-list');
        this.managerSearchInput = document.getElementById('manager-search');
        this.managerDetailTitle = document.getElementById('manager-detail-title');
        this.managerDetailHint = document.querySelector('.manager-detail-hint');
        this.managerDetailPreview = document.getElementById('manager-detail-preview');
        this.managerOpenBtn = document.getElementById('manager-open-btn');
        this.managerEditBtn = document.getElementById('manager-edit-btn');
        this.managerDeleteBtn = document.getElementById('manager-delete-btn');
        this.structureModal = document.getElementById('structure-modal');
        this.structureParentSelect = document.getElementById('structure-parent');
        this.structureNewSectionField = document.getElementById('structure-new-section');
        this.structureSectionInput = document.getElementById('structure-section-title');
        this.structureContentInput = document.getElementById('structure-content-title');
        this.adminModal = document.getElementById('admin-modal');
        this.adminLockBtn = document.getElementById('admin-lock-btn');
        this.adminStatusText = document.getElementById('admin-status-text');
        this.adminSetupPanel = document.getElementById('admin-setup-panel');
        this.adminUnlockPanel = document.getElementById('admin-unlock-panel');
        this.adminManagePanel = document.getElementById('admin-manage-panel');
        this.adminPassInput = document.getElementById('admin-passcode');
        this.adminPassConfirmInput = document.getElementById('admin-passcode-confirm');
        this.adminPassEntryInput = document.getElementById('admin-passcode-enter');
        this.adminSubmitBtn = document.getElementById('admin-submit-btn');
        this.adminCancelBtn = document.getElementById('admin-cancel-btn');
        this.adminDisableBtn = document.getElementById('admin-disable-btn');
        this.adminRelockBtn = document.getElementById('admin-relock-btn');
        this.adminChangeBtn = document.getElementById('admin-change-btn');
        this.adminActionGroup = document.querySelector('.admin-action-group');
        this.pastePopover = document.getElementById('paste-popover');
        this.pastePreviewPanel = document.getElementById('paste-preview-panel');
        this.pastePreviewOriginal = document.getElementById('paste-preview-original');
        this.pastePreviewResult = document.getElementById('paste-preview-result');
        this.pastePreviewSummary = document.getElementById('paste-preview-summary');
        this.pastePreviewModeSelect = document.getElementById('paste-preview-mode');
        this.pasteCopyHtmlBtn = document.getElementById('paste-copy-html-btn');
        this.pasteCopyTextBtn = document.getElementById('paste-copy-text-btn');
    this.pasteInsertPreviewBtn = document.getElementById('paste-insert-preview-btn');
        this.pasteSettingsModal = document.getElementById('paste-settings-modal');
        this.wordStyleTable = document.getElementById('word-style-table');
    this.pasteTableControls = document.getElementById('paste-table-controls');
    this.pasteTableList = document.getElementById('paste-table-list');
    this.pasteTableSelectAllBtn = document.getElementById('paste-table-select-all');
    this.pasteTableClearBtn = document.getElementById('paste-table-clear');
    this.pasteTablePreviewResetBtn = document.getElementById('paste-table-preview-reset');
    this.pasteInsertSelectedBtn = document.getElementById('paste-insert-selected');
    this.pasteCopySelectedBtn = document.getElementById('paste-copy-selected');
        this.quickLinksContainer = document.getElementById('quick-links-grid');
        this.settingsModal = document.getElementById('settings-modal');
        this.quickLinkEditor = document.getElementById('quick-link-editor');
        this.addQuickLinkRowBtn = document.getElementById('add-quick-link-row');
        this.saveQuickLinksBtn = document.getElementById('save-quick-links');
        this.resetQuickLinksBtn = document.getElementById('reset-quick-links');
        this.settingsOpenManagerBtn = document.getElementById('settings-open-manager');
        this.settingsExportBtn = document.getElementById('settings-export-json');
        this.settingsImportInput = document.getElementById('settings-import-json');
        this.settingsAddSectionBtn = document.getElementById('settings-add-section');
        this.settingsDownloadBackupBtn = document.getElementById('settings-download-backup');
        this.settingsResetDataBtn = document.getElementById('settings-reset-data');
        this.settingsBtn = document.getElementById('settings-btn');
        this.closeSettingsBtn = document.getElementById('close-settings');
        this.editButton = document.getElementById('edit-btn');
        this.addSectionButton = document.getElementById('add-section-btn');
        this.viewOnlyBadge = document.getElementById('view-only-pill');
        this.toolbarExcelBtn = document.getElementById('toolbar-excel-btn');

        this.updateEditPermissions();
        this.setupImageResizeOverlay();
        this.setupEditorToolbar();
        this.loadFromStorage();
        this.buildNavigation();
        this.setupEventListeners();
        this.setupNavigation();
        this.showWelcomeScreen();
        this.refreshAdminState();
        this.updateAdminButton();
        this.setupAdminLockControls();
        this.setupPasteUI();
        this.renderQuickLinks();
        this.setupSettingsModalEvents();
        this.setupHomeShortcuts();
        this.syncFromServer();
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 검색 버튼
        document.getElementById('search-btn')?.addEventListener('click', () => {
            this.showSearchModal();
        });

        // 편집 버튼
        document.getElementById('edit-btn')?.addEventListener('click', () => {
            this.showEditModal();
        });

        // 인쇄 버튼
        document.getElementById('print-btn')?.addEventListener('click', () => {
            window.print();
        });

        // 설정 버튼
        this.settingsBtn?.addEventListener('click', () => {
            this.openSettingsModal();
        });

        // 새 섹션 추가 버튼
        document.getElementById('add-section-btn')?.addEventListener('click', () => {
            this.showStructureModal();
        });

        // 모달 이벤트
        this.setupModalEvents();
        this.setupManagerEvents();
        this.setupStructureModalEvents();
        this.setupExcelModalEvents();

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch(e.key) {
                    case 'f':
                        e.preventDefault();
                        this.showSearchModal();
                        break;
                    case 'e':
                        e.preventDefault();
                        if (!this.canEdit) {
                            this.showError('관리자 계정으로 로그인해야 편집할 수 있습니다.');
                            return;
                        }
                        this.showEditModal();
                        break;
                    case 'p':
                        e.preventDefault();
                        window.print();
                        break;
                }
            }
        });

        document.addEventListener('selectionchange', () => this.handleSelectionChange());
    }

    // 모달 관련 이벤트 설정
    setupModalEvents() {
        // 검색 모달
        document.getElementById('close-search').addEventListener('click', () => {
            this.hideModal('search-modal');
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.performSearch(e.target.value);
        });

        // 편집 모달
        document.getElementById('close-edit').addEventListener('click', () => {
            this.requestCloseEditModal();
        });

        document.getElementById('save-edit').addEventListener('click', () => {
            this.saveEdit();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.requestCloseEditModal();
        });

        document.getElementById('close-settings')?.addEventListener('click', () => {
            this.hideModal('settings-modal');
        });

        // 모달 외부 클릭 시 닫기
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal.id === 'edit-modal') {
                        return;
                    }
                    if (modal.id === 'admin-modal') {
                        this.pendingAdminAction = null;
                    }
                    this.hideModal(modal.id);
                }
            });
        });
    }

    setupManagerEvents() {
        if (!this.managerModal) return;

        document.getElementById('close-manager')?.addEventListener('click', () => {
            this.hideModal('manager-modal');
        });

        this.managerSearchInput?.addEventListener('input', (event) => {
            this.renderManagerList(event.target.value);
        });

        this.managerOpenBtn?.addEventListener('click', () => {
            if (!this.managerSelection) return;
            if (this.managerSelection.type === 'content') {
                this.hideModal('manager-modal');
                this.loadContent(this.managerSelection.key);
            } else if (this.managerSelection.type === 'section') {
                this.showStructureModal(this.managerSelection.sectionId);
            }
        });

        this.managerEditBtn?.addEventListener('click', () => {
            if (!this.managerSelection) return;
            if (this.managerSelection.type === 'content') {
                this.hideModal('manager-modal');
                this.loadContent(this.managerSelection.key);
                this.showEditModal();
            } else if (this.managerSelection.type === 'section') {
                this.renameSectionPrompt(this.managerSelection.sectionId);
            }
        });

        this.managerDeleteBtn?.addEventListener('click', () => {
            if (!this.managerSelection) return;
            if (this.managerSelection.type === 'content') {
                this.deleteContentEntry(this.managerSelection.key);
            } else if (this.managerSelection.type === 'section') {
                this.deleteSection(this.managerSelection.sectionId);
            }
        });
    }

    setupStructureModalEvents() {
        if (!this.structureModal) return;

        document.getElementById('close-structure')?.addEventListener('click', () => {
            this.hideModal('structure-modal');
        });

        document.getElementById('structure-cancel')?.addEventListener('click', () => {
            this.hideModal('structure-modal');
        });

        document.getElementById('structure-save')?.addEventListener('click', () => {
            this.handleStructureSave();
        });

        this.structureParentSelect?.addEventListener('change', () => {
            this.toggleStructureNewSection();
        });
    }

    setupPasteUI() {
        if (!this.editRichArea) return;

        this.clearPastePreview();

        this.pastePreviewResult?.addEventListener('dragstart', (event) => this.handlePreviewDrag(event));
        this.pastePreviewResult?.addEventListener('dblclick', () => this.insertPreviewResult());

        document.querySelectorAll('[data-paste-mode]').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.pasteMode;
                this.handlePasteOption(mode);
            });
        });

        document.getElementById('close-paste-popover')?.addEventListener('click', () => {
            this.dismissPasteOverlay(true);
        });

        this.pastePreviewModeSelect?.addEventListener('change', (event) => {
            this.updatePreviewResult(event.target.value);
        });

        this.pasteCopyHtmlBtn?.addEventListener('click', () => {
            if (!this.lastPasteBundle) return;
            const mode = this.pastePreviewModeSelect?.value || 'clean';
            const html = this.resolvePasteHtmlByMode(mode);
            if (!html) {
                this.showError('복사할 HTML이 없습니다.');
                return;
            }
            this.copyToClipboard(html).then(() => this.showSuccess('HTML을 복사했습니다.'));
        });

        this.pasteCopyTextBtn?.addEventListener('click', () => {
            if (!this.lastPasteBundle) return;
            const text = this.lastPasteBundle.originalText || this.stripHtml(this.lastPasteBundle.originalHtml || '');
            if (!text) {
                this.showError('복사할 텍스트가 없습니다.');
                return;
            }
            this.copyToClipboard(text).then(() => this.showSuccess('텍스트를 복사했습니다.'));
        });

        this.pasteInsertPreviewBtn?.addEventListener('click', () => this.insertPreviewResult());

        document.getElementById('paste-settings-btn')?.addEventListener('click', () => {
            this.openPasteSettingsModal();
        });

        document.getElementById('close-paste-settings')?.addEventListener('click', () => {
            this.closePasteSettingsModal();
        });

        document.getElementById('paste-settings-cancel')?.addEventListener('click', () => {
            this.closePasteSettingsModal();
        });

        document.getElementById('paste-settings-save')?.addEventListener('click', () => {
            this.savePasteSettings();
        });

        document.getElementById('paste-settings-reset')?.addEventListener('click', () => {
            this.resetPasteSettings();
        });

        document.getElementById('add-style-map-row')?.addEventListener('click', () => {
            this.addStyleMapRow();
        });

        this.pasteTableSelectAllBtn?.addEventListener('click', () => this.selectAllTables());
        this.pasteTableClearBtn?.addEventListener('click', () => this.clearTableSelection());
        this.pasteTablePreviewResetBtn?.addEventListener('click', () => this.resetTablePreviewFocus(true));
        this.pasteInsertSelectedBtn?.addEventListener('click', () => this.insertSelectedTables());
        this.pasteCopySelectedBtn?.addEventListener('click', () => this.copySelectedTables());

        this.pasteTableList?.addEventListener('change', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            const index = Number(input.dataset.tableSelect);
            if (Number.isNaN(index)) return;
            if (input.checked) {
                this.selectedTableIndexes.add(index);
            } else {
                this.selectedTableIndexes.delete(index);
                if (this.tablePreviewFocus === index) {
                    this.resetTablePreviewFocus(true);
                }
            }
            this.updateTableActionButtons();
            if ((this.pastePreviewModeSelect?.value || 'clean') === 'table' && this.tablePreviewFocus === null) {
                this.updatePreviewResult('table');
            }
        });

        this.pasteTableList?.addEventListener('click', (event) => {
            const button = event.target instanceof Element ? event.target.closest('[data-table-preview]') : null;
            if (!button) return;
            const index = Number(button.dataset.tablePreview);
            if (Number.isNaN(index)) {
                this.resetTablePreviewFocus(true);
                return;
            }
            this.previewTable(index);
        });

        this.renderWordStyleTable();
        this.populatePasteSettings();

        document.addEventListener('click', (event) => {
            if (!this.pastePopover?.classList.contains('active')) return;
            if (this.pastePopover.contains(event.target) || this.editRichArea.contains(event.target)) {
                return;
            }
            this.dismissPasteOverlay(true);
        });
    }

    renderQuickLinks() {
        if (!this.quickLinksContainer) return;
        const links = InfrastructureData.getQuickStartLinks();
        this.quickLinksContainer.innerHTML = '';

        if (!links.length) {
            const empty = document.createElement('p');
            empty.className = 'quick-link-empty';
            empty.textContent = '설정에서 빠른 시작 카드를 추가하세요.';
            this.quickLinksContainer.appendChild(empty);
            return;
        }

        links.forEach(link => {
            const title = this.escapeHtml(link.title || '새 카드');
            const description = this.escapeHtml(link.description || '문서로 이동');
            const anchor = document.createElement('a');
            anchor.href = `#${link.key || ''}`;
            anchor.className = 'quick-link-card';
            anchor.dataset.content = link.key || '';
            anchor.innerHTML = `<h4>${title}</h4><p>${description}</p>`;
            anchor.addEventListener('click', (event) => {
                event.preventDefault();
                if (link.key) {
                    this.loadContent(link.key);
                }
            });
            this.quickLinksContainer.appendChild(anchor);
        });
    }

    setupHomeShortcuts() {
        const homeTargets = [
            document.querySelector('.sidebar-header .logo'),
            document.querySelector('.sidebar-header h2'),
            document.querySelector('.welcome-icon')
        ];
        homeTargets.forEach(el => {
            if (!el) return;
            el.style.cursor = 'pointer';
            el.addEventListener('click', (event) => {
                event.preventDefault();
                this.showWelcomeScreen();
            });
        });
    }

    openSettingsModal() {
        const perform = () => {
            if (!this.settingsModal) return;
            this.populateSettingsModal();
            this.settingsModal.classList.add('active');
        };

        if (!this.guardAdmin(perform)) {
            return;
        }
        perform();
    }

    populateSettingsModal() {
        this.populateQuickLinkEditor();
    }

    setupSettingsModalEvents() {
        this.addQuickLinkRowBtn?.addEventListener('click', () => {
            this.addQuickLinkEditorRow();
        });

        this.saveQuickLinksBtn?.addEventListener('click', () => {
            this.saveQuickLinksFromEditor();
        });

        this.resetQuickLinksBtn?.addEventListener('click', () => {
            if (!confirm('빠른 시작 카드를 기본값으로 복구할까요?')) return;
            this.resetQuickLinksToDefault();
        });

        this.settingsOpenManagerBtn?.addEventListener('click', () => {
            this.hideModal('settings-modal');
            this.openManagerModal();
        });

        this.settingsExportBtn?.addEventListener('click', () => {
            this.exportData();
        });

        this.settingsImportInput?.addEventListener('change', (event) => {
            this.importData(event.target);
            event.target.value = '';
        });

        this.settingsAddSectionBtn?.addEventListener('click', () => {
            this.hideModal('settings-modal');
            this.showStructureModal();
        });

        this.settingsDownloadBackupBtn?.addEventListener('click', () => {
            this.exportData();
        });

        this.settingsResetDataBtn?.addEventListener('click', () => {
            this.resetLocalData();
        });
    }

    populateQuickLinkEditor() {
        if (!this.quickLinkEditor) return;
        this.quickLinkEditor.innerHTML = '';
        const links = InfrastructureData.getQuickStartLinks();
        if (!links.length) {
            this.addQuickLinkEditorRow();
            return;
        }
        links.forEach(link => this.addQuickLinkEditorRow(link));
    }

    addQuickLinkEditorRow(link = {}) {
        if (!this.quickLinkEditor) return;
        const row = document.createElement('div');
        row.className = 'quick-link-row';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = '카드 제목';
        titleInput.value = link.title || '';
        titleInput.className = 'quick-link-title';

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.placeholder = '간단한 설명 (선택)';
        descInput.value = link.description || '';
        descInput.className = 'quick-link-description';

        const select = document.createElement('select');
        select.className = 'quick-link-target';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '연결할 문서 선택';
        select.appendChild(placeholder);
        InfrastructureData.getNavigation().forEach(section => {
            const group = document.createElement('optgroup');
            group.label = section.title;
            section.items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.key;
                option.textContent = `${item.title}`;
                group.appendChild(option);
            });
            select.appendChild(group);
        });
        select.value = link.key || '';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'ghost-btn danger mini';
        removeBtn.textContent = '삭제';
        removeBtn.addEventListener('click', () => {
            row.remove();
            if (!this.quickLinkEditor.querySelector('.quick-link-row')) {
                this.addQuickLinkEditorRow();
            }
        });

        row.appendChild(titleInput);
        row.appendChild(descInput);
        row.appendChild(select);
        row.appendChild(removeBtn);
        this.quickLinkEditor.appendChild(row);
    }

    collectQuickLinksFromEditor() {
        if (!this.quickLinkEditor) return [];
        return Array.from(this.quickLinkEditor.querySelectorAll('.quick-link-row')).map(row => {
            const title = row.querySelector('.quick-link-title')?.value.trim();
            const description = row.querySelector('.quick-link-description')?.value.trim();
            const key = row.querySelector('.quick-link-target')?.value.trim();
            return { title, description, key };
        }).filter(link => link.title && link.key);
    }

    saveQuickLinksFromEditor() {
        const links = this.collectQuickLinksFromEditor();
        if (!links.length) {
            this.showError('최소 한 개의 카드에 제목과 연결 문서를 입력하세요.');
            return;
        }
        InfrastructureData.updateQuickStartLinks(links);
        this.renderQuickLinks();
        this.showSuccess('빠른 시작 카드를 저장했습니다.');
    }

    resetQuickLinksToDefault() {
        InfrastructureData.resetQuickStartLinks();
        this.populateQuickLinkEditor();
        this.renderQuickLinks();
        this.showSuccess('빠른 시작 카드를 기본값으로 복구했습니다.');
    }

    resetLocalData() {
        if (!confirm('로컬에 저장된 모든 데이터를 삭제하고 초기 상태로 되돌릴까요?')) {
            return;
        }
        localStorage.removeItem(InfrastructureData.storageKey);
        location.reload();
    }

    setupAdminLockControls() {
        this.adminLockBtn?.addEventListener('click', () => {
            if (!this.adminConfig?.enabled) {
                this.showAdminModal('setup');
                return;
            }
            if (!this.isAdminUnlocked) {
                this.showAdminModal('unlock');
                return;
            }
            this.showAdminModal('manage');
        });

        this.adminSubmitBtn?.addEventListener('click', () => this.handleAdminSubmit());
        this.adminCancelBtn?.addEventListener('click', () => {
            this.pendingAdminAction = null;
            this.hideModal('admin-modal');
        });
        document.getElementById('close-admin')?.addEventListener('click', () => {
            this.pendingAdminAction = null;
            this.hideModal('admin-modal');
        });
        this.adminDisableBtn?.addEventListener('click', () => this.handleAdminDisable());
        this.adminRelockBtn?.addEventListener('click', () => {
            this.lockAdmin();
            this.hideModal('admin-modal');
        });
        this.adminChangeBtn?.addEventListener('click', () => {
            this.showAdminModal('change');
        });
    }

    refreshAdminState() {
        this.adminConfig = InfrastructureData.getAdminConfig();
        if (!this.adminConfig.enabled) {
            this.isAdminUnlocked = true;
        }
    }

    handleAuthContextChange(isAuthenticated, profile) {
        const nextCanEdit = Boolean(isAuthenticated && profile?.isAdmin);
        if (this.canEdit === nextCanEdit) {
            return;
        }
        this.canEdit = nextCanEdit;
        if (!this.canEdit) {
            this.isAdminUnlocked = false;
            this.pendingAdminAction = null;
            this.forceCloseEditModal();
            this.hideModal('settings-modal');
            this.hideModal('structure-modal');
            this.hideModal('manager-modal');
        }
        this.updateEditPermissions();
        this.refreshNavigationAccessState();
    }

    updateEditPermissions() {
        const readOnly = !this.canEdit;
        this.readOnlyMode = readOnly;
        const toggledButtons = [this.editButton, this.settingsBtn, this.addSectionButton];
        toggledButtons.forEach((button) => {
            if (!button) return;
            button.removeAttribute('disabled');
            button.setAttribute('aria-disabled', readOnly ? 'true' : 'false');
            button.setAttribute('data-readonly', readOnly ? 'true' : 'false');
            if (button === this.editButton) {
                button.title = readOnly ? '관리자 계정으로 로그인해야 편집할 수 있습니다.' : '';
            } else if (button === this.addSectionButton) {
                button.title = readOnly ? '관리자만 문서를 추가할 수 있습니다.' : '';
            } else if (button === this.settingsBtn) {
                button.title = readOnly ? '관리자 전용 설정입니다.' : '';
            }
        });
        if (this.viewOnlyBadge) {
            this.viewOnlyBadge.classList.toggle('active', readOnly);
        }
        if (this.adminLockBtn) {
            this.adminLockBtn.style.display = readOnly ? 'none' : '';
        }
        document.body?.classList.toggle('view-only-mode', readOnly);
    }

    updateAdminButton() {
        if (!this.adminLockBtn) return;
        this.adminLockBtn.classList.remove('setup', 'locked', 'unlocked');
        if (!this.adminConfig?.enabled) {
            this.adminLockBtn.textContent = '관리자 잠금 설정';
            this.adminLockBtn.classList.add('setup');
        } else if (this.isAdminUnlocked) {
            this.adminLockBtn.textContent = '관리자 보호 해제됨';
            this.adminLockBtn.classList.add('unlocked');
        } else {
            this.adminLockBtn.textContent = '관리자 잠금 해제';
            this.adminLockBtn.classList.add('locked');
        }
    }

    guardAdmin(action) {
        if (!this.canEdit) {
            this.showError('관리자 계정으로 로그인해야 편집할 수 있습니다.');
            return false;
        }
        if (!this.adminConfig?.enabled || this.isAdminUnlocked) {
            return true;
        }
        this.pendingAdminAction = action;
        this.showAdminModal('unlock');
        return false;
    }

    hasUnlockedAdminAccess() {
        if (!this.canEdit) {
            return false;
        }
        if (!this.adminConfig?.enabled) {
            return true;
        }
        return this.isAdminUnlocked;
    }

    refreshNavigationAccessState() {
        this.buildNavigation();
        if (!this.managerListElement) {
            return;
        }
        const keyword = this.managerSearchInput?.value || '';
        this.renderManagerList(keyword);
        this.refreshManagerSelectionState();
    }

    showAdminModal(mode = 'unlock') {
        if (!this.adminModal) return;
        this.adminModalMode = mode;
        this.adminModal.classList.add('active');
        this.updateAdminStatus('');

        const isSetup = mode === 'setup' || mode === 'change';
        const isUnlock = mode === 'unlock';
        const isManage = mode === 'manage';

        this.adminSetupPanel?.classList.toggle('active', isSetup);
        this.adminUnlockPanel?.classList.toggle('active', isUnlock);
        this.adminManagePanel?.classList.toggle('active', isManage);

        if (isSetup) {
            this.adminPassInput && (this.adminPassInput.value = '');
            this.adminPassConfirmInput && (this.adminPassConfirmInput.value = '');
        }
        if (isUnlock) {
            this.adminPassEntryInput && (this.adminPassEntryInput.value = '');
        }

        if (this.adminSubmitBtn) {
            this.adminSubmitBtn.textContent = isSetup
                ? (mode === 'change' ? '비밀번호 변경' : '비밀번호 저장')
                : '잠금 해제';
            this.adminSubmitBtn.style.display = isManage ? 'none' : 'inline-flex';
        }
        if (this.adminCancelBtn) {
            this.adminCancelBtn.style.display = isManage ? 'none' : 'inline-flex';
        }
        if (this.adminDisableBtn) {
            this.adminDisableBtn.style.display = (this.adminConfig?.enabled && this.isAdminUnlocked && !isSetup) ? 'inline-flex' : 'none';
        }
        if (this.adminActionGroup) {
            this.adminActionGroup.style.display = isManage ? 'none' : 'flex';
        }

        if (this.adminManagePanel) {
            this.adminManagePanel.querySelectorAll('button').forEach(btn => {
                btn.disabled = !this.adminConfig?.enabled;
            });
        }

        this.adminLockBtn?.classList.remove('pulse');
    }

    resetAdminModal() {
        if (!this.adminModal) return;
        this.adminModal.classList.remove('active');
        if (this.adminPassInput) this.adminPassInput.value = '';
        if (this.adminPassConfirmInput) this.adminPassConfirmInput.value = '';
        if (this.adminPassEntryInput) this.adminPassEntryInput.value = '';
        this.adminSetupPanel?.classList.remove('active');
        this.adminUnlockPanel?.classList.remove('active');
        this.adminManagePanel?.classList.remove('active');
        this.updateAdminStatus('');
        this.adminModalMode = this.adminConfig?.enabled ? 'unlock' : 'setup';
    }

    updateAdminStatus(message, type = 'neutral') {
        if (!this.adminStatusText) return;
        this.adminStatusText.textContent = message;
        this.adminStatusText.classList.remove('error', 'success');
        if (type === 'error') {
            this.adminStatusText.classList.add('error');
        } else if (type === 'success') {
            this.adminStatusText.classList.add('success');
        }
    }

    handleAdminSubmit() {
        if (this.adminModalMode === 'setup' || this.adminModalMode === 'change') {
            const pass = (this.adminPassInput?.value || '').trim();
            const confirm = (this.adminPassConfirmInput?.value || '').trim();
            if (pass.length < 4) {
                this.updateAdminStatus('비밀번호는 최소 4자 이상이어야 합니다.', 'error');
                return;
            }
            if (pass !== confirm) {
                this.updateAdminStatus('비밀번호 확인이 일치하지 않습니다.', 'error');
                return;
            }
            InfrastructureData.setAdminPasscode(pass);
            this.refreshAdminState();
            this.isAdminUnlocked = true;
            this.saveToStorage();
            this.updateAdminButton();
            this.refreshNavigationAccessState();
            this.hideModal('admin-modal');
            this.showSuccess(this.adminModalMode === 'change' ? '비밀번호를 변경했습니다.' : '관리자 잠금을 설정했습니다.');
            this.flushPendingAdminAction();
            return;
        }

        if (this.adminModalMode === 'unlock') {
            const pass = (this.adminPassEntryInput?.value || '').trim();
            if (!InfrastructureData.verifyAdminPasscode(pass)) {
                this.updateAdminStatus('비밀번호가 올바르지 않습니다.', 'error');
                return;
            }
            this.isAdminUnlocked = true;
            this.saveToStorage();
            this.updateAdminButton();
            this.refreshNavigationAccessState();
            this.hideModal('admin-modal');
            this.showSuccess('관리자 잠금을 해제했습니다.');
            this.flushPendingAdminAction();
        }
    }

    handleAdminDisable() {
        if (!this.adminConfig?.enabled) return;
        if (!this.isAdminUnlocked) {
            this.updateAdminStatus('잠금 해제 후 비활성화할 수 있습니다.', 'error');
            return;
        }
        if (!confirm('관리자 잠금을 완전히 비활성화할까요?')) {
            return;
        }
        InfrastructureData.clearAdminLock();
        this.refreshAdminState();
        this.isAdminUnlocked = true;
        this.saveToStorage();
        this.updateAdminButton();
        this.refreshNavigationAccessState();
        this.hideModal('admin-modal');
        this.showSuccess('관리자 잠금을 비활성화했습니다.');
        this.flushPendingAdminAction();
    }

    lockAdmin(showNotice = true) {
        if (!this.adminConfig?.enabled) return;
        this.isAdminUnlocked = false;
        this.pendingAdminAction = null;
        this.saveToStorage();
        this.updateAdminButton();
        this.refreshNavigationAccessState();
        if (showNotice) {
            this.showSuccess('관리자 잠금이 다시 활성화되었습니다.');
        }
    }

    flushPendingAdminAction() {
        const action = this.pendingAdminAction;
        this.pendingAdminAction = null;
        if (typeof action === 'function') {
            action();
        }
    }

    openManagerModal() {
        const open = () => {
            if (!this.managerModal) return;
            this.renderManagerList(this.managerSearchInput?.value || '');
            this.resetManagerDetail();
            this.managerModal.classList.add('active');
        };

        if (!this.adminConfig?.enabled) {
            this.pendingAdminAction = open;
            this.showAdminModal('setup');
            return;
        }

        if (!this.guardAdmin(open)) return;
        open();
    }

    renderManagerList(keyword = '') {
        if (!this.managerListElement) return;
        const search = keyword.trim().toLowerCase();
        const navData = InfrastructureData.getNavigation();

        this.managerListElement.innerHTML = '';

        navData.forEach((section, sectionIndex) => {
            const sectionMatches = section.title.toLowerCase().includes(search);
            const filteredItems = section.items.filter(item => {
                if (!search) return true;
                return item.title.toLowerCase().includes(search) || item.key.toLowerCase().includes(search);
            });

            if (!sectionMatches && search && !filteredItems.length) {
                return;
            }

            const card = document.createElement('div');
            card.className = 'manager-item';
            card.dataset.section = section.id;

            const top = document.createElement('div');
            top.className = 'manager-item-top';
            top.innerHTML = `
                <div>
                    <div class="manager-title">${sectionIndex + 1}. ${section.title}</div>
                    <div class="manager-key">${section.id} · 문서 ${section.items.length}개</div>
                </div>
            `;
            top.addEventListener('click', () => {
                this.selectManagerItem({ type: 'section', sectionId: section.id });
            });
            card.appendChild(top);

            if (filteredItems.length) {
                const children = document.createElement('div');
                children.className = 'manager-children';

                section.items.forEach((item, itemIndex) => {
                    if (search && !filteredItems.includes(item)) {
                        return;
                    }
                    const child = document.createElement('div');
                    child.className = 'manager-child';
                    child.dataset.content = item.key;
                    child.innerHTML = `
                        <div class="manager-child-title">${sectionIndex + 1}.${itemIndex + 1} ${item.title}</div>
                        <div class="manager-key">${item.key}</div>
                    `;
                    child.addEventListener('click', () => {
                        this.selectManagerItem({ type: 'content', key: item.key });
                    });
                    children.appendChild(child);
                });

                card.appendChild(children);
            }

            this.managerListElement.appendChild(card);
        });

        if (!this.managerListElement.children.length) {
            const empty = document.createElement('p');
            empty.className = 'manager-empty';
            empty.textContent = '검색 결과가 없습니다.';
            this.managerListElement.appendChild(empty);
        }

        this.applyManagerSelectionStyles();
    }

    applyManagerSelectionStyles() {
        if (!this.managerListElement) return;
        this.managerListElement.querySelectorAll('.manager-item').forEach(card => card.classList.remove('active'));
        this.managerListElement.querySelectorAll('.manager-child').forEach(child => child.classList.remove('active'));

        if (!this.managerSelection) return;

        if (this.managerSelection.type === 'section') {
            const sectionCard = this.managerListElement.querySelector(`.manager-item[data-section="${this.managerSelection.sectionId}"]`);
            sectionCard?.classList.add('active');
        } else if (this.managerSelection.type === 'content') {
            const contentRow = this.managerListElement.querySelector(`.manager-child[data-content="${this.managerSelection.key}"]`);
            contentRow?.classList.add('active');
            contentRow?.closest('.manager-item')?.classList.add('active');
        }
    }

    refreshManagerSelectionState() {
        if (!this.managerSelection) {
            return;
        }
        const selection = { ...this.managerSelection };
        this.selectManagerItem(selection);
        this.applyManagerSelectionStyles();
    }

    selectManagerItem(selection) {
        this.managerSelection = selection;

        if (!this.managerDetailTitle || !this.managerDetailPreview) {
            return;
        }

        if (selection.type === 'content') {
            const content = InfrastructureData.content[selection.key];
            if (!content) {
                this.resetManagerDetail();
                return;
            }
            this.managerDetailTitle.textContent = content.title;
            this.managerDetailHint.textContent = `콘텐츠 키: ${selection.key}`;
            this.managerDetailPreview.value = InfrastructureData.getPlainText(content);
            if (this.managerOpenBtn) {
                this.managerOpenBtn.textContent = '문서 열기';
                this.managerOpenBtn.disabled = false;
            }
            if (this.managerEditBtn) {
                this.managerEditBtn.textContent = '편집 모달 열기';
                this.managerEditBtn.disabled = false;
                this.managerEditBtn.title = '편집 모달 열기';
            }
            if (this.managerDeleteBtn) {
                this.managerDeleteBtn.textContent = '문서 삭제';
                this.managerDeleteBtn.disabled = false;
            }
        } else if (selection.type === 'section') {
            const section = InfrastructureData.findSectionById(selection.sectionId);
            if (!section) {
                this.resetManagerDetail();
                return;
            }
            this.managerDetailTitle.textContent = section.title;
            this.managerDetailHint.textContent = `문서 ${section.items.length}개가 연결되어 있습니다.`;
            this.managerDetailPreview.value = section.items.map((item, index) => `${index + 1}. ${item.title}`).join('\n') || '연결된 문서가 없습니다.';
            if (this.managerOpenBtn) {
                this.managerOpenBtn.textContent = '+ 문서 추가';
                this.managerOpenBtn.disabled = false;
            }
            if (this.managerEditBtn) {
                const renameAllowed = this.hasUnlockedAdminAccess();
                this.managerEditBtn.textContent = '이름 변경';
                this.managerEditBtn.disabled = !renameAllowed;
                this.managerEditBtn.title = renameAllowed ? '목차 이름 변경' : '관리자만 목차 이름을 변경할 수 있습니다.';
            }
            if (this.managerDeleteBtn) {
                this.managerDeleteBtn.textContent = '목차 삭제';
                this.managerDeleteBtn.disabled = false;
            }
        }

        this.applyManagerSelectionStyles();
    }

    resetManagerDetail() {
        this.managerSelection = null;
        if (this.managerDetailTitle) {
            this.managerDetailTitle.textContent = '섹션을 선택하세요';
        }
        if (this.managerDetailHint) {
            this.managerDetailHint.textContent = '좌측 목록에서 항목을 선택하면 미리보기와 빠른 작업을 사용할 수 있습니다.';
        }
        if (this.managerDetailPreview) {
            this.managerDetailPreview.value = '';
        }
        if (this.managerOpenBtn) {
            this.managerOpenBtn.textContent = '문서 열기';
            this.managerOpenBtn.disabled = true;
        }
        if (this.managerEditBtn) {
            this.managerEditBtn.textContent = '편집 모달 열기';
            this.managerEditBtn.disabled = true;
            this.managerEditBtn.title = '';
        }
        if (this.managerDeleteBtn) {
            this.managerDeleteBtn.textContent = '선택 삭제';
            this.managerDeleteBtn.disabled = true;
        }
        this.applyManagerSelectionStyles();
    }

    renameSectionPrompt(sectionId) {
        const perform = () => {
            const section = InfrastructureData.findSectionById(sectionId);
            if (!section) {
                this.showError('목차를 찾을 수 없습니다.');
                return;
            }
            const newTitle = prompt('새 목차 이름을 입력하세요.', section.title);
            if (!newTitle) {
                return;
            }
            InfrastructureData.renameNavigationSection(sectionId, newTitle.trim());
            this.saveToStorage();
            this.buildNavigation();
            this.renderManagerList(this.managerSearchInput?.value || '');
            this.showSuccess('목차 이름이 변경되었습니다.');
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    renameContentPrompt(contentKey) {
        const perform = () => {
            const content = InfrastructureData.content[contentKey];
            const match = InfrastructureData.findSectionByContentKey(contentKey);
            if (!content || !match) {
                this.showError('문서를 찾을 수 없습니다.');
                return;
            }
            const currentTitle = match.section.items[match.itemIndex]?.title || content.title;
            const newTitle = prompt('새 문서 이름을 입력하세요.', currentTitle);
            if (!newTitle) {
                return;
            }
            const trimmed = newTitle.trim();
            if (!trimmed) {
                this.showError('문서 이름을 입력해야 합니다.');
                return;
            }
            InfrastructureData.renameNavigationItem(contentKey, trimmed);
            InfrastructureData.updateContentTitle(contentKey, trimmed);
            this.saveToStorage();
            this.refreshNavigationAccessState();
            if (this.currentContent === contentKey) {
                this.updateBreadcrumb(trimmed);
            }
            this.showSuccess('문서 이름이 변경되었습니다.');
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    deleteContentEntry(contentKey) {
        const perform = () => {
            if (!contentKey) return;
            if (!confirm('이 문서를 삭제하시겠습니까?')) {
                return;
            }
            if (InfrastructureData.deleteContent(contentKey)) {
                if (this.currentContent === contentKey) {
                    this.showWelcomeScreen();
                }
                this.saveToStorage();
                this.buildNavigation();
                this.renderManagerList(this.managerSearchInput?.value || '');
                this.resetManagerDetail();
                this.showSuccess('문서를 삭제했습니다.');
            } else {
                this.showError('문서를 삭제할 수 없습니다.');
            }
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    quickEditContent(contentKey) {
        const perform = () => {
            if (!contentKey) return;
            this.loadContent(contentKey);
            this.showEditModal();
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    deleteSection(sectionId) {
        const perform = () => {
            const section = InfrastructureData.findSectionById(sectionId);
            if (!section) {
                this.showError('목차를 찾을 수 없습니다.');
                return;
            }
            const message = section.items.length
                ? `"${section.title}" 목차와 연결된 ${section.items.length}개 문서를 모두 삭제할까요?`
                : `"${section.title}" 목차를 삭제할까요?`;
            if (!confirm(message)) {
                return;
            }
            InfrastructureData.deleteNavigationSection(sectionId, { deleteContent: true });
            if (this.currentContent && !InfrastructureData.content[this.currentContent]) {
                this.showWelcomeScreen();
            }
            this.saveToStorage();
            this.buildNavigation();
            this.renderManagerList(this.managerSearchInput?.value || '');
            this.resetManagerDetail();
            this.showSuccess('목차를 삭제했습니다.');
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    showStructureModal(sectionId = '') {
        const open = () => {
            if (!this.structureModal) return;
            this.populateStructureParentOptions(sectionId);
            if (this.structureSectionInput) {
                this.structureSectionInput.value = '';
            }
            if (this.structureContentInput) {
                this.structureContentInput.value = '';
                this.structureContentInput.focus();
            }
            this.structureModal.classList.add('active');
        };

        if (!this.guardAdmin(open)) return;
        open();
    }

    populateStructureParentOptions(selectedId = '') {
        if (!this.structureParentSelect) return;
        const navData = InfrastructureData.getNavigation();
        this.structureParentSelect.innerHTML = '<option value="">+ 새 상위 목차 만들기</option>';
        navData.forEach(section => {
            const option = document.createElement('option');
            option.value = section.id;
            option.textContent = section.title;
            this.structureParentSelect.appendChild(option);
        });
        this.structureParentSelect.value = selectedId || '';
        this.toggleStructureNewSection();
    }

    toggleStructureNewSection() {
        if (!this.structureNewSectionField || !this.structureParentSelect) return;
        const value = this.structureParentSelect.value;
        this.structureNewSectionField.style.display = value ? 'none' : 'block';
    }

    handleStructureSave() {
        const perform = () => {
            if (!this.structureContentInput) return;
            const parentId = this.structureParentSelect?.value || '';
            const needsNewSection = !parentId;
            const sectionTitle = needsNewSection ? (this.structureSectionInput?.value.trim() || '') : '';
            const contentTitle = (this.structureContentInput?.value.trim() || '');

            if (!contentTitle) {
                this.showError('문서 제목을 입력하세요.');
                return;
            }

            let targetSectionId = parentId;
            if (needsNewSection) {
                if (!sectionTitle) {
                    this.showError('새 목차 이름을 입력하세요.');
                    return;
                }
                const newSection = InfrastructureData.addNavigationSection(sectionTitle);
                targetSectionId = newSection.id;
            }

            const key = this.generateKey(contentTitle);
            const template = `<h1>${contentTitle}</h1><p>여기에 문서 내용을 작성하세요.</p>`;
            InfrastructureData.addContent(key, contentTitle, template, 'html');
            InfrastructureData.addNavigationItem(targetSectionId, contentTitle, key);
            this.saveToStorage();
            this.buildNavigation();
            this.renderManagerList(this.managerSearchInput?.value || '');
            this.hideModal('structure-modal');
            this.showSuccess('새 문서를 추가했습니다.');
            this.loadContent(key);
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    buildPasteBundle(htmlData, plainData, imagePayloads = []) {
        const pasteRules = InfrastructureData.getPasteRules();
        const payloadQueue = Array.isArray(imagePayloads) ? [...imagePayloads] : [];
        const bundle = {
            originalHtml: htmlData || '',
            originalText: plainData || '',
            cleanedHtml: '',
            plainHtml: '',
            tableHtml: '',
            tables: [],
            tableMeta: [],
            summary: null,
            defaultMode: pasteRules.defaultMode || 'clean',
            imageCount: payloadQueue.length || 0
        };

        let workingHtml = htmlData || '';
        if (!workingHtml && !plainData && payloadQueue.length > 1) {
            const prioritized = this.prioritizeClipboardPayloads(payloadQueue);
            payloadQueue.length = 0;
            Array.prototype.push.apply(payloadQueue, prioritized);
            bundle.imageCount = payloadQueue.length;
        }

        if (workingHtml && payloadQueue.length) {
            const merged = this.mergeClipboardImagesIntoHtml(workingHtml, payloadQueue);
            workingHtml = merged.html || workingHtml;
        } else if (!workingHtml && payloadQueue.length) {
            const textHtml = plainData ? this.plainTextToHtml(plainData) : '';
            const imageHtml = this.composeImageHtmlFromPayloads(payloadQueue);
            workingHtml = `${textHtml}${imageHtml}` || imageHtml;
        }
        if (workingHtml) {
            bundle.originalHtml = workingHtml;
            if (InfrastructureData.isLikelyOfficeHtml(workingHtml)) {
                const normalized = InfrastructureData.normalizeOfficeFragment(workingHtml);
                bundle.cleanedHtml = normalized.html;
                bundle.summary = normalized.summary;
            } else {
                bundle.cleanedHtml = InfrastructureData.cleanHtml(workingHtml);
            }
            bundle.tables = this.extractTablesFromHtml(workingHtml);
        }

        if (pasteRules.autoTableFromTabs && !bundle.tables.length && plainData && this.looksLikeTabularText(plainData)) {
            bundle.tables = [this.convertExcelToTableHtml(plainData, true)].filter(Boolean);
        }

        if (bundle.tables.length) {
            bundle.tableMeta = bundle.tables.map((table) => this.describeTableHtml(table));
            bundle.tableHtml = this.composeTableHtml(bundle.tables);
        }

        if (plainData) {
            bundle.plainHtml = this.plainTextToHtml(plainData);
        }

        if (bundle.summary) {
            bundle.summary.tables = bundle.tables.length;
            if (typeof bundle.summary.convertedDividers === 'undefined') {
                bundle.summary.convertedDividers = 0;
            }
        } else {
            bundle.summary = {
                removedTags: 0,
                removedStyles: 0,
                keptStyles: 0,
                tables: bundle.tables.length,
                mappedStyles: [],
                convertedDividers: 0
            };
        }

        bundle.defaultHtml = bundle.cleanedHtml
            || bundle.tableHtml
            || bundle.plainHtml
            || InfrastructureData.cleanHtml(bundle.originalHtml || bundle.originalText);

        return bundle;
    }

    composeImageHtmlFromPayloads(payloads = []) {
        if (!payloads.length) {
            return '';
        }
        return payloads
            .filter((payload) => payload?.src)
            .map((payload) => `
                <figure class="editor-image layout-inline">
                    <img src="${payload.src}" alt="${this.escapeHtml(payload.name || 'clipboard-image')}" style="max-width:100%;height:auto;">
                </figure>
            `)
            .join('<p></p>');
    }

    prioritizeClipboardPayloads(payloads = []) {
        if (!payloads.length) {
            return [];
        }
        const preferredOrder = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];
        const score = (type = '') => {
            const normalized = type.toLowerCase();
            const index = preferredOrder.indexOf(normalized);
            return index === -1 ? preferredOrder.length : index;
        };
        const sorted = [...payloads].sort((a, b) => score(a?.type) - score(b?.type));
        return sorted.slice(0, 1);
    }

    mergeClipboardImagesIntoHtml(html, imagePayloads = []) {
        if (!html || !imagePayloads?.length) {
            return { html, replacements: 0 };
        }
        try {
            const template = document.createElement('template');
            template.innerHTML = html;
            this.unwrapWordShapeImages(template.content);
            this.removeDuplicatePlaceholderImages(template.content);
            const replacements = this.applyClipboardPayloadToImages(template.content, imagePayloads);
            return {
                html: template.innerHTML,
                replacements
            };
        } catch (error) {
            console.warn('클립보드 이미지 병합 실패:', error);
            return { html, replacements: 0 };
        }
    }

    unwrapWordShapeImages(root) {
        if (!root) {
            return;
        }
        const selectors = ['v\\:shape', 'o\\:shape', 'shape'];
        const shapeIds = new Set();
        const normalizeId = (value) => (value || '').trim().toLowerCase();
        root.querySelectorAll(selectors.join(',')).forEach((shape) => {
            const imagedata = shape.querySelector('v\\:imagedata, o\\:imagedata, imagedata');
            if (!imagedata) {
                return;
            }
            const img = document.createElement('img');
            const shapeIdRaw = shape.getAttribute('id') || shape.getAttribute('o:id') || shape.getAttribute('name');
            const normalizedId = normalizeId(shapeIdRaw);
            if (normalizedId) {
                img.setAttribute('data-word-shape-id', shapeIdRaw || normalizedId);
                shapeIds.add(normalizedId);
            }
            const source = imagedata.getAttribute('src')
                || imagedata.getAttribute('o:href')
                || imagedata.getAttribute('href')
                || '';
            if (source) {
                img.setAttribute('src', source);
            }
            const title = imagedata.getAttribute('o:title') || imagedata.getAttribute('title');
            if (title) {
                img.setAttribute('alt', title);
            }
            const style = shape.getAttribute('style');
            if (style) {
                img.setAttribute('style', style);
            } else {
                const width = shape.getAttribute('width');
                const height = shape.getAttribute('height');
                if (width) {
                    img.style.width = width;
                }
                if (height) {
                    img.style.height = height;
                }
            }
            if (typeof InfrastructureData !== 'undefined'
                && typeof InfrastructureData.captureWordImageDimensions === 'function') {
                InfrastructureData.captureWordImageDimensions(img, style || '');
            }
            shape.replaceWith(img);
        });
        if (!shapeIds.size) {
            return;
        }
        const fallbackSelectors = ['img[v\\:shapes]', 'img[o\\:shapes]', 'img[shapes]'];
        root.querySelectorAll(fallbackSelectors.join(',')).forEach((img) => {
            const rawRefs = img.getAttribute('v:shapes')
                || img.getAttribute('o:shapes')
                || img.getAttribute('shapes')
                || '';
            if (!rawRefs) {
                return;
            }
            const references = rawRefs
                .split(/[\s,;]+/)
                .map((value) => normalizeId(value))
                .filter(Boolean);
            if (!references.length) {
                return;
            }
            const hasMatch = references.some((reference) => shapeIds.has(reference));
            if (hasMatch) {
                img.remove();
            }
        });
    }

    removeDuplicatePlaceholderImages(root) {
        if (!root) {
            return;
        }
        const seen = new Set();
        root.querySelectorAll('img').forEach((img) => {
            const src = (img.getAttribute('src') || '').trim();
            if (!src) {
                return;
            }
            if (!this.shouldReplaceImageSource(src)) {
                return;
            }
            const normalized = src.toLowerCase();
            if (seen.has(normalized)) {
                img.remove();
                return;
            }
            seen.add(normalized);
        });
    }

    removeSequentialDuplicateImages(root) {
        if (!root) {
            return;
        }
        const imageSignatures = new WeakMap();
        const hashContent = (node) => {
            if (!node) {
                return '';
            }
            const clone = node.cloneNode(true);
            const sanitizeAttributes = (el) => {
                if (!el || el.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }
                el.removeAttribute('data-word-width');
                el.removeAttribute('data-word-height');
                el.removeAttribute('style');
                Array.from(el.childNodes).forEach((child) => sanitizeAttributes(child));
            };
            sanitizeAttributes(clone);
            return clone.outerHTML || clone.textContent || '';
        };
        const getImageSignature = (node) => {
            if (!node) {
                return '';
            }
            if (imageSignatures.has(node)) {
                return imageSignatures.get(node);
            }
            const key = hashContent(node);
            imageSignatures.set(node, key);
            return key;
        };
        const isWhitespaceNode = (node) => node?.nodeType === Node.TEXT_NODE && !node.textContent.trim();
        const isIgnorableElement = (node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            if (node.matches('br')) {
                return true;
            }
            if (!node.matches('p,div,span')) {
                return false;
            }
            if (node.querySelector('img, figure, video, table, canvas, svg')) {
                return false;
            }
            return !node.textContent.trim();
        };
        const resolveImageElement = (node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                return null;
            }
            if (typeof node.matches === 'function' && node.matches('figure.editor-image')) {
                return node.querySelector('img');
            }
            if (node.tagName === 'IMG') {
                return node;
            }
            return null;
        };
        const traverseContainer = (container) => {
            let child = container.firstChild;
            let lastImageInfo = null;
            while (child) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const imageElement = resolveImageElement(child);
                    if (imageElement) {
                        const src = imageElement.getAttribute('src') || '';
                        const signature = `${src}::${getImageSignature(imageElement)}`;
                        if (signature && lastImageInfo && lastImageInfo.signature === signature) {
                            const next = child.nextSibling;
                            child.remove();
                            child = next;
                            continue;
                        }
                        lastImageInfo = signature ? { node: child, signature } : null;
                    } else if (isIgnorableElement(child)) {
                        const next = child.nextSibling;
                        child.remove();
                        child = next;
                        continue;
                    } else {
                        this.removeSequentialDuplicateImages(child);
                        lastImageInfo = null;
                    }
                } else if (child.nodeType === Node.TEXT_NODE) {
                    if (isWhitespaceNode(child)) {
                        const next = child.nextSibling;
                        child.remove();
                        child = next;
                        continue;
                    } else {
                        lastImageInfo = null;
                    }
                } else {
                    lastImageInfo = null;
                }
                child = child.nextSibling;
            }
        };
        if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE
            || root.nodeType === Node.DOCUMENT_NODE
            || root.nodeType === Node.ELEMENT_NODE) {
            traverseContainer(root);
        }
    }

    applyClipboardPayloadToImages(root, payloads = []) {
        if (!root || !payloads.length) {
            return 0;
        }
        const queue = payloads.filter((payload) => payload?.src);
        if (!queue.length) {
            return 0;
        }
        let cursor = 0;
        let replaced = 0;
        root.querySelectorAll('img').forEach((img) => {
            if (cursor >= queue.length) {
                return;
            }
            const src = img.getAttribute('src') || '';
            if (!this.shouldReplaceImageSource(src)) {
                return;
            }
            const payload = queue[cursor];
            cursor += 1;
            img.setAttribute('src', payload.src);
            if (!img.getAttribute('alt') && payload.name) {
                img.setAttribute('alt', payload.name);
            }
            replaced += 1;
        });
        return replaced;
    }

    shouldReplaceImageSource(src) {
        if (!src) {
            return true;
        }
        const normalized = src.trim().toLowerCase();
        if (!normalized) {
            return true;
        }
        if (normalized.startsWith('data:') || normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('blob:')) {
            return false;
        }
        if (normalized.startsWith('file:') || normalized.startsWith('mhtml:') || normalized.startsWith('cid:') || normalized.startsWith('about:') || normalized.startsWith('wordml:')) {
            return true;
        }
        if (normalized.includes('msohtmlclip') || normalized.includes('wordmedia') || normalized.includes('oleobject')) {
            return true;
        }
        if (!normalized.includes('://')) {
            return true;
        }
        return false;
    }

    extractTablesFromHtml(html) {
        if (!html) return [];
        try {
            const template = document.createElement('template');
            template.innerHTML = html;
            return Array.from(template.content.querySelectorAll('table')).map(table => InfrastructureData.cleanHtml(table.outerHTML));
        } catch (error) {
            console.warn('테이블 추출 실패:', error);
            return [];
        }
    }

    describeTableHtml(tableHtml) {
        if (!tableHtml) {
            return { rows: 0, cols: 0, sample: '' };
        }
        try {
            const template = document.createElement('template');
            template.innerHTML = tableHtml;
            const table = template.content.querySelector('table');
            if (!table) {
                return { rows: 0, cols: 0, sample: '' };
            }
            const rows = table.querySelectorAll('tr').length;
            let cols = 0;
            table.querySelectorAll('tr').forEach(tr => {
                cols = Math.max(cols, tr.children.length);
            });
            const sample = (table.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
            return { rows, cols, sample };
        } catch (error) {
            console.warn('표 요약 실패:', error);
            return { rows: 0, cols: 0, sample: '' };
        }
    }

    composeTableHtml(tables, indexes = []) {
        if (!tables?.length) return '';
        return tables
            .map((tableHtml, idx) => {
                const tableIndex = indexes[idx] != null ? (indexes[idx] + 1) : (idx + 1);
                return `<figure class="pasted-table" data-table="${tableIndex}">${tableHtml}</figure>`;
            })
            .join('<p></p>');
    }

    plainTextToHtml(text) {
        if (!text) return '';
        const normalized = text.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        const blocks = [];
        let buffer = [];

        const isDividerLine = (value) => /^[_\-\u2014\s]{5,}$/.test(value);
        const startsNewBlock = (value) => {
            if (isDividerLine(value)) {
                return true;
            }
            return /^(\d+[\.\)]|[a-zA-Z][\.\)]|[ivxlcdm]+\.|[\u2022\u00b7\u25cf\u25cb\u25a0\-\*])\s*/i.test(value);
        };

        const flush = () => {
            if (!buffer.length) {
                return;
            }
            blocks.push(buffer.join('\n').trim());
            buffer = [];
        };

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                flush();
                return;
            }
            if (startsNewBlock(trimmed) && buffer.length) {
                flush();
            }
            buffer.push(trimmed);
        });
        flush();

        if (!blocks.length) {
            return `<p>${this.escapeHtml(normalized)}</p>`;
        }

        return blocks.map((block) => {
            if (isDividerLine(block)) {
                return '<hr class="editor-divider" data-divider="neutral" data-source="plain-text">';
            }
            return `<p>${this.escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
        }).join('');
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    formatRelativeTime(value) {
        if (!value) {
            return '';
        }
        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) {
            return '';
        }
        const diffMs = Date.now() - timestamp;
        if (diffMs < 60000) {
            return '방금 전';
        }
        const minutes = Math.round(diffMs / 60000);
        if (minutes < 60) {
            return `${minutes}분 전`;
        }
        const hours = Math.round(diffMs / 3600000);
        if (hours < 24) {
            return `${hours}시간 전`;
        }
        const days = Math.round(diffMs / 86400000);
        if (days < 30) {
            return `${days}일 전`;
        }
        const date = new Date(timestamp);
        return date.toLocaleDateString('ko-KR');
    }

    stripHtml(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    showPastePreview(bundle) {
        if (!this.pastePreviewPanel) return;
        this.pastePreviewPanel.classList.remove('hidden');
        this.editorLayoutElement?.classList.add('has-paste-preview');

        if (this.pastePreviewOriginal) {
            if (bundle.originalHtml) {
                this.pastePreviewOriginal.innerHTML = InfrastructureData.cleanHtml(bundle.originalHtml);
                this.pastePreviewOriginal.classList.remove('empty');
            } else if (bundle.originalText) {
                this.pastePreviewOriginal.textContent = bundle.originalText;
                this.pastePreviewOriginal.classList.remove('empty');
            } else {
                this.pastePreviewOriginal.textContent = '클립보드 원본';
                this.pastePreviewOriginal.classList.add('empty');
            }
        }

        const initialMode = this.setPreviewModeOptions(bundle);
        this.updatePreviewResult(initialMode);
        this.updatePasteSummary(bundle);
        this.renderTableControls(bundle);

        if (this.pasteCopyHtmlBtn) {
            this.pasteCopyHtmlBtn.disabled = false;
        }
        if (this.pasteCopyTextBtn) {
            this.pasteCopyTextBtn.disabled = !(bundle.originalText || bundle.originalHtml);
        }
    }

    clearPastePreview() {
        if (!this.pastePreviewPanel) return;
        this.pastePreviewPanel.classList.add('hidden');
        this.editorLayoutElement?.classList.remove('has-paste-preview');
        if (this.pastePreviewOriginal) {
            this.pastePreviewOriginal.textContent = '클립보드 원본';
            this.pastePreviewOriginal.classList.add('empty');
        }
        if (this.pastePreviewResult) {
            this.pastePreviewResult.textContent = '정리된 결과';
            this.pastePreviewResult.classList.add('empty');
        }
        if (this.pastePreviewSummary) {
            this.pastePreviewSummary.textContent = '클립보드 데이터를 붙여넣으면 비교가 표시됩니다.';
        }
        if (this.pasteCopyHtmlBtn) this.pasteCopyHtmlBtn.disabled = true;
        if (this.pasteCopyTextBtn) this.pasteCopyTextBtn.disabled = true;
        if (this.pastePreviewModeSelect) {
            this.pastePreviewModeSelect.disabled = true;
        }
        if (this.pasteInsertPreviewBtn) {
            this.pasteInsertPreviewBtn.disabled = true;
        }
        this.resetTableControls();
    }

    resetTableControls() {
        this.selectedTableIndexes = new Set();
        this.tablePreviewFocus = null;
        if (this.pasteTableList) {
            this.pasteTableList.innerHTML = '';
        }
        this.pasteTableControls?.classList.add('hidden');
        this.updateTableActionButtons();
        this.updateTablePreviewButtons();
    }

    renderTableControls(bundle) {
        if (!this.pasteTableControls) return;
        if (!bundle?.tables?.length) {
            this.resetTableControls();
            return;
        }
        this.pasteTableControls.classList.remove('hidden');
        this.selectedTableIndexes = new Set(bundle.tables.map((_, index) => index));
        this.tablePreviewFocus = null;
        if (this.pasteTableList) {
            this.pasteTableList.innerHTML = '';
            bundle.tables.forEach((tableHtml, index) => {
                const meta = bundle.tableMeta?.[index] || {};
                const detailParts = [];
                if (meta.rows || meta.cols) {
                    detailParts.push(`${meta.rows || '?'}행 × ${meta.cols || '?'}열`);
                }
                if (meta.sample) {
                    detailParts.push(meta.sample);
                }
                const detailText = detailParts.join(' · ') || '표 구조를 분석했습니다.';
                const row = document.createElement('div');
                row.className = 'table-chip';
                row.dataset.index = index;
                row.innerHTML = `
                    <label>
                        <input type="checkbox" data-table-select="${index}" checked>
                        <span>
                            <strong>표 ${index + 1}</strong>
                            <span class="table-chip-details">${detailText}</span>
                        </span>
                    </label>
                    <div class="table-chip-actions">
                        <button type="button" class="ghost-btn mini" data-table-preview="${index}">보기</button>
                    </div>
                `;
                this.pasteTableList.appendChild(row);
            });
        }
        this.updateTableActionButtons();
        this.updateTablePreviewButtons();
    }

    updateTableActionButtons() {
        const hasSelection = (this.selectedTableIndexes?.size || 0) > 0;
        if (this.pasteInsertSelectedBtn) {
            this.pasteInsertSelectedBtn.disabled = !hasSelection;
        }
        if (this.pasteCopySelectedBtn) {
            this.pasteCopySelectedBtn.disabled = !hasSelection;
        }
    }

    selectAllTables() {
        if (!this.lastPasteBundle?.tables?.length) return;
        this.selectedTableIndexes = new Set(this.lastPasteBundle.tables.map((_, index) => index));
        this.pasteTableList?.querySelectorAll('[data-table-select]').forEach(input => {
            if (input instanceof HTMLInputElement) {
                input.checked = true;
            }
        });
        this.updateTableActionButtons();
        if ((this.pastePreviewModeSelect?.value || 'clean') === 'table' && this.tablePreviewFocus === null) {
            this.updatePreviewResult('table');
        }
    }

    clearTableSelection() {
        this.selectedTableIndexes.clear();
        this.pasteTableList?.querySelectorAll('[data-table-select]').forEach(input => {
            if (input instanceof HTMLInputElement) {
                input.checked = false;
            }
        });
        this.resetTablePreviewFocus();
        this.updateTableActionButtons();
        if ((this.pastePreviewModeSelect?.value || 'clean') === 'table') {
            this.updatePreviewResult('table');
        }
    }

    getSelectedTableIndexes(bundle) {
        if (!bundle?.tables?.length) return [];
        if (!this.selectedTableIndexes) {
            return bundle.tables.map((_, index) => index);
        }
        if (!this.selectedTableIndexes.size) {
            return [];
        }
        return Array.from(this.selectedTableIndexes).sort((a, b) => a - b).filter(index => bundle.tables[index]);
    }

    resolveSelectedTablesHtml(bundle) {
        if (!bundle?.tables?.length) return '';
        const indexes = this.getSelectedTableIndexes(bundle);
        if (!indexes.length) {
            return '';
        }
        const tables = indexes.map(index => bundle.tables[index]).filter(Boolean);
        return this.composeTableHtml(tables, indexes);
    }

    previewTable(index) {
        if (!this.lastPasteBundle?.tables?.[index]) return;
        this.tablePreviewFocus = index;
        this.updateTablePreviewButtons();
        this.pastePreviewModeSelect && (this.pastePreviewModeSelect.value = 'table');
        this.updatePreviewResult('table');
    }

    resetTablePreviewFocus(forceUpdate = false) {
        this.tablePreviewFocus = null;
        this.updateTablePreviewButtons();
        if (forceUpdate && (this.pastePreviewModeSelect?.value || 'clean') === 'table') {
            this.updatePreviewResult('table');
        }
    }

    updateTablePreviewButtons() {
        if (!this.pasteTableList) return;
        this.pasteTableList.querySelectorAll('.table-chip').forEach(chip => {
            if (!(chip instanceof HTMLElement)) return;
            const index = Number(chip.dataset.index);
            chip.classList.toggle('active', this.tablePreviewFocus === index);
        });
    }

    insertSelectedTables() {
        if (!this.lastPasteBundle) return;
        const html = this.resolveSelectedTablesHtml(this.lastPasteBundle);
        if (!html) {
            this.showError('선택된 표가 없습니다.');
            return;
        }
        this.insertPasteHtml(html);
        this.dismissPasteOverlay(true);
        this.showSuccess('선택한 표를 삽입했습니다.');
    }

    copySelectedTables() {
        if (!this.lastPasteBundle) return;
        const html = this.resolveSelectedTablesHtml(this.lastPasteBundle);
        if (!html) {
            this.showError('복사할 표가 없습니다.');
            return;
        }
        this.copyToClipboard(html).then(() => this.showSuccess('선택한 표 HTML을 복사했습니다.'));
    }

    insertPreviewResult() {
        if (!this.lastPasteBundle) {
            this.showError('붙여넣을 데이터가 없습니다.');
            return;
        }
        const mode = this.pastePreviewModeSelect?.value || 'clean';
        let html = this.resolvePasteHtmlByMode(mode);
        if (mode === 'table' && this.tablePreviewFocus !== null && this.lastPasteBundle.tables?.[this.tablePreviewFocus]) {
            html = this.lastPasteBundle.tables[this.tablePreviewFocus];
        }
        if (!html) {
            this.showError('삽입할 데이터가 없습니다.');
            return;
        }
        this.insertPasteHtml(html);
        this.dismissPasteOverlay(true);
        this.showSuccess('미리보기 결과를 삽입했습니다.');
    }

    handlePreviewDrag(event) {
        if (!event?.dataTransfer || !this.lastPasteBundle) {
            event?.preventDefault();
            return;
        }
        const mode = this.pastePreviewModeSelect?.value || 'clean';
        let html = this.resolvePasteHtmlByMode(mode);
        if (mode === 'table' && this.tablePreviewFocus !== null && this.lastPasteBundle.tables?.[this.tablePreviewFocus]) {
            html = this.lastPasteBundle.tables[this.tablePreviewFocus];
        }
        if (!html) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.setData('text/html', html);
        const plain = this.stripHtml(html) || this.lastPasteBundle.originalText || '';
        event.dataTransfer.setData('text/plain', plain);
    }

    refreshActivePasteBundle() {
        if (!this.lastPasteBundle) return;
        const rebuilt = this.buildPasteBundle(this.lastPasteBundle.originalHtml, this.lastPasteBundle.originalText);
        this.lastPasteBundle = rebuilt;
        this.showPastePreview(rebuilt);
        if (this.pastePopover?.classList.contains('active')) {
            this.showPastePopover(rebuilt);
        }
    }

    setPreviewModeOptions(bundle) {
        if (!this.pastePreviewModeSelect) return 'clean';
        const availability = {
            clean: !!bundle.cleanedHtml,
            plain: !!bundle.plainHtml,
            table: !!bundle.tableHtml,
            original: !!bundle.originalHtml
        };
        Array.from(this.pastePreviewModeSelect.options).forEach(option => {
            option.disabled = !availability[option.value];
        });
        const rules = InfrastructureData.getPasteRules();
        const preferenceOrder = [rules.defaultMode || 'clean', 'clean', 'table', 'plain', 'original'];
        const selected = preferenceOrder.find(mode => availability[mode]) || 'clean';
        this.pastePreviewModeSelect.value = selected;
        this.pastePreviewModeSelect.disabled = !Object.values(availability).some(Boolean);
        return selected;
    }

    updatePreviewResult(mode) {
        if (!this.pastePreviewResult) return;
        if (mode !== 'table' && this.tablePreviewFocus !== null) {
            this.tablePreviewFocus = null;
            this.updateTablePreviewButtons();
        }
        let html = this.resolvePasteHtmlByMode(mode);
        if (mode === 'table' && this.tablePreviewFocus !== null && this.lastPasteBundle?.tables?.[this.tablePreviewFocus]) {
            html = this.lastPasteBundle.tables[this.tablePreviewFocus];
        }
        if (html) {
            this.pastePreviewResult.innerHTML = html;
            this.pastePreviewResult.classList.remove('empty');
            if (this.pasteInsertPreviewBtn) {
                this.pasteInsertPreviewBtn.disabled = false;
            }
        } else {
            this.pastePreviewResult.textContent = '선택한 모드에 사용할 데이터가 없습니다.';
            this.pastePreviewResult.classList.add('empty');
            if (this.pasteInsertPreviewBtn) {
                this.pasteInsertPreviewBtn.disabled = true;
            }
        }
    }

    resolvePasteHtmlByMode(mode) {
        if (!this.lastPasteBundle) return '';
        const bundle = this.lastPasteBundle;
        switch (mode) {
            case 'plain':
                return bundle.plainHtml || this.plainTextToHtml(bundle.originalText);
            case 'table':
                {
                    const selected = this.resolveSelectedTablesHtml(bundle);
                    return selected || bundle.tableHtml || this.convertExcelToTableHtml(bundle.originalText, true);
                }
            case 'original':
                if (bundle.originalHtml) {
                    return InfrastructureData.cleanHtml(bundle.originalHtml);
                }
                return this.plainTextToHtml(bundle.originalText);
            case 'clean':
            default:
                return bundle.cleanedHtml || bundle.defaultHtml;
        }
    }

    resolveAutoPasteHtml(bundle) {
        if (!bundle) {
            return '';
        }
        const cleanedOriginal = bundle.originalHtml
            ? InfrastructureData.cleanHtml(bundle.originalHtml)
            : '';
        const cleanedHtml = bundle.cleanedHtml || '';
        const hasImages = /<img\b/i.test(cleanedOriginal || cleanedHtml || '');
        if (hasImages) {
            return cleanedOriginal || cleanedHtml || bundle.defaultHtml;
        }
        if (cleanedHtml) {
            return cleanedHtml;
        }
        if (bundle.tables?.length) {
            return bundle.tableHtml || this.composeTableHtml(bundle.tables);
        }
        if (bundle.defaultHtml) {
            return bundle.defaultHtml;
        }
        if (bundle.plainHtml) {
            return bundle.plainHtml;
        }
        return this.plainTextToHtml(bundle.originalText || '');
    }

    normalizeEditorImages(root = null) {
        const scope = root || this.editRichArea;
        if (!scope) {
            return;
        }
        const images = scope.querySelectorAll('img');
        images.forEach((image) => {
            const wrapper = image.closest('.editor-image');
            if (wrapper) {
                this.ensureResponsiveImage(image);
                return;
            }
            const figure = document.createElement('figure');
            figure.className = 'editor-image layout-inline';
            image.parentNode?.insertBefore(figure, image);
            figure.appendChild(image);
            this.ensureResponsiveImage(image);
        });
    }

    ensureResponsiveImage(image) {
        if (!image) {
            return;
        }
        if (!image.style.maxWidth) {
            image.style.maxWidth = '100%';
        }
        image.style.height = 'auto';
        const figure = image.closest('.editor-image');
        if (!figure) {
            return;
        }
        const widthHint = Number(image.getAttribute('data-word-width') || image.dataset?.wordWidth || '');
        if (!widthHint || Number.isNaN(widthHint)) {
            return;
        }
        const containerWidth = figure.parentElement?.clientWidth || this.editRichArea?.clientWidth || image.naturalWidth || 1;
        if (!containerWidth) {
            return;
        }
        const percent = Math.max(15, Math.min(120, Math.round((widthHint / containerWidth) * 100)));
        figure.style.width = `${percent}%`;
    }

    updatePasteSummary(bundle) {
        if (!this.pastePreviewSummary || !bundle) return;
        const summary = bundle.summary || {};
        const removedTags = summary.removedTags || 0;
        const removedStyles = summary.removedStyles || 0;
        const keptStyles = summary.keptStyles || 0;
        const tables = summary.tables ?? bundle.tables?.length ?? 0;
        let text = `태그 ${removedTags}개 제거 · 스타일 ${keptStyles}개 유지 / ${removedStyles}개 제거`;
        if (tables > 0) {
            const dims = (bundle.tableMeta || [])
                .map(meta => {
                    if (!meta) return null;
                    if (!meta.rows && !meta.cols) return null;
                    return `${meta.rows || '?'}x${meta.cols || '?'}`;
                })
                .filter(Boolean);
            if (dims.length) {
                const previewDims = dims.slice(0, 3).join(', ');
                const suffix = dims.length > 3 ? '…' : '';
                text += ` · 표 ${tables}개 (${previewDims}${suffix})`;
            } else {
                text += ` · 표 ${tables}개 감지`;
            }
        }
        this.pastePreviewSummary.textContent = text;
    }

    showPastePopover(bundle) {
        if (!this.pastePopover || !this.lastPasteRange) return;
        const rect = this.lastPasteRange.getBoundingClientRect();
        const popoverRect = this.pastePopover.getBoundingClientRect();
        const caption = document.getElementById('paste-popover-caption');
        if (caption) {
            caption.textContent = bundle.tables?.length ? `표 ${bundle.tables.length}개 감지됨` : '원하는 방식을 선택하세요.';
        }
        const defaultMode = bundle.defaultMode || 'clean';
        document.querySelectorAll('[data-paste-mode]').forEach(button => {
            button.classList.toggle('active', button.dataset.pasteMode === defaultMode);
        });
        let top = window.scrollY + rect.top - popoverRect.height - 12;
        if (top < window.scrollY + 10) {
            top = window.scrollY + rect.bottom + 12;
        }
        const left = window.scrollX + rect.left;
        this.pastePopover.style.top = `${top}px`;
        this.pastePopover.style.left = `${left}px`;
        this.pastePopover.classList.add('active');
    }

    dismissPasteOverlay(reset = false) {
        this.pastePopover?.classList.remove('active');
        if (reset) {
            this.lastPasteBundle = null;
            this.lastPasteRange = null;
            this.clearPastePreview();
        }
    }

    handlePasteOption(mode) {
        if (mode === 'cancel') {
            this.dismissPasteOverlay(true);
            return;
        }
        const html = this.resolvePasteHtmlByMode(mode);
        if (!html) {
            this.showError('선택한 방식으로 붙여넣을 수 없습니다.');
            return;
        }
        this.insertPasteHtml(html);
        this.dismissPasteOverlay(true);
        this.showSuccess('콘텐츠를 붙여넣었습니다.');
    }

    insertPasteHtml(html) {
        if (!html) return;
        const container = document.createElement('div');
        container.innerHTML = html;
        this.removeSequentialDuplicateImages(container);
        this.editRichArea?.focus();
        const range = this.lastPasteRange || this.captureCurrentRange();
        if (!range) {
            document.execCommand('insertHTML', false, container.innerHTML);
            return;
        }
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        while (container.firstChild) {
            fragment.appendChild(container.firstChild);
        }
        const lastNode = fragment.lastChild;
        range.insertNode(fragment);
        if (lastNode) {
            this.setCaretAfter(lastNode);
        }
    }

    captureCurrentRange() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return null;
        return selection.getRangeAt(0).cloneRange();
    }

    setCaretAfter(node) {
        if (!node) return;
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
        this.lastPasteRange = range.cloneRange();
    }

    copyToClipboard(value) {
        if (!value) {
            return Promise.reject('empty');
        }
        if (navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(value);
        }
        return new Promise((resolve, reject) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    openPasteSettingsModal() {
        if (!this.pasteSettingsModal) return;
        this.populatePasteSettings();
        this.pasteSettingsModal.classList.add('active');
    }

    closePasteSettingsModal() {
        this.pasteSettingsModal?.classList.remove('active');
    }

    populatePasteSettings() {
        const rules = InfrastructureData.getPasteRules();
        document.querySelectorAll('[data-paste-toggle]').forEach(toggle => {
            const key = toggle.dataset.pasteToggle;
            toggle.checked = !!rules[key];
        });
        const defaultModeSelect = document.getElementById('paste-default-mode');
        if (defaultModeSelect) {
            defaultModeSelect.value = rules.defaultMode || 'clean';
        }
        this.renderWordStyleTable();
    }

    savePasteSettings() {
        const payload = {};
        document.querySelectorAll('[data-paste-toggle]').forEach(toggle => {
            const key = toggle.dataset.pasteToggle;
            payload[key] = toggle.checked;
        });
        const defaultModeSelect = document.getElementById('paste-default-mode');
        payload.defaultMode = defaultModeSelect?.value || 'clean';
        payload.wordStyleMap = this.collectStyleMap();
        InfrastructureData.updatePasteRules(payload);
        this.refreshActivePasteBundle();
        this.closePasteSettingsModal();
        this.showSuccess('붙여넣기 규칙을 저장했습니다.');
    }

    resetPasteSettings() {
        InfrastructureData.updatePasteRules({
            keepBold: true,
            keepItalic: true,
            keepUnderline: true,
            keepColors: true,
            keepBackgrounds: true,
            keepAlignment: true,
            autoTableFromTabs: false,
            preserveWordLayoutTables: true,
            defaultMode: 'clean',
            wordStyleMap: {
                MsoTitle: 'doc-title',
                MsoSubtitle: 'doc-subtitle',
                MsoHeading1: 'doc-heading-1',
                MsoHeading2: 'doc-heading-2',
                MsoHeading3: 'doc-heading-3',
                MsoQuote: 'doc-quote'
            }
        });
        this.populatePasteSettings();
        this.refreshActivePasteBundle();
        this.showSuccess('기본값으로 재설정했습니다.');
    }

    renderWordStyleTable() {
        if (!this.wordStyleTable) return;
        const rules = InfrastructureData.getPasteRules();
        const map = rules.wordStyleMap || {};
        this.wordStyleTable.innerHTML = '';
        const entries = Object.entries(map);
        if (!entries.length) {
            this.addStyleMapRow();
            return;
        }
        entries.forEach(([source, target]) => this.addStyleMapRow(source, target));
    }

    addStyleMapRow(source = '', target = '') {
        if (!this.wordStyleTable) return;
        const row = document.createElement('div');
        row.className = 'style-map-row';
        row.innerHTML = `
            <input type="text" class="style-key" placeholder="Word 클래스 (예: MsoHeading1)" value="${source}">
            <input type="text" class="style-value" placeholder="적용할 클래스 (예: doc-heading-1)" value="${target}">
            <button type="button" class="style-remove">&times;</button>
        `;
        row.querySelector('.style-remove').addEventListener('click', () => {
            row.remove();
            if (!this.wordStyleTable.querySelector('.style-map-row')) {
                this.addStyleMapRow();
            }
        });
        this.wordStyleTable.appendChild(row);
    }

    collectStyleMap() {
        if (!this.wordStyleTable) return {};
        const map = {};
        this.wordStyleTable.querySelectorAll('.style-map-row').forEach(row => {
            const key = row.querySelector('.style-key')?.value.trim();
            const value = row.querySelector('.style-value')?.value.trim();
            if (key && value) {
                map[key] = value;
            }
        });
        return map;
    }

    // 사이드바 섹션 토글
    toggleSection(event) {
        const button = event.currentTarget;
        const sectionName = button.dataset.section;
        const subMenu = document.querySelector(`.sub-menu[data-section="${sectionName}"]`);
        
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');

        if (isActive) {
            subMenu?.classList.add('active');
            this.expandedSections.add(sectionName);
        } else {
            subMenu?.classList.remove('active');
            this.expandedSections.delete(sectionName);
        }
    }

    // 네비게이션 설정
    setupNavigation() {
        document.querySelectorAll('.quick-link-card').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const contentKey = link.dataset.content;
                if (contentKey) {
                    this.loadContent(contentKey);
                }
            });
        });
    }

    buildNavigation() {
        if (!this.navContainer) {
            this.navContainer = document.getElementById('nav-sections');
        }

        if (!this.navContainer) return;

        const navData = InfrastructureData.getNavigation();
        const canRenameNavigation = this.hasUnlockedAdminAccess();

        this.navContainer.innerHTML = '';

        navData.forEach((section, sectionIndex) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'expandable-section';

            const header = document.createElement('div');
            header.className = 'section-header';

            const button = document.createElement('button');
            button.className = 'section-toggle';
            button.dataset.section = section.id;
            button.innerHTML = `
                <span class="toggle-icon">▶</span>
                <span>${sectionIndex + 1} ${section.title}</span>
            `;
            if (this.expandedSections.has(section.id)) {
                button.classList.add('active');
            }
            button.addEventListener('click', (e) => this.toggleSection(e));

            const sectionActions = document.createElement('div');
            sectionActions.className = 'section-actions';

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'icon-btn';
            addBtn.title = '문서 추가';
            addBtn.innerHTML = '+';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showStructureModal(section.id);
            });

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'icon-btn';
            renameBtn.innerHTML = '✎';
            const renameTooltip = canRenameNavigation
                ? '목차 이름 변경'
                : '관리자만 목차 이름을 변경할 수 있습니다.';
            renameBtn.title = renameTooltip;
            if (canRenameNavigation) {
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.renameSectionPrompt(section.id);
                });
            } else {
                renameBtn.disabled = true;
                renameBtn.setAttribute('aria-disabled', 'true');
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'icon-btn danger';
            deleteBtn.title = '목차 삭제';
            deleteBtn.innerHTML = '🗑';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSection(section.id);
            });

            sectionActions.appendChild(addBtn);
            sectionActions.appendChild(renameBtn);
            sectionActions.appendChild(deleteBtn);

            header.appendChild(button);
            header.appendChild(sectionActions);

            const subMenu = document.createElement('ul');
            subMenu.className = 'sub-menu';
            subMenu.dataset.section = section.id;
            if (this.expandedSections.has(section.id)) {
                subMenu.classList.add('active');
            }

            if (!section.items.length) {
                const placeholder = document.createElement('li');
                placeholder.className = 'sub-menu-empty';
                placeholder.textContent = '문서를 추가하세요';
                subMenu.appendChild(placeholder);
            } else {
                section.items.forEach((item, itemIndex) => {
                    const li = document.createElement('li');
                    const row = document.createElement('div');
                    row.className = 'sub-menu-row';

                    const link = document.createElement('a');
                    link.href = `#${item.key}`;
                    link.dataset.content = item.key;
                    const label = `${sectionIndex + 1}.${itemIndex + 1} ${item.title}`;
                    const isRecent = InfrastructureData.isContentRecentlyUpdated(item.key, this.recentUpdateHours);
                    link.innerHTML = `
                        <span class="nav-link-title">${this.escapeHtml(label)}</span>
                        ${isRecent ? '<span class="update-pill">N</span>' : ''}
                    `;
                    link.title = item.title;
                    if (this.currentContent === item.key) {
                        link.classList.add('active');
                    }
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.loadContent(item.key);
                    });

                    const itemActions = document.createElement('div');
                    itemActions.className = 'sub-item-actions';

                    const renameItemBtn = document.createElement('button');
                    renameItemBtn.type = 'button';
                    renameItemBtn.className = 'icon-btn';
                    renameItemBtn.innerHTML = '✎';
                    const renameItemTooltip = canRenameNavigation
                        ? '문서 제목 변경'
                        : '관리자만 문서 제목을 변경할 수 있습니다.';
                    renameItemBtn.title = renameItemTooltip;
                    if (canRenameNavigation) {
                        renameItemBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            this.renameContentPrompt(item.key);
                        });
                    } else {
                        renameItemBtn.disabled = true;
                        renameItemBtn.setAttribute('aria-disabled', 'true');
                    }

                    const editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'icon-btn';
                    editBtn.title = '편집';
                    editBtn.innerHTML = '📝';
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.quickEditContent(item.key);
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = 'icon-btn danger';
                    deleteBtn.title = '문서 삭제';
                    deleteBtn.innerHTML = '🗑';
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.deleteContentEntry(item.key);
                    });

                    itemActions.appendChild(renameItemBtn);
                    itemActions.appendChild(editBtn);
                    itemActions.appendChild(deleteBtn);

                    row.appendChild(link);
                    row.appendChild(itemActions);
                    li.appendChild(row);
                    subMenu.appendChild(li);
                });
            }

            wrapper.appendChild(header);
            wrapper.appendChild(subMenu);
            this.navContainer.appendChild(wrapper);
        });

        this.highlightActiveLink(this.currentContent);
        this.renderNavigationUpdates();
    }

    renderNavigationUpdates() {
        if (!this.navUpdatesContainer) {
            return;
        }
        const recentHours = Math.max(1, this.recentUpdateHours || 720);
        const updates = InfrastructureData.getRecentUpdates(recentHours, 6);
        const dayWindow = Math.max(1, Math.ceil(recentHours / 24));
        const hasUpdates = updates.length > 0;

        const toggleHtml = `
            <button type="button" class="nav-updates-toggle" data-action="toggle">
                <div class="updates-toggle-text">
                    <span class="updates-label">최신 업데이트</span>
                    <span class="updates-range">최근 ${dayWindow}일</span>
                </div>
                <div class="updates-toggle-meta">
                    <span class="updates-count">${updates.length}</span>
                    <span class="toggle-icon">${this.navUpdatesExpanded ? '▲' : '▼'}</span>
                </div>
            </button>
        `;

        let panelHtml = '';
        if (hasUpdates) {
            const listHtml = updates.map((update) => `
                <button type="button" class="nav-update-item" data-content="${update.key}">
                    <span class="nav-update-title">${this.escapeHtml(update.title)}</span>
                    <span class="nav-update-time">${this.formatRelativeTime(update.updatedAt)}</span>
                </button>
            `).join('');
            panelHtml = `<div class="nav-updates-panel"><div class="nav-updates-list">${listHtml}</div></div>`;
        } else {
            panelHtml = `
                <div class="nav-updates-panel empty">
                    <p class="nav-updates-empty">최근 ${dayWindow}일 내 변경된 문서가 없습니다.</p>
                </div>
            `;
        }

        this.navUpdatesContainer.innerHTML = `${toggleHtml}${panelHtml}`;
        this.navUpdatesContainer.classList.toggle('expanded', this.navUpdatesExpanded);

        const toggleBtn = this.navUpdatesContainer.querySelector('.nav-updates-toggle');
        toggleBtn?.addEventListener('click', () => {
            this.navUpdatesExpanded = !this.navUpdatesExpanded;
            this.renderNavigationUpdates();
        });

        if (this.navUpdatesExpanded && hasUpdates) {
            this.navUpdatesContainer.querySelectorAll('.nav-update-item').forEach((button) => {
                button.addEventListener('click', (event) => {
                    const target = event.currentTarget;
                    const key = target?.dataset?.content;
                    if (!key) {
                        return;
                    }
                    this.loadContent(key);
                });
            });
        }
    }

    highlightActiveLink(contentKey) {
        const links = document.querySelectorAll('.sub-menu a');
        let sectionToExpand = null;

        links.forEach(link => {
            if (contentKey && link.dataset.content === contentKey) {
                link.classList.add('active');
                const subMenu = link.closest('.sub-menu');
                if (subMenu) {
                    sectionToExpand = subMenu.dataset.section;
                }
            } else {
                link.classList.remove('active');
            }
        });

        if (!contentKey) {
            return;
        }

        if (sectionToExpand) {
            this.expandSection(sectionToExpand);
        }
    }

    expandSection(sectionId) {
        if (!sectionId) return;
        const button = document.querySelector(`.section-toggle[data-section="${sectionId}"]`);
        const subMenu = document.querySelector(`.sub-menu[data-section="${sectionId}"]`);
        if (button && subMenu) {
            button.classList.add('active');
            subMenu.classList.add('active');
            this.expandedSections.add(sectionId);
        }
    }

    // 콘텐츠 로드
    loadContent(contentKey) {
        const contentData = InfrastructureData.content[contentKey];
        
        if (!contentData) {
            this.showError('콘텐츠를 찾을 수 없습니다.');
            return;
        }

        this.currentContent = contentKey;
        
        // 환영 화면 숨기고 문서 콘텐츠 표시
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('document-content').style.display = 'block';
        
        // 콘텐츠 렌더링
    const contentHtml = InfrastructureData.renderContent(contentData);
        document.getElementById('document-content').innerHTML = contentHtml;
    this.highlightActiveLink(contentKey);
        
        // 브레드크럼 업데이트
        this.updateBreadcrumb(contentData.title);
        
        // 스크롤을 맨 위로
        window.scrollTo(0, 0);
    }

    // 환영 화면 표시
    showWelcomeScreen() {
        document.getElementById('welcome-screen').style.display = 'block';
        document.getElementById('document-content').style.display = 'none';
        this.updateBreadcrumb('홈');
        this.currentContent = null;
        this.highlightActiveLink(null);
    }

    // 브레드크럼 업데이트
    updateBreadcrumb(title) {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = `<span>홈</span>`;
        
        if (title !== '홈') {
            breadcrumb.innerHTML += ` <span>${title}</span>`;
        }
    }

    // 검색 모달 표시
    showSearchModal() {
        document.getElementById('search-modal').classList.add('active');
        document.getElementById('search-input').focus();
    }

    // 편집 모달 표시
    showEditModal() {
        const perform = () => {
            if (!this.currentContent) {
                this.showError('편집할 콘텐츠가 없습니다.');
                return;
            }

            const contentData = InfrastructureData.content[this.currentContent];
            if (this.editRichArea) {
                const html = InfrastructureData.renderContent(contentData, true) || '';
                this.editRichArea.innerHTML = html;
                this.setEditorBaseline(html);
                this.refreshImageResizeOverlay();
            }
            this.editModalElement?.classList.add('active');
            this.editRichArea?.focus();
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    // 새 섹션 추가 모달
    showAddSectionModal() {
        this.showStructureModal();
    }

    // 모달 숨기기
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal?.classList.remove('active');
        if (modalId === 'admin-modal') {
            this.resetAdminModal();
        }
    }

    // 검색 수행
    performSearch(query) {
        const results = InfrastructureData.searchContent(query);
        const resultsContainer = document.getElementById('search-results');
        
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p>검색 결과가 없습니다.</p>';
            return;
        }
        
        const resultsHtml = results.map(result => `
            <div class="search-result-item" onclick="app.loadContentFromSearch('${result.key}')">
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-snippet">${result.snippet}...</div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = resultsHtml;
    }

    // 검색 결과에서 콘텐츠 로드
    loadContentFromSearch(contentKey) {
        this.hideModal('search-modal');
        this.loadContent(contentKey);
    }

    // 편집 내용 저장
    saveEdit() {
        const perform = () => {
            if (!this.currentContent || !this.editRichArea) return;

            this.cleanupCaretPlaceholders(true);
            const htmlContent = InfrastructureData.cleanHtml(this.editRichArea.innerHTML || '');

            if (!htmlContent.trim()) {
                this.showError('내용이 비어 있습니다.');
                return;
            }

            if (InfrastructureData.updateContent(this.currentContent, htmlContent, 'html')) {
                this.loadContent(this.currentContent);
                this.buildNavigation();
                this.saveToStorage();
                this.forceCloseEditModal();
                this.showSuccess('변경사항이 저장되었습니다.');
            } else {
                this.showError('저장에 실패했습니다.');
            }
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    // 엑셀 붙여넣기 모달 열기
    openExcelModal() {
        const perform = () => {
            if (!this.currentContent) {
                this.showError('먼저 문서를 열어주세요.');
                return;
            }

            if (!this.editModalElement?.classList.contains('active')) {
                this.showEditModal();
            }

            document.getElementById('excel-input').value = '';
            const preview = document.getElementById('excel-preview');
            if (preview) {
                preview.textContent = '표 데이터를 붙여넣으면 결과가 표시됩니다.';
            }
            document.getElementById('excel-has-header').checked = true;
            document.getElementById('excel-modal').classList.add('active');
            document.getElementById('excel-input').focus();
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    // 엑셀 모달 이벤트 바인딩
    setupExcelModalEvents() {
        const excelInput = document.getElementById('excel-input');
        const hasHeaderInput = document.getElementById('excel-has-header');
        const previewElement = document.getElementById('excel-preview');
        const copyButton = document.getElementById('copy-excel-html');

        if (!excelInput || !hasHeaderInput || !previewElement) {
            return;
        }

        const updatePreview = () => {
            const tableHtml = this.convertExcelToTableHtml(excelInput.value, hasHeaderInput.checked);
            if (tableHtml) {
                previewElement.innerHTML = tableHtml;
            } else {
                previewElement.textContent = '표 데이터를 붙여넣으면 결과가 표시됩니다.';
            }
            if (copyButton) {
                copyButton.disabled = !tableHtml;
            }
        };

        document.getElementById('close-excel').addEventListener('click', () => {
            this.hideModal('excel-modal');
        });

        document.getElementById('cancel-excel').addEventListener('click', () => {
            this.hideModal('excel-modal');
        });

        copyButton?.addEventListener('click', () => {
            const tableHtml = this.convertExcelToTableHtml(excelInput.value, hasHeaderInput.checked);
            if (!tableHtml) {
                this.showError('복사할 데이터가 없습니다.');
                return;
            }
            navigator.clipboard.writeText(tableHtml)
                .then(() => this.showSuccess('HTML이 복사되었습니다.'))
                .catch(() => this.showError('복사에 실패했습니다.'));
        });

        excelInput.addEventListener('input', updatePreview);
        hasHeaderInput.addEventListener('change', updatePreview);

        document.getElementById('insert-excel-table').addEventListener('click', () => {
            const tableHtml = this.convertExcelToTableHtml(excelInput.value, hasHeaderInput.checked);
            if (!tableHtml) {
                this.showError('변환할 데이터가 없습니다.');
                return;
            }
            this.insertExcelTable(tableHtml);
            this.hideModal('excel-modal');
        });
    }

    // 엑셀 데이터를 HTML 표로 변환
    convertExcelToTableHtml(rawText, hasHeader = true) {
        if (!rawText || !rawText.trim()) {
            return '';
        }

        const rows = rawText
            .trim()
            .split(/\r?\n/)
            .map(line => this.splitExcelRow(line))
            .filter(row => row.some(cell => cell.trim().length));

        if (!rows.length) {
            return '';
        }

        const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
        const normalizedRows = rows.map(row => {
            const cells = [...row];
            while (cells.length < columnCount) {
                cells.push('');
            }
            return cells.map(cell => cell.trim().replace(/\|/g, '\\|'));
        });

        let headerRow;
        let bodyRows;
        if (hasHeader) {
            headerRow = normalizedRows.shift();
        } else {
            headerRow = Array.from({ length: columnCount }, (_, index) => `컬럼${index + 1}`);
        }
        bodyRows = normalizedRows;

        const buildHead = (cells) => `<thead><tr>${cells.map(cell => `<th>${cell}</th>`).join('')}</tr></thead>`;
        const thead = hasHeader ? buildHead(headerRow) : buildHead(Array.from({ length: columnCount }, (_, index) => `컬럼${index + 1}`));
        const tbody = `
            <tbody>
                ${bodyRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
        `;

        return `<table data-excel-table="true">${thead}${tbody}</table>`;
    }

    looksLikeTabularText(text) {
        if (!text) {
            return false;
        }

        const rows = text.trim().split(/\r?\n/).filter(Boolean);
        if (rows.length < 2) {
            return false;
        }

        const tabCounts = rows.map(row => row.split('\t').length);
        const hasTabs = tabCounts.some(count => count > 1);
        if (!hasTabs) {
            return false;
        }

        const first = tabCounts[0];
        const variance = tabCounts.filter(count => count === first).length / tabCounts.length;
        return variance >= 0.6;
    }

    splitExcelRow(line) {
        if (line.includes('\t')) {
            return line.split('\t');
        }
        if (line.includes(',')) {
            return line.split(',');
        }
        return line.split(/\s{2,}/);
    }

    insertExcelTable(tableHtml) {
        const perform = () => {
            if (!this.editRichArea) {
                this.showError('편집 영역을 찾을 수 없습니다.');
                return;
            }
            this.editRichArea.focus();
            document.execCommand('insertHTML', false, tableHtml);
            this.handleEditorInputChange();
        };

        if (!this.guardAdmin(perform)) return;
        perform();
    }

    // 키 생성 (제목을 기반으로)
    generateKey(title) {
        return title.toLowerCase()
            .replace(/[^a-z0-9가-힣]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Date.now();
    }

    // 로컬 스토리지에 저장
    saveToStorage() {
        const success = InfrastructureData.saveToLocalStorage();
        if (!success) {
            this.showError('로컬 저장에 실패했습니다.');
            return;
        }
        this.scheduleServerSave();
    }

    // 로컬 스토리지에서 로드
    loadFromStorage() {
        InfrastructureData.loadFromLocalStorage();
        this.refreshAdminState();
    }

    refreshAfterDataReload() {
        this.buildNavigation();
        this.renderQuickLinks();
        if (this.currentContent && InfrastructureData.content[this.currentContent]) {
            this.loadContent(this.currentContent);
        } else {
            this.showWelcomeScreen();
        }
        this.refreshAdminState();
        this.updateAdminButton();
    }

    scheduleServerSave(reason = 'update') {
        if (typeof fetch !== 'function') {
            return;
        }
        if (this.serverSyncTimer) {
            clearTimeout(this.serverSyncTimer);
        }
        const delay = reason === 'seed' ? 200 : 800;
        this.serverSyncTimer = setTimeout(() => this.pushStateToServer(reason), delay);
    }

    async pushStateToServer(reason = 'update') {
        if (typeof fetch !== 'function') {
            return;
        }
        try {
            this.serverSyncStatus.isSyncing = true;
            const payload = InfrastructureData.getStatePayload();
            const response = await this.authFetch('/api/state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: payload, reason })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.serverSyncStatus.lastSyncedAt = new Date();
            this.serverSyncStatus.lastError = null;
        } catch (error) {
            if (error?.code === 'AUTH_REQUIRED' || error?.code === 'ADMIN_REQUIRED') {
                this.serverSyncStatus.lastError = error.code === 'ADMIN_REQUIRED' ? '관리자 권한 필요' : '인증 필요';
                return;
            }
            console.warn('서버 저장 실패:', error);
            this.serverSyncStatus.lastError = error.message;
        } finally {
            this.serverSyncStatus.isSyncing = false;
        }
    }

    async syncFromServer() {
        if (typeof fetch !== 'function') {
            console.warn('fetch를 지원하지 않는 환경에서는 서버 동기화를 이용할 수 없습니다.');
            return;
        }
        try {
            this.serverSyncStatus.isSyncing = true;
            const response = await this.authFetch('/api/state', {
                headers: { 'Accept': 'application/json' },
                cache: 'no-cache'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            if (!payload || !payload.data) {
                if (!this.initialSyncPerformed) {
                    this.scheduleServerSave('seed');
                    this.initialSyncPerformed = true;
                }
                return;
            }
            InfrastructureData.loadFromObject(payload.data);
            InfrastructureData.saveToLocalStorage();
            this.refreshAfterDataReload();
            this.serverSyncStatus.lastSyncedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
            this.initialSyncPerformed = true;
        } catch (error) {
            if (error?.code === 'AUTH_REQUIRED' || error?.code === 'ADMIN_REQUIRED') {
                this.serverSyncStatus.lastError = error.code === 'ADMIN_REQUIRED' ? '관리자 권한 필요' : '인증 필요';
                return;
            }
            console.warn('서버 동기화 실패:', error);
            this.serverSyncStatus.lastError = error.message;
        } finally {
            this.serverSyncStatus.isSyncing = false;
        }
    }

    // 성공 메시지 표시
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // 오류 메시지 표시
    showError(message) {
        this.showNotification(message, 'error');
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        // 간단한 알림 구현
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            border-radius: 4px;
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // JSON으로 데이터 내보내기
    exportData() {
        InfrastructureData.ensureNavigationCoverage();
        const payload = {
            content: InfrastructureData.content,
            navigation: InfrastructureData.getNavigation(false),
            settings: InfrastructureData.settings
        };
        const data = JSON.stringify(payload, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'infrastructure-manual-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // JSON에서 데이터 가져오기
    importData(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.content || data.navigation || data.settings) {
                    if (data.content) {
                        InfrastructureData.normalizeContentObject(data.content);
                        InfrastructureData.content = data.content;
                    }
                    if (data.navigation) {
                        InfrastructureData.navigation = data.navigation;
                    }
                    if (data.settings) {
                        const mergedPasteRules = {
                            ...InfrastructureData.getPasteRules(),
                            ...(data.settings.pasteRules || {})
                        };
                        const quickLinks = Array.isArray(data.settings.quickLinks) && data.settings.quickLinks.length
                            ? data.settings.quickLinks
                            : InfrastructureData.getDefaultQuickLinks();
                        InfrastructureData.settings = {
                            admin: {
                                enabled: !!data.settings.admin?.enabled,
                                passcode: data.settings.admin?.passcode || null
                            },
                            pasteRules: mergedPasteRules,
                            quickLinks
                        };
                    }
                } else {
                    InfrastructureData.normalizeContentObject(data);
                    InfrastructureData.content = data;
                }
                InfrastructureData.ensureNavigationCoverage();
                this.saveToStorage();
                this.showSuccess('데이터를 성공적으로 가져왔습니다.');
                this.refreshAdminState();
                this.updateAdminButton();
                location.reload(); // 페이지 새로고침으로 UI 업데이트
            } catch (error) {
                this.showError('파일 형식이 올바르지 않습니다.');
            }
        };
        reader.readAsText(file);
    }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification {
        animation: slideIn 0.3s ease;
    }
`;
document.head.appendChild(style);

// 애플리케이션 인스턴스 생성 및 전역 변수로 설정
let app;
let authManager;

// DOM 로드 완료 후 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
    window.authManager = authManager;

    authManager.onAuthChange((isAuthenticated, profile) => {
        if (app?.handleAuthContextChange) {
            app.handleAuthContextChange(isAuthenticated, profile);
        }
        if (!isAuthenticated) {
            return;
        }
        if (!app) {
            app = new InfrastructureManual(authManager);
            exposeAppHelpers(app);
        } else {
            app.syncFromServer();
        }
    });

    authManager.bootstrap().then((ready) => {
        if (ready && !app) {
            app = new InfrastructureManual(authManager);
            exposeAppHelpers(app);
            app.handleAuthContextChange?.(true, authManager.profile);
        }
    });
});

function exposeAppHelpers(instance) {
    window.app = instance;
    window.exportData = () => instance.exportData();
    window.importData = (fileInput) => instance.importData(fileInput);
    window.resetData = () => {
        instance?.resetLocalData();
    };
}