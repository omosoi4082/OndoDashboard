# 축사 3D 모델 (glb) 배치 가이드

`../src/config.js`의 `BARNS` 배열에서 각 축사의 `modelUrl`(+ 필요 시 `modelNodeName`)에
이 폴더 기준 상대경로를 지정하면, placeholder(와이어프레임 박스) 대신 실제 모델이
표시됩니다.

## 현재 적용된 모델 — `p1.glb`

`p1.glb` 한 파일 안에 방 3개가 이미 들어있고, 작은 방부터 순서대로 이름이 붙어있습니다.

| 노드명 | 크기(가로×세로×높이, m) | 배정된 축사 |
|---|---|---|
| `P1` | 9 × 8 × 2.8 | 자돈사 A동 (가장 작은 방) |
| `P1.001` | 9 × 15 × 2.8 | 자돈사 B동 (중간 방) |
| `P1.002` | 9 × 24 × 2.8 | 자돈사 C동 (가장 큰 방) |

`config.js`에서 세 축사가 같은 `modelUrl`(`p1.glb`)을 공유하고, `modelNodeName`으로
그 안의 어느 방 노드를 꺼내 쓸지만 다르게 지정하는 방식입니다.

```js
// src/config.js
const SHARED_MODEL_URL = "../assets/models/p1.glb";

{ id: 0, name: "자돈사 A동", modelUrl: SHARED_MODEL_URL, modelNodeName: "P1" },
{ id: 1, name: "자돈사 B동", modelUrl: SHARED_MODEL_URL, modelNodeName: "P1.001" },
{ id: 2, name: "자돈사 C동", modelUrl: SHARED_MODEL_URL, modelNodeName: "P1.002" },
```

`barnFactory.js`는 같은 `modelUrl`은 한 번만 로드(캐시)하고, `modelNodeName`으로 지정한
노드만 `getObjectByName()`으로 꺼내 복제해서 각 축사에 붙입니다. 모델은 원본 크기
그대로(1 unit = 1 m) 쓰고, 바닥(y=0)·수평 중심만 자동 정렬합니다 — 세 방의 실제 크기
차이를 그대로 보여주기 위해 하나의 슬롯 크기로 강제 축소하지 않습니다. 클릭 판정용
히트박스도 로드 후 실제 모델 크기로 자동 갱신됩니다.

`p1.glb`는 재질에 텍스처를 참조하지 않는 플랫 그레이 머티리얼(Material.001/002/006)만
가지고 있어, 함께 받은 `P1.png`(뷰포트 렌더 미리보기로 추정)는 코드에서 쓰이지 않습니다.

## 축사마다 별도 파일을 쓰고 싶다면

`modelNodeName`을 생략하면 파일의 씬 전체(`gltf.scene`)를 그대로 씁니다. 즉 축사별로
독립된 glb 파일(`barn-a.glb`, `barn-b.glb`, `barn-c.glb`)을 준비했다면, 축사마다 다른
`modelUrl`만 지정하고 `modelNodeName`은 빼면 됩니다.

```js
{ id: 0, name: "자돈사 A동", modelUrl: "../assets/models/barn-a.glb" },
```

## Blender 내보내기 규칙 (필수)

- 단위: 1 Blender unit = 1 m
- 축: Y-up (glTF 내보내기 시 기본값 그대로 사용)
- 내보내기 전 `Ctrl+A → All Transforms` 로 Apply Transform 적용
  (스케일/회전이 남아있으면 코드에서 자동 정렬이 부정확해질 수 있습니다)
- 형식: glTF Binary (.glb) — 텍스처/머티리얼 포함해 파일 하나로 내보내기
- 한 파일에 여러 방을 담을 경우, Blender에서 최상위 오브젝트(빈 또는 방 루트)에
  구분 가능한 이름을 붙여 내보내면 그 이름이 그대로 `modelNodeName`이 됩니다.

## 아직 모델이 없다면

`modelUrl`을 비워두면(`null`) 기존처럼 와이어프레임 박스로 표시되며, 클릭/상세보기 등
나머지 기능은 동일하게 동작합니다.
