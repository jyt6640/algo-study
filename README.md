# 7일 7솔 — 알고리즘 스터디 (algo-study)

LeetCode 연동 스터디 벌금 서비스. 매주 **7문제**를 못 채우면 벌금이 장부에 기록된다. 마감은 매주 **일요일 자정(Asia/Seoul)**. 실제 벌금 정산은 오프라인.

> 기획 전문은 [PRD.md](./PRD.md) 참고.

## 스택

- **Next.js 15 (App Router) + TypeScript + Tailwind v4**
- **Drizzle ORM + Neon(Postgres)** — 서버리스 HTTP 드라이버
- **Vercel Cron** — 시간당 수집 + 일요일 자정 마감 배치
- **Chrome 확장 (MV3)** — 버튼 클릭으로 Accepted 코드 업로드 (`/extension`)

## 풀이 수집 경로 (상호보완)

1. **서버 폴링** (`/api/cron/collect`) — LeetCode 비공식 GraphQL `recentAcSubmissionList`. 확장 미설치자도 커버.
2. **확장 push** (`/api/ingest`) — 유저 브라우저에서 코드까지 캡처. 비공개 프로필도 동작.

두 경로 모두 `problem_slug` 기준으로 dedup 되어 주간 카운트에 합산된다.

## 로컬 실행

```bash
cp .env.example .env      # DATABASE_URL(Neon), CRON_SECRET 채우기
npm install
npm run db:push           # 스키마를 DB에 반영
npm run dev               # http://localhost:3000
```

- Neon 무료 계정: https://neon.tech 에서 프로젝트 생성 → connection string 복사.

## 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/groups` | 그룹 생성 (+ 방장 유저) |
| POST | `/api/groups/join` | 초대코드로 가입 |
| POST | `/api/tokens` | 확장 연동 토큰 발급 (`{userId}`) |
| POST | `/api/ingest` | 확장 push 수신 (`Authorization: Bearer <토큰>`) |
| POST | `/api/link` | LeetCode 핸들 연동 (`Bearer` + `{handle}`) — 확장 로그인 감지가 호출 |
| GET | `/api/cron/collect` | 폴링 수집 배치 (Cron) |
| GET | `/api/cron/finalize` | 주간 마감·벌금 확정 배치 (Cron) |
| — | `/groups/[id]` | 그룹 대시보드 (진행률·예상 벌금·벌금 장부) |
| — | `/groups/[id]/members/[uid]` | 멤버가 푼 문제 목록 (LeetCode 링크 + 업로드 코드) |

Cron 엔드포인트는 프로덕션에서 `Authorization: Bearer $CRON_SECRET` 필요.

## 확장프로그램 설치 (개발자 모드)

1. Chrome → `chrome://extensions` → 개발자 모드 ON → **압축해제된 확장 프로그램 로드** → `extension/` 선택
2. 확장 팝업에서 **API 주소**(예: `http://localhost:3000`)와 **연동 토큰**(대시보드 "내 연동 토큰 발급") 입력·저장
3. 팝업의 **LeetCode 로그인 감지 & 연동** 클릭 → leetcode.com 로그인 세션에서 username 자동 감지·연동 (핸들 수기 입력 불필요)
4. LeetCode 문제 페이지에서 Accepted 후 우측 하단 **📤 스터디 업로드** 클릭 (Accepted 감지 시 버튼이 초록으로 바뀜)

> `manifest.json` 의 `host_permissions` 에 배포 도메인을 추가해야 프로덕션에서 push 가능.

## 배포 (Vercel)

1. GitHub 레포 연결 → Vercel import
2. 환경변수 `DATABASE_URL`, `CRON_SECRET` 설정
3. `vercel.json` 의 crons 자동 등록. **Hobby 플랜은 크론이 하루 1회로 제한**되므로 `collect` 는 매일 1회로 설정돼 있음. 시간당 폴링이 필요하면 **Pro 플랜**으로 `0 * * * *` 로 바꾸거나, Upstash QStash 같은 외부 스케줄러를 붙인다. (실시간성은 확장 push 가 보완)

## 알려진 한계 / PoC 필요

- LeetCode GraphQL 은 **비공식** — 언제든 차단 가능. 확장 push 로 이중화.
- 확장의 코드 캡처는 Monaco 에디터 값 읽기 방식 — LeetCode UI 변경에 취약. 제출 API 인터셉트 방식으로 견고화 예정.
- 인증은 MVP 수준(초대코드+닉네임). 정식 로그인은 2차.
