// 유동 입자 애니메이션 — 2026-10-26 온도 측 요청으로 유동 표현을 화살표(FlowCylinders)에서
// 바꿨다. 입자가 급기구에서 나와 유속(grid.flow가 있으면 그것, 없으면 flowGrid)을 따라 흐르고, 색은 그 자리의 온도 또는
// 습도(grid 삼선형 보간)다. 움직임 계산은 detail/flowParticles.ts(순수 로직), 여기서는
// 매 프레임 버퍼만 갱신한다 — 지오메트리·머티리얼은 다시 만들지 않는다.
//
// 머리(점)는 Points 1개, 꼬리는 LineSegments 1개다. 색 속성을 RGBA(itemSize 4)로 둬서
// 내장 머티리얼(PointsMaterial·LineBasicMaterial)이 정점 알파를 쓰게 한다 — 직접 셰이더를
// 쓰지 않는 이유는 Canvas의 logarithmicDepthBuffer와 깊이 비교가 어긋나지 않게 하기 위해서다.
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DetailBase, DetailFrame, Geometry } from '@ondo/shared';
import { zUpToYUp } from './coords.js';
import { colormapRGB01, normalize } from '../detail/colormap.js';
import {
  createParticles,
  sampleScalar,
  stepParticles,
  velocityFieldOf,
  type ParticleOptions,
} from '../detail/flowParticles.js';
import { useDetailStore } from '../store/detailStore.js';
import {
  FLOW_PARTICLE_COUNT,
  FLOW_PARTICLE_FALLBACK_AIRFLOW_M3H,
  FLOW_PARTICLE_SIZE_M,
  FLOW_PARTICLE_TRAIL,
  PARTITION_HEIGHT_M,
  SECTION_PARTITION_SEGMENTS,
} from '../config/constants.js';

interface FlowParticlesProps {
  geometry: Geometry;
  frame: DetailFrame;
  range: DetailBase['range'];
}

const LUT_SIZE = 256;
/** 급기구에서 막 나온 입자가 서서히 나타나는 시간(화면 초) — 갑자기 튀어나와 보이지 않게. */
const FADE_S = 0.4;
const HEAD_ALPHA = 0.95;
const TRAIL_ALPHA = 0.6;

