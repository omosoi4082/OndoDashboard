// 예측·전문가·제어 모드 3D 표현(01-functional-spec.md 3장) — 온도·습도: grid를 2배
// 삼선형 보간(detail/gridUpsample.ts, Web Worker에서 미리 계산·캐시 —
// hooks/useIsosurfaceCache.ts) → marching cubes 등치면 3~5단계(반투명, 값 색상).
// three-stdlib의 MarchingCubes(docs/07-starter-kit-assets.md volumeField.js 포팅 대상)를
// 쓰되, 데모의 합성 데이터(sampleTemperatureAt) 대신 실제 frame.grid.temp/.rh를 쓴다.
import { useEffect, useMemo, type ReactElement } from 'react';
import * as THREE from 'three';
import { MarchingCubes } from 'three-stdlib';
import type { DetailBase, Geometry } from '@ondo/shared';
import { zUpVolumeGroupTransform } from './coords.js';
import { valueToRGB01 } from '../detail/colormap.js';
import { fillCubeField, isosurfaceCubeResolution, levelIsolations } from '../detail/isosurfaceField.js';
import { upsampledGridSize } from '../detail/gridUpsample.js';
import {
  ISOSURFACE_LEVEL_COUNT,
  ISOSURFACE_MAX_POLY_COUNT,
  ISOSURFACE_MAX_RESOLUTION,
  ISOSURFACE_OPACITY,
} from '../config/constants.js';
import type { IsosurfaceFrameCache } from '../hooks/useIsosurfaceCache.js';

interface IsosurfaceVolumeProps {
  geometry: Geometry;
  range: DetailBase['range'];
  valueField: 'temp' | 'rh';
  /** 이 프레임의 2배 업샘플 결과(hooks/useIsosurfaceCache.ts) — 아직 준비 전이면 null. */
  frameCache: IsosurfaceFrameCache | null;
}

export function IsosurfaceVolume({ geometry, range, valueField, frameCache }: IsosurfaceVolumeProps): ReactElement | null {
  // grid 치수는 geometry 응답 기준 고정값이라(상세 진입 시 1회) 해상도도 세션 내내 고정된다
  // — 프레임이 바뀔 때마다 MarchingCubes 인스턴스를 새로 만들 필요가 없다(성능 요구사항).
  const resolution = useMemo(() => {
    const upSize = upsampledGridSize(geometry.grid.size);
    return Math.min(isosurfaceCubeResolution(upSize), ISOSURFACE_MAX_RESOLUTION);
  }, [geometry.grid.size]);

  const transform = useMemo(() => zUpVolumeGroupTransform(geometry.room.size), [geometry.room.size]);

  const instances = useMemo(
    () =>
      Array.from({ length: ISOSURFACE_LEVEL_COUNT }, () => {
        const material = new THREE.MeshStandardMaterial({
          transparent: true,
          opacity: ISOSURFACE_OPACITY,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0,
          depthWrite: false,
        });
        return new MarchingCubes(resolution, material, false, false, ISOSURFACE_MAX_POLY_COUNT);
      }),
    [resolution],
  );

  // MarchingCubes 인스턴스는 resolution이 바뀔 때만 새로 만들어진다(세션 내 고정이라
  // 실제로는 마운트당 1회) — 언마운트/교체 시 GPU 버퍼를 정리한다.
  useEffect(() => {
    return () => {
      for (const mc of instances) {
        mc.geometry.dispose();
        const material = mc.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    };
  }, [instances]);

  // 정육면체 field 스크래치 버퍼 — 레벨(등치면 단계) 4개가 같은 field를 공유하므로
  // 프레임마다 한 번만 리샘플링한다(detail/isosurfaceField.ts fillCubeField).
  const fieldScratch = useMemo(() => new Float32Array(resolution ** 3), [resolution]);

  useEffect(() => {
    if (!frameCache) return;
    const fieldRange = valueField === 'temp' ? range.temp : range.rh;
    const values = valueField === 'temp' ? frameCache.temp : frameCache.rh;
    fillCubeField(fieldScratch, resolution, values, frameCache.size);
    const isolations = levelIsolations(fieldRange, ISOSURFACE_LEVEL_COUNT);

    instances.forEach((mc, i) => {
      mc.field.set(fieldScratch);
      const isolation = isolations[i] ?? fieldRange.max;
      mc.isolation = isolation;
      const [r, g, b] = valueToRGB01(isolation, fieldRange.min, fieldRange.max, valueField);
      const material = mc.material;
      if (!Array.isArray(material)) (material as THREE.MeshStandardMaterial).color.setRGB(r, g, b);
      mc.update();
    });
  }, [frameCache, valueField, range, instances, resolution, fieldScratch]);

  if (!frameCache) return null;

  return (
    <group position={transform.position} scale={transform.scale} rotation={[transform.rotationX, 0, 0]}>
      {instances.map((mc, i) => (
        <primitive key={i} object={mc} />
      ))}
    </group>
  );
}
