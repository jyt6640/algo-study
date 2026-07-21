# 7일 7솔 — LeetCode 연동 스터디 벌금 서비스 기획서

> 스터디원끼리 매주 LeetCode 7문제를 풀고, 못 채우면 벌금 장부에 기록되는 서비스.
> 최종 목표: "돈 걸고 꾸준히 알고리즘 문제 풀기"를 자동으로 추적·정산 보조.

- 문서 버전: v0.1 (초안)
- 작성일: 2026-07-21

---

## 1. 문제 정의 / 배경

- 알고리즘 코딩테스트 준비는 **꾸준함**이 핵심인데 혼자서는 동기부여가 약하다.
- 스터디를 만들어도 "누가 이번 주 몇 문제 풀었는지" 수동 집계는 번거롭고, 벌금 정산은 흐지부지되기 쉽다.
- LeetCode 풀이 기록을 **자동으로 수집**해서 주간 목표 달성/미달을 판정하고, 벌금 **장부**를 자동으로 계산해 주면 스터디 운영 부담이 사라진다.

## 2. 목표 / 비목표

### 목표 (In Scope — MVP)
- 스터디 그룹 생성 및 초대(초대 코드)
- 멤버의 LeetCode 핸들 등록
- LeetCode 풀이 기록 자동 수집 — **① 서버 폴링 + ② 브라우저 확장프로그램 push** (상호보완)
- **확장프로그램 버튼 클릭으로 작성한 코드 업로드** (Accepted 제출의 코드/메타 캡처)
- 매주 **일요일 자정 마감** 기준 주간 달성/미달 판정
- 미달 시 **벌금 장부 자동 기록** (금액 계산·표시)
- 그룹 대시보드: 이번 주 진행률, 리더보드, 벌금 장부, 제출 코드 보기

### 비목표 (Out of Scope — 최소 1차에서는 제외)
- **실제 결제·송금·에스크로** → 앱은 장부만, 실제 송금은 오프라인(계좌이체/카카오페이)
- 백준(BOJ)/프로그래머스 등 타 플랫폼 연동 (LeetCode부터)
- 휴가/면제 패스, 난이도 가중치 (2차 확장 후보)
- 모바일 네이티브 앱 (웹 우선)

## 3. 핵심 규칙 (확정)

| 항목 | 규칙 |
|------|------|
| **주기** | 주 단위 고정. 월요일 00:00 시작 ~ **일요일 24:00(=월요일 00:00) 마감** |
| **목표(quota)** | 주당 **7문제** |
| **1솔 인정** | 해당 주 기간 내 **Accepted** 된 **서로 다른 문제**(problem slug 기준 dedup) 1건 = 1솔. 난이도 무관 |
| **판정 시점** | 매주 일요일 자정 마감 시점에 그 주 누적 solved 개수 확정 |
| **미달 처리** | `solved < 7`이면 벌금 장부에 기록 |
| **벌금 산정** | 그룹 설정값 기반 계산 (아래 옵션) — 앱은 계산·표시만, 정산은 오프라인 |
| **타임존** | 그룹 기준 타임존(기본 Asia/Seoul)으로 주 경계 계산 |

### 벌금 산정 방식 (그룹 생성 시 선택)
- (A) 미달 시 **고정 벌금** (예: 못 채우면 무조건 10,000원)
- (B) **부족한 문제 수 × 단가** (예: 5문제만 풀면 부족 2문제 × 3,000원 = 6,000원)
- 모인 벌금 용처(달성자 분배 / 회식 / 이월)는 **장부 표기만** 하고 실제 처리는 그룹 자율

## 4. 사용자 시나리오