function makeLut(field: 'temp' | 'rh'): Float32Array {
  const lut = new Float32Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i++) {
    const [r, g, b] = colormapRGB01(i / (LUT_SIZE - 1), field);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

/**
 * 둥근 점 모양 — PointsMaterial 기본은 네모라서 텍스처로 원을 만든다.
 *
 * 2026-10-27 사용자 요청("입자 번짐없이 또렷하게"): 전에는 반지름 50 %까지만 불투명하고
 * 나머지 절반이 서서히 투명해져(0.5 → 1.0) 입자가 뿌옇게 번져 보였다. 지금은 가장자리
 * 바로 앞(92 %)까지 불투명하게 두고 마지막 8 %만 떨어뜨려 계단 현상만 지운다.
 * 아래 PointsMaterial의 alphaTest와 짝이다 — 그 값이 남은 반투명 테두리를 잘라낸다.
 */
function makeDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.92, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  // 밉맵을 끈다 — 점 스프라이트는 화면에서 몇 px밖에 안 되는데, 밉맵을 쓰면 뭉개진 낮은
  // 단계를 뽑아 와 alphaTest 경계가 원이 아니라 마름모처럼 잘린다(2026-10-27 실제로 그랬음).
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function FlowParticles({ geometry, frame, range }: FlowParticlesProps): ReactElement {
  const colorField = useDetailStore((s) => s.particleColorField);

  const [W, D, H] = geometry.room.size;
  const roomVolumeM3 = W * D * H;
  const opts: ParticleOptions = useMemo(
    () => ({
      count: FLOW_PARTICLE_COUNT,
      trail: FLOW_PARTICLE_TRAIL,
      // 방 공기가 한 번 바뀔 만큼 들어오면 최대 개수가 찬다.
      particlesPerM3: roomVolumeM3 > 0 ? FLOW_PARTICLE_COUNT / roomVolumeM3 : 0,
      fallbackAirflowM3h: FLOW_PARTICLE_FALLBACK_AIRFLOW_M3H,
      partition: { segments: SECTION_PARTITION_SEGMENTS, height: PARTITION_HEIGHT_M },
    }),
    [roomVolumeM3],
  );
  // 프레임(타임라인)·색 기준은 ref로 읽는다 — 바뀌어도 입자를 새로 뿌리지 않고 이어서 흐른다.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // 처음엔 방 전체에 고르게 뿌린다(샘플 seedAll). geometry가 바뀔 때만 새로.
  const state = useMemo(() => createParticles(geometry, opts), [geometry, opts]);

  const { headGeom, trailGeom } = useMemo(() => {
    const count = state.capacity;
    const { trail } = opts;
    const head = new THREE.BufferGeometry();
    head.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    head.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const nv = count * (trail - 1) * 2;
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    tail.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 4), 4).setUsage(THREE.DynamicDrawUsage));
    return { headGeom: head, trailGeom: tail };
  }, [state, opts]);
  const dotTexture = useMemo(() => makeDotTexture(), []);
  useEffect(
    () => () => {
      headGeom.dispose();
      trailGeom.dispose();
      dotTexture.dispose();
    },
    [headGeom, trailGeom, dotTexture],
  );

  const colorRef = useRef({ lut: makeLut(colorField), min: 0, max: 1, field: colorField });
  useEffect(() => {
    const r = colorField === 'temp' ? range.temp : range.rh;
    colorRef.current = { lut: makeLut(colorField), min: r.min, max: r.max, field: colorField };
  }, [colorField, range]);

  useFrame((_, delta) => {
    const f = frameRef.current;
    // 탭 전환 등으로 프레임 간격이 크게 벌어지면 입자가 한 번에 튀지 않게 자른다.
    const dt = Math.min(delta, 0.1);
    // 배속은 매 프레임 스토어에서 바로 읽는다 — 바꿔도 입자를 새로 뿌리지 않는다.
    const speed = useDetailStore.getState().particleSpeed;
    stepParticles(state, geometry, velocityFieldOf(geometry, f), f.supply, dt, speed);

    const count = state.capacity;
    const { trail } = opts;
    const { lut, min, max, field } = colorRef.current;
    const values = field === 'temp' ? f.grid.temp : f.grid.rh;
    const grid = geometry.grid;
    const hp = headGeom.attributes.position?.array as Float32Array;
    const hc = headGeom.attributes.color?.array as Float32Array;
    const tp = trailGeom.attributes.position?.array as Float32Array;
    const tc = trailGeom.attributes.color?.array as Float32Array;

    const colorAt = (x: number, y: number, z: number, out: Float32Array, o: number, a: number): void => {
      const v = sampleScalar(grid, values, x, y, z);
      if (Number.isNaN(v)) {
        out[o] = 0.6;
        out[o + 1] = 0.6;
        out[o + 2] = 0.6;
      } else {
        const t = Math.min(Math.max(normalize(v, min, max), 0), 1);
        const li = Math.round(t * (LUT_SIZE - 1)) * 3;
        out[o] = lut[li] ?? 0;
        out[o + 1] = lut[li + 1] ?? 0;
        out[o + 2] = lut[li + 2] ?? 0;
      }
      out[o + 3] = a;
    };

    for (let p = 0; p < count; p++) {
      const o = p * trail * 3;
      const len = state.histLen[p] ?? 0;
      // 빈 자리(배기구로 나갔거나 아직 안 나온 입자)는 투명하게 둔다.
      const fade = len === 0 ? 0 : Math.min(1, (state.age[p] ?? 0) / FADE_S);

      const [x, y, z] = zUpToYUp([state.hist[o] ?? 0, state.hist[o + 1] ?? 0, state.hist[o + 2] ?? 0]);
      hp[p * 3] = x;
      hp[p * 3 + 1] = y;
      hp[p * 3 + 2] = z;
      colorAt(state.hist[o] ?? 0, state.hist[o + 1] ?? 0, state.hist[o + 2] ?? 0, hc, p * 4, HEAD_ALPHA * fade);

      for (let k = 0; k < trail - 1; k++) {
        const v0 = (p * (trail - 1) + k) * 2;
        const v1 = v0 + 1;
        const ok = k + 1 < len;
        const a0 = o + k * 3;
        const a1 = o + (k + 1) * 3;
        const [x0, y0, z0] = zUpToYUp([state.hist[a0] ?? 0, state.hist[a0 + 1] ?? 0, state.hist[a0 + 2] ?? 0]);
        const [x1, y1, z1] = ok ? zUpToYUp([state.hist[a1] ?? 0, state.hist[a1 + 1] ?? 0, state.hist[a1 + 2] ?? 0]) : [x0, y0, z0];
        tp[v0 * 3] = x0;
        tp[v0 * 3 + 1] = y0;
        tp[v0 * 3 + 2] = z0;
        tp[v1 * 3] = x1;
        tp[v1 * 3 + 1] = y1;
        tp[v1 * 3 + 2] = z1;
        const alpha0 = ok ? TRAIL_ALPHA * fade * (1 - k / (trail - 1)) : 0;
        const alpha1 = ok ? TRAIL_ALPHA * fade * (1 - (k + 1) / (trail - 1)) : 0;
        colorAt(state.hist[a0] ?? 0, state.hist[a0 + 1] ?? 0, state.hist[a0 + 2] ?? 0, tc, v0 * 4, alpha0);
        tc[v1 * 4] = tc[v0 * 4] ?? 0;
        tc[v1 * 4 + 1] = tc[v0 * 4 + 1] ?? 0;
        tc[v1 * 4 + 2] = tc[v0 * 4 + 2] ?? 0;
        tc[v1 * 4 + 3] = alpha1;
      }
    }
    for (const g of [headGeom, trailGeom]) {
      const pos = g.attributes.position;
      const col = g.attributes.color;
      if (pos) pos.needsUpdate = true;
      if (col) col.needsUpdate = true;
    }
  });

  // toneMapped=false: R3F 기본 톤매핑이 채도 높은 색을 바래 보이게 만든다(FlowCylinders와 같은 이유).
  return (
    <>
      <lineSegments geometry={trailGeom} frustumCulled={false} renderOrder={2}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} />
      </lineSegments>
      <points geometry={headGeom} frustumCulled={false} renderOrder={3}>
        <pointsMaterial
          vertexColors
          size={FLOW_PARTICLE_SIZE_M}
          sizeAttenuation
          map={dotTexture}
          transparent
          alphaTest={0.25}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}
