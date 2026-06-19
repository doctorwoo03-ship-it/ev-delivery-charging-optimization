import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Design tokens
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

// ── Scroll-reveal CSS (injected once, respects prefers-reduced-motion)
const REVEAL_CSS = `
  @media (prefers-reduced-motion: no-preference) {
    .rv-up {
      opacity: 0;
      transform: translateY(36px);
      transition: opacity 0.75s cubic-bezier(.16,1,.3,1), transform 0.75s cubic-bezier(.16,1,.3,1);
    }
    .rv-up.rv-in {
      opacity: 1;
      transform: translateY(0);
    }
    .rv-card {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.65s cubic-bezier(.16,1,.3,1), transform 0.65s cubic-bezier(.16,1,.3,1);
    }
    .rv-grid.rv-in > .rv-card {
      opacity: 1;
      transform: translateY(0);
    }
    .rv-grid.rv-in > .rv-card:nth-child(1) { transition-delay: 0ms; }
    .rv-grid.rv-in > .rv-card:nth-child(2) { transition-delay: 90ms; }
    .rv-grid.rv-in > .rv-card:nth-child(3) { transition-delay: 180ms; }
    .rv-grid.rv-in > .rv-card:nth-child(4) { transition-delay: 270ms; }
    .rv-grid.rv-in > .rv-card:nth-child(5) { transition-delay: 360ms; }
    .rv-grid.rv-in > .rv-card:nth-child(6) { transition-delay: 450ms; }
  }
`

// ── IntersectionObserver reveal hook (fires once, then disconnects)
function useReveal(threshold = 0.1) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function scrollToRef(ref) {
  if (!ref.current) return
  const top = ref.current.getBoundingClientRect().top + window.scrollY - 64
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function PillCta({ to, children, outline = false, onDark = false, size = 'md' }) {
  const lg = size === 'lg'
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: lg ? '20px 44px' : '12px 24px',
    borderRadius: 9999, lineHeight: 1, textDecoration: 'none',
    fontSize: lg ? 20 : 16, fontWeight: 600,
    fontFamily: TEXT, letterSpacing: '-0.374px',
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'opacity 0.15s',
  }
  const filled = { ...base, background: CLR.primary, color: '#fff', border: 'none',
    boxShadow: '0 4px 28px rgba(0,102,204,0.28)' }
  const ghost  = { ...base, background: 'transparent',
    border: `1.5px solid ${onDark ? CLR.primaryOnDark : CLR.primary}`,
    color: onDark ? CLR.primaryOnDark : CLR.primary }
  return <Link to={to} style={outline ? ghost : filled}>{children}</Link>
}

