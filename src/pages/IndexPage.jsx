import { useRef } from 'react'
import { Link } from 'react-router-dom'

// ── Design tokens (DESIGN-apple.md)
const CLR = {
  primary:       '#0066cc',
  primaryOnDark: '#2997ff',
  ink:           '#1d1d1f',
  inkMuted80:    '#333333',
  inkMuted48:    '#7a7a7a',
  canvas:        '#ffffff',
  parchment:     '#f5f5f7',
  tileDark1:     '#272729',
  tileDark2:     '#2a2a2c',
  onDark:        '#ffffff',
  onDarkMuted:   '#cccccc',
  hairline:      '#e0e0e0',
}

const DISPLAY = "'SF Pro Display', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
const TEXT    = "'SF Pro Text', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"

function scrollToRef(ref) {
  if (!ref.current) return
  const top = ref.current.getBoundingClientRect().top + window.scrollY - 64
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function PillCta({ to, children, outline = false, onDark = false, size = 'md' }) {
  const lg = size === 'lg'
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: lg ? '18px 36px' : '12px 24px',
    borderRadius: 9999, lineHeight: 1, textDecoration: 'none',
    fontSize: lg ? 19 : 16, fontWeight: 500,
    fontFamily: TEXT, letterSpacing: '-0.374px',
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'opacity 0.15s',
  }
  const filled = { ...base, background: CLR.primary, color: '#fff', border: 'none' }
  const ghost  = { ...base, background: 'transparent', border: `1.5px solid ${onDark ? CLR.primaryOnDark : CLR.primary}`, color: onDark ? CLR.primaryOnDark : CLR.primary }
  return <Link to={to} style={outline ? ghost : filled}>{children}</Link>
}

