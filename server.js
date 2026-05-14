const path = require('path');
const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const stateStore = require('./services/stateStore');
const authStore = require('./services/authStore');
const pcStatusStore = require('./services/pcStatusStore');

const app = express();
const PORT = process.env.PORT || 5173;
const JWT_SECRET = process.env.JWT_SECRET || 'infra-manual-secret';
const JWT_TTL = process.env.JWT_TTL || '12h';
const DEFAULT_ADMIN_USER = process.env.DEFAULT_ADMIN_USER || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'woori0212!';

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

function buildToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            username: user.username,
            isAdmin: !!user.isAdmin
        },
        JWT_SECRET,
        { expiresIn: JWT_TTL }
    );
}

function requireAdmin(req, res, next) {
    if (!req.authUser?.isAdmin) {
        return res.status(403).json({ error: 'ADMIN_REQUIRED' });
    }
    next();
}

async function authenticateRequest(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) {
            return res.status(401).json({ error: 'UNAUTHORIZED' });
        }
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await authStore.getUserById(payload.sub);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED' });
        }
        req.authUser = user;
        next();
    } catch (error) {
        console.warn('[Auth] 인증 실패:', error.message);
        return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
}

function parseAccountId(param) {
    const id = Number(param);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
}

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = await authStore.verifyCredentials(username, password);
        if (!user) {
            return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        }
        const token = buildToken(user);
        return res.json({ token, user });
    } catch (error) {
        console.error('[Auth] 로그인 실패:', error);
        return res.status(500).json({ error: 'AUTH_FAILED' });
    }
});

app.get('/api/auth/session', authenticateRequest, (req, res) => {
    return res.json({ user: req.authUser });
});

app.post('/api/auth/logout', (req, res) => {
    return res.json({ status: 'ok' });
});

app.get('/api/accounts', authenticateRequest, requireAdmin, async (req, res) => {
    try {
        const users = await authStore.listUsers();
        return res.json({ users });
    } catch (error) {
        console.error('[Accounts] 목록 조회 실패:', error);
        return res.status(500).json({ error: 'ACCOUNT_LIST_FAILED' });
    }
});

app.post('/api/accounts', authenticateRequest, requireAdmin, async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = await authStore.createUser({ username, password });
        return res.status(201).json({ user });
    } catch (error) {
        if (error?.code === 'INVALID_USERNAME') {
            return res.status(400).json({ error: 'INVALID_USERNAME' });
        }
        if (error?.code === 'INVALID_PASSWORD') {
            return res.status(400).json({ error: 'INVALID_PASSWORD' });
        }
        if (error?.code === 'USERNAME_EXISTS') {
            return res.status(409).json({ error: 'USERNAME_EXISTS' });
        }
        console.error('[Accounts] 계정 생성 실패:', error);
        return res.status(500).json({ error: 'ACCOUNT_CREATE_FAILED' });
    }
});

app.put('/api/accounts/:id', authenticateRequest, requireAdmin, async (req, res) => {
    const accountId = parseAccountId(req.params.id);
    if (!accountId) {
        return res.status(400).json({ error: 'INVALID_ACCOUNT_ID' });
    }
    try {
        const { username, password } = req.body || {};
        const user = await authStore.updateUser(accountId, { username, password });
        if (!user) {
            return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
        }
        return res.json({ user });
    } catch (error) {
        if (error?.code === 'INVALID_USERNAME') {
            return res.status(400).json({ error: 'INVALID_USERNAME' });
        }
        if (error?.code === 'INVALID_PASSWORD') {
            return res.status(400).json({ error: 'INVALID_PASSWORD' });
        }
        if (error?.code === 'USERNAME_EXISTS') {
            return res.status(409).json({ error: 'USERNAME_EXISTS' });
        }
        console.error('[Accounts] 계정 업데이트 실패:', error);
        return res.status(500).json({ error: 'ACCOUNT_UPDATE_FAILED' });
    }
});