// ── CSS Route Mockup (unchanged)
function RouteMockup() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#131929', overflow: 'hidden' }}>
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[12,24,36,48,60,72,84].map(n => (
          <line key={`v${n}`} x1={n} y1={0} x2={n} y2={100} stroke="rgba(120,160,220,0.05)" strokeWidth="0.4" />
        ))}
        {[15,30,45,60,75,90].map(n => (
          <line key={`h${n}`} x1={0} y1={n} x2={100} y2={n} stroke="rgba(120,160,220,0.05)" strokeWidth="0.4" />
        ))}
        <line x1={20} y1={0} x2={18} y2={100} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={50} y1={0} x2={52} y2={100} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={80} y1={0} x2={78} y2={100} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={0} y1={24} x2={100} y2={22} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={0} y1={48} x2={100} y2={46} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <line x1={0} y1={74} x2={100} y2={72} stroke="rgba(200,220,255,0.09)" strokeWidth="1.8" />
        <path d="M 14,76 C 22,64 30,57 37,50 C 50,42 57,36 64,33 C 74,28 82,37 88,52"
          stroke="#1a7dff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
        <path d="M 14,76 C 22,64 30,57 37,50 C 50,42 57,36 64,33 C 74,28 82,37 88,52"
          stroke="#4da8ff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 80,44 C 79,54 78,61 76,68"
          stroke="#30d158" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="2.5 2" opacity="0.75" />
      </svg>
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 9999, padding: '8px 20px',
        fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)',
        fontFamily: TEXT, whiteSpace: 'nowrap', letterSpacing: '-0.2px', zIndex: 2,
      }}>
        실제 도로 경로 · 서울 도심
      </div>
      <div style={{ position: 'absolute', left: '14%', top: '76%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#1a7dff', border: '3px solid #fff', boxShadow: '0 0 12px rgba(26,125,255,0.85)' }} />
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.72)', fontFamily: TEXT, whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.52)', padding: '2px 6px', borderRadius: 4 }}>출발</div>
      </div>
      {[{ cx: '37%', cy: '50%', n: 1 }, { cx: '64%', cy: '33%', n: 2 }, { cx: '88%', cy: '52%', n: 3 }].map(({ cx, cy, n }) => (
        <div key={n} style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)', zIndex: 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '2.5px solid #1a7dff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#0055bb', fontFamily: DISPLAY, boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
          {n}
        </div>
      ))}
      <div style={{ position: 'absolute', left: '76%', top: '68%', transform: 'translate(-50%, -50%)', zIndex: 3, width: 24, height: 24, borderRadius: '50%', background: '#30d158', border: '2.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(48,209,88,0.75)', fontSize: 12 }}>
        ⚡
      </div>
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '14px 30px', display: 'flex', gap: 28, alignItems: 'center', zIndex: 4, whiteSpace: 'nowrap' }}>
        {[
          { value: '배송 가능',     label: '상태',    color: '#30d158' },
          { value: '충전 없이 완주', label: '충전 시점', color: '#fff' },
          { value: '85.5km',       label: '전체 거리', color: '#fff' },
          { value: '90점',         label: '건강 점수', color: '#4da8ff' },
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

// ── Section header (enlarged typography)
function SectionHead({ label, title, subtitle, dark = false }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 100 }}>
      {label && (
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: dark ? CLR.primaryOnDark : CLR.primary,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          marginBottom: 24, fontFamily: TEXT,
        }}>
          {label}
        </div>
      )}
      <h2 style={{
        fontSize: 'clamp(58px, 7vw, 96px)',
        fontWeight: 700,
        color: dark ? CLR.onDark : CLR.ink,
        fontFamily: DISPLAY, lineHeight: 1.04,
        letterSpacing: '-0.5px',
        marginBottom: subtitle ? 28 : 0,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          fontSize: 22, color: dark ? CLR.onDarkMuted : CLR.inkMuted48,
          fontFamily: TEXT, lineHeight: 1.5,
          letterSpacing: '-0.374px', maxWidth: 600, margin: '0 auto',
        }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── Redesigned access notice (dismissible, light-blue)
function AccessNotice() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div style={{
      background: 'rgba(0,102,204,0.05)',
      border: '1.5px solid rgba(0,102,204,0.18)',
      borderRadius: 22,
      padding: '36px 44px',
      position: 'relative',
    }}>
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: CLR.inkMuted48, fontSize: 24,
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, lineHeight: 1,
        }}
        aria-label="닫기"
      >
        ×
      </button>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'rgba(0,102,204,0.10)',
          border: '1px solid rgba(0,102,204,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          ℹ
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 20, fontWeight: 700, color: CLR.ink,
            fontFamily: DISPLAY, letterSpacing: '-0.3px', marginBottom: 10,
          }}>
            처음 접속하면 잠깐 기다려 주세요
          </div>
          <p style={{
            fontSize: 16, color: CLR.inkMuted80, fontFamily: TEXT,
            lineHeight: 1.75, margin: '0 0 16px',
          }}>
            실제 도로 경로 API와 공공 충전소 데이터를 사용하는 서비스예요.
            한동안 접속이 없으면 백엔드 서버가 잠시 절전 상태로 전환돼요.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(0,102,204,0.08)',
            border: '1px solid rgba(0,102,204,0.18)',
            borderRadius: 12, padding: '12px 20px', marginBottom: 14,
          }}>
            <span style={{ fontSize: 18 }}>⏱</span>
            <span style={{ fontFamily: TEXT }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: CLR.primary }}>첫 접속 시 약 30~60초 </span>
              <span style={{ fontSize: 15, color: CLR.inkMuted80 }}>소요될 수 있어요</span>
            </span>
          </div>
          <p style={{
            fontSize: 14, color: CLR.inkMuted48, fontFamily: TEXT,
            margin: 0, lineHeight: 1.6,
          }}>
            잠시 기다리거나 새로고침하면 바로 이용할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Static data (unchanged)
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

