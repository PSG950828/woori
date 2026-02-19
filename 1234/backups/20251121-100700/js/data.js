// 인프라 매뉴얼 데이터 관리
const DEFAULT_QUICK_LINKS = [
    { title: '인프라 개요', description: '시스템 아키텍처와 구성요소 확인', key: 'infrastructure-intro' },
    { title: '네트워크 구성', description: '네트워크 토폴로지와 설정 정보', key: 'network-topology' },
    { title: '서버 설정', description: '서버 구성과 관리 방법', key: 'server-setup' },
    { title: '트러블슈팅', description: '일반적인 문제 해결 방법', key: 'common-issues' }
];

const DEFAULT_UPDATED_AT = '2024-12-01T09:00:00.000Z';

const InfrastructureData = {
    // 기본 인프라 문서 콘텐츠
    content: {
        'infrastructure-intro': {
            title: '인프라 소개',
            format: 'markdown',
            content: `
# 인프라 개요

## 시스템 아키텍처

우리 조직의 IT 인프라는 다음과 같은 주요 구성요소로 이루어져 있습니다:

### 주요 구성요소
- **서버 인프라**: 물리적 및 가상 서버 환경
- **네트워크 인프라**: 내부 네트워크 및 외부 연결
- **스토리지 시스템**: 데이터 저장 및 백업 시스템
- **보안 시스템**: 방화벽, 침입 탐지, 접근 제어

### 인프라 목표
- **가용성**: 99.9% 이상의 서비스 가용성 보장
- **확장성**: 비즈니스 성장에 따른 유연한 확장
- **보안성**: 다층 보안 체계를 통한 위협 방어
- **효율성**: 자동화를 통한 운영 효율성 향상

## 서비스 레벨

### Tier 1 - 핵심 서비스
- 24x7 모니터링
- 즉시 대응 (15분 이내)
- 이중화 구성

### Tier 2 - 중요 서비스  
- 업무시간 모니터링
- 1시간 이내 대응
- 백업 구성

### Tier 3 - 일반 서비스
- 정기 점검
- 당일 대응
- 기본 백업
            `
        },
        'infrastructure-architecture': {
            title: '아키텍처 개요',
            format: 'markdown',
            content: `
# 시스템 아키텍처

## 전체 구조도

\`\`\`
[DMZ] ←→ [내부 네트워크] ←→ [데이터센터]
  |           |               |
방화벽      코어 스위치      서버팜
  |           |               |
웹서버     업무 네트워크     스토리지
\`\`\`

## 네트워크 계층

### DMZ (비무장지대)
- **웹 서버**: 공개 웹 서비스 호스팅
- **메일 서버**: 외부 메일 송수신
- **DNS 서버**: 도메인 네임 서비스

### 내부 네트워크
- **업무 네트워크**: 사용자 워크스테이션
- **관리 네트워크**: 시스템 관리 전용
- **백업 네트워크**: 데이터 백업 전용

### 서버팜
- **애플리케이션 서버**: 비즈니스 로직 처리
- **데이터베이스 서버**: 데이터 저장 및 처리
- **파일 서버**: 문서 및 파일 공유

## 보안 계층

> **다층 보안 체계**를 통해 시스템을 보호합니다.

1. **경계 보안**: 방화벽, IPS
2. **네트워크 보안**: VLAN 분리, ACL
3. **호스트 보안**: 안티바이러스, 패치 관리
4. **데이터 보안**: 암호화, 백업
5. **접근 보안**: 인증, 권한 관리
            `
        },
        'infrastructure-components': {
            title: '주요 구성요소',
            format: 'markdown',
            content: `
# 주요 구성요소

## 서버 인프라

| 구분 | 서버명 | 사양 | 용도 | 위치 |
|------|--------|------|------|------|
| 웹서버 | WEB01 | 8코어/16GB/500GB SSD | 메인 웹사이트 | DMZ |
| 웹서버 | WEB02 | 8코어/16GB/500GB SSD | 백업 웹사이트 | DMZ |
| DB서버 | DB01 | 16코어/64GB/2TB SSD | 주 데이터베이스 | 내부 |
| DB서버 | DB02 | 16코어/64GB/2TB SSD | 백업 DB | 내부 |
| 파일서버 | FILE01 | 8코어/32GB/10TB HDD | 문서 공유 | 내부 |

## 네트워크 장비

### 코어 스위치
- **모델**: Cisco Catalyst 6500
- **포트**: 48포트 기가비트
- **기능**: VLAN, QoS, 라우팅

### 방화벽
- **모델**: Fortinet FortiGate 600D
- **처리량**: 5Gbps
- **기능**: 침입방지, 웹필터링, VPN

### 무선 장비
- **AP 모델**: Cisco Aironet 3700
- **개수**: 25대
- **커버리지**: 전 사무공간

## 스토리지 시스템

### SAN (Storage Area Network)
- **용량**: 50TB (사용가능)
- **타입**: FC 16Gb
- **RAID**: RAID 10 구성

### NAS (Network Attached Storage)
- **용량**: 20TB
- **프로토콜**: NFS, CIFS
- **용도**: 파일 공유, 백업

## 가상화 환경

### VMware vSphere
- **호스트**: 8대
- **VM 수**: 150대
- **클러스터**: HA/DRS 구성
            `
        },
        'network-topology': {
            title: '네트워크 토폴로지',
            format: 'markdown',
            content: `
# 네트워크 토폴로지

## 물리적 네트워크 구성

### 인터넷 연결
- **주회선**: KT 전용선 1Gbps
- **백업회선**: LG U+ 전용선 500Mbps
- **ISP 이중화**: 자동 장애복구 구성

### VLAN 설계

| VLAN ID | 네트워크 | 서브넷 | 용도 |
|---------|----------|--------|------|
| 10 | 관리 네트워크 | 192.168.10.0/24 | 서버 관리 |
| 20 | 업무 네트워크 | 192.168.20.0/24 | 사용자 PC |
| 30 | DMZ | 192.168.30.0/24 | 공개 서비스 |
| 40 | 게스트 | 192.168.40.0/24 | 방문자 |
| 50 | 백업 네트워크 | 192.168.50.0/24 | 데이터 백업 |

### IP 주소 할당 정책

#### 고정 IP 범위
- **서버**: .1 ~ .100
- **네트워크 장비**: .101 ~ .150
- **프린터**: .151 ~ .200

#### 동적 IP 범위  
- **사용자 PC**: .201 ~ .250
- **게스트**: 전체 대역

## 라우팅 설계

### 기본 게이트웨이
\`\`\`
관리 네트워크: 192.168.10.1
업무 네트워크: 192.168.20.1
DMZ: 192.168.30.1
게스트: 192.168.40.1
\`\`\`

### 정적 라우팅
- 백업 센터: 10.0.0.0/16 via 192.168.10.254
- 지사: 172.16.0.0/12 via 192.168.10.253

## 대역폭 관리

### QoS 정책
1. **음성통화**: 최고 우선순위 (30% 보장)
2. **업무 트래픽**: 높은 우선순위 (40% 보장)  
3. **인터넷**: 일반 우선순위 (20% 보장)
4. **기타**: 낮은 우선순위 (10% 보장)
            `
        },
        'network-security': {
            title: '네트워크 보안',
            format: 'markdown',
            content: `
# 네트워크 보안

## 방화벽 정책

### 인바운드 규칙

| 순서 | 소스 | 목적지 | 포트 | 동작 | 설명 |
|------|------|--------|------|------|------|
| 1 | Any | DMZ:80,443 | HTTP/HTTPS | 허용 | 웹 서비스 |
| 2 | Any | DMZ:25,587 | SMTP | 허용 | 메일 서비스 |
| 3 | 관리IP | 내부:22,3389 | SSH/RDP | 허용 | 원격 관리 |
| 4 | Any | Any | Any | 거부 | 기본 정책 |

### 아웃바운드 규칙
- **업무 네트워크**: HTTP(80), HTTPS(443), DNS(53) 허용
- **서버 네트워크**: 필요한 포트만 선별적 허용
- **DMZ**: 내부 네트워크 접근 차단

## 침입 탐지 시스템 (IDS/IPS)

### 탐지 규칙
1. **SQL 인젝션** 공격 패턴
2. **XSS** (Cross-Site Scripting) 공격
3. **DDoS** 공격 시도
4. **포트 스캔** 탐지
5. **악성코드** 통신 패턴

### 대응 절차
1. **즉시 차단**: 명확한 악성 트래픽
2. **경고 발생**: 의심스러운 활동
3. **로그 수집**: 모든 탐지 이벤트
4. **보고서 생성**: 일/주/월 단위

## VPN 구성

### 사용자 VPN (SSL VPN)
- **동접**: 최대 100명
- **인증**: AD 연동 + OTP
- **정책**: Split Tunneling

### 사이트 VPN (IPSec)
- **지사 연결**: 5개 지사
- **암호화**: AES-256
- **인증**: Pre-shared Key + 인증서

## 무선 보안

### 인증 방식
- **직원**: WPA3-Enterprise (802.1X)
- **게스트**: WPA3-Personal (임시 비밀번호)

### 보안 설정
- **SSID 숨김**: 직원 네트워크
- **MAC 필터링**: 중요 구역
- **접속 시간 제한**: 게스트 네트워크

## 모니터링 및 로깅

### 실시간 모니터링
- **대역폭** 사용량
- **연결** 세션 수
- **보안 이벤트** 발생

### 로그 보존
- **방화벽 로그**: 1년
- **IPS 로그**: 6개월  
- **VPN 로그**: 3개월
            `
        },
        'network-monitoring': {
            title: '네트워크 모니터링',
            format: 'markdown',
            content: `
# 네트워크 모니터링

## 모니터링 시스템

### PRTG Network Monitor
- **센서 수**: 500개
- **모니터링 간격**: 1분
- **알림**: 이메일, SMS

### 주요 모니터링 항목

#### 장비 상태
- **CPU 사용률**: 임계값 80%
- **메모리 사용률**: 임계값 85%
- **디스크 사용률**: 임계값 90%
- **온도**: 임계값 70°C

#### 네트워크 성능
- **대역폭 사용률**: 임계값 80%
- **패킷 손실률**: 임계값 1%
- **응답 시간**: 임계값 100ms
- **연결 세션 수**: 모니터링

## 성능 기준선

### 정상 범위

| 항목 | 평상시 | 피크시간 | 임계점 |
|------|---------|----------|--------|
| WAN 대역폭 | 30% | 60% | 80% |
| LAN 대역폭 | 20% | 40% | 70% |
| 방화벽 CPU | 25% | 45% | 80% |
| 스위치 CPU | 15% | 25% | 60% |

### 트래픽 패턴
- **업무시간**: 09:00 ~ 18:00 (높은 사용률)
- **점심시간**: 12:00 ~ 13:00 (중간 사용률)
- **야간/주말**: 22:00 ~ 08:00 (낮은 사용률)

## 알림 체계

### 심각도 분류

#### Critical (긴급)
- 서비스 중단
- 보안 침해
- 하드웨어 장애

#### Warning (경고)
- 성능 저하
- 임계값 근접
- 설정 변경

#### Information (정보)
- 정기 점검
- 로그 정리
- 업데이트 알림

### 에스컬레이션 절차
1. **1차**: 담당자 (5분 이내)
2. **2차**: 팀장 (15분 이내)
3. **3차**: 부서장 (30분 이내)

## 리포트 및 분석

### 일간 리포트
- 가용성 현황
- 성능 통계
- 보안 이벤트
- 장애 내역

### 주간 리포트
- 트렌드 분석
- 용량 계획
- 성능 최적화 권고
- 보안 취약점

### 월간 리포트
- SLA 달성률
- 비용 분석
- 개선 계획
- 예산 계획

## 장애 대응

### 장애 감지
1. **자동 감지**: 모니터링 시스템
2. **수동 신고**: 사용자 신고
3. **정기 점검**: 예방적 발견

### 대응 절차
1. **상황 파악**: 장애 범위 및 원인 분석
2. **임시 조치**: 서비스 복구 우선
3. **근본 원인**: 상세 분석 및 해결
4. **사후 관리**: 재발 방지 대책

### 복구 목표
- **RTO** (복구 목표 시간): 1시간
- **RPO** (복구 목표 시점): 15분
            `
        },
        'server-setup': {
            title: '서버 설정',
            format: 'markdown',
            content: `
# 서버 설정 및 구성

## 표준 서버 구성

### 하드웨어 사양

#### Tier 1 서버 (핵심)
- **CPU**: Intel Xeon 16코어 이상
- **메모리**: 64GB RAM 이상
- **스토리지**: SSD 1TB + HDD 2TB
- **네트워크**: 이중화된 기가비트 NIC

#### Tier 2 서버 (중요)
- **CPU**: Intel Xeon 8코어 이상
- **메모리**: 32GB RAM 이상
- **스토리지**: SSD 500GB + HDD 1TB
- **네트워크**: 기가비트 NIC

### 운영체제 설정

#### Windows Server 2019/2022
\`\`\`powershell
# 기본 설정
Set-TimeZone -Id "Korea Standard Time"
Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' -name "fDenyTSConnections" -value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
\`\`\`

#### Linux (CentOS/RHEL 8)
\`\`\`bash
# 기본 설정
timedatectl set-timezone Asia/Seoul
systemctl enable chronyd
systemctl start chronyd
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload
\`\`\`

## 보안 설정

### 계정 관리
- **관리자 계정**: 복잡한 패스워드, 정기 변경
- **서비스 계정**: 최소 권한, 전용 계정
- **감사 계정**: 읽기 전용, 로그 접근

### 패스워드 정책
- **최소 길이**: 12자
- **복잡성**: 영문/숫자/특수문자 조합
- **변경 주기**: 90일
- **이력 관리**: 최근 12개 기억

### 방화벽 설정
\`\`\`bash
# Linux iptables 기본 규칙
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -s 192.168.10.0/24 -j ACCEPT
\`\`\`

## 서비스별 구성

### 웹 서버 (Apache/Nginx)

#### Apache 설정
\`\`\`apache
# /etc/httpd/conf/httpd.conf
ServerTokens Prod
ServerSignature Off
Timeout 60
KeepAlive On
MaxKeepAliveRequests 100
\`\`\`

#### Nginx 설정
\`\`\`nginx
# /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
client_max_body_size 50M;
\`\`\`

### 데이터베이스 서버

#### MySQL/MariaDB 최적화
\`\`\`sql
-- my.cnf 주요 설정
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 16G
innodb_log_file_size = 1G
slow_query_log = 1
\`\`\`

#### PostgreSQL 최적화
\`\`\`sql
-- postgresql.conf 주요 설정
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
checkpoint_segments = 32
\`\`\`

## 모니터링 에이전트

### SNMP 설정
\`\`\`bash
# /etc/snmp/snmpd.conf
community public
syslocation "Main Data Center"
syscontact "admin@company.com"
\`\`\`

### Zabbix Agent
\`\`\`bash
# /etc/zabbix/zabbix_agentd.conf
Server=192.168.10.100
ServerActive=192.168.10.100
Hostname=server01
EnableRemoteCommands=1
\`\`\`

## 백업 설정

### 파일 시스템 백업
\`\`\`bash
#!/bin/bash
# daily_backup.sh
BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/system.tar.gz /etc /var/log
rsync -av /home/ $BACKUP_DIR/home/
\`\`\`

### 데이터베이스 백업
\`\`\`bash
#!/bin/bash
# mysql_backup.sh
mysqldump --all-databases --single-transaction --routines --triggers > 
/backup/mysql_$(date +%Y%m%d).sql
\`\`\`

## 로그 관리

### 로그 로테이션
\`\`\`bash
# /etc/logrotate.d/custom
/var/log/application/*.log {
    daily
    rotate 30
    compress
    delaycompress
    copytruncate
}
\`\`\`

### 중앙 로그 서버
\`\`\`bash
# rsyslog 설정
*.* @@192.168.10.150:514
\`\`\`
            `
        }
    },

    navigation: [
        {
            id: 'section-infrastructure',
            title: '인프라 개요',
            items: [
                { key: 'infrastructure-intro', title: '인프라 소개' },
                { key: 'infrastructure-architecture', title: '아키텍처 개요' },
                { key: 'infrastructure-components', title: '주요 구성요소' }
            ]
        },
        {
            id: 'section-network',
            title: '네트워크',
            items: [
                { key: 'network-topology', title: '네트워크 토폴로지' },
                { key: 'network-security', title: '네트워크 보안' },
                { key: 'network-monitoring', title: '네트워크 모니터링' }
            ]
        },
        {
            id: 'section-servers',
            title: '서버 관리',
            items: [
                { key: 'server-setup', title: '서버 설정' }
            ]
        },
        {
            id: 'section-security',
            title: '보안',
            items: []
        },
        {
            id: 'section-backup',
            title: '백업 및 복구',
            items: []
        },
        {
            id: 'section-troubleshooting',
            title: '트러블슈팅',
            items: []
        }
    ],

    settings: {
        admin: {
            enabled: false,
            passcode: null
        },
        pasteRules: {
            keepBold: true,
            keepItalic: true,
            keepUnderline: false,
            keepColors: false,
            keepBackgrounds: false,
            keepAlignment: true,
            autoTableFromTabs: false,
            defaultMode: 'clean',
            wordStyleMap: {
                MsoTitle: 'doc-title',
                MsoSubtitle: 'doc-subtitle',
                MsoHeading1: 'doc-heading-1',
                MsoHeading2: 'doc-heading-2',
                MsoHeading3: 'doc-heading-3',
                MsoQuote: 'doc-quote'
            }
        },
        quickLinks: DEFAULT_QUICK_LINKS.map(link => ({ ...link }))
    },

    storageKey: 'infrastructureManualData',
    allowedPasteStyleProps: null,

    // 검색 기능
    searchContent: function(query) {
        if (!query || !query.trim()) {
            return [];
        }
        const results = [];
        const searchQuery = query.toLowerCase();

        for (const [key, item] of Object.entries(this.content)) {
            const title = item.title.toLowerCase();
            const content = this.getPlainText(item).toLowerCase();
            
            if (title.includes(searchQuery) || content.includes(searchQuery)) {
                // 스니펫 생성
                const index = content.indexOf(searchQuery);
                const start = Math.max(0, index - 100);
                const end = Math.min(content.length, index + 100);
                const snippet = content.substring(start, end);
                
                results.push({
                    key: key,
                    title: item.title,
                    snippet: snippet
                });
            }
        }

        return results;
    },

    // 콘텐츠 추가
    addContent: function(key, title, content, format = 'markdown') {
        this.content[key] = {
            title: title,
            content: content,
            format: format,
            updatedAt: new Date().toISOString()
        };
        return this.content[key];
    },

    // 콘텐츠 수정
    updateContent: function(key, content, format = 'markdown') {
        if (this.content[key]) {
            this.content[key].content = content;
            this.content[key].format = format;
            this.content[key].updatedAt = new Date().toISOString();
            return true;
        }
        return false;
    },

    // 콘텐츠 삭제
    deleteContent: function(key) {
        if (this.content[key]) {
            delete this.content[key];
            this.removeNavigationItem(key);
            return true;
        }
        return false;
    },

    getNavigation: function(includeOrphans = true) {
        if (includeOrphans) {
            this.ensureNavigationCoverage();
        }
        return this.navigation;
    },

    findSectionById: function(sectionId) {
        return this.navigation.find(section => section.id === sectionId);
    },

    findSectionByContentKey: function(contentKey) {
        for (let i = 0; i < this.navigation.length; i++) {
            const section = this.navigation[i];
            const itemIndex = section.items.findIndex(item => item.key === contentKey);
            if (itemIndex !== -1) {
                return { section, sectionIndex: i, itemIndex };
            }
        }
        return null;
    },

    addNavigationSection: function(title) {
        const id = this.generateSectionId(title);
        const section = {
            id,
            title,
            items: []
        };
        this.navigation.push(section);
        return section;
    },

    renameNavigationSection: function(sectionId, title) {
        const section = this.findSectionById(sectionId);
        if (!section) return false;
        section.title = title;
        return true;
    },

    renameNavigationItem: function(contentKey, title) {
        const match = this.findSectionByContentKey(contentKey);
        if (!match) return false;
        match.section.items[match.itemIndex].title = title;
        return true;
    },

    updateContentTitle: function(contentKey, title) {
        const content = this.content[contentKey];
        if (!content) return false;
        content.title = title;
        return true;
    },

    deleteNavigationSection: function(sectionId, options = { deleteContent: true }) {
        const index = this.navigation.findIndex(section => section.id === sectionId);
        if (index === -1) return false;
        const [section] = this.navigation.splice(index, 1);
        if (options.deleteContent) {
            section.items.forEach(item => {
                delete this.content[item.key];
            });
        }
        return true;
    },

    addNavigationItem: function(sectionId, title, contentKey) {
        const section = this.findSectionById(sectionId);
        if (!section) return null;
        const exists = section.items.some(item => item.key === contentKey);
        if (exists) return section.items.find(item => item.key === contentKey);
        const item = { key: contentKey, title };
        section.items.push(item);
        return item;
    },

    removeNavigationItem: function(contentKey) {
        let removed = false;
        this.navigation.forEach(section => {
            const originalLength = section.items.length;
            section.items = section.items.filter(item => item.key !== contentKey);
            if (section.items.length !== originalLength) {
                removed = true;
            }
        });
        return removed;
    },

    generateSectionId: function(title) {
        const base = (title || 'section')
            .toLowerCase()
            .replace(/[^a-z0-9가-힣]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'section';
        let candidate = `section-${base}`;
        let suffix = 1;
        while (this.navigation.some(section => section.id === candidate)) {
            candidate = `section-${base}-${suffix++}`;
        }
        return candidate;
    },

    ensureNavigationCoverage: function() {
        const referenced = new Set();
        this.navigation.forEach(section => {
            section.items = section.items.filter(item => !!this.content[item.key]);
            section.items.forEach(item => referenced.add(item.key));
        });

        const orphanKeys = Object.keys(this.content).filter(key => !referenced.has(key));
        if (!orphanKeys.length) {
            return;
        }

        if (!this.navigation.length) {
            this.navigation.push({
                id: 'section-default',
                title: '기본 목차',
                items: []
            });
        }

        const fallback = this.navigation[0];
        orphanKeys.forEach(key => {
            fallback.items.push({
                key,
                title: this.content[key]?.title || key
            });
        });
    },

    ensureContentMetadata: function() {
        if (!this.content) {
            return;
        }
        Object.keys(this.content).forEach((key) => {
            if (!this.content[key].updatedAt) {
                this.content[key].updatedAt = DEFAULT_UPDATED_AT;
            }
        });
    },

    getContentUpdatedAt: function(key) {
        if (!key || !this.content[key]) {
            return null;
        }
        if (!this.content[key].updatedAt) {
            this.content[key].updatedAt = DEFAULT_UPDATED_AT;
        }
        return this.content[key].updatedAt;
    },

    isContentRecentlyUpdated: function(key, windowHours = 72) {
        const updatedAt = this.getContentUpdatedAt(key);
        if (!updatedAt) {
            return false;
        }
        const timestamp = Date.parse(updatedAt);
        if (Number.isNaN(timestamp)) {
            return false;
        }
        const threshold = Date.now() - (windowHours * 60 * 60 * 1000);
        return timestamp >= threshold;
    },

    getRecentUpdates: function(windowHours = 72, limit = 5) {
        if (!this.content) {
            return [];
        }
        this.ensureContentMetadata();
        const threshold = Date.now() - (windowHours * 60 * 60 * 1000);
        return Object.entries(this.content)
            .filter(([, item]) => {
                const timestamp = Date.parse(item.updatedAt || DEFAULT_UPDATED_AT);
                return !Number.isNaN(timestamp) && timestamp >= threshold;
            })
            .sort(([, a], [, b]) => {
                const aTime = Date.parse(a.updatedAt || DEFAULT_UPDATED_AT);
                const bTime = Date.parse(b.updatedAt || DEFAULT_UPDATED_AT);
                return bTime - aTime;
            })
            .slice(0, Math.max(1, limit || 5))
            .map(([key, item]) => ({
                key,
                title: item.title,
                updatedAt: item.updatedAt || DEFAULT_UPDATED_AT
            }));
    },

    // 목차 생성
    generateTableOfContents: function() {
        const toc = [];
        this.ensureNavigationCoverage();
        this.navigation.forEach(section => {
            section.items.forEach(item => {
                toc.push({
                    key: item.key,
                    title: item.title,
                    section: section.title
                });
            });
        });
        return toc;
    },

    // 로컬 스토리지에 저장
    saveToLocalStorage: function() {
        try {
            const payload = this.getStatePayload();
            localStorage.setItem(this.storageKey, JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error('로컬 스토리지 저장 실패:', error);
            return false;
        }
    },

    getStatePayload: function() {
        this.normalizeContentObject(this.content);
        return {
            content: JSON.parse(JSON.stringify(this.content)),
            navigation: JSON.parse(JSON.stringify(this.navigation)),
            settings: JSON.parse(JSON.stringify(this.settings))
        };
    },

    // 로컬 스토리지에서 불러오기
    loadFromLocalStorage: function() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.content || parsed.navigation || parsed.settings) {
                    if (parsed.content) {
                        this.normalizeContentObject(parsed.content);
                        this.content = { ...this.content, ...parsed.content };
                    }
                    if (parsed.navigation) {
                        this.navigation = parsed.navigation;
                    }
                    if (parsed.settings) {
                        this.settings = {
                            admin: {
                                enabled: !!parsed.settings.admin?.enabled,
                                passcode: parsed.settings.admin?.passcode || null
                            },
                            pasteRules: {
                                ...this.settings.pasteRules,
                                ...(parsed.settings.pasteRules || {})
                            },
                            quickLinks: Array.isArray(parsed.settings.quickLinks) && parsed.settings.quickLinks.length
                                ? parsed.settings.quickLinks
                                : this.settings.quickLinks
                        };
                    }
                } else {
                    this.normalizeContentObject(parsed);
                    this.content = { ...this.content, ...parsed };
                }
                this.ensureContentMetadata();
                this.ensureNavigationCoverage();
                return true;
            }
        } catch (error) {
            console.error('로컬 스토리지 로드 실패:', error);
        }
        this.ensureContentMetadata();
        this.ensureNavigationCoverage();
        return false;
    },

    loadFromObject: function(state) {
        if (!state || typeof state !== 'object') {
            return false;
        }
        try {
            if (state.content) {
                const contentClone = JSON.parse(JSON.stringify(state.content));
                this.normalizeContentObject(contentClone);
                this.content = contentClone;
            }
            if (state.navigation) {
                this.navigation = JSON.parse(JSON.stringify(state.navigation));
            }
            if (state.settings) {
                const baseRules = { ...this.getPasteRules() };
                const incomingSettings = JSON.parse(JSON.stringify(state.settings));
                const mergedRules = {
                    ...baseRules,
                    ...(incomingSettings.pasteRules || {})
                };
                const quickLinks = Array.isArray(incomingSettings.quickLinks) && incomingSettings.quickLinks.length
                    ? incomingSettings.quickLinks
                    : this.getDefaultQuickLinks();
                this.settings = {
                    admin: {
                        enabled: !!incomingSettings.admin?.enabled,
                        passcode: incomingSettings.admin?.passcode || null
                    },
                    pasteRules: mergedRules,
                    quickLinks
                };
            }
            this.ensureContentMetadata();
            this.ensureNavigationCoverage();
            return true;
        } catch (error) {
            console.error('메모리 상태 로드 실패:', error);
            return false;
        }
    },

    normalizeContentObject: function(contentMap) {
        if (!contentMap) return;
        Object.values(contentMap).forEach(item => {
            if (!item.format) {
                item.format = 'markdown';
            }
            if (!item.updatedAt) {
                item.updatedAt = DEFAULT_UPDATED_AT;
            }
        });
    },

    // Markdown을 HTML로 변환 (간단한 변환기)
    markdownToHtml: function(markdown) {
        let html = markdown
            // 제목
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // 굵은 글씨
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            // 기울임
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            // 인라인 코드
            .replace(/`([^`]*)`/gim, '<code>$1</code>')
            // 코드 블록
            .replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre><code class="language-$1">$2</code></pre>')
            // 인용문
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            // 링크
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
            // 테이블 (기본적인 변환)
            .replace(/\|(.+)\|/g, function(match, content) {
                const cells = content.split('|').map(cell => cell.trim());
                const cellsHtml = cells.map(cell => `<td>${cell}</td>`).join('');
                return `<tr>${cellsHtml}</tr>`;
            })
            // 리스트
            .replace(/^[\*\-] (.*)$/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            // 문단
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gim, '<p>$1</p>');

        return html;
    },

    renderContent: function(item, skipSanitize = false) {
        if (!item) return '';
        if (item.format === 'html') {
            return skipSanitize ? item.content : this.cleanHtml(item.content);
        }
        return this.markdownToHtml(item.content);
    },

    getPlainText: function(item) {
        if (!item) return '';
        if (item.format === 'html') {
            const temp = document.createElement('div');
            temp.innerHTML = item.content;
            return temp.textContent || '';
        }
        return item.content;
    },

    cleanHtml: function(html) {
        if (!html) return '';
        const template = document.createElement('template');
        template.innerHTML = html;
        template.content.querySelectorAll('script, style').forEach(node => node.remove());
        template.content.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return template.innerHTML;
    },

    isLikelyOfficeHtml: function(html) {
        if (!html) return false;
        return /class="?Mso|mso-|<o:p>|OfficeDocumentSettings|StartFragment|urn:schemas-microsoft-com|<w:WordDocument/i.test(html);
    },

    normalizeOfficeHtml: function(html) {
        const result = this.normalizeOfficeFragment(html);
        return result.html;
    },

    normalizeOfficeFragment: function(html) {
        if (!html) return { html: '', summary: null };
        const summary = {
            removedTags: 0,
            removedStyles: 0,
            keptStyles: 0,
            tables: 0,
            mappedStyles: new Set(),
            convertedDividers: 0
        };

        try {
            const template = document.createElement('template');
            template.innerHTML = html;
            const fragment = template.content;
            const rules = this.getPasteRules();

            fragment.querySelectorAll('meta, link, xml, title, style, script').forEach(node => {
                summary.removedTags++;
                node.remove();
            });

            const commentNodes = [];
            const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT, null);
            while (walker.nextNode()) {
                commentNodes.push(walker.currentNode);
            }
            commentNodes.forEach(node => {
                summary.removedTags++;
                node.parentNode?.removeChild(node);
            });

            this.convertWordLists(fragment);

            fragment.querySelectorAll('*').forEach(el => {
                if (el && !el.isConnected) {
                    return;
                }
                const tag = el.tagName || '';
                if (/^(O:|W:|V:)/i.test(tag)) {
                    summary.removedTags++;
                    while (el.firstChild) {
                        el.parentNode?.insertBefore(el.firstChild, el);
                    }
                    el.remove();
                    return;
                }

                const styleAttr = el.getAttribute('style');

                if (styleAttr) {
                    const dividerReplacement = this.extractWordDividerReplacement(el, styleAttr);
                    if (dividerReplacement && dividerReplacement.target.parentNode) {
                        dividerReplacement.target.parentNode.replaceChild(dividerReplacement.node, dividerReplacement.target);
                        summary.convertedDividers++;
                        return;
                    }
                }

                if (el.className) {
                    const mapped = this.applyWordStyleMapping(el.className, el);
                    if (mapped) {
                        summary.mappedStyles.add(mapped);
                    }
                }

                if (tag === 'IMG') {
                    this.captureWordImageDimensions(el, styleAttr);
                }
                if (styleAttr) {
                    const filteredStyle = this.filterOfficeStyle(styleAttr, rules);
                    if (filteredStyle) {
                        summary.keptStyles++;
                        el.setAttribute('style', filteredStyle);
                    } else {
                        summary.removedStyles++;
                        el.removeAttribute('style');
                    }
                }
            });

            fragment.querySelectorAll('table').forEach(table => {
                summary.tables++;
                if (!table.querySelector('tbody')) {
                    const tbody = document.createElement('tbody');
                    Array.from(table.children).forEach(child => {
                        if (child.tagName === 'TR') {
                            tbody.appendChild(child);
                        } else if (child.tagName === 'TBODY') {
                            tbody.append(...Array.from(child.children));
                            child.remove();
                        }
                    });
                    if (tbody.children.length) {
                        table.appendChild(tbody);
                    }
                }
            });

            if (!rules.preserveWordLayoutTables) {
                this.unwrapOfficeLayoutTables(fragment);
            }
            this.ensureWordParagraphSpacing(fragment);
            const cleaned = this.cleanHtml(fragment.innerHTML);
            return {
                html: cleaned,
                summary: {
                    ...summary,
                    mappedStyles: Array.from(summary.mappedStyles)
                }
            };
        } catch (error) {
            console.warn('Office HTML 변환 중 오류:', error);
            return { html: this.cleanHtml(html), summary: null };
        }
    },

    extractWordDividerReplacement: function(element, styleAttr) {
        if (!element || !styleAttr) {
            return null;
        }
        if (!this.looksLikeWordDividerStyle(styleAttr)) {
            return null;
        }
        const target = this.resolveWordDividerTarget(element);
        if (!target) {
            return null;
        }
        const divider = this.buildWordDividerElement(styleAttr);
        if (!divider) {
            return null;
        }
        return { target, node: divider };
    },

    resolveWordDividerTarget: function(element) {
        if (!element) {
            return null;
        }
        const allowed = ['p', 'div', 'section', 'article', 'header', 'footer', 'span'];
        let current = element;
        let tagName = (current.tagName || '').toLowerCase();
        if (!allowed.includes(tagName)) {
            return null;
        }
        if (tagName === 'span' && current.parentElement && /^(p|div)$/i.test(current.parentElement.tagName || '')) {
            current = current.parentElement;
            tagName = (current.tagName || '').toLowerCase();
        }
        if (!['p', 'div', 'section', 'article', 'header', 'footer'].includes(tagName)) {
            return null;
        }
        const textContent = (current.textContent || '').replace(/\u00a0/g, '').trim();
        if (textContent) {
            return null;
        }
        return current;
    },

    looksLikeWordDividerStyle: function(styleAttr) {
        if (!styleAttr) {
            return false;
        }
        const lowered = styleAttr.toLowerCase();
        const hasTop = /border(-top)?\s*:\s*(?!0|none)/.test(lowered)
            || /border-top-width\s*:\s*(?!0)/.test(lowered)
            || /mso-border-top-alt\s*:\s*(?!0|none)/.test(lowered);
        const hasBottom = /border(-bottom)?\s*:\s*(?!0|none)/.test(lowered)
            || /border-bottom-width\s*:\s*(?!0)/.test(lowered)
            || /mso-border-bottom-alt\s*:\s*(?!0|none)/.test(lowered);
        return hasTop || hasBottom;
    },

    buildWordDividerElement: function(styleAttr) {
        if (!styleAttr) {
            return null;
        }
        const divider = document.createElement('hr');
        divider.className = 'editor-divider';
        divider.setAttribute('data-divider', 'neutral');
        divider.setAttribute('data-source', 'word-divider');
        const styleMap = this.parseInlineStyle(styleAttr);
        const width = (styleMap.width || '').trim();
        if (width && width !== 'auto') {
            divider.style.width = width;
        }
        ['margin-top', 'margin-bottom'].forEach(prop => {
            const value = (styleMap[prop] || '').trim();
            if (value) {
                divider.style.setProperty(prop, value);
            }
        });
        const align = (styleMap['text-align'] || '').toLowerCase();
        if (align === 'center') {
            divider.style.marginLeft = 'auto';
            divider.style.marginRight = 'auto';
        } else if (align === 'right') {
            divider.style.marginLeft = 'auto';
        }
        const color = this.extractWordDividerColor(styleAttr);
        if (color) {
            divider.style.background = color;
        }
        const thickness = this.extractWordDividerThickness(styleAttr);
        if (thickness) {
            divider.style.height = thickness;
        }
        return divider;
    },

    extractWordDividerColor: function(styleAttr) {
        if (!styleAttr) {
            return '';
        }
        const match = styleAttr.match(/border-(?:top|bottom)[^;]*?(#[0-9a-f]{3,8}|rgba?\([^\)]+\)|hsl\([^\)]+\)|[a-z]+)/i);
        if (!match) {
            return '';
        }
        return this.normalizeSystemColor(match[1]);
    },

    extractWordDividerThickness: function(styleAttr) {
        if (!styleAttr) {
            return '';
        }
        const match = styleAttr.match(/border-(?:top|bottom)[^;]*?(\d+(?:\.\d+)?(?:px|pt|mm|cm))/i);
        if (!match) {
            return '';
        }
        return match[1];
    },

    normalizeSystemColor: function(value) {
        if (!value) {
            return '';
        }
        const normalized = String(value).trim().toLowerCase();
        const map = {
            windowtext: '#111827',
            windowframe: '#1f2937',
            'gray-text': '#9ca3af'
        };
        if (map[normalized]) {
            return map[normalized];
        }
        return value.trim();
    },

    convertWordLists: function(root) {
        if (!root) {
            return;
        }
        const paragraphs = Array.from(root.querySelectorAll('p'));
        let activeList = null;
        let activeMeta = null;
        paragraphs.forEach((p) => {
            const meta = this.getWordListMeta(p);
            if (!meta || !p.parentNode) {
                activeList = null;
                activeMeta = null;
                return;
            }
            const shouldReset = !activeList
                || !activeMeta
                || activeMeta.type !== meta.type
                || activeMeta.listId !== meta.listId;
            if (shouldReset) {
                activeList = this.createWordListElement(meta, p.parentNode, p);
                activeMeta = meta;
            }
            if (!activeList) {
                return;
            }
            const li = document.createElement('li');
            if (meta.level > 1) {
                li.style.marginLeft = `${(meta.level - 1) * 24}px`;
            }
            this.stripWordListPrefix(p);
            while (p.firstChild) {
                li.appendChild(p.firstChild);
            }
            activeList.appendChild(li);
            p.remove();
        });
    },

    createWordListElement: function(meta, parentNode, referenceNode = null) {
        if (!parentNode) {
            return null;
        }
        const tag = meta.type === 'bullet' ? 'ul' : 'ol';
        const list = document.createElement(tag);
        if (meta.listId) {
            list.dataset.wordList = meta.listId;
        }
        list.dataset.wordLevel = String(meta.level || 1);
        if (referenceNode) {
            parentNode.insertBefore(list, referenceNode);
        } else {
            parentNode.appendChild(list);
        }
        return list;
    },

    getWordListMeta: function(element) {
        if (!element) {
            return null;
        }
        const className = (element.className || '').toLowerCase();
        const styleAttr = (element.getAttribute('style') || '').toLowerCase();
        if (!/mso-list/.test(styleAttr) && !/mso(list|listparagraph)/.test(className)) {
            return null;
        }
        const levelMatch = styleAttr.match(/level(\d+)/) || className.match(/level(\d+)/);
        const listIdMatch = styleAttr.match(/mso-list:\s*l(\d+)/);
        return {
            level: levelMatch ? Number(levelMatch[1]) || 1 : 1,
            listId: listIdMatch ? listIdMatch[1] : '',
            type: this.detectWordListType(element)
        };
    },

    detectWordListType: function(element) {
        const text = (element.textContent || '').trim();
        if (/^[\u2022\u00b7\u25cf\u25cb\u25a0]/.test(text)) {
            return 'bullet';
        }
        if (/^(\d+\.|\d+\)|[a-z]+\.|[ivxlcdm]+\.)/i.test(text)) {
            return 'ordered';
        }
        return 'ordered';
    },

    stripWordListPrefix: function(element) {
        if (!element) {
            return;
        }
        element.querySelectorAll('[style]').forEach(node => {
            const inlineStyle = node.getAttribute('style') || '';
            if (/mso-list:ignore/i.test(inlineStyle)) {
                node.remove();
            }
        });
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        const pattern = /^(?:[\s\u00a0]*((?:\d+|[a-z]+|[ivxlcdm]+)(?:[\.)])|[\u2022\u00b7\u25cf\u25cb\u25a0]))[\s\u00a0]*/i;
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const original = node.textContent || '';
            const updated = original.replace(pattern, '');
            if (updated !== original) {
                node.textContent = updated;
                break;
            }
        }
    },

    ensureWordParagraphSpacing: function(root) {
        if (!root) {
            return;
        }
        root.querySelectorAll('p').forEach((p) => {
            const styleAttr = p.getAttribute('style') || '';
            const className = p.className || '';
            const looksWordPara = /mso/i.test(styleAttr) || /mso/i.test(className);
            if (!looksWordPara) {
                return;
            }
            const styleMap = this.parseInlineStyle(styleAttr);
            const computedMarginBottom = styleMap['margin-bottom'] || '';
            const computedMarginTop = styleMap['margin-top'] || '';
            if (!computedMarginBottom || /^0(?:px|pt|em|rem)?$/.test(computedMarginBottom)) {
                p.style.marginBottom = '12px';
            }
            if (!computedMarginTop || /^0(?:px|pt|em|rem)?$/.test(computedMarginTop)) {
                p.style.marginTop = '0';
            }
            if (!styleMap['line-height']) {
                const paragraphSpacing = this.inferWordLineHeight(styleMap);
                if (paragraphSpacing) {
                    p.style.lineHeight = paragraphSpacing;
                }
            }
        });
    },

    inferWordLineHeight: function(styleMap) {
        if (!styleMap) {
            return '';
        }
        const spacing = styleMap['mso-line-height-rule'];
        if (spacing) {
            if (spacing.includes('exactly')) {
                return '1.2';
            }
            if (spacing.includes('at-least')) {
                return '1.3';
            }
        }
        const unitHeight = styleMap['line-height'];
        if (unitHeight) {
            return unitHeight;
        }
        return '';
    },

    unwrapOfficeLayoutTables: function(root) {
        if (!root) return;
        let mutated = true;
        while (mutated) {
            mutated = false;
            const tables = Array.from(root.querySelectorAll('table'));
            tables.forEach(table => {
                if (!this.isOfficeLayoutTable(table)) {
                    return;
                }
                const parent = table.parentNode;
                if (!parent) {
                    return;
                }
                const fragment = document.createDocumentFragment();
                while (table.firstChild) {
                    fragment.appendChild(table.firstChild);
                }
                parent.insertBefore(fragment, table);
                parent.removeChild(table);
                mutated = true;
            });
        }
    },

    isOfficeLayoutTable: function(table) {
        if (!table) return false;
        const rows = Array.from(table.rows || []);
        if (!rows.length) return false;

        if (table.querySelector('th')) {
            return false;
        }

        const borderless = !this.tableHasVisibleBorder(table);
        const singleCellRows = rows.every(row => row.cells.length <= 1);
        const nestedTableCount = table.querySelectorAll('table').length;
        const textBlockCount = table.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, ul, ol').length;
        const wordClass = /(Mso|WordSection|Section)/i.test(table.className || '');
        const parent = table.parentElement;
        const parentLooksLikeWord = parent && /(body|div)/i.test(parent.tagName || '') && /(WordSection|Mso)/i.test(parent.className || '');
        const mostlyTextCells = rows.length > 1 && Array.from(table.querySelectorAll('td')).every(td => this.cellLooksLikeBlock(td));

        if (!borderless) {
            return false;
        }

        if ((singleCellRows && nestedTableCount > 1) || (singleCellRows && mostlyTextCells)) {
            return true;
        }

        if ((wordClass || parentLooksLikeWord) && singleCellRows && (nestedTableCount || textBlockCount > rows.length)) {
            return true;
        }

        return false;
    },

    cellLooksLikeBlock: function(cell) {
        if (!cell) return false;
        if (cell.querySelector('table')) {
            return true;
        }
        if (cell.querySelector('p, div, h1, h2, h3, h4, h5, h6, ul, ol')) {
            return true;
        }
        const text = (cell.textContent || '').trim();
        return text.length > 60;
    },

    tableHasVisibleBorder: function(table) {
        if (!table) return false;
        const borderAttr = (table.getAttribute('border') || '').trim();
        if (borderAttr && borderAttr !== '0') {
            return true;
        }
        const style = (table.getAttribute('style') || '').toLowerCase();
        if (!style) {
            return false;
        }
        if (/border-(top|right|bottom|left)?\s*:\s*(?:none|0)/.test(style)) {
            const otherBorders = style.match(/border-(top|right|bottom|left)?\s*:\s*([^;]+)/g) || [];
            const hasVisible = otherBorders.some(decl => !/border[^:]*:\s*(?:none|0)/.test(decl));
            if (!hasVisible && /border:\s*(?:none|0)/.test(style)) {
                return false;
            }
        }
        if (/border(-top|-right|-bottom|-left)?\s*:\s*(?!0|none)/.test(style)) {
            return true;
        }
        if (/border-width\s*:\s*(?!0)/.test(style)) {
            return true;
        }
        return false;
    },

    captureWordImageDimensions: function(element, inlineStyle = '') {
        if (!element) {
            return;
        }
        const styleMap = inlineStyle ? this.parseInlineStyle(inlineStyle) : {};
        const widthValue = styleMap.width || element.getAttribute('width') || '';
        const heightValue = styleMap.height || element.getAttribute('height') || '';
        const widthPx = this.cssSizeToPixels(widthValue);
        const heightPx = this.cssSizeToPixels(heightValue);
        if (widthPx) {
            element.setAttribute('data-word-width', String(widthPx));
        }
        if (heightPx) {
            element.setAttribute('data-word-height', String(heightPx));
        }
    },

    parseInlineStyle: function(styleString) {
        if (!styleString) {
            return {};
        }
        return styleString.split(';').reduce((acc, declaration) => {
            const [prop, value] = declaration.split(':');
            if (!prop || !value) {
                return acc;
            }
            acc[prop.trim().toLowerCase()] = value.trim();
            return acc;
        }, {});
    },

    cssSizeToPixels: function(value) {
        if (!value) {
            return null;
        }
        const trimmed = String(value).trim().toLowerCase();
        if (!trimmed) {
            return null;
        }
        const unitMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|pt|cm|mm|in)?$/);
        if (!unitMatch) {
            return null;
        }
        const numeric = parseFloat(unitMatch[1]);
        const unit = unitMatch[2] || 'px';
        if (Number.isNaN(numeric)) {
            return null;
        }
        switch (unit) {
            case 'px':
                return numeric;
            case 'pt':
                return numeric * (96 / 72);
            case 'cm':
                return numeric * (96 / 2.54);
            case 'mm':
                return numeric * (96 / 25.4);
            case 'in':
                return numeric * 96;
            default:
                return null;
        }
    },

    filterOfficeStyle: function(styleString, rules = null) {
        if (!styleString) return '';
        const preferences = rules || this.getPasteRules();
        const allowed = this.getAllowedPasteStyleProps();
        const styleMap = this.parseInlineStyle(styleString);
        const preserved = [];
        Object.entries(styleMap).forEach(([prop, value]) => {
            if (!value) {
                return;
            }
            const normalizedProp = prop.toLowerCase();
            if (!allowed.has(normalizedProp)) {
                return;
            }
            if (!this.shouldKeepStyleProperty(normalizedProp, value, preferences)) {
                return;
            }
            preserved.push(`${normalizedProp}:${value}`);
        });
        return preserved.join('; ');
    },

    shouldKeepStyleProperty: function(prop, value, preferences = null) {
        const rules = preferences || this.getPasteRules();
        const normalizedValue = (value || '').toLowerCase();
        switch (prop) {
            case 'font-weight':
                return rules.keepBold || /normal/.test(normalizedValue);
            case 'font-style':
                return rules.keepItalic || normalizedValue === 'normal';
            case 'text-decoration':
                if (/underline/.test(normalizedValue)) {
                    return !!rules.keepUnderline;
                }
                return true;
            case 'color':
                return !!rules.keepColors;
            case 'background':
            case 'background-color':
                return !!rules.keepBackgrounds;
            case 'text-align':
                return !!rules.keepAlignment;
            default:
                return true;
        }
    },

    getAllowedPasteStyleProps: function() {
        if (this.allowedPasteStyleProps instanceof Set) {
            return this.allowedPasteStyleProps;
        }
        this.allowedPasteStyleProps = new Set([
            'font-weight',
            'font-style',
            'text-decoration',
            'text-align',
            'color',
            'background',
            'background-color',
            'background-image',
            'background-size',
            'background-position',
            'background-repeat',
            'margin',
            'margin-left',
            'margin-right',
            'margin-top',
            'margin-bottom',
            'padding',
            'padding-left',
            'padding-right',
            'padding-top',
            'padding-bottom',
            'line-height',
            'font-size',
            'font-family',
            'letter-spacing',
            'text-indent',
            'border',
            'border-left',
            'border-right',
            'border-top',
            'border-bottom',
            'border-color',
            'border-width',
            'border-style',
            'border-collapse',
            'border-spacing',
            'width',
            'min-width',
            'max-width',
            'height',
            'min-height',
            'max-height',
            'list-style-type',
            'list-style-position',
            'list-style-image',
            'white-space'
        ]);
        return this.allowedPasteStyleProps;
    },

    applyWordStyleMapping: function(className, element) {
        if (!className || !element) return null;
        const rules = this.getPasteRules();
        const classes = className.split(/\s+/);
        let mapped = null;
        classes.forEach(cls => {
            const match = rules.wordStyleMap?.[cls];
            if (match) {
                element.classList.add(match);
                mapped = match;
            }
        });
        return mapped;
    },

    getPasteRules: function() {
        if (!this.settings || !this.settings.pasteRules) {
            this.settings.pasteRules = {
                keepBold: true,
                keepItalic: true,
                keepUnderline: true,
                keepColors: true,
                keepBackgrounds: true,
                keepAlignment: true,
                autoTableFromTabs: false,
                preserveWordLayoutTables: true,
                defaultMode: 'clean',
                wordStyleMap: {}
            };
        }
        if (typeof this.settings.pasteRules.autoTableFromTabs === 'undefined') {
            this.settings.pasteRules.autoTableFromTabs = false;
        }
        if (typeof this.settings.pasteRules.preserveWordLayoutTables === 'undefined') {
            this.settings.pasteRules.preserveWordLayoutTables = true;
        }
        return this.settings.pasteRules;
    },

    updatePasteRules: function(partial) {
        const current = this.getPasteRules();
        this.settings.pasteRules = {
            ...current,
            ...partial,
            wordStyleMap: {
                ...current.wordStyleMap,
                ...(partial?.wordStyleMap || {})
            }
        };
        this.saveToLocalStorage();
        return this.settings.pasteRules;
    },

    getDefaultQuickLinks: function() {
        return DEFAULT_QUICK_LINKS.map(link => ({ ...link }));
    },

    getQuickStartLinks: function() {
        if (!Array.isArray(this.settings.quickLinks) || !this.settings.quickLinks.length) {
            this.settings.quickLinks = this.getDefaultQuickLinks();
        }
        return this.settings.quickLinks;
    },

    updateQuickStartLinks: function(links) {
        const sanitized = Array.isArray(links)
            ? links
                .map(link => ({
                    title: (link.title || '').trim(),
                    description: (link.description || '').trim(),
                    key: (link.key || '').trim()
                }))
                .filter(link => link.title && link.key)
            : this.getDefaultQuickLinks();
        this.settings.quickLinks = sanitized.length ? sanitized : this.getDefaultQuickLinks();
        this.saveToLocalStorage();
        return this.settings.quickLinks;
    },

    resetQuickStartLinks: function() {
        this.settings.quickLinks = this.getDefaultQuickLinks();
        this.saveToLocalStorage();
        return this.settings.quickLinks;
    },

    getAdminConfig: function() {
        if (!this.settings || !this.settings.admin) {
            this.settings = {
                admin: {
                    enabled: false,
                    passcode: null
                }
            };
        }
        return this.settings.admin;
    },

    setAdminPasscode: function(passcode) {
        const hash = this.hashPasscode(passcode);
        this.getAdminConfig();
        this.settings.admin.enabled = true;
        this.settings.admin.passcode = hash;
        return this.settings.admin;
    },

    clearAdminLock: function() {
        this.getAdminConfig();
        this.settings.admin.enabled = false;
        this.settings.admin.passcode = null;
        return this.settings.admin;
    },

    verifyAdminPasscode: function(passcode) {
        if (!this.settings?.admin?.enabled || !this.settings.admin.passcode) {
            return false;
        }
        return this.settings.admin.passcode === this.hashPasscode(passcode);
    },

    hashPasscode: function(value) {
        if (typeof value !== 'string') {
            return '';
        }
        try {
            return btoa(unescape(encodeURIComponent(value)));
        } catch (e) {
            return value;
        }
    }
};

InfrastructureData.ensureContentMetadata();