export const metadata = { title: "개인정보 처리방침 — 7일 7솔" };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 leading-relaxed">
      <h1 className="text-3xl font-semibold tracking-tight">개인정보 처리방침</h1>
      <p className="mt-2 text-sm text-secondary">최종 업데이트: 2026-07-21</p>

      <div className="mt-8 space-y-6 text-sm">
        <section>
          <h2 className="text-lg font-semibold">수집하는 정보</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
            <li>GitHub 로그인 정보(고유 id, 사용자명, 이름, 프로필 이미지, 이메일)</li>
            <li>연동한 LeetCode 사용자명과 공개 풀이 기록(문제 제목·slug·시각)</li>
            <li>확장프로그램으로 직접 업로드한 제출 코드(사용자가 버튼을 눌러 전송한 경우에 한함)</li>
            <li>스터디 그룹 구성 및 방장이 등록한 정산 계좌 정보</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">이용 목적</h2>
          <p className="mt-2 text-secondary">
            주간 풀이 목표 달성 여부 집계, 스터디 진행 현황·벌금 장부 표시, 로그인 유지를 위해서만
            사용합니다. 벌금의 실제 정산은 앱 외부에서 이루어지며, 앱은 결제·송금을 처리하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">확장프로그램 권한</h2>
          <p className="mt-2 text-secondary">
            확장프로그램은 leetcode.com 문제 페이지에서 풀이 결과와 코드를 읽고, 사용자가 지정한 스터디
            서버로 전송합니다. LeetCode 로그인 세션은 사용자명 확인 용도로만 사용하며 자격증명(비밀번호·쿠키)을
            저장하거나 외부로 전송하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">제3자 제공</h2>
          <p className="mt-2 text-secondary">
            수집한 정보를 광고 등 목적으로 제3자에게 판매·제공하지 않습니다. 서비스 운영을 위한 인프라(호스팅,
            데이터베이스)에만 저장됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">삭제 요청</h2>
          <p className="mt-2 text-secondary">
            계정 및 관련 데이터 삭제를 원하면 프로젝트 관리자에게 요청할 수 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
