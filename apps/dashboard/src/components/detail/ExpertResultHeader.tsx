// 전문가 모드 결과 화면 맨 윗줄(시안 05) — "필수값 설정" 라벨 + 오른쪽 넓은 "필수값 수정" 버튼.
// 누르면 입력 표 화면으로 돌아간다(ExpertModeView의 screen='input').
// 결과 화면에서는 입력 표를 접어 두고 이 한 줄만 남기는 것이 2026-10-17 시안의 구조다.
import type { ReactElement } from 'react';

export function ExpertResultHeader({ onEdit }: { onEdit: () => void }): ReactElement {
  return (
    <section className="flex shrink-0 flex-col gap-3 border-b border-ondo-border pb-5">
      <div className="flex h-[50px] shrink-0 items-center gap-3">
        <span className="text-[16px] font-semibold text-[#ccc]">필수값 설정</span>
        {/* 2026-10-17 사용자 지정: 348×50, 글자 16, 라운드 8, 아이콘 26×26
            (docs/design/icon/checkbook.png → public/assets/icons/control/). */}
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto flex h-[50px] w-[348px] shrink-0 items-center justify-center gap-2 rounded-[8px] border border-[rgba(85,85,85,0.5)] bg-[rgba(71,73,81,0.45)] text-[16px] font-medium text-white transition-colors hover:bg-[rgba(71,73,81,0.7)]"
        >
          <img src="/assets/icons/control/checkbook.png" alt="" width={26} height={26} />
          필수값 수정
        </button>
      </div>
    </section>
  );
}
