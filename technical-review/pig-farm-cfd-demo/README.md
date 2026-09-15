# 돈사 CFD 대시보드 — 기술 검토용 데모

> **주의**: 이 폴더는 클라이언트 기술 검토(PoC) 목적의 독립 데모입니다.
> 실제 납품 코드는 R3F(React) 기반으로 별도 구현하며, 이 데모의 씬 구성/셰이더 로직만
> 재사용됩니다. `CLAUDE.md`의 폴더 구조(`scenes/shared`, `scenes/pig-farm`)와는 무관합니다.

원본 단일 HTML 파일(`cfd_threejs_sample.html`)을 기능 단위 ES 모듈로 분리해
가독성/유지보수성을 높이고, 축사 3개를 실제 3D 모델(glb)로 교체할 수 있도록
코드를 확장했습니다. 렌더링 결과와 인터랙션은 원본과 동일합니다.

## 실행 방법

ES 모듈(import) + glTF 로딩 때문에 `file://`로 직접 열면 CORS 오류가 납니다.
반드시 로컬 정적 서버로 실행하세요.

```bash
cd technical-review/pig-farm-cfd-demo
npx serve .
# 또는: python -m http.server 5173
```

브라우저에서 안내된 주소(예: http://localhost:3000)로 접속합니다.
Three.js는 `index.html`의 importmap을 통해 CDN(unpkg)에서 로드하므로 인터넷 연결이 필요합니다.

## 폴더 구조

```
pig-farm-cfd-demo/
  index.html          UI 마크업 + 스타일 (원본과 동일)
  src/
    main.js            진입점 — 씬 생성, DOM 이벤트 바인딩, 렌더 루프
    config.js           ROOM 크기, 축사 3개 목록(BARNS) — modelUrl로 모델 교체
    barnFactory.js       축사 3D 표현 생성 — glb 모델 또는 placeholder 박스
    overviewScene.js     개요 씬 — 축사 배치, 클릭 선택, 라벨
    detailScene.js        상세 씬 — 등온면 볼륨 + 스트림라인 + 호버 조회
    volumeField.js         Marching Cubes 온도장 베이크/업데이트
    streamlines.js          기류 스트림라인 추적/렌더링
    ui.js                    DOM 엘리먼트 참조 헬퍼
  assets/
    models/                 축사 glb 모델 배치 위치 (README 참고)
```

## 축사 3개는 현재 실제 모델(`p1.glb`)을 쓰고 있음

`assets/models/p1.glb` 한 파일 안에 방 3개(`P1` / `P1.001` / `P1.002`)가 작은 방부터
순서대로 들어있어, `src/config.js`에서 축사 A/B/C에 각각 배정했습니다
(A=가장 작은 방, B=중간, C=가장 큰 방). 셋 다 같은 파일을 공유하며 `modelNodeName`으로
어느 방을 쓸지만 다르게 지정합니다. 자세한 매핑 표와 모델을 교체/추가하는 방법은
`assets/models/README.md` 참고.

```js
// src/config.js
const SHARED_MODEL_URL = "../assets/models/p1.glb";
{ id: 0, name: "자돈사 A동", modelUrl: SHARED_MODEL_URL, modelNodeName: "P1" },      // 가장 작음
{ id: 1, name: "자돈사 B동", modelUrl: SHARED_MODEL_URL, modelNodeName: "P1.001" },  // 중간
{ id: 2, name: "자돈사 C동", modelUrl: SHARED_MODEL_URL, modelNodeName: "P1.002" },  // 가장 큼
```

모델 로드에 실패하면 자동으로 와이어프레임 박스(placeholder)로 대체됩니다. 축사별로
완전히 다른 파일을 쓰고 싶다면 `modelNodeName`을 빼고 `modelUrl`만 각각 다르게 지정하면
됩니다(`assets/models/README.md`의 "축사마다 별도 파일을 쓰고 싶다면" 참고).

## 원본 대비 변경 사항

- 단일 인라인 `<script>` → 기능별 ES 모듈로 분리 (로직 변경 없음)
- 축사 표현을 `barnFactory.js`로 추출, `GLTFLoader` 기반 모델 로딩 추가
  - 같은 glb를 여러 축사가 공유할 때 한 번만 로드하는 캐시
  - `modelNodeName`으로 한 파일 안의 특정 방 노드만 꺼내 쓰는 기능
  - 모델은 원본 크기 그대로 사용(강제 축소 없음) + 바닥/중심 자동 정렬
  - 클릭 판정용 히트박스를 로드된 실제 모델 크기로 자동 갱신
- 개요 씬 카메라/라벨 높이를 실제 모델 배치·크기에 맞게 조정
- 그 외 CFD 볼륨/스트림라인/UI 로직은 원본과 동일 (실 데이터 연동 지점은 코드 내 주석 참고)
