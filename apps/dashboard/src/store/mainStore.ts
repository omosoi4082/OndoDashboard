// 메인 화면 상태 — zustand(CLAUDE.md 규칙). 영역별(rooms/weather-kma/weather-station)
// 응답을 각각 독립적으로 들고 있는다(하나로 합치지 않음).
import { create } from 'zustand';
import type { ApiResponse, KmaWeather, RoomId, RoomsResponse, StationWeather } from '@ondo/shared';

export interface MainState {
  rooms: ApiResponse<RoomsResponse> | null;
  weatherKma: ApiResponse<KmaWeather> | null;
  weatherStation: ApiResponse<StationWeather> | null;

  hoveredRoomId: RoomId | null;
  selectedRoomId: RoomId | null;
  /** 축척 바 표시값(8번 영역) — 카메라 줌에 따라 CameraRig가 갱신한다. */
  scaleBar: { meters: number; px: number } | null;

  setRooms: (value: ApiResponse<RoomsResponse>) => void;
  setWeatherKma: (value: ApiResponse<KmaWeather>) => void;
  setWeatherStation: (value: ApiResponse<StationWeather>) => void;
  setHoveredRoomId: (id: RoomId | null) => void;
  setSelectedRoomId: (id: RoomId | null) => void;
  setScaleBar: (value: { meters: number; px: number }) => void;
}

export const useMainStore = create<MainState>((set) => ({
  rooms: null,
  weatherKma: null,
  weatherStation: null,
  hoveredRoomId: null,
  selectedRoomId: null,
  scaleBar: null,

  setRooms: (value) => set({ rooms: value }),
  setWeatherKma: (value) => set({ weatherKma: value }),
  setWeatherStation: (value) => set({ weatherStation: value }),
  setHoveredRoomId: (id) => set({ hoveredRoomId: id }),
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
  setScaleBar: (value) => set({ scaleBar: value }),
}));
