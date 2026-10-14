// docs/03-upstream-apis.md 2장: 기상청 단기예보 조회서비스(VilageFcstInfoService_2.0).
import { fetchText } from '../utils/fetchText.js';
import {
  kmaBaseTimeToIso,
  ultraSrtFcstBaseTime,
  ultraSrtNcstBaseTime,
  ultraSrtNcstBaseTimeAtHour,
  vilageFcstBaseTime,
  type KmaBaseTime,
} from '../transforms/kmaBaseTime.js';
import { kstWallClock } from '../utils/time.js';
import {
  kmaFcstItemSchema,
  kmaNcstItemSchema,
  ncstItemsToMap,
  parseKmaBody,
  type KmaFcstItem,
} from './kmaParse.js';
import type { z } from 'zod';

const KMA_BASE_URL = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

export interface KmaNcstResult {
  map: Record<string, string>; // category → obsrValue
  baseAt: string; // Iso8601 +09:00
}

export interface KmaFcstResult {
  items: KmaFcstItem[];
  baseAt: string; // Iso8601 +09:00
  /** 최신 발표분에서 몇 단계 이전 발표분인지(0 = 최신). getVilageFcst만 채운다. */
  stepsBack?: number;
}

export interface KmaClient {
  /** 초단기실황(getUltraSrtNcst): T1H, REH, VEC, PTY. */
  getUltraSrtNcst(now: Date): Promise<KmaNcstResult | null>;
  /**
   * 지정한 과거 정시의 초단기실황(getUltraSrtNcst). hour는 kstWallClock() 표현의 정시 Date.
   * 직전 발표분으로 재요청하지 않는다 — 그 시각 값이 없으면(NO_DATA·통신 실패) null.
   * 현재·예측 모드 과거 3시간 외기 온·습도 입력용(2026-10-13 B-3).
   */
  getUltraSrtNcstAtHour(hour: Date): Promise<KmaNcstResult | null>;
  /** 초단기예보(getUltraSrtFcst): SKY 등. */
  getUltraSrtFcst(now: Date): Promise<KmaFcstResult | null>;
  /**
   * 단기예보(getVilageFcst): TMP, REH(1시간 단위). startStepsBack(기본 0 = 최신 발표분)부터
   * NO_DATA면 한 단계씩 이전 발표분으로 내려가며 `KMA_VILAGE_MAX_STEPS_BACK` 단계까지 시도한다
   * (2026-10-13 23:30 실측: 23:00·20:00 발표분이 연속 NO_DATA, 17:00만 유효). docs/02-relay-api.md
   * 6장 "예보가 24시간을 못 채우면 직전 발표분 재요청" 용도로는 찾은 발표분의 stepsBack + 1을
   * 넘긴다 — 이때는 최대 단계를 넘더라도 그 한 단계는 시도한다.
   */
  getVilageFcst(now: Date, startStepsBack?: number): Promise<KmaFcstResult | null>;
}

interface KmaClientOpts {
  serviceKey: string;
  nx: number;
  ny: number;
  timeoutMs: number;
  /** 단기예보 NO_DATA 시 최신 발표분에서 최대 몇 단계 이전까지 내려갈지(KMA_VILAGE_MAX_STEPS_BACK). */
  vilageMaxStepsBack: number;
}

// (오퍼레이션, baseDate, baseTime) 단위 메모리 캐시(docs/02-relay-api.md 8장).
const cache = new Map<string, Promise<{ items: unknown[] } | null>>();

function cacheKey(operation: string, baseDate: string, baseTime: string): string {
  return `${operation}:${baseDate}${baseTime}`;
}

/**
 * 발표 시각 하나를 조회한다(재요청 없음). NO_DATA면 null, 그 밖의 실패는 throw.
 * 성공한 응답만 캐시에 남긴다.
 */
