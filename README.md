# EV 배송차량 충전 최적화 플랫폼 — Frontend

## 프로젝트 목적

전기 배송차량 운전자가 출발 전에 배송 경로를 입력하면, 현재 배터리 상태와 실도로 거리를 기반으로 충전 필요 여부·충전소·충전량을 자동 판단해 주는 의사결정 지원 플랫폼입니다.

---

## 서비스 URL

| 환경 | URL |
|------|-----|
| 프론트엔드 (Vercel) | https://ev-delivery-charging-optimization.vercel.app |
| 백엔드 API (Render) | https://ev-delivery-charging-backend.onrender.com |
| API 문서 (Swagger) | https://ev-delivery-charging-backend.onrender.com/docs |

---

## MVP 단계별 주요 기능

| 단계 | 기능 요약 |
|------|-----------|
| MVP-0 | Kakao Maps SDK 연동 확인, 기본 마커 테스트 |
| MVP-1 | 차량 상태 패널, 배송지/충전소 마커 시각화 |
| MVP-2 | 배송지 추가·삭제, 지도 마커 실시간 연동 |
| MVP-3 | 브랜드·차종 선택, 전비 기반 주행 가능 거리 계산 |
| MVP-4 | 실제 배송 경로 거리 계산, 충전 필요 여부 1차 판단 |
| MVP-5 | 경로 인근 충전소 후보 표시, 최적 충전소 추천 |
| MVP-6 | TSP 기반 배송 순서 최적화, 경로 편차 기반 충전소 추천 |
| MVP-7 | 실도로 기반 경로 건강 점수, 7가지 상태 판정, MVP-6↔7 세션 복원 |
| MVP-8 | 통합 드라이버 플로우 (5단계 설정 마법사 + 코크핏 뷰) |

---

## MVP-8 최종 구현 기능

- **5단계 설정 마법사**: 차량 선택 → 배터리 SOC → 출발지 → 배송지 → 검토
- **Kakao 장소 검색**: Places API + Geocoder 이중 검색, debounce 처리
- **SafeMap/KE 공공 충전소 API**: 출발지 반경 15km 이내 충전소 실시간 조회, 10분 캐시
- **실도로 경로 거리**: Kakao Mobility Directions API 기반 (`/api/directions`)
- **안전 하한 SOC 기반 충전 삽입**: 배송 구간별 SOC 시뮬레이션 → 위반 지점에서 역방향 pull-forward → 최적 삽입 지점 결정
- **7가지 결정 상태**: 배송 가능 / 여유 부족 / 충전 권장 / 출발 전 충전 필요 / 충전소 도달 불가 / 실시간 데이터 없음 / SOC 확인 필요
- **세션 복원**: 새로고침 후 설정·코크핏 상태 자동 복원 (sessionStorage)
- **다크/라이트 테마**: localStorage 기반 사용자 선택 유지

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| UI 프레임워크 | React 18, React Router DOM 7 |
| 빌드 도구 | Vite 5 |
| 지도 SDK | Kakao Maps JavaScript SDK (libraries=services) |
| HTTP 클라이언트 | Axios |
| 배포 | Vercel (SPA rewrite via vercel.json) |

---

## 배포 구조

```
사용자 브라우저
    │
    ▼
Vercel (frontend)
    │  /api/* 요청
    ▼
Render (FastAPI backend)
    │  /api/directions  → Kakao Mobility API
    │  /api/chargers    → SafeMap / 공공 충전소 API
    ▼
외부 API
```

- Vercel은 `dist/` 정적 파일을 서빙하며, 모든 경로 요청을 `index.html`로 rewrite (SPA 라우팅)
- Render 백엔드는 Kakao Mobility 및 SafeMap API의 서버사이드 프록시 역할

---

## 환경변수

Vercel 대시보드 → Settings → Environment Variables에서 설정:

| 변수명 | 설명 |
|--------|------|
| `VITE_KAKAO_MAP_API_KEY` | Kakao Developers에서 발급받은 JavaScript 앱키 |
| `VITE_API_BASE_URL` | 백엔드 API URL (기본값: https://ev-delivery-charging-backend.onrender.com) |

> **주의:** `VITE_*` 변수는 Vite 빌드 시 번들에 인라인 치환됩니다. Vercel 대시보드에서 값을 정확히 설정해야 합니다. 값란에 변수명 자체를 입력하면 SDK 로딩이 실패합니다.

로컬 개발은 `frontend/.env` 파일 사용 (`.gitignore`로 제외):

```env
VITE_KAKAO_MAP_API_KEY=your_actual_key_here
VITE_API_BASE_URL=https://ev-delivery-charging-backend.onrender.com
```

---

## 알려진 제한 사항

- **충전소 실시간 가용 여부 미확인**: SafeMap API는 충전소 위치·사업자 정보를 제공하지만, 실시간 충전 슬롯 가용 여부(현재 충전 중/대기 중)는 확인되지 않습니다. 추천된 충전소에 도착 전 별도 확인이 필요합니다.
- **Render 무료 플랜 콜드 스타트**: 15분 이상 비활성 상태 후 첫 요청은 응답에 30–60초 소요될 수 있습니다.
- **경로 fallback**: Kakao Directions API가 실패하면 haversine 직선 거리로 대체됩니다. 실도로보다 거리가 짧게 추정될 수 있습니다.

---

## 로컬 실행 방법

```bash
# 1. 의존성 설치
cd frontend
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 VITE_KAKAO_MAP_API_KEY 값 입력

# 3. 개발 서버 실행
npm run dev
# → http://localhost:5173

# 4. 프로덕션 빌드
npm run build
npm run preview
```
