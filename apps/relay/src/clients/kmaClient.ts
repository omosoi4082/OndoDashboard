// docs/03-upstream-apis.md 2장: 기상청 단기예보 조회서비스(VilageFcstInfoService_2.0).
import { fetchText } from '../utils/fetchText.js';
import { kmaBaseTimeToIso, ultraSrtFcstBaseTime, ultraSrtNcstBaseTime, vilageFcstBaseTime } from '../transforms/kmaBaseTime.js';
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
}

export interface KmaClient {
  /** 초단기실황(getUltraSrtNcst): T1H, REH, VEC, PTY. */
  getUltraSrtNcst(now: Date): Promise<KmaNcstResult | null>;
  /** 초단기예보(getUltraSrtFcst): SKY 등. */
  getUltraSrtFcst(now: Date): Promise<KmaFcstResult | null>;
  /**
   * 단기예보(getVilageFcst): TMP, REH(1시간 단위). startStepsBack을 생략하면 최신 발표분부터
   * 시도하고 NO_DATA면 1회 직전으로 재시도한다(기본 동작). docs/02-relay-api.md 6장 "예보가
   * 24시간을 못 채우면 직전 발표분 재요청" 용도로 startStepsBack=1을 명시해 "그 다음" 발표분
   * (최신 발표분보다 한 단계 더 이전)부터 바로 시도할 수도 있다.
   */
  getVilageFcst(now: Date, startStepsBack?: number): Promise<KmaFcstResult | null>;
}

interface KmaClientOpts {
  serviceKey: string;
  nx: number;
  ny: number;
  timeoutMs: number;
}

// (오퍼레이션, baseDate, baseTime) 단위 메모리 캐시(docs/02-relay-api.md 8장).
const cache = new Map<string, Promise<{ items: unknown[] } | null>>();

function cacheKey(operation: string, baseDate: string, baseTime: string): string {
  return `${operation}:${baseDate}${baseTime}`;
}

async function fetchOperation<T>(
  operation: string,
  itemSchema: z.ZodType<T>,
  baseTimeFn: (now: Date, stepsBack?: number) => { baseDate: string; baseTime: string },
  now: Date,
  opts: KmaClientOpts,
  startStepsBack = 0,
): Promise<{ items: T[]; baseAt: string } | null> {
  const attempt = async (stepsBack: number): Promise<{ items: T[]; baseAt: string } | null> => {
    const bt = baseTimeFn(now, stepsBack);
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

    cache.set(key, task as Promise<{ items: unknown[] } | null>);
    const result = await task;
    return result ? { items: result.items, baseAt: kmaBaseTimeToIso(bt) } : null;
  };

  try {
    const first = await attempt(startStepsBack);
    if (first) return first;
    // resultCode=03(NO_DATA) → 직전 발표 시각으로 1회 재요청(docs/03 2장).
    return await attempt(startStepsBack + 1);
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

    async getUltraSrtFcst(now: Date): Promise<KmaFcstResult | null> {
      const kstNow = kstWallClock(now);
      return fetchOperation('getUltraSrtFcst', kmaFcstItemSchema, ultraSrtFcstBaseTime, kstNow, opts);
    },

    async getVilageFcst(now: Date, startStepsBack = 0): Promise<KmaFcstResult | null> {
      const kstNow = kstWallClock(now);
      return fetchOperation('getVilageFcst', kmaFcstItemSchema, vilageFcstBaseTime, kstNow, opts, startStepsBack);
    },
  };
}
