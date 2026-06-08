import { NavLink } from 'react-router-dom'

const stages = [
  { key: 'mvp-0', label: 'MVP-0 지도 테스트' },
  { key: 'mvp-1', label: 'MVP-1 대시보드' },
  { key: 'mvp-2', label: 'MVP-2 배송지 관리' },
  { key: 'mvp-3', label: 'MVP-3 배터리 계산' },
  { key: 'mvp-4', label: 'MVP-4 경로 거리' },
  { key: 'mvp-5', label: 'MVP-5 충전소 추천' },
  { key: 'mvp-6', label: 'MVP-6 배송 순서 최적화' },
  { key: 'mvp-7', label: 'MVP-7 EV 경로 최적화' },
  { key: 'mvp-8', label: 'MVP-8 내비게이션' },
]

function NavBar({ basePath = '' }) {
  return (
    <nav className="nav">
      {stages.map(({ key, label }) => (
        <NavLink
          key={key}
          to={`${basePath}/${key}`}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default NavBar
