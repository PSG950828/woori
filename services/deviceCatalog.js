// 장비 카탈로그 — 프론트엔드 데이터(js/data.js)의 SAMPLE_INFRA_DEVICES 를
// 백엔드에서 그대로 재사용한다. 장비 목록을 한 곳(data.js)에서만 관리하기 위해
// 파일을 읽어 배열 리터럴만 안전하게 평가한다. (등록/삭제 기능은 다루지 않음)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_FILE = path.join(__dirname, '..', 'js', 'data.js');

let cached = null;

function normalizeDevice(d, i) {
    const src = (d && typeof d === 'object') ? d : {};
    const ip = (typeof src.ip === 'string') ? src.ip.trim() : '';
    return {
        id: String(src.id != null ? src.id : (ip || `device-${i}`)),
        name: typeof src.name === 'string' ? src.name : '',
        ip,
        floor: src.floor != null ? src.floor : null,
        // enabled 가 명시적으로 false 일 때만 비활성 — 그 외에는 활성으로 본다
        enabled: src.enabled !== false
    };
}

// js/data.js 에서 SAMPLE_INFRA_DEVICES 배열 리터럴만 추출해 평가한다.
// 실패하더라도 예외를 던지지 않고 빈 배열을 반환해 서버가 죽지 않게 한다.
function loadDevices() {
    try {
        const source = fs.readFileSync(DATA_FILE, 'utf8');
        const match = source.match(/const\s+SAMPLE_INFRA_DEVICES\s*=\s*(\[[\s\S]*?\n\])\s*;/);
        if (!match) {
            console.warn('[deviceCatalog] SAMPLE_INFRA_DEVICES 배열을 찾지 못했습니다.');
            return [];
        }
        const arr = vm.runInNewContext(match[1], Object.create(null), { timeout: 1000 });
        if (!Array.isArray(arr)) {
            console.warn('[deviceCatalog] SAMPLE_INFRA_DEVICES 가 배열이 아닙니다.');
            return [];
        }
        return arr.map(normalizeDevice);
    } catch (error) {
        console.error('[deviceCatalog] 장비 목록 로드 실패:', error.message);
        return [];
    }
}

// 장비 목록 반환 — 최초 1회 로드 후 캐시. (파일이 거의 바뀌지 않으므로 캐시 안전)
function getDevices() {
    if (!cached) {
        cached = loadDevices();
    }
    return cached;
}

// 특정 id 의 장비 1건 반환 (없으면 null)
function getDeviceById(id) {
    const target = String(id == null ? '' : id);
    return getDevices().find(d => d.id === target) || null;
}

// 캐시 강제 초기화 (데이터 파일이 갱신된 경우 사용)
function reload() {
    cached = null;
    return getDevices();
}

module.exports = { getDevices, getDeviceById, reload };
