const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'manual.sqlite');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[StateStore] 데이터베이스 연결 실패:', err.message);
    } else {
        console.log(`[StateStore] SQLite 연결: ${DB_PATH}`);
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS manual_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function getState() {
    return new Promise((resolve, reject) => {
        db.get('SELECT data, updated_at FROM manual_state WHERE id = 1', (err, row) => {
            if (err) {
                return reject(err);
            }
            if (!row || !row.data) {
                return resolve(null);
            }
            try {
                const payload = JSON.parse(row.data);
                resolve({ data: payload, updatedAt: row.updated_at });
            } catch (parseError) {
                console.warn('[StateStore] 저장된 JSON 파싱 실패, 원본 문자열을 반환합니다.');
                resolve({ data: null, updatedAt: row.updated_at, raw: row.data });
            }
        });
    });
}

function saveState(state) {
    return new Promise((resolve, reject) => {
        let serialized;
        try {
            serialized = JSON.stringify(state);
        } catch (err) {
            return reject(err);
        }

        db.run(
            `INSERT INTO manual_state (id, data, updated_at)
             VALUES (1, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP`,
            serialized,
            (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            }
        );
    });
}

module.exports = {
    getState,
    saveState
};
