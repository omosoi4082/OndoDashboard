// 기상청 단기예보 조회서비스 응답 파싱(docs/03-upstream-apis.md 2장). 순수 함수 + 테스트(kmaParse.test.ts).
import { z } from 'zod';

const kmaHeaderSchema = z.object({
  resultCode: z.string(),
  resultMsg: z.string(),
});

export const kmaNcstItemSchema = z.object({
  category: z.string(),
  obsrValue: z.string(),
});
export type KmaNcstItem = z.infer<typeof kmaNcstItemSchema>;

export const kmaFcstItemSchema = z.object({
  category: z.string(),
  fcstDate: z.string(),
  fcstTime: z.string(),
  fcstValue: z.string(),
});
export type KmaFcstItem = z.infer<typeof kmaFcstItemSchema>;

// zod의 제네릿 object 추론(addQuestionMarks<baseObjectOutputType<...>>)은 같은 제네릭 함수
// 안에서 바로 구조분해하면 TS가 풀어내지 못하는 경우가 있어, 런타임 검증(safeParse)과
// 별개로 아래 수동 인터페이스로 출력 타입을 명시한다(이중 선언 아님 — zod 스키마가 실제로
// 이 모양을 만들어내는 것을 safeParse가 보장한다).
interface KmaEnvelope<T> {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: { items: { item: T[] } };
  };
}

function kmaResponseSchema<T extends z.ZodTypeAny>(itemSchema: T): z.ZodType<KmaEnvelope<z.infer<T>>> {
  const schema = z.object({
    response: z.object({
      header: kmaHeaderSchema,
      body: z
        .object({
          items: z.object({
            // 항목이 1개면 배열이 아니라 단일 객체로 내려오는 공공데이터포털 특성에 대비.
            item: z.union([z.array(itemSchema), itemSchema]).transform((v) => (Array.isArray(v) ? v : [v])),
          }),
        })
        .optional(),
    }),
  });
  return schema as unknown as z.ZodType<KmaEnvelope<z.infer<T>>>;
}

export type KmaParseResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; reason: 'NO_DATA' | 'XML_ERROR' | 'ERROR'; message: string };

/** 키 오류 등은 JSON 요청에도 XML로 응답 — 그 안에서 오류 메시지를 최대한 추출한다. */
export function extractXmlError(xmlText: string): string {
  const errMsg = /<errMsg>(.*?)<\/errMsg>/.exec(xmlText)?.[1];
  const authMsg = /<returnAuthMsg>(.*?)<\/returnAuthMsg>/.exec(xmlText)?.[1];
  const reasonCode = /<returnReasonCode>(.*?)<\/returnReasonCode>/.exec(xmlText)?.[1];
  const parts = [errMsg, authMsg, reasonCode].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(' / ') : xmlText.slice(0, 200);
}

export function parseKmaBody<T>(rawText: string, itemSchema: z.ZodType<T>): KmaParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: 'XML_ERROR', message: extractXmlError(rawText) };
  }

  const parsed = kmaResponseSchema(itemSchema).safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: 'ERROR', message: parsed.error.message };
  }

  const { header, body } = parsed.data.response;
  if (header.resultCode === '03') {
    return { ok: false, reason: 'NO_DATA', message: header.resultMsg };
  }
  if (header.resultCode !== '00') {
    return { ok: false, reason: 'ERROR', message: `${header.resultCode} ${header.resultMsg}` };
  }
  if (!body) {
    return { ok: false, reason: 'NO_DATA', message: 'empty body' };
  }
  return { ok: true, items: body.items.item };
}

/** 초단기예보(getUltraSrtFcst)에서 category에 해당하는 항목 중 now와 fcstDate/fcstTime이 가장 가까운 값. */
export function pickNearestFcstValue(items: KmaFcstItem[], category: string, now: Date): string | null {
  const candidates = items.filter((it) => it.category === category);
  if (candidates.length === 0) return null;

  let best: KmaFcstItem | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const it of candidates) {
    const t = parseFcstDateTime(it.fcstDate, it.fcstTime);
    const diff = Math.abs(t.getTime() - now.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = it;
    }
  }
  return best ? best.fcstValue : null;
}

/** "YYYYMMDD" + "HHmm" → Date. now와 동일하게 UTC 필드에 KST 벽시계 값을 담는다(순수 비교용). */
export function parseFcstDateTime(fcstDate: string, fcstTime: string): Date {
  const y = Number(fcstDate.slice(0, 4));
  const m = Number(fcstDate.slice(4, 6));
  const d = Number(fcstDate.slice(6, 8));
  const hh = Number(fcstTime.slice(0, 2));
  const mi = Number(fcstTime.slice(2, 4));
  return new Date(Date.UTC(y, m - 1, d, hh, mi));
}

/** category → obsrValue(초단기실황) 맵. 순서에 의존하지 않는다. */
export function ncstItemsToMap(items: KmaNcstItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    map[item.category] = item.obsrValue;
  }
  return map;
}