const DEV_MILESTONES = [
  { stage: 'MVP-0',   title: '지도 연동',              desc: 'Kakao Map API 기본 연동' },
  { stage: 'MVP-1~2', title: '대시보드 + 배송지 관리', desc: '차량 패널·배송지 추가/삭제' },
  { stage: 'MVP-3~4', title: 'SOC 계산 + 경로 거리',  desc: '전비 기반 배터리 계산·도로 거리' },
  { stage: 'MVP-5~6', title: '충전소 추천 + TSP',      desc: '충전소 추천·배송 순서 최적화' },
  { stage: 'MVP-7',   title: 'EV 경로 인텔리전스',    desc: '경로 건강 점수·7가지 상태 판정' },
  { stage: 'MVP-8',   title: '통합 드라이버 플로우',   desc: '5단계 마법사·공공 API·세션 복원' },
]

export default function IndexPage() {
  // Inject reveal CSS once on mount
  useEffect(() => {
    if (document.getElementById('idx-reveal-css')) return
    const el = document.createElement('style')
    el.id = 'idx-reveal-css'
    el.textContent = REVEAL_CSS
    document.head.appendChild(el)
    return () => document.getElementById('idx-reveal-css')?.remove()
  }, [])

  // Scroll anchors
  const howRef  = useRef(null)
  const techRef = useRef(null)
  const devRef  = useRef(null)

  // Reveal hooks (one per animated section)
  const [heroRevRef,     heroVis]     = useReveal(0.15)
  const [cockpitRevRef,  cockpitVis]  = useReveal(0.1)
  const [probRevRef,     probVis]     = useReveal(0.1)
  const [usersRevRef,    usersVis]    = useReveal(0.1)
  const [stepsRevRef,    stepsVis]    = useReveal(0.1)
  const [logicRevRef,    logicVis]    = useReveal(0.1)
  const [techRevRef,     techVis]     = useReveal(0.1)
  const [useRevRef,      useVis]      = useReveal(0.1)
  const [devRevRef,      devVis]      = useReveal(0.1)

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
      <section style={{
        background: 'linear-gradient(160deg, rgba(220,237,255,0.65) 0%, rgba(255,255,255,1) 62%)',
        padding: '168px 24px 168px',
      }}>
        <div
          ref={heroRevRef}
          className={`rv-up ${heroVis ? 'rv-in' : ''}`}
          style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}
        >
          <div style={{
            fontSize: 14, fontWeight: 700, color: CLR.primary,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            marginBottom: 32, fontFamily: TEXT,
          }}>
            EV 배송차량 충전 최적화 플랫폼
          </div>
          <h1 style={{
            fontSize: 'clamp(72px, 10vw, 128px)',
            fontWeight: 700, color: CLR.ink,
            fontFamily: DISPLAY, lineHeight: 1.02,
            letterSpacing: '-1px', marginBottom: 32,
          }}>
            배송 경로와 배터리를<br />함께 분석해요.
          </h1>
          <p style={{
            fontSize: 26, color: CLR.inkMuted80, fontFamily: TEXT,
            lineHeight: 1.45, letterSpacing: '-0.5px', marginBottom: 14,
          }}>
            충전 시점과 추천 충전소를 출발 전에 바로 확인해요.
          </p>
          <p style={{
            fontSize: 18, color: CLR.inkMuted48, fontFamily: TEXT,
            lineHeight: 1.6, letterSpacing: '-0.374px', marginBottom: 60,
          }}>
            실제 도로 경로와 공공 충전소 데이터로 운행 가능한 충전 계획을 추천해요.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <PillCta to="/mvp-8?start=1" size="lg">서비스 시작</PillCta>
            <PillCta to="/mvp-flow" outline size="lg">개발 과정 보기</PillCta>
          </div>
        </div>
      </section>

      {/* ── 스마트 모빌리티 코크핏 ──────────────────────── */}
      <section style={{ background: CLR.tileDark1, padding: '160px 24px 180px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div
            ref={cockpitRevRef}
            className={`rv-up ${cockpitVis ? 'rv-in' : ''}`}
            style={{ textAlign: 'center', marginBottom: 88 }}
          >
            <div style={{
              fontSize: 14, fontWeight: 700, color: CLR.primaryOnDark,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              marginBottom: 24, fontFamily: TEXT,
            }}>
              스마트 모빌리티 코크핏
            </div>
            <h2 style={{
              fontSize: 'clamp(52px, 6.5vw, 84px)',
              fontWeight: 700, color: CLR.onDark,
              fontFamily: DISPLAY, lineHeight: 1.04,
              letterSpacing: '-0.5px', marginBottom: 22,
            }}>
              배송 가능 여부, 충전 시점, 추천 충전소를<br />한 화면에서 확인해요.
            </h2>
            <p style={{
              fontSize: 22, color: CLR.onDarkMuted,
              fontFamily: TEXT, lineHeight: 1.5,
              letterSpacing: '-0.374px', maxWidth: 560, margin: '0 auto',
            }}>
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
            <div style={{ flex: '1 1 64%', minWidth: 0, height: 560, position: 'relative', background: '#131929', overflow: 'hidden' }}>
              <RouteMockup />
            </div>
            <div style={{ flex: '1 1 36%', minWidth: 300, background: CLR.tileDark2, padding: '36px 42px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.45)', fontFamily: TEXT, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                충전 판단 요약
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#30d158', fontFamily: DISPLAY, lineHeight: 1, marginBottom: 20 }}>
                배송 가능
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 18 }} />
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
              <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(0,102,204,0.14)', borderRadius: 13, border: '1px solid rgba(41,151,255,0.28)' }}>
                <div style={{ fontSize: 12, color: CLR.primaryOnDark, fontWeight: 600, marginBottom: 10, fontFamily: TEXT, letterSpacing: '0.10em', textTransform: 'uppercase' }}>경로 건강 점수</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 46, fontWeight: 700, color: CLR.onDark, fontFamily: DISPLAY, lineHeight: 1 }}>90</span>
                  <span style={{ fontSize: 18, color: CLR.onDarkMuted, fontFamily: TEXT }}>점</span>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '11px 14px', background: 'rgba(41,151,255,0.07)', borderRadius: 10, border: '1px solid rgba(41,151,255,0.18)' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(190,215,255,0.80)', fontFamily: TEXT, lineHeight: 1.6 }}>
                  서비스에서 경로 건강 점수와 충전 판단의 이유도 함께 확인할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 해결하는 문제 ──────────────────────────────── */}
      <section style={{ background: CLR.parchment, padding: '160px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={probRevRef} className={`rv-up ${probVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="해결하는 문제"
              title="전기 배송차량 운행의 불확실성을 줄여요."
              subtitle="배터리와 경로 데이터를 함께 분석해 운전자가 확신을 갖고 출발할 수 있도록 도와요."
            />
          </div>
          <div
            className={`rv-grid ${probVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}
          >
            {PROBLEMS.map(p => (
              <div key={p.title} className="rv-card" style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 36, minHeight: 210 }}>
                <div style={{ fontSize: 36, marginBottom: 18 }}>{p.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontSize: 18, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, letterSpacing: '-0.224px' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 대상 사용자 ────────────────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '160px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={usersRevRef} className={`rv-up ${usersVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="이런 분들을 위해 만들었어요"
              title="전기 배송 운영에 참여하는 모든 분께 유용해요."
            />
          </div>
          <div
            className={`rv-grid ${usersVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}
          >
            {USERS.map(u => (
              <div key={u.title} className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 36, minHeight: 210 }}>
                <div style={{ fontSize: 36, marginBottom: 18 }}>{u.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>{u.title}</div>
                <div style={{ fontSize: 18, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, letterSpacing: '-0.224px' }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 작동 방식 ──────────────────────────────────── */}
      <section ref={howRef} id="how-it-works" style={{ background: CLR.parchment, padding: '160px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div ref={stepsRevRef} className={`rv-up ${stepsVis ? 'rv-in' : ''}`}>
            <SectionHead label="작동 방식" title="5단계로 충전 계획을 세워요." />
          </div>
          <div
            className={`rv-grid ${stepsVis ? 'rv-in' : ''}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {HOW_STEPS.map((s, i) => (
              <div key={i} className="rv-card" style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: '28px 34px', display: 'flex', alignItems: 'center', gap: 28, minHeight: 96 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, background: CLR.primary, color: '#fff', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY }}>
                  {s.num}
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 18, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 핵심 판단 로직 ─────────────────────────────── */}
      <section ref={techRef} id="technology" style={{ background: CLR.tileDark2, padding: '160px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={logicRevRef} className={`rv-up ${logicVis ? 'rv-in' : ''}`}>
            <SectionHead
              dark
              label="핵심 판단 로직"
              title="6단계 로직으로 최적 충전 계획을 만들어요."
              subtitle="배터리 상태와 경로 데이터를 단계별로 분석해 정확한 충전 판단을 내려요."
            />
          </div>
          <div
            className={`rv-grid ${logicVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}
          >
            {LOGIC_CARDS.map((c, i) => (
              <div key={i} className="rv-card" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 22, padding: 36 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: CLR.primaryOnDark, fontFamily: TEXT, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{c.num}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: CLR.onDark, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12 }}>{c.title}</div>
                <div style={{ fontSize: 18, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 핵심 기술 구성 ─────────────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '160px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* 섹션 헤더 */}
          <div ref={techRevRef} className={`rv-up ${techVis ? 'rv-in' : ''}`} style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 24, fontFamily: TEXT }}>
              핵심 기술 구성 · Core Technology
            </div>
            <h2 style={{ fontSize: 'clamp(52px, 6.5vw, 84px)', fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, lineHeight: 1.04, letterSpacing: '-0.5px', marginBottom: 22 }}>
              실제 API와 EV-TSP 알고리즘으로<br />배송·충전 경로를 최적화해요.
            </h2>
            <p style={{ fontSize: 20, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.65, letterSpacing: '-0.374px', maxWidth: 640, margin: '0 auto 36px' }}>
              이 서비스는 데모가 아니에요. 실제 도로 경로 API, 공공 충전소 데이터, 배터리 상태, 안전 하한 SOC를 결합해 실제로 운행 가능한 배송·충전 계획을 추천해요.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {['실제 API 연동', 'EV-TSP 기반', '실도로 경로 계산', '안전 하한 SOC 반영'].map(b => (
                <span key={b} style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 18px', background: 'rgba(0,102,204,0.07)', border: '1px solid rgba(0,102,204,0.22)', borderRadius: 9999, fontSize: 14, fontWeight: 600, color: CLR.primary, fontFamily: TEXT, letterSpacing: '-0.2px' }}>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* 상단 3카드 */}
          <div
            className={`rv-grid ${techVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 18 }}
          >
            <div className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: '32px 36px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14, fontFamily: TEXT }}>Frontend</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>사용자 인터페이스</div>
              <div style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, marginBottom: 18 }}>
                React + Vite 기반 SPA로 차량 인포테인먼트(IVI) 스타일의 코크핏 UI를 구현했어요. Kakao Map SDK로 실시간 경로 폴리라인과 충전소 마커를 지도 위에 표시해요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['React + Vite', 'Kakao Map SDK', 'IVI 코크핏 UI'].map(t => (
                  <span key={t} style={{ fontSize: 12, color: CLR.inkMuted80, background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 6, padding: '4px 10px', fontFamily: TEXT }}>{t}</span>
                ))}
              </div>
            </div>

            <div className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: '32px 36px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14, fontFamily: TEXT }}>외부 API</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>실제 도로 · 공공 충전소 데이터</div>
              <div style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, marginBottom: 18 }}>
                Kakao Directions API로 실제 도로 거리를 계산하고, SafeMap과 한국환경공단(KE) 공공 API로 전국 충전소 현황을 실시간으로 조회해요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['Kakao Directions', 'Kakao Places', 'SafeMap API', 'KE 공공충전소 API'].map(t => (
                  <span key={t} style={{ fontSize: 12, color: CLR.inkMuted80, background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 6, padding: '4px 10px', fontFamily: TEXT }}>{t}</span>
                ))}
              </div>
            </div>

            <div className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: '32px 36px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14, fontFamily: TEXT }}>Backend</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 12, lineHeight: 1.3 }}>API 프록시 서버</div>
              <div style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, marginBottom: 18 }}>
                FastAPI(Python)로 구현한 REST API 프록시 서버가 공공 충전소 API 키를 안전하게 관리하고 CORS를 처리해요. Render.com에 배포되어 운영 중이에요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['FastAPI (Python)', 'Render 배포', 'REST API'].map(t => (
                  <span key={t} style={{ fontSize: 12, color: CLR.inkMuted80, background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 6, padding: '4px 10px', fontFamily: TEXT }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 하단 2카드 */}
          <div
            className={`rv-grid ${techVis ? 'rv-in' : ''}`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}
          >
            {/* EV-TSP 강조 카드 */}
            <div className="rv-card" style={{ flex: '2 1 360px', background: 'linear-gradient(145deg, rgba(0,100,210,0.06) 0%, rgba(0,100,210,0.11) 100%)', border: '2px solid rgba(0,102,204,0.30)', borderRadius: 22, padding: '36px 40px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(0,102,204,0.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -60, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(0,102,204,0.04)', pointerEvents: 'none' }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: CLR.primary, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 9999, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 20, fontFamily: TEXT }}>
                ⚡ 핵심 알고리즘
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, letterSpacing: '-0.4px', marginBottom: 20, lineHeight: 1.2 }}>
                EV-TSP 기반 경로·충전 최적화
              </div>
              <div style={{ fontSize: 16, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, marginBottom: 14 }}>
                <strong style={{ color: CLR.ink }}>TSP(Traveling Salesman Problem)</strong>는 여러 목적지를 가장 효율적인 순서로 방문하는 경로를 찾는 대표적인 조합 최적화 문제예요.
              </div>
              <div style={{ fontSize: 16, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, marginBottom: 14 }}>
                <strong style={{ color: CLR.ink }}>EV-TSP</strong>는 TSP에 전기차 특유의 제약 조건 — 배터리 잔량, 충전 시점 결정, 안전 하한 SOC, 충전소 후보 선택 — 을 추가한 확장 알고리즘이에요.
              </div>
              <div style={{ fontSize: 16, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, marginBottom: 26 }}>
                이 서비스는 단순히 최단 경로를 찾는 게 아니에요. <strong style={{ color: CLR.ink }}>배송 완주 가능성, 배터리 여유, 충전 위치, 우회 거리, 운행 안전성</strong>을 함께 고려한 실용적인 계획을 제안해요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['배송 순서 최적화', 'SOC 시뮬레이션', '충전 전략 추천', '공공 충전소 후보 평가'].map(f => (
                  <span key={f} style={{ fontSize: 13, fontWeight: 600, color: CLR.primary, background: 'rgba(0,102,204,0.10)', border: '1px solid rgba(0,102,204,0.22)', borderRadius: 8, padding: '5px 12px', fontFamily: TEXT }}>{f}</span>
                ))}
              </div>
            </div>

            {/* 판단 로직 흐름 카드 */}
            <div className="rv-card" style={{ flex: '1 1 260px', background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: '36px 36px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14, fontFamily: TEXT }}>작동 흐름</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 24, lineHeight: 1.3 }}>배송·충전 계획 결정 흐름</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  '출발지·배송지 입력',
                  'TSP로 배송 순서 최적화',
                  'EV 배터리 / SOC 시뮬레이션',
                  '충전 필요 구간 탐지',
                  '충전소 후보 비교·평가',
                  '최적 배송·충전 계획 추천',
                ].map((text, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: i === arr.length - 1 ? CLR.primary : 'rgba(0,102,204,0.12)',
                        border: i === arr.length - 1 ? 'none' : '1.5px solid rgba(0,102,204,0.30)',
                        color: i === arr.length - 1 ? '#fff' : CLR.primary,
                        fontSize: 13, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: TEXT,
                      }}>
                        {i + 1}
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ width: 2, height: 20, background: 'rgba(0,102,204,0.18)', margin: '4px 0' }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 15,
                      color: i === arr.length - 1 ? CLR.ink : CLR.inkMuted80,
                      fontWeight: i === arr.length - 1 ? 600 : 400,
                      fontFamily: TEXT, lineHeight: 1.5, paddingTop: 6,
                    }}>
                      {text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 사용 방법 ──────────────────────────────────── */}
      <section style={{ background: CLR.parchment, padding: '160px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div ref={useRevRef} className={`rv-up ${useVis ? 'rv-in' : ''}`}>
            <SectionHead label="사용 방법" title="지금 바로 충전 계획을 확인해요." />
          </div>
          <div style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 22, padding: 44 }}>
            <div
              className={`rv-grid ${useVis ? 'rv-in' : ''}`}
            >
              {[
                '서비스 시작 버튼을 눌러요.',
                '차량 종류를 선택하고 현재 배터리 잔량을 입력해요.',
                '출발지와 배송지를 추가해요.',
                '배송 순서를 확인하고 코크핏으로 이동해요.',
                '배송 가능 여부와 충전 계획을 확인해요.',
              ].map((text, i, arr) => (
                <div key={i} className="rv-card" style={{
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
            </div>
            <div style={{ marginTop: 44, textAlign: 'center' }}>
              <PillCta to="/mvp-8?start=1" size="lg">서비스 시작</PillCta>
            </div>
          </div>
        </div>
      </section>

      {/* ── 접속 안내 (redesigned) ────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '72px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <AccessNotice />
        </div>
      </section>

      {/* ── 개발 과정 ──────────────────────────────────── */}
      <section ref={devRef} id="development-process" style={{ background: CLR.tileDark1, padding: '160px 24px 180px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={devRevRef} className={`rv-up ${devVis ? 'rv-in' : ''}`} style={{ textAlign: 'center', marginBottom: 88 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: CLR.primaryOnDark, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 24, fontFamily: TEXT }}>
              개발 과정
            </div>
            <h2 style={{ fontSize: 'clamp(52px, 7vw, 96px)', fontWeight: 700, color: CLR.onDark, fontFamily: DISPLAY, lineHeight: 1.04, letterSpacing: '-0.5px', marginBottom: 22 }}>
              MVP-0부터 MVP-8까지의<br />개발 여정을 확인해요.
            </h2>
            <p style={{ fontSize: 22, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.5, letterSpacing: '-0.374px', maxWidth: 560, margin: '0 auto 52px' }}>
              카카오 지도 연동부터 실시간 충전소 API, 경로 최적화까지 단계별로 쌓아 올린 과정을 볼 수 있어요.
            </p>
            <PillCta to="/mvp-flow" outline onDark size="lg">개발 과정 보기</PillCta>
          </div>

          <div
            className={`rv-grid ${devVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}
          >
            {DEV_MILESTONES.map((m, i) => (
              <div key={i} className="rv-card" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 18, padding: '26px 28px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: CLR.primaryOnDark, fontFamily: TEXT, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{m.stage}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: CLR.onDark, fontFamily: TEXT, marginBottom: 6 }}>{m.title}</div>
                <div style={{ fontSize: 15, color: CLR.onDarkMuted, fontFamily: TEXT, lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer style={{ background: CLR.parchment, padding: '56px 32px', borderTop: `1px solid ${CLR.hairline}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ fontSize: 15, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.8 }}>
            EV 배송차량 충전 최적화 플랫폼<br />
            <span style={{ fontSize: 14, color: CLR.inkMuted48, fontStyle: 'italic', letterSpacing: '0.01em' }}>made by Hoyeon</span>
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
