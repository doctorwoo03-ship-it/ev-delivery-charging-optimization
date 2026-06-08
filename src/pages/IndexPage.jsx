import { Link } from 'react-router-dom'

const mvpCards = [
  {
    to: '/mvp-0',
    stage: 'MVP-0',
    subtitle: '지도 테스트',
    desc: 'Kakao Map API 연동 확인 및 기본 마커 테스트',
    ready: true,
  },
  {
    to: '/mvp-1',
    stage: 'MVP-1',
    subtitle: '기본 대시보드',
    desc: '차량 상태 패널 및 지도 마커 시각화',
    ready: true,
  },
  {
    to: '/mvp-2',
    stage: 'MVP-2',
    subtitle: '배송지 관리',
    desc: '배송지 추가·삭제 및 지도 마커 실시간 연동',
    ready: true,
  },
  {
    to: '/mvp-3',
    stage: 'MVP-3',
    subtitle: '배터리 SOC 계산',
    desc: '브랜드·차종 선택 및 전비 기반 예상 주행거리 계산',
    ready: true,
  },
  {
    to: '/mvp-4',
    stage: 'MVP-4',
    subtitle: '경로 거리 계산',
    desc: '실제 배송 경로 거리 계산 및 충전 필요 여부 판단',
    ready: false,
  },
  {
    to: '/mvp-5',
    stage: 'MVP-5',
    subtitle: '충전소 추천',
    desc: '경로 인근 충전소 후보 표시 및 최적 충전소 추천',
    ready: false,
  },
  {
    to: '/mvp-6',
    stage: 'MVP-6',
    subtitle: '배송 순서 최적화',
    desc: '다수 배송지 방문 순서 최적화 및 TSP 로직 적용',
    ready: false,
  },
  {
    to: '/mvp-7',
    stage: 'MVP-7',
    subtitle: 'EV 경로 최적화',
    desc: '배송 경로와 충전소 경유지를 통합한 EV 특화 최적 경로',
    ready: false,
  },
  {
    to: '/mvp-8',
    stage: 'MVP-8',
    subtitle: '내비게이션 안내',
    desc: '단계별 주행 안내 UI 및 경로 폴리라인 지도 시각화',
    ready: false,
  },
]

function IndexPage() {
  return (
    <div className="index-root">
      <header className="index-header">
        <h1>EV 배송차량 충전 최적화 플랫폼</h1>
        <p>MVP 단계별 구현 현황</p>
      </header>
      <main className="index-main">
        <div className="mvp-grid">
          {mvpCards.map(({ to, stage, subtitle, desc, ready }) => (
            <Link
              key={to}
              to={to}
              className={`mvp-card${ready ? '' : ' mvp-card-pending'}`}
            >
              <div className="mvp-card-header">
                <span className="mvp-card-stage">{stage}</span>
                {ready
                  ? <span className="mvp-badge-ready">완료</span>
                  : <span className="mvp-badge-pending">예정</span>
                }
              </div>
              <div className="mvp-card-subtitle">{subtitle}</div>
              <p className="mvp-card-desc">{desc}</p>
            </Link>
          ))}
        </div>

        <Link to="/mvp-flow" className="mvp-flow-card">
          <div className="mvp-flow-header">
            <span className="mvp-flow-title">MVP 개발 흐름</span>
            <span className="mvp-flow-arrow">→</span>
          </div>
          <p className="mvp-flow-desc">
            전체 MVP 단계를 순서대로 탐색합니다. 상단 네비게이션을 통해 각 단계로 자유롭게 이동할 수 있습니다.
          </p>
        </Link>
      </main>
    </div>
  )
}

export default IndexPage
