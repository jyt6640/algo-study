# 문제 풀이 메모 레이아웃 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문제 풀이 페이지의 좌우 여백을 줄이고 개인 메모장을 넓혀 코드와 메모를 함께 보기 쉽게 만든다.

**Architecture:** 기존 Next.js App Router 구조와 Tailwind utility class를 유지한다. 페이지 컨테이너 폭/패딩은 solve page에서, 코드-메모 분할 폭은 `CodeNotes`에서 각각 조정하며 저장 및 조회 로직은 건드리지 않는다.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Vitest

## Global Constraints

- 문제 풀이 페이지는 큰 화면에서 `max-w-7xl` 컨테이너를 사용한다.
- 페이지 좌우 패딩은 기본 `px-4`, `sm` 이상 `sm:px-5`를 사용한다.
- 큰 화면의 코드와 메모장 폭은 `1:1`로 나눈다.
- `lg` 미만의 단일 열 레이아웃과 기존 메모 기능은 유지한다.
- 새 의존성은 추가하지 않는다.

---

### Task 1: 문제 풀이 메모 화면의 폭 조정

**Files:**
- Modify: `src/app/groups/[id]/solve/[solveId]/page.tsx:50-55`
- Modify: `src/components/CodeNotes.tsx:158-161`
- Test: 기존 `npm test`와 실제 브라우저 visual QA

**Interfaces:**
- Consumes: 기존 `SolvePage`와 `CodeNotes` props/API 계약
- Produces: 동일한 메모 기능을 유지하면서 넓어진 데스크톱 레이아웃

- [ ] **Step 1: 변경 전 검증 기준을 기록한다**

확인할 현재 클래스:

```text
SolvePage: rise mx-auto px-6 py-14 + code ? max-w-5xl : max-w-2xl
CodeNotes: mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]
```

- [ ] **Step 2: 레이아웃 utility class를 최소 변경한다**

`SolvePage`의 컨테이너 클래스에서 `px-6`을 `px-4 sm:px-5`로 바꾸고, 코드가 있는 경우 `max-w-5xl` 대신 `max-w-7xl`을 사용한다. `CodeNotes`의 큰 화면 grid를 `lg:grid-cols-2`로 바꿔 코드와 메모장을 동일한 폭으로 나눈다.

- [ ] **Step 3: 기존 테스트를 실행한다**

Run: `npm test`

Expected: 기존 테스트 전체 PASS.

- [ ] **Step 4: 실제 브라우저에서 반응형 화면을 확인한다**

개발 서버에서 문제 풀이 화면을 열어 375px, 768px, 1280px에서 다음을 확인한다.

- 375px/768px에서 코드와 메모가 한 열로 유지된다.
- 1280px에서 코드와 메모장이 동일한 폭으로 보인다.
- 페이지에 가로 스크롤이 생기지 않는다.
- 메모장 제목, 공개 토글, 저장 안내 문구가 잘리지 않는다.

- [ ] **Step 5: 변경 파일을 점검한다**

Run: `git diff --check`

Expected: whitespace 오류가 없다.
