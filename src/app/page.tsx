import { HomeForms } from "./HomeForms";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        7일 <span className="text-emerald-400">7솔</span>
      </h1>
      <p className="mt-3 text-lg text-neutral-400">
        LeetCode 연동 알고리즘 스터디. 매주 <b className="text-neutral-200">7문제</b>를 못 채우면 벌금이
        장부에 기록됩니다. 마감은 매주 일요일 자정.
      </p>

      <div className="mt-10 grid gap-6">
        <HomeForms />
      </div>

      <footer className="mt-16 text-sm text-neutral-500">
        서버 폴링 + 브라우저 확장으로 풀이를 자동 집계합니다. 실제 벌금 정산은 오프라인.
      </footer>
    </main>
  );
}
