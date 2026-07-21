import { HomeForms } from "./HomeForms";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <header className="rise text-center">
        <h1 className="text-5xl font-semibold tracking-tight">
          7일 <span className="accent">7솔</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-secondary">
          LeetCode와 함께하는 알고리즘 스터디. 매주 7문제, 못 채우면 벌금이 장부에 남습니다.
          마감은 매주 일요일 자정.
        </p>
      </header>

      <div className="rise mt-12">
        <HomeForms />
      </div>

      <footer className="mt-16 text-center text-sm text-secondary">
        LeetCode 아이디만 있으면 시작할 수 있어요.
      </footer>
    </main>
  );
}
