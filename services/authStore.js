const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'manual.sqlite');
const SALT_ROUNDS = 10;
let defaultAdminConfig = {};

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[AuthStore] 데이터베이스 연결 실패:', err.message);
    } else {
        console.log(`[AuthStore] SQLite 연결: ${DB_PATH}`);
    }
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                return reject(err);
            }
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row || null);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows || []);
        });
    });
}

async function ensureSchema() {
    await run(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await ensureAdminColumn();
}

async function ensureAdminColumn() {
    const columns = await all("PRAGMA table_info('auth_users')");
    const hasAdminColumn = columns.some((column) => column.name === 'is_admin');
    if (!hasAdminColumn) {
        await run('ALTER TABLE auth_users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
    }
}

async function ensureAdminPresence(defaults = null) {
    const fallback = defaults && Object.keys(defaults).length ? defaults : defaultAdminConfig;
    const existingAdmin = await get('SELECT id FROM auth_users WHERE is_admin = 1 LIMIT 1');
    if (existingAdmin) {
        return;
    }

    const preferredUsername = (fallback.username || '').trim();
    let target = null;
    if (preferredUsername) {
        target = await getRawUserByUsername(preferredUsername);
    }
    if (!target) {
        target = await get('SELECT id, username FROM auth_users ORDER BY id ASC LIMIT 1');
    }
    if (target) {
        await run('UPDATE auth_users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [target.id]);
        console.warn(`[AuthStore] 관리자 계정이 없어 '${target.username}' 계정에 관리자 권한을 부여했습니다.`);
        return;
    }

    await ensureDefaultUser(fallback);
}

async function ensureAnyAdmin(currentUser = null) {
    const hasAdmin = await get('SELECT id FROM auth_users WHERE is_admin = 1 LIMIT 1');
    if (hasAdmin) {
        return hasAdmin.id;
    }

    if (currentUser?.id) {
        await run('UPDATE auth_users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [currentUser.id]);
        console.warn(`[AuthStore] 관리자 계정이 없어 '${currentUser.username}' 계정에 관리자 권한을 부여했습니다.`);
        return currentUser.id;
    }

    await ensureAdminPresence(defaultAdminConfig);
    const fallbackAdmin = await get('SELECT id FROM auth_users WHERE is_admin = 1 LIMIT 1');
    return fallbackAdmin?.id || null;
}

function mapUser(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        username: row.username,
        isAdmin: Boolean(row.is_admin),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

async function listUsers() {
    const rows = await all('SELECT id, username, is_admin, created_at, updated_at FROM auth_users ORDER BY username ASC');
    return rows.map(mapUser);
}

async function getUserById(id) {
    const row = await get('SELECT id, username, is_admin, created_at, updated_at FROM auth_users WHERE id = ?', [id]);
    return mapUser(row);
}

async function getRawUserById(id) {
    return get('SELECT * FROM auth_users WHERE id = ?', [id]);
}

async function getRawUserByUsername(username) {
    return get('SELECT * FROM auth_users WHERE username = ?', [username]);
}

async function createUser({ username, password, isAdmin = false }) {
    const trimmed = (username || '').trim();
    if (!trimmed) {
        const error = new Error('INVALID_USERNAME');
        error.code = 'INVALID_USERNAME';
        throw error;
    }
    if (!password || password.length < 6) {
        const error = new Error('INVALID_PASSWORD');
        error.code = 'INVALID_PASSWORD';
        throw error;
    }
    const hash = await hashPassword(password);
    try {
        const result = await run(
            'INSERT INTO auth_users (username, password_hash, is_admin) VALUES (?, ?, ?)',
            [trimmed, hash, isAdmin ? 1 : 0]
        );
        return getUserById(result.lastID);
    } catch (error) {
        if (error?.message?.includes('UNIQUE')) {
            const conflict = new Error('USERNAME_EXISTS');
            conflict.code = 'USERNAME_EXISTS';
            throw conflict;
        }
        throw error;
    }
}

async function updateUser(id, { username, password }) {
    const sets = [];
    const params = [];

    if (username != null) {
        const trimmed = username.trim();
        if (!trimmed) {
            const error = new Error('INVALID_USERNAME');
            error.code = 'INVALID_USERNAME';
            throw error;
        }
        sets.push('username = ?');
        params.push(trimmed);
    }

    if (password != null) {
        if (!password || password.length < 6) {
            const error = new Error('INVALID_PASSWORD');
            error.code = 'INVALID_PASSWORD';
            throw error;
        }
        const hash = await hashPassword(password);
        sets.push('password_hash = ?');
        params.push(hash);
    }

    if (!sets.length) {
        return getUserById(id);
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    try {
        await run(`UPDATE auth_users SET ${sets.join(', ')} WHERE id = ?`, params);
    } catch (error) {
        if (error?.message?.includes('UNIQUE')) {
            const conflict = new Error('USERNAME_EXISTS');
            conflict.code = 'USERNAME_EXISTS';
            throw conflict;
        }
        throw error;
    }
    return getUserById(id);
}

async function deleteUser(id) {
    const result = await run('DELETE FROM auth_users WHERE id = ?', [id]);
    return result.changes > 0;
}

async function countUsers() {
    const row = await get('SELECT COUNT(1) as count FROM auth_users');
    return row?.count || 0;
}

async function verifyCredentials(username, password) {
    const trimmed = (username || '').trim();
    if (!trimmed || !password) {
        return null;
    }
    const row = await getRawUserByUsername(trimmed);
    if (!row) {
        return null;
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
        return null;
    }
    await ensureAnyAdmin(row);
    const refreshed = await getRawUserById(row.id);
    return mapUser(refreshed || row);
}

async function ensureDefaultUser({ username, password } = {}) {
    const total = await countUsers();
    if (total > 0) {
        return;
    }
    const seedName = (username || 'admin').trim() || 'admin';
    const seedPassword = password || 'woori0212!';
    await createUser({ username: seedName, password: seedPassword, isAdmin: true });
    console.log(`[AuthStore] 기본 계정 '${seedName}' 을(를) 생성했습니다.`);
}

async function initialize(defaultUserConfig = {}) {
    defaultAdminConfig = { ...defaultUserConfig };
    await ensureSchema();
    await ensureDefaultUser(defaultUserConfig);
    await ensureAdminPresence(defaultUserConfig);
}

module.exports = {
    initialize,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    countUsers,
    verifyCredentials,
    getUserById,
    getRawUserById
};
