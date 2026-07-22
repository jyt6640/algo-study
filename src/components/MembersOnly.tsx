import Link from "next/link";

/** 비멤버가 접근했을 때 보여주는 안내 (프라이버시 게이트) */
export function MembersOnly({ groupId }: { groupId: number }) {
  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href={`/groups/${groupId}`} className="text-sm text-secondary hover:underline">
        ← 대시보드
      </Link>
      <div className="card mt-6 p-8 text-center">
        <h1 className="text-xl font-semibold">멤버만 볼 수 있어요</h1>
        <p className="mt-2 text-sm text-secondary">
          이 스터디의 멤버가 아니면 다른 멤버의 풀이·코드를 볼 수 없어요. 초대코드로 참여하면 함께 볼 수
          있습니다.
        </p>
      </div>
    </main>
  );
}
