# 프로젝트 컨텍스트 (Claude Code가 항상 참고)

## 프로젝트
(주)온도 — 공간 분석 유동학 시뮬레이션 대시보드 개발
- 계약기간: 2026-10-01 ~ 2026-11-30 (2개월)
- 1개월차(선진행): 스마트 축사(돈사) 대시보드
- 2개월차(후진행): 스마트 데이터센터 대시보드
- 기존에 만든 [pig-farm-cfd-dashboard](../pig-farm-cfd-dashboard) 자산(볼륨/스트림라인 로직)을 R3F로 포팅해 재활용

## 계약 범위 (스코프 밖 작업은 하지 않는다)
- 대시보드 UI/UX 설계
- 2D/3D 객체 모델링 (돼지·돈사·데이터센터 공간·서버 등 총 10객체 이내)
- 외부 센서 데이터 API 연동
- 내부 시뮬레이션 백엔드 I/O 연동 (입력 3개 → 3D 결과 가시화)
- 멀티 레졸루션 포인트 가시화
- 유동장/습도장 히트맵, 온도·습도·풍량 레이어 시각화
- 내부 API 연동 시 비프로그래머 엔지니어와 협업 필요 → API 스펙은 반드시 문서로 먼저 합의할 것

## 기술 스택
- Vite + React + TypeScript (strict)
- three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, three-stdlib
- 상태: zustand / 데이터: @tanstack/react-query, zod
- UI: tailwindcss, framer-motion, lucide-react, recharts
- 모델 파이프라인: Blender → glTF Binary(.glb) export → 필요 시 gltfjsx로 변환

## 참고 레퍼런스
기존 2D 아이소메트릭 대시보드(스크린샷 제공됨) 스타일을 3D로 전환 + 화면 분할 + 이펙트 강화.
톤: 다크 네이비 배경 + 시안/블루 네온 강조 + 카드형 유리감(glassmorphism) 패널.

## 작업 원칙
1. `docs/00-requirements.md`, `docs/01-screens.md`, `docs/02-design-guide.md`를 항상 기준으로 삼는다.
   문서에 없는 기능/화면을 임의로 추가하지 않는다. 애매하면 문서에 TBD로 남기고 진행한다.
2. 요구사항이 바뀌면 코드보다 문서를 먼저 갱신한다 (spec-writer 에이전트 사용).
3. 폴더 구조는 `scenes/shared`(공용 카메라·조명·컬러맵)와 `scenes/pig-farm` / `scenes/data-center`를
   분리해 2개월차 재사용을 항상 염두에 둔다.
4. 계약 범위 밖 요청("이것도 예쁘게 더 넣어볼까")은 진행 전에 사용자에게 먼저 확인한다.
