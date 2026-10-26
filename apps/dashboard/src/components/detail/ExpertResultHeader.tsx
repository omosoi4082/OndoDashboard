// 전문가 모드 결과 화면 맨 윗줄(시안 05) — "필수값 설정" 라벨 + 오른쪽 넓은 "필수값 수정" 버튼.
// 누르면 입력 표 화면으로 돌아간다(ExpertModeView의 screen='input').
// 결과 화면에서는 입력 표를 접어 두고 이 한 줄만 남기는 것이 2026-10-17 시안의 구조다.
import type { ReactElement } from 'react';

export function ExpertResultHeader({ onEdit }: { onEdit: () => void }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-2.5 border-b border-ondo-border pb-2.5">
      <div className="flex h-[25px] shrink-0 items-center gap-2.5">
        <span className="text-[16px] font-semibold text-[#ccc]">필수값 설정</span>
        {/* 2026-10-17 사용자 지정: 348×50, 글자 16, 라운드 8, 아이콘 26×26
            (docs/design/icon/checkbook.png → public/assets/icons/control/).
            2026-10-26 사용자 지시로 높이 50 → 25(반), 아이콘 26 → 13으로 줄였다. 글자는
            16px이면 줄높이 24px + 테두리 2px가 25px를 넘겨(크롬 실측 scrollHeight>clientHeight)
            14px로 낮췄다. 가로 348·라운드 8·색은 유지(더 나중 지시가 우선, 되돌릴 땐 위
            2026-10-17 값으로). */}
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto flex h-[25px] w-[348px] shrink-0 items-center justify-center gap-2 rounded-[8px] border border-[rgba(85,85,85,0.5)] bg-[rgba(71,73,81,0.45)] text-[14px] font-medium text-white transition-colors hover:bg-[rgba(71,73,81,0.7)]"
        >
          <img src="/assets/icons/control/checkbook.png" alt="" width={13} height={13} />
          필수값 수정
        </button>
      </div>
    </section>
  );
}
