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
  FLOW_PARTICLE_MAX_AGE_S,
  FLOW_PARTICLE_OUTLET_HIT,
  FLOW_PARTICLE_MAX_PX,
  FLOW_PARTICLE_MIN_PX,
  FLOW_PARTICLE_SIZE_M,
  FLOW_PARTICLE_TRAIL,
  PARTITION_BLOCKS_PARTICLES,
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
/**
 * 멈춘 채로 막대를 옮겼을 때(= 프레임만 바뀌었을 때) 입자를 따라오게 하는 걸음 수(1/60초 단위).
 * 2026-10-27 사용자: "막대를 끌면 등치면처럼 정지 상태에서도 갱신돼야 하지 않나".
 * 등치면·2D는 그 시각 값으로 다시 그려지는데 입자만 서 있으면 한 화면이 서로 다른 시각을 보여준다.
 * 12걸음이면 기본 10배속에서 약 2초치 흐름이라 눈에 띄게 바뀌고, 한 번에 25 ms 안팎이라 끌어도 끊기지 않는다.
 */
const SCRUB_CATCHUP_STEPS = 12;
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

/**
 * 머리(원) 머티리얼 — 내장 PointsMaterial을 쓰되 gl_PointSize만 px로 자른다.
 *
 * 왜: sizeAttenuation만 쓰면 확대할 때 원이 계속 커져 1px 꼬리선과 크기 차이가 벌어진다.
 * 온도 측 샘플 뷰어와 같은 방식(clamp 1.5~7 px)으로 자르면, 줌을 당겨도 원이 일정 크기
 * 이상 커지지 않고 멀어지면 작아진다(2026-10-27 사용자).
 *
 * 셰이더를 통째로 새로 쓰지 않는 이유는 파일 머리말과 같다 — Canvas의 logarithmicDepthBuffer
 * 처리를 내장 셰이더(logdepthbuf_vertex)에 그대로 맡긴다. 그 include 바로 앞에 한 줄만 끼운다.
 */
function makeHeadMaterial(map: THREE.Texture): THREE.PointsMaterial {
  const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: FLOW_PARTICLE_SIZE_M,
    sizeAttenuation: true,
    map,
    transparent: true,
    alphaTest: 0.25,
    depthWrite: false,
    toneMapped: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <logdepthbuf_vertex>',
      `gl_PointSize = clamp( gl_PointSize, ${FLOW_PARTICLE_MIN_PX.toFixed(1)}, ${FLOW_PARTICLE_MAX_PX.toFixed(1)} );
#include <logdepthbuf_vertex>`,
    );
  };
  // 셰이더를 고쳤으니 캐시 키도 달라야 한다 — 같은 키면 PointsMaterial 원본 프로그램을 쓴다.
  mat.customProgramCacheKey = () => 'flow-particle-head-clamped';
  return mat;
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
      maxAgeS: FLOW_PARTICLE_MAX_AGE_S,
      outletHit: FLOW_PARTICLE_OUTLET_HIT,
      // 칸막이 차단은 우리 판단으로 넣은 규칙이라 한 줄로 끌 수 있게 둔다(2026-10-28, 상수 주석 참고).
      partition: PARTITION_BLOCKS_PARTICLES
        ? { segments: SECTION_PARTITION_SEGMENTS, height: PARTITION_HEIGHT_M }
        : undefined,
    }),
    [roomVolumeM3],
  );
  // 프레임(타임라인)·색 기준은 ref로 읽는다 — 바뀌어도 입자를 새로 뿌리지 않고 이어서 흐른다.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  /** 마지막으로 입자를 움직인 프레임 — 멈춘 채로 막대만 옮겼는지 판단한다. */
  const lastSteppedFrame = useRef(frame);
  // 빈 방에서 시작해 급기구에서 나온 입자로 채워진다(안내문 "급기구에서 출발").
  // timelineRunId가 올라가면(초기화·모드 전환·분석 항목 전환) 다시 빈 방부터 시작한다.
  const runId = useDetailStore((s) => s.timelineRunId);
  const state = useMemo(() => createParticles(opts), [opts, runId]);

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
  const headMaterial = useMemo(() => makeHeadMaterial(dotTexture), [dotTexture]);
  useEffect(
    () => () => {
      headGeom.dispose();
      trailGeom.dispose();
      dotTexture.dispose();
      headMaterial.dispose();
    },
    [headGeom, trailGeom, dotTexture, headMaterial],
  );

  const colorRef = useRef({ lut: makeLut(colorField), min: 0, max: 1, field: colorField });
  useEffect(() => {
    const r = colorField === 'temp' ? range.temp : range.rh;
    colorRef.current = { lut: makeLut(colorField), min: r.min, max: r.max, field: colorField };
  }, [colorField, range]);

  useFrame((_, delta) => {
    const f = frameRef.current;
    // 타임라인이 멈춰 있으면 입자도 멈춘다(2026-10-27 사용자 — 온도 측 샘플 뷰어와 같은 방식:
    // advance(playing ? dtReal*speed : 0)). 멈춘 동안에도 버퍼는 한 번 더 갱신해야 색 기준을
    // 바꿨을 때 반영되므로, 아래 색 갱신은 그대로 두고 이동만 건너뛴다.
    const playing = useDetailStore.getState().timelinePlaying;
    // 탭 전환 등으로 프레임 간격이 크게 벌어지면 입자가 한 번에 튀지 않게 자른다.
    const dt = Math.min(delta, 0.1);
    // 배속은 매 프레임 스토어에서 바로 읽는다 — 바꿔도 입자를 새로 뿌리지 않는다.
    const speed = useDetailStore.getState().particleSpeed;
    if (playing) {
      stepParticles(state, geometry, velocityFieldOf(geometry, f), f.supply, dt, speed);
      lastSteppedFrame.current = f;
    } else if (lastSteppedFrame.current !== f) {
      // 멈춘 채로 시각만 바뀌었다 — 그 시각 유동장으로 잠깐 흘려 입자를 따라오게 한다.
      const field = velocityFieldOf(geometry, f);
      for (let i = 0; i < SCRUB_CATCHUP_STEPS; i++) {
        stepParticles(state, geometry, field, f.supply, 1 / 60, speed);
      }
      lastSteppedFrame.current = f;
    }

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
      <points geometry={headGeom} material={headMaterial} frustumCulled={false} renderOrder={3} />
    </>
  );
}
