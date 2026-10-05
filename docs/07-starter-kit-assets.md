# 07. 재사용 자산 (이 저장소에 원래 있던 목업 코드)

> 이 저장소는 원래 "스타터킷"(템플릿) 용도였다. 계약범위/화면설계/디자인가이드 문서는 회의를 거쳐
> 구체화된 `docs/01~05` 문서로 교체했다. 아래 3D 모델링·카메라/마우스 인터랙션 코드만 포팅 대상으로 남겨둔다.

## 위치

`technical-review/pig-farm-cfd-demo/`

## 포팅 대상 모듈

| 파일 | 역할 | 포팅 시 주의 |
|---|---|---|
| `src/main.js` | 씬 초기화, 카메라/마우스(OrbitControls 등) 인터랙션 | DOM 조작 부분만 React 훅/컴포넌트로 교체. 카메라 리그 로직 자체는 그대로 둔다 |
| `src/barnFactory.js` | 돈사 박스·칸막이·팬 등 3D 구조물 생성 | 치수는 `config/geometry.json`(PINN v17.0 형상) 값으로 교체 |
| `src/overviewScene.js` / `src/detailScene.js` | 메인 화면 vs 상세 화면 씬 구성 | `01-functional-spec.md`의 화면 4(메인 모델링)·12/18/25/32(상세 3D)에 맞게 데이터 바인딩만 교체 |
| `src/colormap.js` | 값→색상 매핑 | 온도·습도 범례 색상 재사용, 범위(`range.min/max`)는 API 응답값 사용 |
| `src/volumeField.js` | 등온면(볼륨) 렌더링 | marching cubes 등치면 로직 재사용, 입력 grid는 `GET /api/detail/geometry` + 상세 응답 `grid`로 교체 |
| `src/streamlines.js` | 기류 스트림라인 | 유동 표현은 `02-relay-api.md` 5장 "유동" 규칙(flowGrid 실린더)에 맞게 표현 방식 자체는 바뀜 — 방향 벡터 계산 로직만 참고 |

## 포팅하지 않는 것

- 과거에 있던 계약범위·화면설계·디자인가이드 문서 내용 (`docs/01~05`, 추후 `06-design-guide.md`로 대체)
- 목업에서 쓴 임시 데이터/목업 생성 로직 (이 프로젝트는 `mock/`, `COMPUTE_MODE=mock`으로 별도 구성)
