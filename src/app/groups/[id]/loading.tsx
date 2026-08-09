/** 대시보드 데이터가 준비되기 전 즉시 보이는 골격 */
export default function Loading() {
  const bar = (w: string, h = "h-4") => (
    <div className={`skeleton ${h} rounded-md`} style={{ width: w }} />
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          {bar("11rem", "h-8")}
          {bar("16rem", "h-3.5")}
          {bar("13rem", "h-3")}
        </div>
        {bar("7rem", "h-8")}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="card space-y-3 p-5">
          {bar("8rem", "h-3")}
          {bar("6rem", "h-7")}
        </div>
        <div className="card space-y-3 p-5">
          {bar("9rem", "h-3")}
          {bar("11rem", "h-6")}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              {bar("6rem")}
              {bar("4.5rem", "h-3.5")}
            </div>
            <div className="skeleton h-2.5 rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
