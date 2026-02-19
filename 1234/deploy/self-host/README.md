# 자체 서버 배포 가이드 (Windows + IIS)

이 문서는 인프라 매뉴얼 정적 사이트를 Windows Server 환경(IIS)에 배포하는 방법을 안내합니다.

## 1. 사전 요구 사항

- Windows Server 2016 이상 또는 Windows 10/11 Pro (IIS 사용 가능)
- 관리자 권한 PowerShell
- 인터넷 연결(최초 IIS 설치 시 필요)
- 프로젝트 소스 코드 복사본 (이 저장소)

## 2. 배포 자동화 스크립트 실행

1. 서버에 이 저장소 전체를 복사합니다. (예: `C:\deploy\infrastructure-manual`)
2. 관리자 권한 PowerShell을 열고 `deploy\self-host` 폴더로 이동합니다.
3. 필요한 파라미터를 지정해 스크립트를 실행합니다.

```powershell
cd C:\deploy\infrastructure-manual\deploy\self-host
# 기본 포트 8080, 물리 경로 C:\inetpub\infrastructure-manual
./setup.ps1 -SiteName "InfraManual" -Port 8080 -PhysicalPath "C:\inetpub\infrastructure-manual"
```

### 스크립트가 수행하는 작업
- IIS(Web-Server) 역할 설치 (미설치 시)
- 배포 디렉토리 생성 및 로컬 소스와 동기화 (robocopy /MIR)
- IIS 사이트 생성 및 바인딩 설정
- JavaScript/CSS MIME 타입 보장, 기본 문서 설정
- Windows 방화벽에 인바운드 규칙 추가

## 3. 서비스 확인

1. 배포가 끝나면 브라우저에서 `http://<서버 IP>:<포트>`로 접속합니다.
2. 로컬 서버에서 테스트하려면 `http://localhost:8080` 형태로 확인합니다.
3. 로고나 콘텐츠를 수정한 뒤 다시 배포하려면 동일한 `setup.ps1`을 재실행하면 됩니다 (자동으로 덮어쓰기).

## 4. HTTPS 구성 (선택)

1. 서버에 인증서를 설치합니다 (Let's Encrypt, 사설 CA 등).
2. IIS 관리자에서 "바인딩" 메뉴를 열고 HTTPS 바인딩을 추가합니다.
3. HTTP에서 HTTPS로 리디렉션하려면 URL Rewrite 모듈 또는 `web.config`를 사용하여 규칙을 추가합니다.

## 5. 유지 관리 팁

- **콘텐츠 업데이트**: 저장소에서 변경 후 다시 `setup.ps1` 실행
- **백업**: `C:\inetpub\infrastructure-manual` 폴더를 정기적으로 백업
- **로그 확인**: IIS 로그(`%SystemDrive%\inetpub\logs\LogFiles`)를 통해 접속 현황 파악
- **보안**: 방화벽에서 허용 포트를 최소화하고, 필요 시 IP 제한 또는 VPN 뒤에서만 접근 가능하도록 구성

## 6. 다른 환경에 배포하기

- **Linux + NGINX/Apache**: `index.html` 이하 전체 파일을 `/var/www/infrastructure-manual`에 복사하고, NGINX `root`를 해당 폴더로 지정하면 됩니다.
- **Docker**: `nginx:alpine` 이미지를 사용해 `COPY` 후 80 포트로 노출하면 손쉽게 컨테이너화할 수 있습니다. (필요 시 `deploy/docker/Dockerfile`을 추가하세요.)

---

궁금한 점이나 추가 자동화가 필요하면 이 폴더에 스크립트를 더 추가해 주세요.
