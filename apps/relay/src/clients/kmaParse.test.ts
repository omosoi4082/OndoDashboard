import { describe, expect, it } from 'vitest';
import {
  extractXmlError,
  kmaFcstItemSchema,
  kmaNcstItemSchema,
  ncstItemsToMap,
  parseKmaBody,
  pickNearestFcstValue,
} from './kmaParse.js';

const NCST_OK = JSON.stringify({
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
    body: {
      items: {
        // 항목 순서를 문서 표 순서(T1H, REH, VEC, PTY)와 다르게 섞는다.
        item: [
          { category: 'PTY', obsrValue: '0' },
          { category: 'VEC', obsrValue: '227' },
          { category: 'T1H', obsrValue: '21.5' },
          { category: 'REH', obsrValue: '68' },
        ],
      },
    },
  },
});

const NO_DATA = JSON.stringify({
  response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } },
});

const XML_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<OpenAPI_ServiceResponse>
  <cmmMsgHeader>
    <errMsg>SERVICE ERROR</errMsg>
    <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
    <returnReasonCode>30</returnReasonCode>
  </cmmMsgHeader>
</OpenAPI_ServiceResponse>`;

describe('parseKmaBody', () => {
  it('정상 응답이면 ok:true, items 배열 반환(항목 순서 무관)', () => {
    const result = parseKmaBody(NCST_OK, kmaNcstItemSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(4);
      expect(ncstItemsToMap(result.items)['T1H']).toBe('21.5');
      expect(ncstItemsToMap(result.items)['PTY']).toBe('0');
    }
  });

  it('resultCode=03이면 NO_DATA', () => {
    const result = parseKmaBody(NO_DATA, kmaNcstItemSchema);
    expect(result).toEqual({ ok: false, reason: 'NO_DATA', message: 'NO_DATA' });
  });

  it('JSON 파싱 실패(XML 오류 응답)면 XML_ERROR + 추출한 메시지', () => {
    const result = parseKmaBody(XML_ERROR, kmaNcstItemSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('XML_ERROR');
      expect(result.message).toContain('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    }
  });

  it('item이 1개뿐이면 배열이 아닌 단일 객체로 와도 배열로 변환', () => {
    const singleItem = JSON.stringify({
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
        body: { items: { item: { category: 'SKY', fcstDate: '20261007', fcstTime: '1500', fcstValue: '1' } } },
      },
    });
    const result = parseKmaBody(singleItem, kmaFcstItemSchema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items).toHaveLength(1);
  });
});

describe('extractXmlError', () => {
  it('errMsg/returnAuthMsg/returnReasonCode를 뽑아낸다', () => {
    expect(extractXmlError(XML_ERROR)).toBe(
      'SERVICE ERROR / SERVICE_KEY_IS_NOT_REGISTERED_ERROR / 30',
    );
  });

  it('아무 패턴도 없으면 원문 일부를 반환', () => {
    expect(extractXmlError('<unknown/>')).toBe('<unknown/>');
  });
});

describe('pickNearestFcstValue', () => {
  const items = [
    { category: 'SKY', fcstDate: '20261007', fcstTime: '1400', fcstValue: '1' },
    { category: 'SKY', fcstDate: '20261007', fcstTime: '1500', fcstValue: '3' },
    { category: 'SKY', fcstDate: '20261007', fcstTime: '1600', fcstValue: '4' },
  ];

  it('now와 가장 가까운 fcstTime의 값을 고른다', () => {
    const now = new Date(Date.UTC(2026, 9, 7, 15, 10));
    expect(pickNearestFcstValue(items, 'SKY', now)).toBe('3');
  });

  it('해당 category가 없으면 null', () => {
    const now = new Date(Date.UTC(2026, 9, 7, 15, 10));
    expect(pickNearestFcstValue(items, 'PTY', now)).toBeNull();
  });
});