// ── CSS Route Mockup
// SVG viewBox="0 0 100 100" + preserveAspectRatio="none" 사용.
// (x, y) 좌표가 컨테이너 기준 % 포지션과 1:1 대응.
function RouteMockup() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#131929', overflow: 'hidden' }}>

      {/* SVG 레이어: 그리드 + 도로망 + 경로 */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* 미세 격자 */}
        {[12,24,36,48,60,72,84].map(n => (
          <line key={`v${n}`} x1={n} y1={0} x2={n} y2={100} stroke="rgba(120,160,220,0.05)" strokeWidth="0.4" />
        ))}
        {[15,30,45,60,75,90].map(n => (
          <line key={`h${n}`} x1={0} y1={n} x2={100} y2={n} stroke="rgba(120,160,220,0.05)" strokeWidth="0.4" />
        ))}

        {/* 도로망 (세로) */}
        <line x1={20} y1={0} x2={18} y2={100} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={50} y1={0} x2={52} y2={100} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={80} y1={0} x2={78} y2={100} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        {/* 도로망 (가로) */}
        <line x1={0} y1={24} x2={100} y2={22} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={0} y1={48} x2={100} y2={46} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={0} y1={74} x2={100} y2={72} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />

        {/* 경로 글로우 (외곽) */}
        <path
          d="M 14,76 C 22,64 30,57 37,50 C 50,42 57,36 64,33 C 74,28 82,37 88,52"
          stroke="#1a7dff"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.22"
        />
        {/* 경로 코어 */}
        <path
          d="M 14,76 C 22,64 30,57 37,50 C 50,42 57,36 64,33 C 74,28 82,37 88,52"
          stroke="#4da8ff"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 충전소 우회 지선 (점선) */}
        <path
          d="M 80,44 C 79,54 78,61 76,68"
          stroke="#30d158"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2.5 2"
          opacity="0.75"
        />
      </svg>

      {/* 상단 pill 레이블 */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 9999, padding: '8px 20px',
        fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)',
        fontFamily: TEXT, whiteSpace: 'nowrap', letterSpacing: '-0.2px',
        zIndex: 2,
      }}>
        실제 도로 경로 · 서울 도심
      </div>

      {/* 출발 마커 */}
      <div style={{ position: 'absolute', left: '14%', top: '76%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: '#1a7dff', border: '3px solid #fff',
          boxShadow: '0 0 12px rgba(26,125,255,0.85)',
        }} />
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.72)',
          fontFamily: TEXT, whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.52)', padding: '2px 6px', borderRadius: 4,
        }}>출발</div>
      </div>

      {/* 배송지 마커 1, 2, 3 */}
      {[
        { cx: '37%', cy: '50%', n: 1 },
        { cx: '64%', cy: '33%', n: 2 },
        { cx: '88%', cy: '52%', n: 3 },
      ].map(({ cx, cy, n }) => (
        <div key={n} style={{
          position: 'absolute', left: cx, top: cy,
          transform: 'translate(-50%, -50%)', zIndex: 3,
          width: 26, height: 26, borderRadius: '50%',
          background: '#fff', border: '2.5px solid #1a7dff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#0055bb', fontFamily: DISPLAY,
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {n}
        </div>
      ))}

      {/* 충전소 마커 */}
      <div style={{
        position: 'absolute', left: '76%', top: '68%',
        transform: 'translate(-50%, -50%)', zIndex: 3,
        width: 24, height: 24, borderRadius: '50%',
        background: '#30d158', border: '2.5px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 12px rgba(48,209,88,0.75)',
        fontSize: 12,
      }}>
        ⚡
      </div>

      {/* 하단 floating summary */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18, padding: '14px 30px',
        display: 'flex', gap: 28, alignItems: 'center',
        zIndex: 4, whiteSpace: 'nowrap',
      }}>
        {[
          { value: '배송 가능',    label: '상태',    color: '#30d158' },
          { value: '충전 없이 완주', label: '충전 시점', color: '#fff' },
          { value: '85.5km',      label: '전체 거리', color: '#fff' },
          { value: '90점',        label: '건강 점수', color: '#4da8ff' },
        ].map(({ value, label, color }, i, arr) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: TEXT, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)', fontFamily: TEXT, marginTop: 4 }}>{label}</div>
            </div>
            {i < arr.length - 1 && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 섹션 헤더
function SectionHead({ label, title, subtitle, dark = false }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 72 }}>
      {label && (
        <div style={{ fontSize: 18, fontWeight: 600, color: dark ? CLR.primaryOnDark : CLR.primary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 18, fontFamily: TEXT }}>
          {label}
        </div>
      )}
      <h2 style={{ fontSize: 'clamp(48px, 5vw, 68px)', fontWeight: 600, color: dark ? CLR.onDark : CLR.ink, fontFamily: DISPLAY, lineHeight: 1.06, letterSpacing: '-0.5px', marginBottom: subtitle ? 22 : 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 20, color: dark ? CLR.onDarkMuted : CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.5, letterSpacing: '-0.374px', maxWidth: 580, margin: '0 auto' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── Static data
const PROBLEMS = [
  { icon: '⚡', title: '충전 시점 판단이 어려워요',        desc: '배터리 잔량만으로는 어느 시점에 충전해야 하는지 정확히 알기 어려워요.' },
  { icon: '🗺', title: '경로 맞춤 충전소 찾기가 번거로워요', desc: '배송 경로 근처에서 적합한 충전소를 직접 찾는 데 시간이 많이 걸려요.' },
  { icon: '⏱', title: '충전 때문에 배송이 지연돼요',        desc: '예상치 못한 충전 일정 때문에 배송 약속 시간을 지키기 어려울 수 있어요.' },
  { icon: '📊', title: '배터리 상태를 계속 체크해야 해요',   desc: '여러 배송지를 돌면서 배터리 상태와 남은 거리를 지속적으로 계산해야 해요.' },
]

const USERS = [
  { icon: '🚐', title: '전기 배송차량 운전자', desc: '출발 전에 충전이 필요한지, 어디서 충전하면 좋은지 바로 알 수 있어요.' },
  { icon: '📦', title: '물류 운영자',          desc: '배송 가능 여부와 충전 계획을 미리 확인해 운행 일정을 효율적으로 관리해요.' },
  { icon: '🔋', title: 'EV Fleet 관리자',      desc: '차량별 배터리 상태와 경로 건강 점수를 바탕으로 운행 리스크를 줄여요.' },
  { icon: '🏙', title: '도시 물류 기획자',     desc: '실제 도로 데이터와 공공 충전소 정보를 활용한 EV 물류 계획을 세울 수 있어요.' },
]

const HOW_STEPS = [
  { num: '01', title: '차량과 배터리 설정',   desc: '차량 종류와 현재 배터리 잔량(SOC)을 입력해요.' },
  { num: '02', title: '출발지와 배송지 설정', desc: '출발지와 배송지를 입력하거나 장소 검색으로 빠르게 추가해요.' },
  { num: '03', title: '배송 순서 최적화',     desc: 'TSP 알고리즘으로 가장 효율적인 배송 순서를 제안해요.' },
  { num: '04', title: '경로와 에너지 분석',   desc: '실제 도로 거리를 바탕으로 에너지 소모량과 충전 필요 여부를 계산해요.' },
  { num: '05', title: '충전 계획 확인',       desc: '배송 가능 여부와 추천 충전소를 코크핏 화면에서 한눈에 확인해요.' },
]

const LOGIC_CARDS = [
  { num: '01', title: '경로 + 순서',    desc: '배송 순서와 충전 시점을 함께 고려해요.' },
  { num: '02', title: '안전 하한',      desc: '안전 하한 SOC로 위험 구간을 찾아요.' },
  { num: '03', title: '에너지 추정',    desc: '실제 도로거리로 에너지 소모를 예측해요.' },
  { num: '04', title: '충전 삽입',      desc: '경로 중 충전이 필요한 시점을 찾아요.' },
  { num: '05', title: '후보 비교',      desc: '충전소 후보를 비교해요.' },
  { num: '06', title: '경로 건강 점수', desc: '배터리 여유와 충전 필요도를 종합해 경로 상태를 점수로 보여줘요.' },
]

const TECH_GROUPS = [
  { category: 'Frontend',  items: ['React + Vite', 'Kakao Map SDK', '인라인 스타일 기반 UI'] },
  { category: '외부 API',  items: ['Kakao Directions (실도로 경로)', 'SafeMap / KE 공공 충전소 API', 'Kakao 장소 검색'] },
  { category: 'Backend',   items: ['FastAPI (Python)', 'Render.com 배포', 'REST API'] },
  { category: '알고리즘',  items: ['TSP 배송 순서 최적화', '안전 하한 SOC 기반 충전 삽입', 'EV 경로 건강 점수'] },
]

const DEV_MILESTONES = [
  { stage: 'MVP-0',   title: '지도 연동',              desc: 'Kakao Map API 기본 연동' },
  { stage: 'MVP-1~2', title: '대시보드 + 배송지 관리', desc: '차량 패널·배송지 추가/삭제' },
  { stage: 'MVP-3~4', title: 'SOC 계산 + 경로 거리',  desc: '전비 기반 배터리 계산·도로 거리' },
  { stage: 'MVP-5~6', title: '충전소 추천 + TSP',      desc: '충전소 추천·배송 순서 최적화' },
  { stage: 'MVP-7',   title: 'EV 경로 인텔리전스',    desc: '경로 건강 점수·7가지 상태 판정' },
  { stage: 'MVP-8',   title: '통합 드라이버 플로우',   desc: '5단계 마법사·공공 API·세션 복원' },
]

export default function IndexPage() {
  const howRef = useRef(null)
  const techRef = useRef(null)
  const devRef  = useRef(null)

  return (
    <div style={{ fontFamily: TEXT, background: CLR.canvas, minHeight: '100vh' }}>

      {/* ── STICKY NAV ────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: '#000000', height: 52,
        display: 'flex', alignItems: 'center',
        padding: '0 32px',
      }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#fff', fontFamily: TEXT, letterSpacing: '-0.2px' }}>
          EV 배송차량 충전 최적화
        </span>
        {[
          { label: '작동 방식', ref: howRef },
          { label: '기술',      ref: techRef },
          { label: '개발 과정', ref: devRef },
        ].map(({ label, ref: r }) => (
          <button key={label} onClick={() => scrollToRef(r)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.82)', fontSize: 15, fontFamily: TEXT, letterSpacing: '-0.2px', padding: '0 18px', height: 52, lineHeight: 1 }}>
            {label}
          </button>
        ))}
        <div style={{ width: 18 }} />
        <Link to="/mvp-8?start=1" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 22px', borderRadius: 9999, lineHeight: 1,
          textDecoration: 'none', fontSize: 15, fontWeight: 600,
          fontFamily: TEXT, letterSpacing: '-0.2px',
          background: CLR.primary, color: '#fff', border: 'none', whiteSpace: 'nowrap',
        }}>
          서비스 시작
        </Link>
      </nav>

      {/* ── HERO ──────────────────────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '148px 24px 148px' }}>
        <div style={{ maxWidth: 940, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: CLR.primary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 26, fontFamily: TEXT }}>
            EV 배송차량 충전 최적화 플랫폼
          </div>
          <h1 style={{ fontSize: 'clamp(64px, 7vw, 92px)', fontWeight: 600, color: CLR.ink, fontFamily: DISPLAY, lineHeight: 1.03, letterSpacing: '-0.5px', marginBottom: 30 }}>
            배송 경로와 배터리 상태를 함께 분석해<br />충전 시점과 충전소를 추천해요.
          </h1>
          <p style={{ fontSize: 28, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.38, letterSpacing: '-0.5px', marginBottom: 16 }}>
            출발 전에 충전이 필요한지, 어디서 충전할지 바로 알 수 있어요.
          </p>
          <p style={{ fontSize: 20, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, letterSpacing: '-0.374px', marginBottom: 52 }}>
            실제 도로 경로와 공공 충전소 데이터를 바탕으로 충전 계획을 빠르게 확인할 수 있어요.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <PillCta to="/mvp-8?start=1" size="lg">서비스 시작</PillCta>
            <PillCta to="/mvp-flow" outline size="lg">개발 과정 보기</PillCta>
          </div>
        </div>
      </section>

      {/* ── 스마트 모빌리티 코크핏 (near-black full-bleed) ── */}
      <section style={{ background: CLR.tileDark1, padding: '140px 24px 160px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: CLR.primaryOnDark, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 22, fontFamily: TEXT }}>
              스마트 모빌리티 코크핏
            </div>
            <h2 style={{ fontSize: 'clamp(44px, 5vw, 60px)', fontWeight: 600, color: CLR.onDark, fontFamily: DISPLAY, lineHeight: 1.05, letterSpacing: '-0.5px', marginBottom: 22 }}>
              배송 가능 여부, 충전 시점, 추천 충전소를<br />한 화면에서 확인해요.
            </h2>
            <p style={{ fontSize: 20, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.5, letterSpacing: '-0.374px', maxWidth: 560, margin: '0 auto' }}>
              운전자가 바로 판단할 수 있도록 실제 도로 경로와 충전 정보를 한 장의 화면으로 정리해요.
            </p>
          </div>

          {/* preview card */}
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            borderRadius: 22, overflow: 'hidden',
            boxShadow: 'rgba(0,0,0,0.55) 0 28px 90px 0',
            maxWidth: 1220, margin: '0 auto',
          }}>
            {/* 왼쪽: CSS route mockup (64%) */}
            <div style={{ flex: '1 1 64%', minWidth: 0, height: 560, position: 'relative', background: '#131929', overflow: 'hidden' }}>
              <RouteMockup />
            </div>

            {/* 오른쪽: 충전 판단 요약 패널 (36%) */}
            <div style={{ flex: '1 1 36%', minWidth: 300, background: CLR.tileDark2, padding: '36px 42px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* 헤더 */}
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.45)', fontFamily: TEXT, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                충전 판단 요약
              </div>

              {/* 대형 상태 표시 */}
              <div style={{ fontSize: 36, fontWeight: 700, color: '#30d158', fontFamily: DISPLAY, lineHeight: 1, marginBottom: 20 }}>
                배송 가능
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 18 }} />

              {/* 데이터 행 */}
              {[
                { label: '차량 종류',         value: '현대 ST1' },
                { label: '현재 SOC',          value: '78%' },
                { label: '충전 시점',          value: '충전 없이 배송 가능', green: true },
                { label: '추천 충전소',        value: '서울양원리 공영주차장' },
                { label: '안전 하한 SOC',      value: '20% 유지' },
                { label: '전체 배송 거리',      value: '85.5 km' },
                { label: '배송 완료 예상 SOC', value: '51.3%' },
              ].map(({ label, value, green }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 14, color: CLR.onDarkMuted, fontFamily: TEXT, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: green ? '#30d158' : CLR.onDark, fontFamily: TEXT, textAlign: 'right', marginLeft: 10 }}>{value}</span>
                </div>
              ))}

              {/* 경로 건강 점수 카드 */}
              <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(0,102,204,0.14)', borderRadius: 13, border: '1px solid rgba(41,151,255,0.28)' }}>
                <div style={{ fontSize: 12, color: CLR.primaryOnDark, fontWeight: 600, marginBottom: 10, fontFamily: TEXT, letterSpacing: '0.10em', textTransform: 'uppercase' }}>경로 건강 점수</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 46, fontWeight: 700, color: CLR.onDark, fontFamily: DISPLAY, lineHeight: 1 }}>90</span>
                  <span style={{ fontSize: 18, color: CLR.onDarkMuted, fontFamily: TEXT }}>점</span>
                </div>
              </div>

              {/* 판단 근거 callout */}
              <div style={{ marginTop: 12, padding: '11px 14px', background: 'rgba(41,151,255,0.07)', borderRadius: 10, border: '1px solid rgba(41,151,255,0.18)' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(190,215,255,0.80)', fontFamily: TEXT, lineHeight: 1.6 }}>
                  서비스에서 경로 건강 점수와 충전 판단의 이유도 함께 확인할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 문제 카드 4개 (parchment) ─────────────────── */}
      <section style={{ background: CLR.parchment, padding: '140px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHead
            label="해결하는 문제"
            title="전기 배송차량 운행의 불확실성을 줄여요."
            subtitle="배터리와 경로 데이터를 함께 분석해 운전자가 확신을 갖고 출발할 수 있도록 도와요."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}>
            {PROBLEMS.map(p => (
              <div key={p.title} style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 36, minHeight: 210 }}>
                <div style={{ fontSize: 34, marginBottom: 18 }}>{p.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontSize: 17, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, letterSpacing: '-0.224px' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 대상 사용자 카드 4개 (white) ──────────────── */}
      <section style={{ background: CLR.canvas, padding: '140px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHead
            label="이런 분들을 위해 만들었어요"
            title="전기 배송 운영에 참여하는 모든 분께 유용해요."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}>
            {USERS.map(u => (
              <div key={u.title} style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 36, minHeight: 210 }}>
                <div style={{ fontSize: 34, marginBottom: 18 }}>{u.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>{u.title}</div>
                <div style={{ fontSize: 17, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, letterSpacing: '-0.224px' }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 작동 방식 5단계 (parchment) ───────────────── */}
      <section ref={howRef} id="how-it-works" style={{ background: CLR.parchment, padding: '140px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <SectionHead label="작동 방식" title="5단계로 충전 계획을 세워요." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {HOW_STEPS.map((s, i) => (
              <div key={i} style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: '28px 34px', display: 'flex', alignItems: 'center', gap: 28, minHeight: 96 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  background: CLR.primary, color: '#fff',
                  fontSize: 18, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: DISPLAY,
                }}>
                  {s.num}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 17, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 핵심 판단 로직 6개 (near-black) ───────────── */}
      <section ref={techRef} id="technology" style={{ background: CLR.tileDark2, padding: '150px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHead
            dark
            label="핵심 판단 로직"
            title="6단계 로직으로 최적 충전 계획을 만들어요."
            subtitle="배터리 상태와 경로 데이터를 단계별로 분석해 정확한 충전 판단을 내려요."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
            {LOGIC_CARDS.map((c, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 22, padding: 36 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: CLR.primaryOnDark, fontFamily: TEXT, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{c.num}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: CLR.onDark, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12 }}>{c.title}</div>
                <div style={{ fontSize: 17, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기술 구성 카드 (white) ─────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '140px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHead label="기술 구성" title="실제 API와 알고리즘을 사용해요." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}>
            {TECH_GROUPS.map((g, i) => (
              <div key={i} style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 36 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 20, fontFamily: TEXT }}>{g.category}</div>
                {g.items.map(item => (
                  <div key={item} style={{ fontSize: 17, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 2.1, letterSpacing: '-0.224px' }}>· {item}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용 방법 (parchment) ─────────────────────── */}
      <section style={{ background: CLR.parchment, padding: '140px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <SectionHead label="사용 방법" title="지금 바로 충전 계획을 확인해요." />
          <div style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 44 }}>
            {[
              '서비스 시작 버튼을 눌러요.',
              '차량 종류를 선택하고 현재 배터리 잔량을 입력해요.',
              '출발지와 배송지를 추가해요.',
              '배송 순서를 확인하고 코크핏으로 이동해요.',
              '배송 가능 여부와 충전 계획을 확인해요.',
            ].map((text, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 22,
                paddingBottom: i < arr.length - 1 ? 22 : 0,
                borderBottom: i < arr.length - 1 ? `1px solid ${CLR.hairline}` : 'none',
                marginBottom: i < arr.length - 1 ? 22 : 0,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 9999, background: CLR.primary, color: '#fff', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: TEXT }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 19, color: CLR.ink, fontFamily: TEXT, lineHeight: 1.5, letterSpacing: '-0.374px' }}>{text}</div>
              </div>
            ))}
            <div style={{ marginTop: 44, textAlign: 'center' }}>
              <PillCta to="/mvp-8?start=1" size="lg">서비스 시작</PillCta>
            </div>
          </div>
        </div>
      </section>

      {/* ── 접속 안내 카드 (white) ────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '72px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ background: CLR.parchment, border: '1px solid rgba(0,0,0,0.07)', borderRadius: 26, padding: '44px 52px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,102,204,0.10)', border: '1px solid rgba(0,102,204,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 17, color: CLR.primary }}>ℹ</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, letterSpacing: '-0.3px' }}>접속 안내</div>
            </div>
            <p style={{ fontSize: 19, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, letterSpacing: '-0.374px', margin: 0 }}>
              일정 시간 접속이 없으면 백엔드가 잠시 쉬어갈 수 있어요.<br />
              처음 접속할 때 실제 도로경로 계산이나 충전소 정보 로딩이 약 30~60초 걸릴 수 있어요.<br />
              잠시 기다리거나 새로고침하면 다시 이용할 수 있어요.
            </p>
          </div>
        </div>
      </section>

      {/* ── 개발 과정 섹션 (near-black full-bleed) ────── */}
      <section ref={devRef} id="development-process" style={{ background: CLR.tileDark1, padding: '150px 24px 160px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: CLR.primaryOnDark, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 26, fontFamily: TEXT }}>개발 과정</div>
            <h2 style={{ fontSize: 'clamp(48px, 5vw, 68px)', fontWeight: 600, color: CLR.onDark, fontFamily: DISPLAY, lineHeight: 1.06, letterSpacing: '-0.5px', marginBottom: 22 }}>
              MVP-0부터 MVP-8까지의 개발 여정을 확인해요.
            </h2>
            <p style={{ fontSize: 20, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.5, letterSpacing: '-0.374px', maxWidth: 560, margin: '0 auto 52px' }}>
              카카오 지도 연동부터 실시간 충전소 API, 경로 최적화까지 단계별로 쌓아 올린 과정을 볼 수 있어요.
            </p>
            <PillCta to="/mvp-flow" outline onDark size="lg">개발 과정 보기</PillCta>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            {DEV_MILESTONES.map((m, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 18, padding: '26px 28px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: CLR.primaryOnDark, fontFamily: TEXT, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{m.stage}</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: CLR.onDark, fontFamily: TEXT, marginBottom: 6 }}>{m.title}</div>
                <div style={{ fontSize: 15, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer style={{ background: CLR.parchment, padding: '56px 32px', borderTop: `1px solid ${CLR.hairline}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ fontSize: 15, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7 }}>
            EV 배송차량 충전 최적화 플랫폼<br />도시 캡스톤 디자인
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <Link to="/mvp-8?start=1" style={{ fontSize: 15, color: CLR.primary, fontFamily: TEXT, textDecoration: 'none' }}>서비스 시작</Link>
            <Link to="/mvp-flow" style={{ fontSize: 15, color: CLR.primary, fontFamily: TEXT, textDecoration: 'none' }}>개발 과정</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
