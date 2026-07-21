# 확장 자동 배포 (GitHub Actions → Chrome Web Store)

`.github/workflows/publish-extension.yml` 가 확장을 자동으로 스토어에 업로드/게시한다.

- **자동**: `master` 에 `extension/**` 변경을 푸시하면 → **초안 업로드**(게시는 안 함)
- **수동**: GitHub → **Actions** 탭 → **Publish extension** → **Run workflow** → `publish` 체크하면 **심사 제출(게시)까지**

> ⚠️ 업로드 전에 `extension/manifest.json` 의 `version` 을 올려야 한다. 스토어는 같은 버전 재업로드를 거부한다.

## 최초 1회: GitHub Secrets 4개 등록

Settings → Secrets and variables → Actions → **New repository secret** 로 아래 4개 추가:

| Secret 이름 | 값 |
|-------------|-----|
| `CWS_EXTENSION_ID` | `khkdmmojedhfebdolbfkdgkldeiabafe` (이미 아는 값) |
| `CWS_CLIENT_ID` | 아래에서 발급 |
| `CWS_CLIENT_SECRET` | 아래에서 발급 |
| `CWS_REFRESH_TOKEN` | 아래에서 발급 |

## Client ID / Secret / Refresh Token 발급

Chrome Web Store 는 게시에 Google OAuth 를 쓴다. 한 번만 설정하면 된다.

### 1) Chrome Web Store API 사용 설정
- https://console.cloud.google.com → 프로젝트 생성/선택
- **API 및 서비스 → 라이브러리** → "Chrome Web Store API" 검색 → **사용 설정**

### 2) OAuth 동의 화면
- **API 및 서비스 → OAuth 동의 화면** → External → 앱 이름/이메일만 채우고 저장
- 테스트 사용자에 **본인 Google 계정**(스토어 개발자 계정) 추가

### 3) OAuth 클라이언트 만들기
- **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
- 애플리케이션 유형: **데스크톱 앱**
- 생성되면 **클라이언트 ID / 클라이언트 보안 비밀** 복사 → `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`

### 4) Refresh Token 발급
브라우저에서 아래 URL 열기 (`YOUR_CLIENT_ID` 교체):
```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&approval_prompt=force&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=YOUR_CLIENT_ID
```
- 본인 계정으로 승인 → 화면에 뜨는 **code** 복사
- 터미널에서 (교체 후) 실행:
```
curl -s "https://oauth2.googleapis.com/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=PASTED_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```
- 응답 JSON 의 **`refresh_token`** 값 → `CWS_REFRESH_TOKEN`

> `redirect_uri=urn:ietf:wg:oauth:2.0:oob` 가 막히면, 클라이언트 유형을 "웹 애플리케이션"으로 만들고 `http://localhost` 리디렉션을 써도 된다.

## 확인
Secrets 4개 등록 후 → Actions 탭에서 **Run workflow** → 로그에 업로드 성공이 뜨면 끝.
이후엔 버전만 올려 푸시하면 초안이 자동 갱신되고, 게시는 수동 실행으로 한다.
