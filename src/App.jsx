import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/main.css'
import IndexPage from './pages/IndexPage'
import StandaloneLayout from './layouts/StandaloneLayout'
import FlowLayout from './layouts/FlowLayout'
import MVP0Page from './pages/MVP0Page'
import MVP1Page from './pages/MVP1Page'
import MVP2Page from './pages/MVP2Page'
import MVP3Page from './pages/MVP3Page'
import MVP4Page from './pages/MVP4Page'
import MVP5Page from './pages/MVP5Page'
import MVP6Page from './pages/MVP6Page'
import MVP7Page from './pages/MVP7Page'
import MVP8Page from './pages/MVP8Page'
import MVPFlowPage from './pages/MVPFlowPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 홈 — MVP 목록 카드 */}
        <Route path="/" element={<IndexPage />} />

        {/* 개별 MVP 페이지 — NavBar 없음, 뒤로가기 링크만 */}
        <Route element={<StandaloneLayout />}>
          <Route path="/mvp-0" element={<MVP0Page />} />
          <Route path="/mvp-1" element={<MVP1Page />} />
          <Route path="/mvp-2" element={<MVP2Page />} />
          <Route path="/mvp-3" element={<MVP3Page />} />
          <Route path="/mvp-4" element={<MVP4Page />} />
          <Route path="/mvp-5" element={<MVP5Page />} />
          <Route path="/mvp-6" element={<MVP6Page />} />
          <Route path="/mvp-7" element={<MVP7Page />} />
          <Route path="/mvp-8" element={<MVP8Page />} />
        </Route>

        {/* MVP 개발 흐름 — NavBar 있음, 단계 간 이동 가능 */}
        <Route path="/mvp-flow" element={<FlowLayout />}>
          <Route index element={<MVPFlowPage />} />
          <Route path="mvp-0" element={<MVP0Page />} />
          <Route path="mvp-1" element={<MVP1Page />} />
          <Route path="mvp-2" element={<MVP2Page />} />
          <Route path="mvp-3" element={<MVP3Page />} />
          <Route path="mvp-4" element={<MVP4Page />} />
          <Route path="mvp-5" element={<MVP5Page />} />
          <Route path="mvp-6" element={<MVP6Page />} />
          <Route path="mvp-7" element={<MVP7Page />} />
          <Route path="mvp-8" element={<MVP8Page />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
