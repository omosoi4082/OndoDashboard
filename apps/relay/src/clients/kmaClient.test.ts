import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchText } from '../utils/fetchText.js';
import { createKmaClient } from './kmaClient.js';

vi.mock('../utils/fetchText.js', () => ({ fetchText: vi.fn() }));
const fetchTextMock = vi.mocked(fetchText);

const NO_DATA = JSON.stringify({ response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } } });

function okBody(baseDate: string, baseTime: string): string {
  return JSON.stringify({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: { items: { item: [{ baseDate, baseTime, category: 'TMP', fcstDate: baseDate, fcstTime: '1800', fcstValue: '20', nx: 53, ny: 37 }] } },
    },
  });
}

/** 지정한 base_time(HHmm)만 데이터가 있고 나머지는 NO_DATA인 기상청을 흉내 낸다. 요청한 base_time을 기록한다. */
function kmaWithData(available: readonly string[]): string[] {
  const requested: string[] = [];
  fetchTextMock.mockImplementation(async (url: string) => {
    if (typeof url !== 'string') return { ok: true, status: 200, text: NO_DATA };
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    const baseDate = params.get('base_date') ?? '';
    const baseTime = params.get('base_time') ?? '';
    requested.push(baseTime);
    const text = available.includes(baseTime) ? okBody(baseDate, baseTime) : NO_DATA;
    return { ok: true, status: 200, text };
  });
  return requested;
}

// 실제 시각(UTC). KmaClient 안에서 +9h(KST)로 바꾼다. 클라이언트 캐시가 모듈 단위라 테스트마다 날짜를 다르게 쓴다.
function kstAsUtc(y: number, m: number, d: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, m - 1, d, h - 9, mi));
}

function client(vilageMaxStepsBack: number) {
  return createKmaClient({ serviceKey: 'k', nx: 53, ny: 37, timeoutMs: 1000, vilageMaxStepsBack });
}

describe('getVilageFcst — NO_DATA 재시도 단계(KMA_VILAGE_MAX_STEPS_BACK)', () => {
  beforeEach(() => fetchTextMock.mockReset());

  it('23:00·20:00이 연속 NO_DATA여도 최대 2단계면 17:00까지 내려간다(2026-10-13 23:30 실측 사례)', async () => {
    const requested = kmaWithData(['1700']);
    const r = await client(2).getVilageFcst(kstAsUtc(2026, 10, 1, 23, 30));
    expect(requested).toEqual(['2300', '2000', '1700']);
    expect(r?.baseAt).toBe('2026-10-01T17:00:00+09:00');
    expect(r?.stepsBack).toBe(2);
  });

  it('기본 3단계면 14:00 발표분(9시간 전)까지 내려간다(2026-10-15 온도 측 확정값)', async () => {
    const requested = kmaWithData(['1400']);
    const r = await client(3).getVilageFcst(kstAsUtc(2026, 10, 6, 23, 30));
    expect(requested).toEqual(['2300', '2000', '1700', '1400']);
    expect(r?.baseAt).toBe('2026-10-06T14:00:00+09:00');
    expect(r?.stepsBack).toBe(3);
  });

  it('최대 1단계면 20:00까지만 보고 실패(null)', async () => {
    const requested = kmaWithData(['1700']);
    const r = await client(1).getVilageFcst(kstAsUtc(2026, 10, 2, 23, 30));
    expect(requested).toEqual(['2300', '2000']);
    expect(r).toBeNull();
  });

  it('최신 발표분이 있으면 재시도하지 않는다(stepsBack 0)', async () => {
    const requested = kmaWithData(['2300', '2000', '1700']);
    const r = await client(2).getVilageFcst(kstAsUtc(2026, 10, 3, 23, 30));
    expect(requested).toEqual(['2300']);
    expect(r?.stepsBack).toBe(0);
  });

  it('보충용 재요청(startStepsBack = 찾은 단계 + 1)은 최대 단계를 넘어도 그 한 단계는 시도한다', async () => {
    const requested = kmaWithData(['1700', '1400']);
    const r = await client(2).getVilageFcst(kstAsUtc(2026, 10, 4, 23, 30), 3);
    expect(requested).toEqual(['1400']);
    expect(r?.stepsBack).toBe(3);
  });

  it('NO_DATA는 캐시하지 않는다 — 나중에 올라오면 다시 조회해 받는다', async () => {
    const now = kstAsUtc(2026, 10, 5, 23, 30);
    kmaWithData([]);
    expect(await client(0).getVilageFcst(now)).toBeNull();
    kmaWithData(['2300']);
    expect((await client(0).getVilageFcst(now))?.baseAt).toBe('2026-10-05T23:00:00+09:00');
  });
});
