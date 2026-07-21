# 크롬 웹스토어 배포 가이드

`npm run ext:package` → 루트에 `algo-study-extension.zip` 생성 → 이 zip 을 업로드한다.

## 1. 개발자 등록 (최초 1회)
- https://chrome.google.com/webstore/devconsole 접속 (본인 Google 계정)
- **일회성 등록비 $5** 결제 → 개발자 계정 활성화

## 2. 아이템 생성 & 업로드
- **New Item** → `algo-study-extension.zip` 업로드
- 심사 통과 후 공개되면 누구나 스토어에서 설치 가능

## 3. 스토어 등록 정보 (복붙용)

**이름**: 7일 7솔 — 알고리즘 스터디 업로더

**요약(간단 설명)**:
LeetCode 풀이를 스터디에 자동 집계하고, Accepted 코드를 버튼 한 번으로 업로드합니다.

**상세 설명**:
```
7일 7솔은 스터디원끼리 매주 LeetCode 7문제를 함께 푸는 알고리즘 스터디 서비스입니다.
이 확장프로그램을 설치하면:

• LeetCode 문제 페이지에서 Accepted 시, 우측 하단 버튼 한 번으로 제출 코드를 스터디에 업로드
• 팝업에서 내 주간 진행률(7문제 중 몇 개)과 최근 푼 문제를 바로 확인
• LeetCode 로그인만으로 계정 자동 연동 (아이디 수기 입력 불필요)

풀이 개수는 웹에서도 자동 집계되며, 확장은 실제 제출 코드까지 스터디에 남기고 싶을 때 사용합니다.
```

**카테고리**: 개발자 도구 (Developer Tools)
**언어**: 한국어

**개인정보처리방침 URL** (필수):
`https://algo-study-eight.vercel.app/privacy`

## 4. 스크린샷 (1280×800 또는 640×400, 최소 1장)
- 확장 팝업(내 현황) 화면
- LeetCode 문제 페이지의 「📤 스터디 업로드」 버튼
- 웹 대시보드

## 5. 권한 사유 (심사 시 요구될 수 있음)
- `storage`: API 주소·연동 토큰 저장
- `host_permissions(leetcode.com)`: 문제 페이지에서 풀이 결과·코드 읽기 (content script)
- `host_permissions(algo-study-eight.vercel.app)`: 수집한 풀이를 스터디 백엔드로 전송
- 원격 코드 실행 없음(전부 번들). `activeTab`·`scripting` 불필요하여 제거함.

## 6. 도메인이 바뀌면
`manifest.json` 의 `host_permissions` 에서 `algo-study-eight.vercel.app` 을 실제 배포 도메인으로 교체 후
버전(`version`)을 올려 재업로드한다.

> 심사는 보통 수일 소요. 통과 전까지는 개발자 모드 "압축해제된 확장 로드"로 사용 가능.