app.delete('/api/accounts/:id', authenticateRequest, requireAdmin, async (req, res) => {
    const accountId = parseAccountId(req.params.id);
    if (!accountId) {
        return res.status(400).json({ error: 'INVALID_ACCOUNT_ID' });
    }
    try {
        const total = await authStore.countUsers();
        if (total <= 1) {
            return res.status(400).json({ error: 'LAST_USER_PROTECTED' });
        }
        const removed = await authStore.deleteUser(accountId);
        if (!removed) {
            return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
        }
        return res.json({ status: 'deleted' });
    } catch (error) {
        console.error('[Accounts] 계정 삭제 실패:', error);
        return res.status(500).json({ error: 'ACCOUNT_DELETE_FAILED' });
    }
});

app.get('/api/state', authenticateRequest, async (req, res) => {
    try {
        const state = await stateStore.getState();
        if (!state) {
            return res.json({ data: null, updatedAt: null });
        }
        return res.json({
            data: state.data,
            updatedAt: state.updatedAt
        });
    } catch (error) {
        console.error('[API] 상태 조회 실패:', error);
        return res.status(500).json({ error: 'STATE_FETCH_FAILED' });
    }
});

app.post('/api/state', authenticateRequest, requireAdmin, async (req, res) => {
    try {
        const payload = req.body?.data;
        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ error: 'INVALID_STATE_PAYLOAD' });
        }
        await stateStore.saveState(payload);
        return res.json({ status: 'ok' });
    } catch (error) {
        console.error('[API] 상태 저장 실패:', error);
        return res.status(500).json({ error: 'STATE_SAVE_FAILED' });
    }
});

// =============================================================================
// PC 상태 관제 API — devices 의 ip 를 ping 으로 확인한 "네트워크 응답 상태"를 제공.
// 전원 상태가 아니며, offline 은 "응답 없음"을 의미한다.
// =============================================================================

// 전체 장비 상태 목록 — 저장된 최신 상태만 반환 (체크는 수행하지 않음)
app.get('/api/pc-status', authenticateRequest, (req, res) => {
    try {
        return res.json({ devices: pcStatusStore.getAll() });
    } catch (error) {
        console.error('[PC상태] 목록 조회 실패:', error);
        return res.status(500).json({ error: 'PC_STATUS_FETCH_FAILED' });
    }
});

// 상태 요약 — 전체/온라인/확인중/응답지연/응답없음/체크제외 개수
app.get('/api/pc-status/summary', authenticateRequest, (req, res) => {
    try {
        return res.json({ summary: pcStatusStore.getSummary() });
    } catch (error) {
        console.error('[PC상태] 요약 조회 실패:', error);
        return res.status(500).json({ error: 'PC_STATUS_SUMMARY_FAILED' });
    }
});

// 전체 장비 수동 체크 — 비동기 + 동시 실행 수 제한 (70대 이상이어도 멈추지 않음)
app.post('/api/pc-status/check', authenticateRequest, async (req, res) => {
    try {
        const devices = await pcStatusStore.checkAll();
        return res.json({ devices, summary: pcStatusStore.getSummary() });
    } catch (error) {
        console.error('[PC상태] 전체 체크 실패:', error);
        return res.status(500).json({ error: 'PC_STATUS_CHECK_FAILED' });
    }
});

// 특정 장비만 수동 체크
app.post('/api/pc-status/check/:id', authenticateRequest, async (req, res) => {
    try {
        const device = await pcStatusStore.checkOne(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
        }
        return res.json({ device });
    } catch (error) {
        console.error('[PC상태] 장비 체크 실패:', error);
        return res.status(500).json({ error: 'PC_STATUS_CHECK_FAILED' });
    }
});

const staticDir = path.join(__dirname);
app.use(express.static(staticDir, {
    extensions: ['html'],
    index: 'index.html'
}));

app.use((req, res, next) => {
    res.status(404).sendFile(path.join(staticDir, 'index.html'));
});

async function start() {
    try {
        await authStore.initialize({
            username: DEFAULT_ADMIN_USER,
            password: DEFAULT_ADMIN_PASSWORD
        });
        // Bind to all interfaces so other machines on the local network can access the site.
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Infrastructure Manual server running at http://0.0.0.0:${PORT} (accessible on the LAN at http://<host-ip>:${PORT})`);
        });
    } catch (error) {
        console.error('[Server] 초기화 실패:', error);
        process.exit(1);
    }
}

start();
