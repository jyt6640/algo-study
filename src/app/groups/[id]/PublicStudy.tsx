import Link from "next/link";

type G = {
  name: string;
  quota: number;
  active: boolean;
  penaltyType: "FIXED" | "PER_MISSING";
  penaltyAmount: number;
};

// 비멤버에게 보여주는 공개 운영 개요. 초대코드·정산 계좌·멤버 개인기록은 노출하지 않는다.
export function PublicStudy({ group, memberCount }: { group: G; memberCount: number }) {
  const penalty =
    group.penaltyType === "FIXED"
      ? `미달 시 ${group.penaltyAmount.toLocaleString()}원`
      : `부족한 문제당 ${group.penaltyAmount.toLocaleString()}원`;

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-sm text-secondary hover:underline">
        ← 홈
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {group.name}
        {!group.active && <span className="ml-2 align-middle text-sm text-secondary">· 비활성</span>}
      </h1>
      <p className="mt-2 text-sm text-secondary">이 스터디가 어떻게 운영되는지 보여드려요.</p>

      <section className="card mt-8 p-6">
        <h2 className="text-lg font-semibold">운영 방식</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <Row label="주간 목표" value={`매주 ${group.quota}문제`} />
          <Row label="마감" value="매주 일요일 자정" />
          <Row label="벌금" value={penalty} />
          <Row label="멤버" value={`${memberCount}명`} />
        </dl>
        <p className="mt-5 text-xs text-secondary">
          벌금은 장부로만 기록되고 실제 정산은 오프라인으로 진행돼요. 풀이·코드·정산 계좌 등 상세는 멤버에게만
          공개됩니다.
        </p>
      </section>

      <div className="card mt-4 p-6 text-sm text-secondary">
        참여하려면 이 스터디 멤버에게 <b className="text-[color:var(--text)]">초대코드</b>를 받아 홈에서
        입력하세요.
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
