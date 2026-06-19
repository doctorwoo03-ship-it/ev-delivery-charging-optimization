import { Link } from 'react-router-dom'

const roadmap = [
  {
    stage: 'MVP-0',
    title: 'Kakao Map 기본 연동',
    path: '/mvp-flow/mvp-0',
    status: 'done',
    features: ['Kakao Map 표시', '기본 마커 표시'],
  },
  {
    stage: 'MVP-1',
    title: '기본 대시보드',
    path: '/mvp-flow/mvp-1',
    status: 'done',
    features: ['차량 상태 패널', '지도', '배송지 마커', '충전소 마커', '추천 충전소 마커'],
  },
  {
    stage: 'MVP-2',
    title: '배송지 관리',
    path: '/mvp-flow/mvp-2',
    status: 'done',
    features: ['배송지 추가', '배송지 삭제', '배송지 목록 관리', '배송지 마커 동적 표시'],
  },
  {
    stage: 'MVP-3',
    title: '차량 선택 및 배터리 SOC 계산',
    path: '/mvp-flow/mvp-3',
    status: 'done',
    features: ['브랜드 선택', '차량 모델 선택', '커스텀 차량 입력', 'SOC 기반 잔여 배터리 계산', '전비 기반 예상 주행거리 계산'],
  },
  {
    stage: 'MVP-4',
    title: '실제 배송 경로 거리 계산',
    path: '/mvp-flow/mvp-4',
    status: 'done',
    features: ['MVP-2 배송지 목록 활용', '차량 출발지 설정', 'Kakao Directions API 연동 준비', '실제 배송 경로 거리 계산', '충전 필요 여부 판단'],
  },
  {
    stage: 'MVP-5',
    title: '충전소 추천',
    path: '/mvp-flow/mvp-5',
    status: 'done',
    features: ['배송 경로 인근 충전소 후보 표시', '배터리 부족 시 최적 충전소 추천', '충전소 거리·속도·도착 배터리 고려', '충전 후 예상 잔여 배터리 계산', '충전 계획 계산 (충전량·시간·비용)', 'IVI 스타일 지도 오버레이 카드'],
  },
  {
    stage: 'MVP-6',
    title: '배송 순서 최적화 + 경로 인텔리전스',
    path: '/mvp-flow/mvp-6',
    status: 'done',
    features: [
      '완전탐색(≤8) / 근사탐색(≥9) TSP 배송 순서 최적화',
      '출발지 선택 (카카오 장소 검색 연동)',
      '실도로 카카오 모빌리티 경로 API 연동 (fallback 포함)',
      '경로 선분 편차 기반 충전소 추천 (pointToSegmentKm)',
      '경로 1km 이내 충전소 마커 필터링',
      '충전소 상세 카드 · 추천 이유 배지 · 경로 밴드 레이블',
    ],
  },
  {
    stage: 'MVP-7',
    title: 'EV 경로 인텔리전스',
    path: '/mvp-flow/mvp-7',
    status: 'done',
    features: [
      'EV 경로 인텔리전스 및 경로 결정 설명',
      '실도로 기반 경로 건강 점수 (0–100)',
      '배송 가능 / 충전 권장 / 여유 부족 / 충전 필요 / 도달 불가 / 데이터 없음 / SOC 확인 필요 7가지 상태 판정',
      'MVP-6 ↔ MVP-7 세션 복원 및 결정 근거 동기화',
      '최소 도착 SOC · 예상 도착 SOC · 건강 점수 연동',
    ],
  },
  {
    stage: 'MVP-8',
    title: '5단계 통합 드라이버 플로우',
    path: '/mvp-flow/mvp-8',
    status: 'done',
    features: [
      '5단계 설정 마법사 (차량 → SOC → 출발지 → 배송지 → 검토) + 코크핏 뷰',
      'SafeMap/KE 공공 충전소 API 연동 (반경 15km · 10분 캐시)',
      'Kakao 실도로 경로 거리 계산 및 폴리라인 표시 (fallback 포함)',
      '안전 하한 SOC 기반 구간별 SOC 시뮬레이션 · pull-forward 충전 삽입 판단',
      'EV 인텔리전스 설명 패널 · 7가지 결정 상태',
      'Vercel(프론트) + Render(백엔드) 배포 완료',
    ],
  },
]

const badgeStyle = {
  done: { background: '#dcfce7', color: '#16a34a', label: '완료' },
  inprogress: { background: '#fef3c7', color: '#d97706', label: '진행 중' },
  planned: { background: '#f1f5f9', color: '#64748b', label: '예정' },
}

function MVPFlowPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>MVP 개발 로드맵</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        MVP-0부터 MVP-8까지 전체 개발 단계를 확인하고 각 단계로 이동할 수 있습니다.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {roadmap.map(({ stage, title, path, status, features }) => {
          const badge = badgeStyle[status]
          return (
            <Link
              key={stage}
              to={path}
              style={{
                display: 'block',
                textDecoration: 'none',
                border: status === 'done' ? '1px solid #bbf7d0' : status === 'inprogress' ? '1px solid #fde68a' : '1px solid #e2e8f0',
                background: status === 'done' ? '#f0fdf4' : status === 'inprogress' ? '#fffbeb' : '#fff',
                borderRadius: 10,
                padding: '14px 18px',
                transition: 'box-shadow 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#475569' }}>{stage}</span>
                  <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{title}</span>
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '2px 10px',
                  borderRadius: 20,
                  background: badge.background,
                  color: badge.color,
                }}>
                  {badge.label}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 22 }}>
                {features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 4, listStylePosition: 'outside' }}>{f}</li>
                ))}
              </ul>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default MVPFlowPage