1. **그룹장**이 그룹 생성 → quota(7), 벌금 방식/단가, 타임존 설정 → 초대 코드 발급
2. **멤버**가 초대 코드로 가입 → 자신의 LeetCode 핸들 등록 (공개 프로필 필요)
3. 서비스가 주기적으로(예: 1시간마다) 각 멤버의 LeetCode 최근 Accepted 제출을 수집해 저장
4. 멤버는 대시보드에서 **이번 주 진행률(7칸 중 N칸)** 확인, D-day 리마인더 수신
5. **일요일 자정** 배치가 각 멤버의 주간 결과를 확정 → 미달자에게 벌금 기록
6. 그룹 장부 화면에서 **누적 벌금 / 이번 주 미달자** 확인 후 오프라인 정산

## 5. LeetCode 연동 방식

> LeetCode는 공식 공개 API가 없다. **두 경로를 상호보완**으로 쓴다. 어느 경로로 들어오든 동일한 `SolveLog`로 정규화되어 주간 판정에 함께 반영된다.

### 경로 ① 서버 폴링 (baseline, 확장 미설치자도 커버)
- 엔드포인트: `https://leetcode.com/graphql`
- 쿼리: `recentAcSubmissionList(username, limit)` — 최근 Accepted 제출의 **문제 title/slug + 제출 timestamp** 반환 (로그인 불필요, 공개 프로필 대상)
- 서비스가 스케줄러로 멤버별 폴링 → 신규 Accepted를 `SolveLog`에 적재
- 주간 카운트 = `SolveLog`에서 (멤버, 이번 주 기간) 내 **distinct slug** 개수

**제약 및 대응**
| 제약 | 대응 |
|------|------|
| 비공식 API → 언제든 스펙 변경/차단 가능 | 확장 push 경로로 이중화, 결과 DB 영구 저장, 어댑터 계층 격리 |
| 최근 N건(약 15~20)만 반환 | 폴링 주기를 짧게(시간당) 유지, 확장 push로 실시간 보강 |
| Rate limit | 멤버 순차 폴링 + 백오프, 캐싱 |
| 비공개 프로필은 조회 불가 | 확장 push는 로그인 세션 기반이라 비공개여도 동작 |

### 경로 ② 브라우저 확장프로그램 push (권장, 코드까지 캡처)
- **형태**: Chrome 확장 (Manifest V3). content script를 `leetcode.com/problems/*`에 주입
- **동작**:
  1. 문제 페이지에 **"스터디에 업로드" 버튼** 삽입 (에디터 근처)
  2. 유저가 Accepted 받은 뒤 버튼 클릭 → 현재 문제의 **코드 · 언어 · slug · 난이도 · 제출시각**을 캡처
  3. 우리 백엔드 `/api/ingest`로 POST (유저별 연동 토큰으로 인증)
  4. 백엔드가 `SolveLog`(+ 코드 본문)에 저장, 대시보드 실시간 반영
- **코드 캡처 방법** (구현 시 PoC로 확정):
  - LeetCode 에디터(Monaco)의 코드는 페이지 컨텍스트에 있음 → 페이지 컨텍스트 주입 스크립트로 접근하거나, LeetCode가 `localStorage`에 저장하는 문제별 코드 드래프트를 읽는다
  - 또는 제출 API 응답(`/submissions/detail`, `check`)을 fetch/XHR 래핑으로 가로채 **Accepted 여부 + 코드**를 정확히 캡처 (가장 견고)
  - DOM 스크래핑은 취약하므로 최후수단
- **인증(확장 ↔ 계정 연결)**: 웹앱에서 발급한 **1회용 연동 토큰**을 확장 설정에 붙여넣기 → 확장은 이후 토큰으로 `/api/ingest` 호출. 토큰은 사용자에 매핑, 폐기/재발급 가능
- **장점**: 비공식 API 차단에 강함(유저 세션 기반), **실제 코드 확보**로 코드 공유/리뷰 기능 가능, 실시간
- **한계**: 유저가 확장 설치·버튼 클릭해야 함(옵트인) → 그래서 폴링을 baseline으로 병행

### 폴백
- 수동 인증(스크린샷/문제 링크 제출 + 그룹장 승인) — 두 경로 모두 실패 시 대비, 2차

