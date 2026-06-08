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
    status: 'planned',
    features: ['MVP-2 배송지 목록 활용', '차량 출발지 설정', 'Kakao Directions API 연동 준비', '실제 배송 경로 거리 계산', '충전 필요 여부 판단'],
  },
  {
    stage: 'MVP-5',
    title: '충전소 추천',
    path: '/mvp-flow/mvp-5',
    status: 'planned',
    features: ['배송 경로 인근 충전소 후보 표시', '배터리 부족 시 최적 충전소 추천', '충전소 거리·속도·도착 배터리 고려', '충전 후 예상 잔여 배터리 계산'],
  },
  {
    stage: 'MVP-6',
    title: '배송 순서 최적화',
    path: '/mvp-flow/mvp-6',
    status: 'planned',
    features: ['다수 배송지 방문 순서 최적화', '거리 행렬 기반 TSP 로직 준비', '최적화된 배송 순서 표시'],
  },
  {
    stage: 'MVP-7',
    title: 'EV 배터리 및 충전소 경로 최적화',
    path: '/mvp-flow/mvp-7',
    status: 'planned',
    features: ['배송 경로와 충전소 경유지 통합 고려', '배터리 부족 구간 감지', '충전 시점 및 충전량 추천', 'EV 특화 최적 경로 제안'],
  },
  {
    stage: 'MVP-8',
    title: '내비게이션 방식 경로 안내',
    path: '/mvp-flow/mvp-8',
    status: 'planned',
    features: ['최종 추천 경로 표시', '출발지·배송지·충전소 경유 순서 표시', '단계별 주행 안내 UI', '경로 폴리라인 지도 시각화'],
  },
]

const badgeStyle = {
  done: { background: '#dcfce7', color: '#16a34a', label: '완료' },
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
                border: status === 'done' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                background: status === 'done' ? '#f0fdf4' : '#fff',
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
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                {features.map((f) => (
                  <li key={f} style={{ fontSize: 12, color: '#64748b' }}>{f}</li>
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
