# 02. 디자인 가이드 + AI 프롬프트 모음

> 정식 브랜드 가이드가 아니라, 일관된 톤을 유지하기 위한 실무용 참고 문서.

## 톤앤매너
- 다크 네이비(#0e1116 ~ #151920 계열) 배경 + 시안/블루 네온 강조
- 경고/이상 상태만 옐로우/레드로 구분 (레퍼런스 스크린샷의 "주의"/"위험" 배지 패턴 유지)
- 카드: 반투명 유리감(glassmorphism) + 얇은 보더 라인, 과하지 않게

## 컬러 토큰 (Tailwind config에 그대로 추가)
```
bg-base:      #0e1116
bg-panel:     #151920
bg-card:      #1c2129
border-line:  #2a303c
text-muted:   #9aa4b2
accent-blue:  #3b8bd4
accent-cyan:  #5dcaa5
warn:         #f0b429
danger:       #d85a4a
```

## 이펙트 방향성 (postprocessing)
- Bloom: 강도 낮게, 3D 오브젝트의 발광 요소(센서 마커, 경고 표시)에만 은은하게
- Vignette: 살짝만 — 대시보드 가독성 해치지 않는 선에서
- 과도한 크로마틱 애버레이션/글리치 효과는 지양 (산업용 대시보드 톤 유지)

## AI 이미지 생성용 프롬프트 (텍스처/레퍼런스 이미지 필요 시)
```
industrial smart farm dashboard UI, dark navy background,
cyan and blue neon accent lines, glassmorphism panel cards,
isometric 3D building illustration, clean sans-serif Korean typography,
minimal sci-fi HUD style, no clutter, high contrast data readouts
```
```
futuristic data center server room, dark background,
cyan neon glow on server racks, subtle particle airflow visualization,
clean industrial UI aesthetic, top-down isometric angle
```
> 실제 생성 후 톤이 스크린샷과 어긋나면 "less saturated", "more muted neon",
> "flatter lighting" 같은 수식어를 추가해 조정.

## Blender 모델링 참고 프롬프트 (컨셉 스케치용)
```
low-poly pig barn interior, industrial ventilation ducts,
simple clean geometry suitable for real-time web rendering,
reference isometric angle, muted industrial color palette
```

## 타이포그래피
- 시스템 폰트 우선 (-apple-system, "Malgun Gothic") — 기존 레퍼런스와 동일하게 로딩 비용 없이 통일감 유지
- 숫자(온도/습도 등)는 tabular-nums로 정렬 흔들림 방지
