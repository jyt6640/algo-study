# 확장 CI/CD 자동 배포 (GitHub Actions → Chrome Web Store)

이미 스토어에 최초 게시가 끝났으면, 이후 버전은 **태그 하나로 자동 업로드·게시**된다.

## 흐름

```
extension/manifest.json 의 version 을 올린다
git commit
git tag ext-v0.6.1 && git push origin ext-v0.6.1
```

- `.github/workflows/release-extension.yml` → GitHub Release 에 zip 첨부
- `.github/workflows/publish-extension.yml` → Chrome Web Store 업로드 + 심사 제출

> 스토어는 같은 버전 재업로드를 거부하므로 태그마다 `manifest.json` version 을 반드시 올릴 것.
> (수동 실행: Actions → "Publish extension" → Run workflow. publish 체크 해제 시 초안만 업로드.)

## 최초 1회: GitHub Secrets 4개

Settings → Secrets and variables → Actions 에 등록:

| Secret | 값 |
|--------|-----|
| `CWS_EXTENSION_ID` | `khkdmmojedhfebdolbfkdgkldeiabafe` |
| `CWS_CLIENT_ID` | 아래에서 발급 |
| `CWS_CLIENT_SECRET` | 아래에서 발급 |
| `CWS_REFRESH_TOKEN` | 아래에서 발급 |

## Client ID / Secret / Refresh Token 발급 (한 번만)

### 1) Chrome Web Store API 사용 설정
- https://console.cloud.google.com → 프로젝트 생성/선택
- **API 및 서비스 → 라이브러리** → "Chrome Web Store API" → **사용 설정**

### 2) OAuth 동의 화면
- **API 및 서비스 → OAuth 동의 화면** → External → 앱 이름/이메일만 채워 저장
- **게시 상태를 "프로덕션"으로** 하거나, "테스트" 유지 시 **테스트 사용자에 본인(스토어 개발자) 계정 추가**
  (테스트 모드 refresh token 은 7일 후 만료될 수 있으니 프로덕션 권장)

### 3) OAuth 클라이언트 만들기
- **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
- 유형: **데스크톱 앱**
- 생성된 **클라이언트 ID / 보안 비밀** → `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`

### 4) Refresh Token 발급
브라우저에서 (`YOUR_CLIENT_ID` 교체) 열고 본인 계정으로 승인:
```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&approval_prompt=force&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=YOUR_CLIENT_ID
```
화면에 나온 **code** 를 복사해, 터미널에서 (모두 교체) 실행:
```bash
curl -s https://oauth2.googleapis.com/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=PASTED_CODE \
  -d grant_type=authorization_code \
  -d redirect_uri=urn:ietf:wg:oauth:2.0:oob
```
응답 JSON 의 **`refresh_token`** → `CWS_REFRESH_TOKEN`

> `urn:ietf:wg:oauth:2.0:oob` 가 막히면 클라이언트 유형을 "웹 애플리케이션"으로 만들고
> 승인된 리디렉션 URI 에 `http://localhost` 를 추가해 code 를 받는다.

## 확인
Secrets 4개 등록 후, `manifest.json` version 올리고 `ext-v*` 태그 푸시 →
Actions 로그에 업로드/게시 성공이 뜨면 끝. 이후 버전업은 태그만 밀면 자동.
