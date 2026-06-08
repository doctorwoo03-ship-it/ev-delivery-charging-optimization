import { Outlet, Link } from 'react-router-dom'

function StandaloneLayout() {
  return (
    <div className="app">
      <header className="standalone-header">
        <Link to="/" className="back-link">← 목록으로</Link>
        <span className="standalone-title">EV 배송차량 충전 최적화 플랫폼</span>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default StandaloneLayout