async function fetchOnce<T>(
  operation: string,
  itemSchema: z.ZodType<T>,
  bt: KmaBaseTime,
  opts: KmaClientOpts,
): Promise<{ items: T[]; baseAt: string } | null> {
  const key = cacheKey(operation, bt.baseDate, bt.baseTime);
  const cached = cache.get(key);
  if (cached) {
    const result = (await cached) as { items: T[] } | null;
    return result ? { items: result.items, baseAt: kmaBaseTimeToIso(bt) } : null;
  }

  const task = (async (): Promise<{ items: T[] } | null> => {
    const params = new URLSearchParams({
      serviceKey: opts.serviceKey,
      pageNo: '1',
      numOfRows: '1000',
      dataType: 'JSON',
      base_date: bt.baseDate,
      base_time: bt.baseTime,
      nx: String(opts.nx),
      ny: String(opts.ny),
    });
    const url = `${KMA_BASE_URL}/${operation}?${params.toString()}`;
    const { text } = await fetchText(url, opts.timeoutMs);
    const parsed = parseKmaBody(text, itemSchema);
    if (!parsed.ok) {
      if (parsed.reason === 'NO_DATA') return null; // 재요청은 바깥에서 처리
      throw new Error(`[kma:${operation}] ${parsed.reason}: ${parsed.message}`);
    }
    return { items: parsed.items };
  })();

  const cacheableTask = task as Promise<{ items: unknown[] } | null>;
  cache.set(key, cacheableTask);
  // 실패(타임아웃·네트워크 오류 등)는 캐시하지 않는다 — 캐시해 두면 다음 폴링(몇 분 뒤)에도
  // 같은 발표 시각(baseTime, 보통 최대 1시간 단위)인 동안 계속 재시도 없이 실패만 돌려줘서
  // "기상청 연결이 계속 끊겨 보이는" 문제가 있었다(2026-10-10 확인 — 실제 기상청 API는
  // 정상 응답하는데도 앱에서는 disconnected가 유지됨). 성공한 응답만 캐시해서 다음 폴링 때
  // 다시 시도하게 한다.
  // NO_DATA(null)도 캐시하지 않는다 — 발표가 늦어 아직 비어 있던 발표분(2026-10-13 23:30
  // 실측: 23:00 발표분 NO_DATA)이 나중에 채워져도 계속 null을 돌려주게 되기 때문이다.
  const evict = (): void => {
    if (cache.get(key) === cacheableTask) cache.delete(key);
  };
  task.then((r) => {
    if (r === null) evict();
  }, evict);
  const result = await task;
  return result ? { items: result.items, baseAt: kmaBaseTimeToIso(bt) } : null;
}

async function fetchOperation<T>(
  operation: string,
  itemSchema: z.ZodType<T>,
  baseTimeFn: (now: Date, stepsBack?: number) => KmaBaseTime,
  now: Date,
  opts: KmaClientOpts,
  startStepsBack = 0,
  lastStepsBack = startStepsBack + 1,
): Promise<{ items: T[]; baseAt: string; stepsBack: number } | null> {
  try {
    // resultCode=03(NO_DATA) → 직전 발표 시각으로 재요청(docs/03 2장). 통신 오류는 바로 실패.
    for (let stepsBack = startStepsBack; stepsBack <= lastStepsBack; stepsBack += 1) {
      const result = await fetchOnce(operation, itemSchema, baseTimeFn(now, stepsBack), opts);
      if (result) return { ...result, stepsBack };
    }
    return null;
  } catch {
    return null;
  }
}

export function createKmaClient(opts: KmaClientOpts): KmaClient {
  return {
    async getUltraSrtNcst(now: Date): Promise<KmaNcstResult | null> {
      const kstNow = kstWallClock(now);
      const result = await fetchOperation('getUltraSrtNcst', kmaNcstItemSchema, ultraSrtNcstBaseTime, kstNow, opts);
      if (!result) return null;
      return { map: ncstItemsToMap(result.items), baseAt: result.baseAt };
    },

    async getUltraSrtNcstAtHour(hour: Date): Promise<KmaNcstResult | null> {
      try {
        const result = await fetchOnce('getUltraSrtNcst', kmaNcstItemSchema, ultraSrtNcstBaseTimeAtHour(hour), opts);
        if (!result) return null;
        return { map: ncstItemsToMap(result.items), baseAt: result.baseAt };
      } catch {
        return null;
      }
    },

    async getUltraSrtFcst(now: Date): Promise<KmaFcstResult | null> {
      const kstNow = kstWallClock(now);
      return fetchOperation('getUltraSrtFcst', kmaFcstItemSchema, ultraSrtFcstBaseTime, kstNow, opts);
    },

    async getVilageFcst(now: Date, startStepsBack = 0): Promise<KmaFcstResult | null> {
      const kstNow = kstWallClock(now);
      const last = Math.max(startStepsBack, opts.vilageMaxStepsBack);
      return fetchOperation('getVilageFcst', kmaFcstItemSchema, vilageFcstBaseTime, kstNow, opts, startStepsBack, last);
    },
  };
}
