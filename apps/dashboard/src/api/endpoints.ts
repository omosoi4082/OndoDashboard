// 메인 화면 API — 화면 영역별로 분리 호출한다(CLAUDE.md 규칙, 하나로 합치지 않음).
import type {
  ApiResponse,
  ControlDetail,
  CurrentDetail,
  ExpertDetail,
  ForecastDetail,
  Geometry,
  KmaWeather,
  RoomsResponse,
  StationWeather,
} from '@ondo/shared';
import { fetchApi, fetchRaw } from './client.js';

export function fetchMainRooms(): Promise<ApiResponse<RoomsResponse>> {
  return fetchApi<RoomsResponse>('/api/main/rooms');
}

export function fetchMainWeatherKma(): Promise<ApiResponse<KmaWeather>> {
  return fetchApi<KmaWeather>('/api/main/weather/kma');
}

export function fetchMainWeatherStation(): Promise<ApiResponse<StationWeather>> {
  return fetchApi<StationWeather>('/api/main/weather/station');
}

// 상세 패널(6) — docs/02-relay-api.md 5장 "GET /api/detail/geometry". ApiResponse로
// 감싸지 않고 형상 파일을 그대로 반환하므로 fetchRaw를 쓴다. 상세 진입 시 1회만 호출한다.
export function fetchDetailGeometry(): Promise<Geometry> {
  return fetchRaw<Geometry>('/api/detail/geometry');
}

// 상세 패널(6) "현재" 탭 — docs/02-relay-api.md 6장 "GET /api/detail/current". ApiOk/ApiError로
// 감싸 응답하므로(apps/relay/src/routes/detailCurrent.ts) fetchApi를 쓴다. 상세 진입 시
// 메인 API들과 동시에 즉시 1회 + 유지 중 10분 주기(docs/04-tasks.md M4).
export function fetchDetailCurrent(): Promise<ApiResponse<CurrentDetail>> {
  return fetchApi<CurrentDetail>('/api/detail/current');
}

// 상세 패널(6) "예측" 탭 — docs/02-relay-api.md 6장 "GET /api/detail/forecast". 탭 선택 시
// 1회만 호출한다(호출 주체는 hooks/useForecastDetailOnDemand.ts — usePolling처럼 주기
// 호출하지 않는다).
export function fetchDetailForecast(): Promise<ApiResponse<ForecastDetail>> {
  return fetchApi<ForecastDetail>('/api/detail/forecast');
}

// 상세 패널(6) "전문가" 탭 — docs/02-relay-api.md 6장 "GET /api/detail/expert?temp=&rh=&vent=".
// 입력 필드 확인 버튼 클릭 시에만 호출한다(ExpertModeView.tsx). temp·rh·vent 모두 필수이며
// 중계 서버도 같은 범위를 재검증해 위반 시 400을 돌려준다(대시보드 쪽은 확인 버튼을
// 유효성 검사 통과 값만 전송하도록 막아 평소엔 400을 받을 일이 없다).
export function fetchDetailExpert(temp: number, rh: number, vent: number): Promise<ApiResponse<ExpertDetail>> {
  const query = new URLSearchParams({ temp: String(temp), rh: String(rh), vent: String(vent) });
  return fetchApi<ExpertDetail>(`/api/detail/expert?${query.toString()}`);
}

// 상세 패널(6) "제어" 탭 — docs/02-relay-api.md 6장 "GET /api/detail/control?target=".
// 탭 선택 시(target=energy 기본)와 최적화 버튼(에너지/환경) 전환 시마다 호출한다
// (ControlModeView.tsx, 01-functional-spec.md 4.4 — 예측 모드의 "탭당 1회"와 다른 패턴).
export function fetchDetailControl(target: 'energy' | 'environment'): Promise<ApiResponse<ControlDetail>> {
  return fetchApi<ControlDetail>(`/api/detail/control?target=${target}`);
}
