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
    ready: true,
  },
  {
    to: '/mvp-5',
    stage: 'MVP-5',
    subtitle: '충전소 추천',
    desc: '경로 인근 충전소 후보 표시 및 최적 충전소 추천',
    ready: true,
  },
  {
    to: '/mvp-6',
    stage: 'MVP-6',
    subtitle: '배송 순서 최적화',
    desc: '출발지 선택 · 배송 순서 TSP 최적화 · 경로 편차 기반 충전소 추천 · 경로 1km 이내 마커 필터',
    ready: true,
  },
  {
    to: '/mvp-7',
    stage: 'MVP-7',
    subtitle: 'EV 경로 인텔리전스',
    desc: 'EV 경로 인텔리전스 및 경로 결정 설명 · 실도로 기반 경로 건강 점수 · 배송 가능/충전 권장/여유 부족/충전 필요/도달 불가/데이터 없음/SOC 확인 필요 7가지 상태 판정 · MVP-6 ↔ MVP-7 세션 복원 및 결정 근거 동기화 · 최소 도착 SOC·예상 도착 SOC·건강 점수 연동',
    ready: true,
  },
  {
    to: '/mvp-8',
    stage: 'MVP-8',
    subtitle: '내비게이션 및 실시간 충전소 연동',
    desc: '충전소 데이터 provider 구조 준비 · 공공 충전소 API 연동 준비 · 실시간 충전소 상태/가용 슬롯 반영 예정 · 운전자 지도 화면 중심의 내비게이션형 경로 안내 고도화',
    ready: false,
    inProgress: true,
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
          {mvpCards.map(({ to, stage, subtitle, desc, ready, inProgress }) => (
            <Link
              key={to}
              to={to}
              className={`mvp-card${ready ? '' : inProgress ? ' mvp-card-progress' : ' mvp-card-pending'}`}
            >
              <div className="mvp-card-header">
                <span className="mvp-card-stage">{stage}</span>
                {ready
                  ? <span className="mvp-badge-ready">완료</span>
                  : inProgress
                    ? <span className="mvp-badge-progress">진행 중</span>
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
