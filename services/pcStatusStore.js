// PC 상태 체크 저장소 — devices 의 ip 를 ping 으로 확인해 네트워크 응답 상태를 판정한다.
// 주의: 이 상태는 "전원 상태"가 아니라 "네트워크 응답 기준" 상태다. (offline = 응답 없음)
//
// 상태값: online(응답 있음) / checking(확인 중) / delayed(응답 지연)
//         offline(응답 없음) / disabled(체크 제외)
// 판정 규칙:
//   - ping 성공                       → online
//   - ping 성공 + latencyMs >= 100ms  → delayed
//   - 1~2회 연속 실패                  → checking
//   - 3회 이상 연속 실패               → offline
//   - enabled=false 또는 ip 없음       → disabled (ping 하지 않음)
const { execFile } = require('child_process');
const deviceCatalog = require('./deviceCatalog');

const PING_TIMEOUT_MS = 1500;        // ping 응답 대기 (1~2초 권장)
const MAX_CONCURRENCY = 12;          // 동시에 띄우는 ping 프로세스 수 제한
const DELAYED_THRESHOLD_MS = 100;    // 이 이상이면 응답 지연으로 본다
const OFFLINE_FAILURE_THRESHOLD = 3; // 연속 실패 횟수가 이 이상이면 응답 없음

const ALLOWED_STATUSES = ['online', 'checking', 'delayed', 'offline', 'disabled'];

// 알 수 없는 상태는 checking 으로 정규화 (switch default 에서 throw 하지 않는다)
function normalizeStatus(value) {
    return ALLOWED_STATUSES.includes(value) ? value : 'checking';
}

// id -> { status, latencyMs, lastCheckedAt, lastSuccessAt, consecutiveFailures }
const statusMap = new Map();

function isCheckable(device) {
    return Boolean(device) && device.enabled !== false
        && typeof device.ip === 'string' && device.ip.trim() !== '';
}

function ensureEntry(device) {
    let entry = statusMap.get(device.id);
    if (!entry) {
        entry = {
            status: isCheckable(device) ? 'checking' : 'disabled',
            latencyMs: null,
            lastCheckedAt: null,
            lastSuccessAt: null,
            consecutiveFailures: 0
        };
        statusMap.set(device.id, entry);
    }
    return entry;
}

// Windows ping 1회 실행. 성공 여부와 응답시간(ms)을 돌려준다.
// 어떤 경우에도 reject 하지 않는다 — 실패해도 앱이 죽으면 안 되므로 resolve 로만 처리.
function pingHost(ip) {
    return new Promise((resolve) => {
        // -n 1: 1회, -w: 응답 대기(ms). execFile 로 셸을 거치지 않아 인젝션에 안전.
        const args = ['-n', '1', '-w', String(PING_TIMEOUT_MS), ip];
        let settled = false;
        const done = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        try {
            execFile('ping', args, {
                windowsHide: true,
                timeout: PING_TIMEOUT_MS + 1000
            }, (error, stdout) => {
                const out = String(stdout || '');
                // TTL 은 로케일과 무관하게 출력된다 → 성공 판정의 기준으로 사용
                const alive = /TTL=/i.test(out);
                if (!alive) {
                    return done({ alive: false, latencyMs: null });
                }
                // "시간=12ms" / "time=12ms" / "시간<1ms" / "time<1ms" 모두 매칭
                const m = out.match(/[<=]\s*([0-9]+)\s*ms/i);
                const latencyMs = m ? Number(m[1]) : 0;
                return done({
                    alive: true,
                    latencyMs: Number.isFinite(latencyMs) ? latencyMs : 0
                });
            });
        } catch (error) {
            // execFile 자체가 throw 하는 극단적 상황도 안전하게 흡수
            console.warn('[pcStatus] ping 실행 실패:', ip, error.message);
            done({ alive: false, latencyMs: null });
        }
    });
}

// 장비 1건 체크 — statusMap 의 항목을 갱신하고 반환한다.
async function checkDevice(device) {
    const entry = ensureEntry(device);
    const now = new Date().toISOString();

    // ip 가 없거나 enabled=false → ping 하지 않고 disabled 처리
    if (!isCheckable(device)) {
        entry.status = 'disabled';
        entry.latencyMs = null;
        entry.lastCheckedAt = now;
        entry.consecutiveFailures = 0;
        return entry;
    }

    let result;
    try {
        result = await pingHost(device.ip.trim());
    } catch (error) {
        console.warn('[pcStatus] ping 처리 중 오류:', device.ip, error.message);
        result = { alive: false, latencyMs: null };
    }

    entry.lastCheckedAt = now;
    if (result.alive) {
        entry.consecutiveFailures = 0;
        entry.latencyMs = Number.isFinite(result.latencyMs) ? result.latencyMs : null;
        entry.lastSuccessAt = now;
        entry.status = (entry.latencyMs != null && entry.latencyMs >= DELAYED_THRESHOLD_MS)
            ? 'delayed'
            : 'online';
    } else {
        entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
        entry.latencyMs = null;
        entry.status = (entry.consecutiveFailures >= OFFLINE_FAILURE_THRESHOLD)
            ? 'offline'
            : 'checking';
    }
    return entry;
}

// 동시 실행 수를 limit 으로 제한하면서 items 전체를 worker 로 처리한다.
// 70대 이상이어도 한 번에 limit 개씩만 ping → 앱이 멈추지 않는다.
async function runWithConcurrency(items, worker, limit) {
    const list = Array.isArray(items) ? items : [];
    let cursor = 0;
    async function runner() {
        while (cursor < list.length) {
            const item = list[cursor++];
            try {
                await worker(item);
            } catch (error) {
                console.warn('[pcStatus] 항목 처리 실패:', error.message);
            }
        }
    }
    const size = Math.max(1, Math.min(limit, list.length || 1));
    const runners = [];
    for (let i = 0; i < size; i++) {
        runners.push(runner());
    }
    await Promise.all(runners);
}

// statusMap 항목 + 장비 정보를 API 응답 형태로 직렬화
function serialize(device) {
    const entry = ensureEntry(device);
    return {
        id: device.id,
        ip: device.ip || '',
        status: normalizeStatus(entry.status),
        latencyMs: Number.isFinite(entry.latencyMs) ? entry.latencyMs : null,
        lastCheckedAt: entry.lastCheckedAt || null,
        lastSuccessAt: entry.lastSuccessAt || null
    };
}

// 전체 장비의 현재 상태 목록 (체크는 하지 않고 저장된 값만 반환)
function getAll() {
    return deviceCatalog.getDevices().map(serialize);
}

// 상태별 개수 요약
function getSummary() {
    const all = getAll();
    const summary = { total: all.length, online: 0, checking: 0, delayed: 0, offline: 0, disabled: 0 };
    all.forEach(d => {
        const s = normalizeStatus(d.status);
        if (summary[s] != null) summary[s] += 1;
    });
    return summary;
}

// 전체 장비 수동 체크 — 동시 실행 수 제한, 실패해도 전체가 멈추지 않음
async function checkAll() {
    const devices = deviceCatalog.getDevices();
    await runWithConcurrency(devices, checkDevice, MAX_CONCURRENCY);
    return getAll();
}

// 특정 장비만 수동 체크 (없으면 null)
async function checkOne(id) {
    const device = deviceCatalog.getDeviceById(id);
    if (!device) return null;
    await checkDevice(device);
    return serialize(device);
}

module.exports = { getAll, getSummary, checkAll, checkOne };