## 6. 데이터 모델 (초안)

```
User
  id, nickname, leetcode_handle, timezone, created_at

Group
  id, name, invite_code, week_start_day(=MON), quota(=7),
  penalty_type(FIXED|PER_MISSING), penalty_amount, timezone, created_at

Membership
  id, user_id, group_id, role(OWNER|MEMBER), joined_at

SolveLog                       # 두 경로(폴링/확장)에서 정규화 적재되는 원천 데이터
  id, user_id, problem_slug, problem_title, difficulty,
  accepted_at, source(LEETCODE_GQL|EXTENSION|MANUAL), collected_at
  UNIQUE(user_id, problem_slug)          # 주 내 dedup은 slug 기준

Submission                     # 확장 push로 들어온 실제 코드 (선택 저장)
  id, solve_log_id, language, code, submitted_at, created_at

ExtensionToken                 # 확장 ↔ 계정 연동용 토큰
  id, user_id, token(hash), created_at, revoked_at, last_used_at

WeeklyResult                   # 마감 배치가 확정하는 주간 결과
  id, user_id, group_id, week_of(주 시작일),
  solved_count, met_quota(bool), penalty_amount, finalized_at
```

**핵심 로직:** `WeeklyResult.solved_count = count(distinct SolveLog.problem_slug where accepted_at in [주 시작, 주 마감))` → `< quota`면 벌금 계산. 폴링과 확장이 같은 문제를 이중 적재해도 slug dedup으로 1솔 처리.

## 7. 시스템 구성 (Vercel + 서버리스)

```
[Next.js App on Vercel]
   ├─ Frontend (App Router)  대시보드 · 진행률 바 · 리더보드 · 벌금 장부
   ├─ API Route Handlers     그룹/멤버/조회/핸들 등록 (서버리스 함수)
   └─ Cron Route Handlers    스케줄러가 호출하는 배치 엔드포인트
        ├─ /api/cron/collect   수집 잡: 멤버별 LeetCode 폴링 → SolveLog 적재
        └─ /api/cron/finalize  마감 잡: WeeklyResult 확정 + 벌금 기록 + 알림

[Scheduler]   Vercel Cron(Pro) 또는 Upstash QStash → 위 cron 엔드포인트 호출
[DB]          Serverless Postgres (Neon / Supabase) — 연결 풀링 필수
[알림]        디스코드 웹훅(MVP) / 카카오 — D-day 리마인더, 마감 결과 통보
```

### 서버리스 특유의 고려사항
| 이슈 | 대응 |
|------|------|
| **Vercel Cron 빈도 제한** — Hobby는 하루 1회·크론 2개까지 | 시간당 폴링 필요 시 **Pro 플랜** 또는 **외부 스케줄러(Upstash QStash)** |
| **함수 실행 시간 제한** — Hobby 10s, Pro 60s+ | 멤버 순차 폴링이 한계 초과하면 QStash로 멤버 단위 fan-out(작업 분할) |
| **DB 커넥션 폭증** — 서버리스는 요청마다 연결 | Neon/Supabase의 **풀러/서버리스 드라이버** 사용 (HTTP 기반 드라이버 권장) |
| **Cron 엔드포인트 보안** | `CRON_SECRET` 헤더 검증으로 외부 무단 호출 차단 |
| **콜드 스타트** | 사용자 대면 경로에 큰 영향 없음(배치는 지연 허용) |

## 7-1. 기술 스택 (제안)

