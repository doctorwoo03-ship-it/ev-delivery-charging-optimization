import { Outlet } from 'react-router-dom'
import NavBar from '../components/NavBar'

function FlowLayout() {
  return (
    <div className="app">
      <header>
        <h1>EV 배송차량 충전 최적화 플랫폼</h1>
        <NavBar basePath="/mvp-flow" />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default FlowLayout