| 레이어 | 선택 | 이유 |
|--------|------|------|
| **Framework** | Next.js (App Router) | 프론트+API를 한 프로젝트로, Vercel 네이티브 |
| **호스팅** | Vercel | 서버리스 함수 + Cron 통합 |
| **DB** | Postgres — **Neon**(=Vercel Postgres) 또는 **Supabase** | 서버리스 친화, HTTP 드라이버, 무료 티어 |
| **ORM** | Drizzle ORM | 가볍고 서버리스/엣지 친화적 (Prisma도 가능) |
| **스케줄러** | Vercel Cron(Pro) **또는** Upstash QStash(Hobby 유지 시) | 시간당 폴링 요구 충족 |
| **인증** | MVP: 초대코드+닉네임 최소화 / 정식: Supabase Auth·Clerk·NextAuth | MVP는 로그인 부담 최소화 후 확장 |
| **알림** | Discord Webhook (MVP) | 스터디 채널과 궁합, 연동 간단 |
| **큐(확장)** | Upstash QStash | 멤버 수 증가 시 폴링 fan-out |

> Supabase를 쓰면 **Postgres + Auth**를 한 번에 얻어 초기 셋업이 간단하고, Neon+Clerk 조합은 각 레이어가 더 가볍다. 둘 중 택1은 셋업 단계에서 확정.

## 8. 화면 (MVP)

1. **그룹 대시보드** — 멤버별 이번 주 진행률(●●●●○○○ 4/7), 마감까지 D-day
2. **리더보드** — 누적 solved, 연속 달성 주(streak)
3. **벌금 장부** — 이번 주 미달자 + 금액, 누적 벌금 합계
4. **설정** — 내 LeetCode 핸들 등록/변경, 그룹 규칙(그룹장)

## 9. MVP 범위 자르기

**1차(MVP)에 반드시:** 그룹 생성/초대 · 핸들 등록 · 폴링 수집 · 주간 카운트 · 진행률 대시보드 · 마감 배치 · 벌금 장부

**2차 이후:** 알림(리마인더) · 리더보드/스트릭 · 휴가 패스 · 난이도 가중치 · 타 플랫폼(BOJ 등) · 실제 결제 연동

## 10. 열린 질문 / 리스크

- **LeetCode API 차단 리스크**가 서비스 존폐를 좌우 → 착수 전 GraphQL 폴링 PoC로 실현성 먼저 검증 권장
- 마감 직전(일요일 23:xx) 제출이 폴링 주기 안에 잡히는지 → **마감 잡(finalize) 실행 시 최종 1회 강제 수집** 후 확정
- **Vercel 플랜 결정 필요** — 시간당 폴링을 위해 Pro(Vercel Cron) vs Hobby+외부 스케줄러(QStash). 비용/운영 트레이드오프
- 벌금 "장부"만 제공 시 실제 미납 관리는 신뢰 기반 → 미납 표시/독촉 기능은 선택
- 타임존/서머타임에 따른 주 경계 정의 명확화(그룹 기준 타임존 고정, Asia/Seoul 기본)
- 인증 범위 — MVP에서 정식 로그인 없이 초대코드+닉네임으로 갈지, 처음부터 Auth를 붙일지

## 11. 다음 액션

1. **LeetCode GraphQL 폴링 PoC** — `recentAcSubmissionList`가 실제로 원하는 데이터를 주는지 검증 (최우선)
2. **셋업 결정** — DB(Neon vs Supabase) · 스케줄러(Vercel Cron Pro vs QStash) · 인증 범위 확정
3. Next.js 프로젝트 뼈대 + DB 스키마(Drizzle) 마이그레이션
4. 수집/마감 cron 엔드포인트 및 주간 판정 로직 구현
5. 대시보드 최소 화면(진행률 바 + 벌금 장부)

## 12. 배포 파이프라인 (개요)

- **저장소 → Vercel 연결**: main 브랜치 push 시 자동 배포 (Preview/Production)
- **환경변수**: `DATABASE_URL`, `CRON_SECRET`, `DISCORD_WEBHOOK_URL` 등 Vercel Env로 관리
- **Cron 설정**: `vercel.json`의 `crons`(Pro) 또는 QStash 스케줄 등록 → cron 엔드포인트는 `CRON_SECRET` 검증
- **DB 마이그레이션**: 배포 파이프라인 또는 수동 `drizzle-kit push`
