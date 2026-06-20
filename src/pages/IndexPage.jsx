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

// ── Scroll-reveal CSS (injected once, scoped to .landing-page, respects prefers-reduced-motion)
const REVEAL_CSS = `
  @media (prefers-reduced-motion: no-preference) {
    .landing-page .rv-up {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1);
    }
    .landing-page .rv-up.rv-in {
      opacity: 1;
      transform: translateY(0);
    }
    .landing-page .rv-up-fast {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.55s cubic-bezier(.16,1,.3,1), transform 0.55s cubic-bezier(.16,1,.3,1);
    }
    .landing-page .rv-up-fast.rv-in {
      opacity: 1;
      transform: translateY(0);
    }
    .landing-page .rv-card {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.65s cubic-bezier(.16,1,.3,1), transform 0.65s cubic-bezier(.16,1,.3,1);
    }
    .landing-page .rv-grid.rv-in > .rv-card {
      opacity: 1;
      transform: translateY(0);
    }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(1) { transition-delay: 0ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(2) { transition-delay: 80ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(3) { transition-delay: 160ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(4) { transition-delay: 240ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(5) { transition-delay: 320ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(6) { transition-delay: 400ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(7) { transition-delay: 480ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(8) { transition-delay: 560ms; }
    .landing-page .rv-grid.rv-in > .rv-card:nth-child(9) { transition-delay: 640ms; }
    @keyframes bounce-down {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(9px); }
    }
    .landing-page .rv-bounce { animation: bounce-down 2.2s ease-in-out infinite; }
    .landing-page .logic-card {
      transition: transform 0.25s cubic-bezier(.16,1,.3,1), box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease;
    }
    .landing-page .logic-card:hover { transform: translateY(-3px); }
    .landing-page .rv-hero-preview {
      opacity: 0;
      transform: translateY(48px) scale(0.97);
      transition: opacity 1.1s 0.25s cubic-bezier(.16,1,.3,1), transform 1.1s 0.25s cubic-bezier(.16,1,.3,1);
    }
    .landing-page .rv-hero-preview.rv-in {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .landing-page .hover-card {
      transition: transform 0.28s cubic-bezier(.16,1,.3,1), box-shadow 0.28s ease, border-color 0.28s ease;
    }
    .landing-page .hover-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 16px 48px rgba(0,0,0,0.11), 0 4px 12px rgba(0,0,0,0.07);
    }
    .landing-page .step-tab {
      transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease !important;
    }
    .landing-page .step-tab:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.09);
    }
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
    transition: 'transform 0.2s cubic-bezier(.16,1,.3,1), box-shadow 0.2s ease, background 0.2s ease',
  }
  const filled = { ...base, background: CLR.primary, color: '#fff', border: 'none',
    boxShadow: '0 4px 28px rgba(0,102,204,0.30)' }
  const ghost  = { ...base, background: 'transparent',
    border: `1.5px solid ${onDark ? CLR.primaryOnDark : CLR.primary}`,
    color: onDark ? CLR.primaryOnDark : CLR.primary }
  const handleEnter = (e) => {
    if (outline) {
      e.currentTarget.style.background = onDark ? 'rgba(41,151,255,0.12)' : 'rgba(0,102,204,0.08)'
      e.currentTarget.style.transform = 'translateY(-2px)'
    } else {
      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
      e.currentTarget.style.boxShadow = '0 14px 52px rgba(0,102,204,0.48)'
    }
  }
  const handleLeave = (e) => {
    e.currentTarget.style.transform = ''
    if (outline) {
      e.currentTarget.style.background = 'transparent'
    } else {
      e.currentTarget.style.boxShadow = '0 4px 28px rgba(0,102,204,0.30)'
    }
  }
  return (
    <Link to={to} style={outline ? ghost : filled} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
    </Link>
  )
}

// ── Route map mockup (hero preview + cockpit section)
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
          { value: '90점',         label: '운행 안정도', color: '#4da8ff' },
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

// ── Light-mode mini stepper (shown at top of each showcase mockup)
function MiniStepper({ active }) {
  const ac = '#3E6AE1'
  const bd = '#E5E5E5'
  const tx = '#5C5E62'
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
      {[1,2,3,4,5].map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 'none' }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
            background: n === active ? ac : n < active ? ac + 'cc' : '#fff',
            border: `1.5px solid ${n <= active ? ac : bd}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
            color: n <= active ? '#fff' : tx,
          }}>{n}</div>
          {i < 4 && <div style={{ flex: 1, height: 1.5, background: n < active ? ac : bd, minWidth: 6 }} />}
        </div>
      ))}
    </div>
  )
}

// ── Showcase step mockups — light mode, matches actual MVP-8 UI
function ShowcaseMockup({ step }) {
  const [mapErr, setMapErr] = useState(false)
  const bg  = '#FFFFFF'
  const sf  = '#F8F8F8'
  const sf2 = '#F2F2F2'
  const tx  = '#171A20'
  const mu  = '#5C5E62'
  const bd  = '#E5E5E5'
  const ac  = '#3E6AE1'
  const ok  = '#22C55E'
  const fnt = TEXT

  // shared nav row
  function NavRow({ prev = true, next = true }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {prev
          ? <div style={{ padding: '7px 14px', border: `1px solid ${bd}`, borderRadius: 8, fontSize: 12, color: mu, fontFamily: fnt, background: bg }}>← 이전</div>
          : <div />}
        {next && <div style={{ padding: '7px 14px', background: ac, borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: fnt }}>다음 →</div>}
      </div>
    )
  }

  if (step === 0) return (
    <div style={{ padding: '11px 14px 10px', height: '100%', background: sf, overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <MiniStepper active={1} />
      {/* SetupCard */}
      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${bd}`, fontSize: 14, fontWeight: 700, color: tx, fontFamily: fnt }}>차량 선택</div>
        <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
          {/* Brand grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { logo: 'H',     label: '현대', active: true  },
              { logo: 'KIA',   label: '기아', active: false },
              { logo: 'BYD',   label: 'BYD',  active: false },
              { logo: 'VOLVO', label: '볼보', active: false },
            ].map(b => (
              <div key={b.label} style={{ borderRadius: 9, padding: '12px 4px', textAlign: 'center', border: `1px solid ${b.active ? ac : bd}`, background: b.active ? ac + '0e' : sf2 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: b.active ? ac + '18' : sf, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: b.logo.length > 3 ? 7 : b.logo.length > 1 ? 9 : 12, fontWeight: 700, color: b.active ? ac : mu, fontFamily: fnt, letterSpacing: b.logo.length > 3 ? '-0.5px' : 0 }}>{b.logo}</div>
                <div style={{ fontSize: 11, color: b.active ? ac : mu, fontWeight: b.active ? 600 : 400, fontFamily: fnt }}>{b.label}</div>
              </div>
            ))}
          </div>
          {/* Vehicle cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
            {[{ name: 'ST1 (61 kWh)', active: true }, { name: '포터 II 일렉트릭', active: false }, { name: 'PV5 롱레인지', active: false }, { name: 'BYD T4K', active: false }].map(v => (
              <div key={v.name} style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${v.active ? ac : bd}`, background: v.active ? ac + '0c' : sf2 }}>
                <div style={{ fontSize: 12, fontWeight: v.active ? 600 : 400, color: v.active ? ac : tx, fontFamily: fnt }}>{v.name}</div>
              </div>
            ))}
          </div>
          {/* Selected card */}
          <div style={{ padding: '11px 14px', background: ac + '0c', border: `1px solid ${ac}40`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ac, marginBottom: 3, fontFamily: fnt }}>✓ 선택됨</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: tx, marginBottom: 2, fontFamily: fnt }}>현대 ST1</div>
              <div style={{ fontSize: 11, color: mu, fontFamily: fnt }}>61 kWh · 5.0 km/kWh · 최대 305 km</div>
            </div>
          </div>
        </div>
      </div>
      <NavRow prev={false} next={true} />
    </div>
  )

  if (step === 1) return (
    <div style={{ padding: '11px 14px 10px', height: '100%', background: sf, overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <MiniStepper active={2} />
      {/* SOC card */}
      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${bd}`, fontSize: 14, fontWeight: 700, color: tx, fontFamily: fnt }}>현재 배터리 (SOC)</div>
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.04em', color: ok, fontFamily: DISPLAY }}>78</span>
            <span style={{ fontSize: 17, color: mu, marginBottom: 6, fontFamily: fnt }}>%</span>
          </div>
          <div style={{ height: 5, background: sf2, borderRadius: 3, marginBottom: 5, overflow: 'hidden' }}>
            <div style={{ width: '78%', height: '100%', background: ok, borderRadius: 3 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 10, color: mu, fontFamily: fnt }}>0%</span>
            <span style={{ fontSize: 10, color: mu, fontFamily: fnt }}>100%</span>
          </div>
          <div style={{ padding: '8px 12px', background: sf2, borderRadius: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: mu, fontFamily: fnt }}>예상 주행 가능 거리</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: ok, fontFamily: fnt }}>238 km</span>
          </div>
        </div>
      </div>
      {/* Reserve SOC card */}
      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, overflow: 'hidden', flex: 1 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${bd}`, fontSize: 14, fontWeight: 700, color: tx, fontFamily: fnt }}>안전 하한 SOC</div>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[5,10,15,20,25,30].map(v => (
              <div key={v} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: `1px solid ${v === 20 ? ac : bd}`, background: v === 20 ? ac + '14' : sf2, textAlign: 'center', fontSize: 12, color: v === 20 ? ac : mu, fontWeight: v === 20 ? 700 : 400, fontFamily: fnt }}>{v}%</div>
            ))}
          </div>
        </div>
      </div>
      <NavRow prev={true} next={true} />
    </div>
  )

  if (step === 2) return (
    <div style={{ padding: '11px 14px 10px', height: '100%', background: sf, overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <MiniStepper active={3} />
      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, overflow: 'hidden', flex: 1 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${bd}`, fontSize: 14, fontWeight: 700, color: tx, fontFamily: fnt }}>출발지</div>
        <div style={{ padding: '14px 16px' }}>
          {/* Location row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: sf2, border: `1px solid ${bd}`, borderRadius: 11, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: tx, marginBottom: 4, fontFamily: fnt }}>서울 성동구 물류센터</div>
              <div style={{ fontSize: 11, color: mu, marginBottom: 2, fontFamily: fnt }}>서울특별시 성동구 성수일로 89</div>
              <div style={{ fontSize: 10, color: mu, opacity: 0.7, fontFamily: fnt }}>37.5465, 127.0486</div>
            </div>
            <div style={{ padding: '10px 16px', border: `1px solid ${ac}50`, borderRadius: 8, background: ac + '10', fontSize: 13, fontWeight: 600, color: ac, cursor: 'pointer', fontFamily: fnt, flexShrink: 0, marginLeft: 12 }}>변경</div>
          </div>
          <div style={{ fontSize: 12, color: mu, lineHeight: 1.7, fontFamily: fnt }}>주소나 장소명을 입력하면 출발 좌표를 자동으로 찾아 실제 도로 경로 계산에 사용해요.</div>
        </div>
      </div>
      <NavRow prev={true} next={true} />
    </div>
  )

  if (step === 3) return (
    <div style={{ padding: '11px 14px 10px', height: '100%', background: sf, overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <MiniStepper active={4} />
      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, overflow: 'hidden', flex: 1 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${bd}`, fontSize: 14, fontWeight: 700, color: tx, fontFamily: fnt }}>배송지 (3개)</div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { n: 1, name: '홍대입구역 편의점', addr: '서울 마포구 양화로 188' },
            { n: 2, name: '합정 카페거리 매장', addr: '서울 마포구 합정동 395' },
            { n: 3, name: '망원동 물류창고',   addr: '서울 마포구 망원동 414' },
          ].map(d => (
            <div key={d.n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: sf2, border: `1px solid ${bd}`, borderRadius: 10, marginBottom: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: ac, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{d.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: tx, fontFamily: fnt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                <div style={{ fontSize: 10, color: mu, marginTop: 2, fontFamily: fnt }}>{d.addr}</div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <div style={{ padding: '5px 10px', border: `1px solid ${bd}`, borderRadius: 6, fontSize: 10, color: mu, background: bg }}>편집</div>
                <div style={{ padding: '5px 10px', border: `1px solid #EF444440`, borderRadius: 6, fontSize: 10, color: '#EF4444', background: bg }}>삭제</div>
              </div>
            </div>
          ))}
          <div style={{ width: '100%', padding: '8px 0', border: `1px dashed ${ac}60`, borderRadius: 10, background: ac + '08', textAlign: 'center', fontSize: 12, fontWeight: 600, color: ac, fontFamily: fnt, marginTop: 2 }}>+ 배송지 추가</div>
        </div>
      </div>
      <NavRow prev={true} next={true} />
    </div>
  )

  // step 4 — driving plan confirmation screen (pre-cockpit)
  return (
    <div style={{ padding: '11px 14px 10px', height: '100%', background: sf, overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <MiniStepper active={5} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: tx, fontFamily: fnt }}>운행 계획 확인</div>
        {/* Vehicle summary */}
        <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🚐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: tx, fontFamily: fnt }}>현대 ST1 (61 kWh)</div>
            <div style={{ fontSize: 10, color: mu, fontFamily: fnt }}>전비 5.0 km/kWh · 최대 305 km</div>
          </div>
          <div style={{ marginLeft: 'auto', padding: '4px 9px', background: ok + '18', border: `1px solid ${ok}40`, borderRadius: 7, fontSize: 10, fontWeight: 700, color: ok, fontFamily: fnt }}>선택됨</div>
        </div>
        {/* Battery / range / SOC row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, flexShrink: 0 }}>
          {[
            { label: '현재 배터리', value: '78%', color: ok },
            { label: '예상 주행', value: '238 km', color: tx },
            { label: '안전 하한 SOC', value: '20%', color: '#EF4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 9, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: mu, fontFamily: fnt, marginBottom: 3, lineHeight: 1.3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: fnt }}>{value}</div>
            </div>
          ))}
        </div>
        {/* Origin */}
        <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: '8px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: mu, fontFamily: fnt, marginBottom: 2 }}>출발지</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tx, fontFamily: fnt }}>서울 성동구 물류센터</div>
          <div style={{ fontSize: 9, color: mu, fontFamily: fnt }}>서울특별시 성동구 성수일로 89</div>
        </div>
        {/* Delivery route summary */}
        <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: '8px 12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 9, color: mu, fontFamily: fnt, marginBottom: 7 }}>배송 경로 · 3개 목적지 · 총 85.5 km</div>
          {[
            { n: 1, name: '홍대입구역 편의점', addr: '서울 마포구', dist: '28.3 km' },
            { n: 2, name: '합정 카페거리 매장', addr: '서울 마포구', dist: '34.1 km' },
            { n: 3, name: '망원동 물류창고', addr: '서울 마포구', dist: '43.2 km' },
          ].map(d => (
            <div key={d.n} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <div style={{ width: 19, height: 19, borderRadius: '50%', background: ac, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{d.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: tx, fontFamily: fnt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                <div style={{ fontSize: 9, color: mu, fontFamily: fnt }}>{d.addr}</div>
              </div>
              <div style={{ fontSize: 10, color: mu, fontFamily: fnt, flexShrink: 0 }}>{d.dist}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 7, marginTop: 6, flexShrink: 0 }}>
        <div style={{ padding: '7px 12px', border: `1px solid ${bd}`, borderRadius: 8, fontSize: 12, color: mu, fontFamily: fnt, background: bg, flexShrink: 0 }}>← 이전</div>
        <div style={{ flex: 1, padding: '7px 0', background: ac, borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: fnt, textAlign: 'center' }}>운전 화면 시작 →</div>
      </div>
    </div>
  )
}

// ── Annotated cockpit diagram — light-mode, click-highlighted, larger
function CockpitAnnotated({ activeArea = 'left' }) {
  const [mapErr, setMapErr] = useState(false)
  const bg = '#FFFFFF', sf = '#F8F8F8', sf2 = '#F2F2F2'
  const tx = '#171A20', mu = '#5C5E62', bd = '#E5E5E5'
  const ac = '#3E6AE1', ok = '#22C55E'

  const areaColors = { left: '#3E6AE1', center: '#0A6AFF', right: '#7C55E8', bottom: '#22C55E' }
  const hl = areaColors[activeArea] || '#3E6AE1'

  const leftActive   = activeArea === 'left'
  const centerActive = activeArea === 'center'
  const rightActive  = activeArea === 'right'
  const bottomActive = activeArea === 'bottom'

  return (
    <div style={{ borderRadius: 16, overflow: 'visible', boxShadow: '0 32px 96px rgba(0,0,0,0.16)', position: 'relative' }}>
      {/* Browser chrome */}
      <div style={{
        background: '#F0F0F0', borderRadius: '16px 16px 0 0',
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6,
        border: '1px solid #E0E0E0', borderBottom: 'none',
      }}>
        {['#ff5f57','#febc2e','#28c840'].map((c, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
        ))}
        <div style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#888', fontFamily: TEXT, letterSpacing: '-0.1px' }}>
          EV 배송 충전 최적화 · 운행 화면
        </div>
      </div>

      <div style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden', border: '1px solid #E0E0E0', borderTop: 'none' }}>
        {/* 3-panel row */}
        <div style={{ display: 'flex', height: 364 }}>

          {/* Left panel */}
          <div style={{
            width: 169, background: leftActive ? `rgba(62,106,225,0.06)` : sf,
            borderRight: leftActive ? `3px solid ${hl}` : `1px solid ${bd}`,
            padding: '12px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6,
            transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
            boxShadow: leftActive ? `4px 0 24px rgba(62,106,225,0.12)` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: bg, borderRadius: 7, border: `1px solid ${bd}` }}>
              <span style={{ fontSize: 14 }}>🚐</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: tx, fontFamily: TEXT }}>현대 ST1</div>
                <div style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>61 kWh · 305 km</div>
              </div>
            </div>
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>배터리 · SOC</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: ok, lineHeight: 1, fontFamily: DISPLAY }}>78</span>
              <span style={{ fontSize: 12, color: mu, fontFamily: TEXT, marginBottom: 4 }}>%</span>
            </div>
            <div style={{ height: 5, background: sf2, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: '78%', height: '100%', background: ok, borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>예상 주행</span>
              <span style={{ fontSize: 8, fontWeight: 600, color: ok, fontFamily: TEXT }}>238 km</span>
            </div>
            <div style={{ height: 1, background: bd }} />
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>운행 안정도</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 27, fontWeight: 700, color: tx, lineHeight: 1, fontFamily: DISPLAY }}>90</span>
              <span style={{ fontSize: 10, color: mu, fontFamily: TEXT }}>점</span>
            </div>
            <div style={{ height: 1, background: bd }} />
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>배송 경로 요약</div>
            <div style={{ fontSize: 9, color: tx, fontFamily: TEXT }}>3개 목적지 · 85.5 km</div>
            <div style={{ fontSize: 9, color: ok, fontWeight: 600, fontFamily: TEXT }}>충전 없이 완주 가능</div>
          </div>

          {/* Center map */}
          <div style={{
            flex: 1, position: 'relative', overflow: 'hidden', background: '#E8ECE8',
            transition: 'box-shadow 0.35s ease',
            boxShadow: centerActive ? `inset 0 0 0 3px ${areaColors.center}88` : 'none',
          }}>
            {!mapErr ? (
              <img
                src="/images/landing-map-preview.png"
                alt="배송 경로 지도"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setMapErr(true)}
              />
            ) : (
              <RouteMockup />
            )}
            {centerActive && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
                border: `3px solid ${areaColors.center}88`,
                boxShadow: `inset 0 0 48px rgba(10,106,255,0.14)`,
                transition: 'opacity 0.35s ease',
              }} />
            )}
            {[{ left: '28%', top: '50%', n: 1 }, { left: '54%', top: '33%', n: 2 }, { left: '80%', top: '60%', n: 3 }].map(({ left, top, n }) => (
              <div key={n} style={{
                position: 'absolute', left, top, transform: 'translate(-50%,-50%)', zIndex: 3,
                width: 36, height: 36, borderRadius: '50%', background: '#fff',
                border: `3px solid ${ac}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16, fontWeight: 800, color: ac,
                boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
              }}>{n}</div>
            ))}
            <div style={{
              position: 'absolute', left: '66%', top: '74%', transform: 'translate(-50%,-50%)', zIndex: 3,
              width: 32, height: 32, borderRadius: '50%', background: ok, border: '3px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(34,197,94,0.6)', fontSize: 15,
            }}>⚡</div>
          </div>

          {/* Right panel */}
          <div style={{
            width: 161, background: rightActive ? 'rgba(124,85,232,0.06)' : sf,
            borderLeft: rightActive ? `3px solid ${areaColors.right}` : `1px solid ${bd}`,
            padding: '12px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5,
            transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
            boxShadow: rightActive ? `-4px 0 24px rgba(124,85,232,0.12)` : 'none',
          }}>
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>충전 판단</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: ok, fontFamily: TEXT }}>배송 가능</div>
            <div style={{ height: 1, background: bd }} />
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT }}>판단 근거</div>
            <div style={{ fontSize: 8, color: tx, lineHeight: 1.55, fontFamily: TEXT }}>현재 배터리로 전체 배송 경로를 완주할 수 있습니다.</div>
            <div style={{ height: 1, background: bd }} />
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT }}>충전소 후보</div>
            {[{ name: '서울양원리 공영', dist: '0.3 km', score: 92 }, { name: '성수 충전소', dist: '1.2 km', score: 78 }].map(c => (
              <div key={c.name} style={{ padding: '6px 7px', background: bg, borderRadius: 6, border: `1px solid ${bd}` }}>
                <div style={{ fontSize: 8, color: tx, fontFamily: TEXT, marginBottom: 3 }}>{c.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>{c.dist}</span>
                  <span style={{ fontSize: 8, color: ok, fontWeight: 600, fontFamily: TEXT }}>{c.score}점</span>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: bd }} />
            <div style={{ fontSize: 7, color: mu, fontFamily: TEXT }}>세부 안정도</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ label: '배송', val: 95 }, { label: '배터리', val: 88 }, { label: '충전', val: 82 }].map(s => (
                <div key={s.label} style={{ flex: 1, background: sf2, borderRadius: 6, padding: '6px 2px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ac, fontFamily: TEXT }}>{s.val}</div>
                  <div style={{ fontSize: 7, color: mu, fontFamily: TEXT }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom summary bar */}
        <div style={{
          background: bottomActive ? 'rgba(34,197,94,0.07)' : sf2,
          borderTop: bottomActive ? `3px solid ${areaColors.bottom}` : `1px solid ${bd}`,
          padding: '9px 17px', display: 'flex', alignItems: 'center',
          transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
          boxShadow: bottomActive ? `inset 0 3px 24px rgba(34,197,94,0.10)` : 'none',
        }}>
          {[
            { label: '전체 거리', value: '85.5 km' },
            { label: '배송지 수', value: '3개' },
            { label: '주행 가능 거리', value: '238 km' },
            { label: '운행 안정도', value: '90점' },
            { label: '최종 상태', value: '배송 가능', color: ok },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: mu, marginBottom: 3, fontFamily: TEXT }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: color ?? tx, fontFamily: TEXT }}>{value}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 22, background: bd }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Section header
function SectionHead({ label, title, subtitle, dark = false }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 64 }}>
      {label && (
        <div style={{
          fontSize: 22, fontWeight: 700,
          color: dark ? CLR.primaryOnDark : CLR.primary,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 22, fontFamily: TEXT,
        }}>
          {label}
        </div>
      )}
      <h2 style={{
        fontSize: 'clamp(33px, 4.3vw, 62px)',
        fontWeight: 700,
        color: dark ? CLR.onDark : CLR.ink,
        fontFamily: DISPLAY, lineHeight: 1.10,
        letterSpacing: '-0.4px',
        marginBottom: subtitle ? 20 : 0,
        wordBreak: 'keep-all',
        overflowWrap: 'break-word',
        maxWidth: 900, margin: subtitle ? '0 auto 20px' : '0 auto',
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          fontSize: 18, color: dark ? CLR.onDarkMuted : CLR.inkMuted48,
          fontFamily: TEXT, lineHeight: 1.6,
          letterSpacing: '-0.374px', maxWidth: 680, margin: '0 auto',
        }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── Nav brand logo with graceful image fallback
function BrandLogo() {
  const [iconFailed,     setIconFailed]     = useState(false)
  const [wordmarkFailed, setWordmarkFailed] = useState(false)
  return (
    <Link
      to="/"
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 14,
        textDecoration: 'none', transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.72' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {!iconFailed && (
        <img
          src="/images/roviq-logo-icon.png"
          alt=""
          style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 13, flexShrink: 0 }}
          onError={() => setIconFailed(true)}
        />
      )}
      {!wordmarkFailed ? (
        <img
          src="/images/roviq-logo-wordmark.png"
          alt="EV 배송차량 충전 최적화"
          style={{ height: 44, objectFit: 'contain', flexShrink: 0 }}
          onError={() => setWordmarkFailed(true)}
        />
      ) : (
        <span style={{ fontSize: 22, fontWeight: 600, color: CLR.inkMuted80, fontFamily: TEXT, letterSpacing: '-0.2px' }}>
          EV 배송차량 충전 최적화
        </span>
      )}
    </Link>
  )
}

// ── Static data
const PROBLEMS = [
  { icon: '🔋', title: '배송 중 배터리 부족',  desc: '남은 배터리만 보고 출발하면 배송 도중 멈춰야 할 수 있어요.' },
  { icon: '⏱', title: '충전 시점 판단',         desc: '지금 충전해야 하는지, 몇 번째 배송 후 충전해야 하는지 판단하기 어려워요.' },
  { icon: '🗺', title: '우회거리 증가',          desc: '가까운 충전소가 항상 좋은 선택은 아니에요. 경로에서 얼마나 벗어나는지도 함께 봐야 해요.' },
  { icon: '📊', title: '안전 하한 SOC',          desc: '배송을 마쳐도 비상 상황에 대비할 배터리는 남아 있어야 해요.' },
]

const USERS = [
  { icon: '🚐', title: '전기 배송차량 운전자',        desc: '충전 걱정 없이 배송 가능 여부를 빠르게 확인해요.' },
  { icon: '📦', title: '물류·배송 운영 관리자',        desc: '여러 배송지와 충전 계획을 함께 관리해요.' },
  { icon: '🔋', title: 'EV Fleet 운영 기업',           desc: '차량별 운행 가능성과 충전 전략을 비교할 수 있어요.' },
  { icon: '🏙', title: '친환경 교통 정책 실증 관계자', desc: '실제 도로 경로와 충전 데이터를 기반으로 운영 가능성을 검증해요.' },
]

const HOW_STEPS = [
  { num: '01', title: '차량과 현재 SOC를 입력해요',      desc: '차량 종류와 현재 배터리 잔량(SOC)을 설정해요.' },
  { num: '02', title: '출발지와 배송지를 설정해요',       desc: '출발지와 배송지를 입력하거나 장소 검색으로 빠르게 추가해요.' },
  { num: '03', title: '실제 도로 경로를 계산해요',        desc: 'Kakao Directions API로 실제 도로 거리와 배송 순서를 계산해요.' },
  { num: '04', title: '구간별 배터리 변화를 예측해요',    desc: '실제 거리를 바탕으로 구간별 SOC 변화와 충전 필요 여부를 분석해요.' },
  { num: '05', title: '충전 시점과 충전소를 추천해요',    desc: '배송 가능 여부와 최적 충전 계획을 코크핏 화면에서 바로 확인해요.' },
]

const LOGIC_FLOW = [
  { num: '01', icon: '📍', title: '출발지·배송지 입력',       desc: '시작점과 배송 목적지를 설정해요.' },
  { num: '02', icon: '🔀', title: 'TSP 배송 순서 최적화',    desc: '가장 효율적인 방문 순서를 계산해요.' },
  { num: '03', icon: '🗺', title: '실제 도로 경로 계산',      desc: 'Kakao Directions로 실제 경로를 계산해요.' },
  { num: '04', icon: '🔋', title: '구간별 SOC 시뮬레이션',   desc: '각 구간의 배터리 소모량을 예측해요.' },
  { num: '05', icon: '⚠️', title: '충전 필요 구간 탐지',     desc: '안전 하한 SOC 이하로 떨어지는 구간을 찾아요.' },
  { num: '06', icon: '⚡', title: '충전소 후보 비교',         desc: '거리·출력·우회거리를 종합해 최적 충전소를 선택해요.' },
  { num: '07', icon: '📊', title: '운행 안정도 산정',         desc: '배송 가능성과 배터리 여유를 점수로 표현해요.' },
  { num: '08', icon: '✅', title: '최종 배송·충전 계획 추천', desc: '코크핏 화면에서 완성된 운행 계획을 확인해요.' },
]

const LOGIC_CARDS = [
  { icon: '🗺', num: '01', title: '경로 + 순서', desc: 'TSP로 최적 배송 순서를 구하고, Kakao Directions로 실제 도로 경로를 계산해요.' },
  { icon: '🔋', num: '02', title: '안전 하한', desc: '배송이 끝날 때까지 안전 SOC 이상을 유지할 수 있는지 구간별로 확인해요.' },
  { icon: '⚡', num: '03', title: '에너지 추정', desc: '실제 거리와 전비 데이터를 기반으로 구간별 배터리 소모량을 예측해요.' },
  { icon: '🔌', num: '04', title: '충전 삽입', desc: 'SOC가 안전 하한 이하로 떨어지는 구간에 최적 충전 시점을 삽입해요.' },
  { icon: '📊', num: '05', title: '후보 비교', desc: '거리·출력·우회거리를 종합해 배송 경로에 가장 적합한 충전소를 선택해요.' },
  { icon: '✅', num: '06', title: '운행 안정도', desc: '배송 가능성과 배터리 여유를 점수로 산정해 운전자에게 즉시 제공해요.' },
]

const SHOWCASE_STEPS = [
  { title: '차량 선택',     desc: '전기 배송차량 종류와 배터리 스펙을 설정해요.' },
  { title: '배터리 입력',   desc: '현재 SOC와 안전 하한 SOC를 설정해요.' },
  { title: '출발지 설정',   desc: '출발지를 장소 검색으로 빠르게 찾아요.' },
  { title: '배송지 설정',   desc: '배송할 목적지를 추가하고 순서를 정해요.' },
  { title: '운행 화면 확인', desc: '충전 계획, 경로, 운행 안정도를 한 화면에서 확인해요.' },
]

const DEV_MILESTONES = [
  {
    stage: 'MVP-0', title: 'Kakao Map 기본 연동',
    items: ['Kakao Map 표시', '기본 마커 렌더링'],
  },
  {
    stage: 'MVP-1', title: '기본 대시보드',
    items: ['차량 상태 패널', '지도', '배송 마커', '충전소 마커', '추천 충전소 마커'],
  },
  {
    stage: 'MVP-2', title: '배송지 관리',
    items: ['배송지 추가', '배송지 삭제', '배송 목록 관리', '배송 마커 동적 렌더링'],
  },
  {
    stage: 'MVP-3', title: '차량 선택 · SOC 계산',
    items: ['브랜드 선택', '차량 모델 선택', '커스텀 차량 입력', 'SOC 기반 잔여 배터리', '전비 기반 예상 주행 가능 거리'],
  },
  {
    stage: 'MVP-4', title: '실제 도로 경로 거리 계산',
    items: ['MVP-2 배송지 목록 활용', '차량 출발 지점 설정', 'Kakao Directions API 연동 준비', '실제 배송 경로 거리 계산', '충전 필요 여부 판단'],
  },
  {
    stage: 'MVP-5', title: '충전소 추천',
    items: ['배송 중 인근 충전소 후보 표시', '배터리 부족 시 최적 충전소 추천', '충전소 거리·속도·도착 배터리 고려', '충전 후 예상 잔여 배터리 계산', '충전 계획 산출 (충전량·시간·비용)', '지도 오버레이 카드'],
  },
  {
    stage: 'MVP-6', title: '배송 순서 최적화 · 경로 인텔리전스',
    items: ['배송 순서 최적화', '출발 지점 선택 (Kakao 장소 검색 연동)', '충전소 API 연동 (폴백 포함)', '경로 기반 충전소 추천', '경로 주변 충전소 렌더링', '이유 배지·상세 카드·경로 정보 개선'],
  },
  {
    stage: 'MVP-7', title: 'EV 경로 인텔리전스',
    items: ['EV 경로 인텔리전스 설명 화면', '신뢰도 기반 경로 건강 점수 (0~100)', '7가지 상태 판정: 배송 가능·충전 권장·여유 부족·충전 필요·도달 불가·데이터 없음·SOC 확인 필요', 'MVP-6 ↔ MVP-7 분석 연결', '최소 도착 SOC·예상 도착 SOC·건강 점수 연동'],
  },
  {
    stage: 'MVP-8', title: '5단계 통합 운전자 플로우',
    items: ['5단계 설정 마법사 (차량 → SOC → 출발지 → 배송지 → 확인)', '코크핏 뷰', 'SafeMap / KE 공공 충전소 API 연동', 'Kakao 실제 도로 경로 계산 및 폴리라인 렌더링', '통합 충전 판단 · 추천 로직'],
  },
]

// ── Hero cockpit preview — full dark 3-panel cockpit layout
function HeroCockpitPreview() {
  const [mapErr, setMapErr] = useState(false)
  const dk  = '#0d1a2d'
  const sf  = '#12233e'
  const bd  = 'rgba(255,255,255,0.09)'
  const tx  = '#ffffff'
  const mu  = 'rgba(255,255,255,0.50)'
  const ok  = '#30d158'
  const ac  = '#4da8ff'
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 680 }}>
      <div style={{
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 52px 110px rgba(0,16,52,0.60), 0 14px 36px rgba(0,0,0,0.32)',
        border: '1px solid rgba(255,255,255,0.10)',
        background: dk,
      }}>
        {/* Browser chrome */}
        <div style={{ background: 'rgba(0,0,0,0.44)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: `1px solid ${bd}` }}>
          {['#ff5f57','#febc2e','#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
          <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: mu, fontFamily: TEXT, letterSpacing: '-0.1px' }}>
            EV 배송 충전 최적화 · 운행 화면
          </div>
        </div>

        {/* 3-panel layout */}
        <div style={{ display: 'flex', height: 350 }}>

          {/* Left panel */}
          <div style={{ width: 150, borderRight: `1px solid ${bd}`, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0, background: sf }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: `1px solid ${bd}`, flexShrink: 0 }}>
              <span style={{ fontSize: 15 }}>🚐</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: tx, fontFamily: TEXT }}>현대 ST1</div>
                <div style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>61 kWh · 305 km</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>배터리 · SOC</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 34, fontWeight: 700, color: ok, lineHeight: 1, fontFamily: DISPLAY }}>78</span>
              <span style={{ fontSize: 12, color: mu, fontFamily: TEXT }}>%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: '78%', height: '100%', background: ok, borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: mu, fontFamily: TEXT }}>예상 주행</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: ok, fontFamily: TEXT }}>238 km</span>
            </div>
            <div style={{ height: 1, background: bd, flexShrink: 0 }} />
            <div style={{ fontSize: 8, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>운행 안정도</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: tx, lineHeight: 1, fontFamily: DISPLAY }}>90</span>
              <span style={{ fontSize: 10, color: mu, fontFamily: TEXT }}>점</span>
            </div>
            <div style={{ height: 1, background: bd, flexShrink: 0 }} />
            <div style={{ fontSize: 9, color: ok, fontWeight: 600, fontFamily: TEXT }}>충전 없이 완주 가능</div>
            <div style={{ fontSize: 9, color: mu, fontFamily: TEXT }}>3개 목적지 · 85.5 km</div>
          </div>

          {/* Center map */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#131929' }}>
            {!mapErr ? (
              <img
                src="/images/landing-map-preview.png"
                alt="배송 경로"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setMapErr(true)}
              />
            ) : (
              <RouteMockup />
            )}
            {[{ left: '25%', top: '56%', n: 1 }, { left: '52%', top: '35%', n: 2 }, { left: '79%', top: '60%', n: 3 }].map(({ left, top, n }) => (
              <div key={n} style={{ position: 'absolute', left, top, transform: 'translate(-50%,-50%)', zIndex: 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', border: `2.5px solid ${ac}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: ac, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{n}</div>
            ))}
            <div style={{ position: 'absolute', left: '64%', top: '74%', transform: 'translate(-50%,-50%)', zIndex: 3, width: 22, height: 22, borderRadius: '50%', background: ok, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>⚡</div>
          </div>

          {/* Right panel */}
          <div style={{ width: 144, borderLeft: `1px solid ${bd}`, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, background: sf }}>
            <div style={{ fontSize: 8, color: mu, fontFamily: TEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>충전 판단</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: ok, fontFamily: TEXT, lineHeight: 1 }}>배송 가능</div>
            <div style={{ height: 1, background: bd, flexShrink: 0 }} />
            <div style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>판단 근거</div>
            <div style={{ fontSize: 10, color: tx, lineHeight: 1.5, fontFamily: TEXT }}>현재 배터리로 전체 배송 경로를 완주할 수 있습니다.</div>
            <div style={{ height: 1, background: bd, flexShrink: 0 }} />
            <div style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>충전소 후보</div>
            {[{ name: '양원리 공영', dist: '0.3 km', score: 92 }, { name: '성수 충전소', dist: '1.2 km', score: 78 }].map(c => (
              <div key={c.name} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 7, border: `1px solid ${bd}`, flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: tx, fontFamily: TEXT, marginBottom: 2 }}>{c.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>{c.dist}</span>
                  <span style={{ fontSize: 9, color: ok, fontWeight: 600, fontFamily: TEXT }}>{c.score}점</span>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: bd, flexShrink: 0 }} />
            <div style={{ fontSize: 8, color: mu, fontFamily: TEXT }}>세부 안정도</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[{ label: '배송', val: 95 }, { label: '배터리', val: 88 }, { label: '충전', val: 82 }].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '5px 2px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ac, fontFamily: TEXT }}>{s.val}</div>
                  <div style={{ fontSize: 7, color: mu, fontFamily: TEXT }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom summary bar */}
        <div style={{ background: 'rgba(0,0,0,0.40)', borderTop: `1px solid ${bd}`, padding: '11px 18px', display: 'flex', alignItems: 'center' }}>
          {[
            { label: '전체 거리', value: '85.5 km', color: tx },
            { label: '배송지', value: '3개', color: tx },
            { label: '주행 가능', value: '238 km', color: tx },
            { label: '운행 안정도', value: '90점', color: ac },
            { label: '최종 상태', value: '배송 가능', color: ok },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: mu, marginBottom: 2, fontFamily: TEXT }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: TEXT }}>{value}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 18, background: bd }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Floating judgment card */}
      <div style={{
        position: 'absolute', top: -14, right: -20,
        background: '#ffffff', borderRadius: 14, padding: '10px 14px',
        boxShadow: '0 14px 44px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        display: 'flex', alignItems: 'center', gap: 9, zIndex: 10,
        border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(34,197,94,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✅</div>
        <div>
          <div style={{ fontSize: 9, color: '#5C5E62', fontFamily: TEXT, marginBottom: 2 }}>충전 판단</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', fontFamily: TEXT }}>배송 가능</div>
        </div>
      </div>

      {/* Floating SOC card */}
      <div style={{
        position: 'absolute', top: '48%', left: -22, transform: 'translateY(-50%)',
        background: '#ffffff', borderRadius: 12, padding: '8px 12px',
        boxShadow: '0 10px 28px rgba(0,0,0,0.14)', zIndex: 10,
        border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: 8, color: '#5C5E62', fontFamily: TEXT, marginBottom: 3 }}>배터리 SOC</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 52, height: 6, background: '#F2F2F2', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: '78%', height: '100%', background: '#22C55E', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', fontFamily: TEXT }}>78%</span>
        </div>
      </div>
    </div>
  )
}

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

  // Hero background error state
  const [heroBgErr, setHeroBgErr] = useState(false)

  // Interactive showcase state
  const [showcaseStep, setShowcaseStep] = useState(0)
  const [showcaseFading, setShowcaseFading] = useState(false)
  const showcaseSectionRef = useRef(null)

  // Cockpit section active area
  const [cockpitActiveArea, setCockpitActiveArea] = useState('left')

  // Reveal hooks
  const [heroRevRef,    heroVis]       = useReveal(0.08)
  const [cockpitRevRef, cockpitVis]    = useReveal(0.1)
  const [cockpitExplRef, cockpitExplVis] = useReveal(0.08)
  const [probRevRef,    probVis]    = useReveal(0.1)
  const [usersRevRef,   usersVis]   = useReveal(0.1)
  const [stepsRevRef,   stepsVis]   = useReveal(0.1)
  const [showRevRef,    showVis]    = useReveal(0.08)
  const [logicRevRef,   logicVis]   = useReveal(0.1)
  const [techRevRef,    techVis]    = useReveal(0.1)
  const [roviqRevRef,   roviqVis]   = useReveal(0.1)
  const [ctaRevRef,     ctaVis]     = useReveal(0.1)
  const [devRevRef,     devVis]     = useReveal(0.1)

  function handleShowcaseStep(i) {
    if (i === showcaseStep) return
    setShowcaseFading(true)
    setTimeout(() => { setShowcaseStep(i); setShowcaseFading(false) }, 140)
  }

  return (
    <div className="landing-page" style={{ fontFamily: TEXT, background: CLR.canvas, minHeight: '100vh' }}>

      {/* ── STICKY NAV ────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: '#ffffff',
        height: 96,
        display: 'flex', alignItems: 'center',
        padding: '0 40px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
      }}>
        <BrandLogo />
        {[
          { label: '작동 방식', ref: howRef },
          { label: '기술',      ref: techRef },
          { label: '개발 과정', ref: devRef },
        ].map(({ label, ref: r }) => (
          <button key={label} onClick={() => scrollToRef(r)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.62)', fontSize: 15, fontFamily: TEXT, letterSpacing: '-0.2px', padding: '0 18px', height: 96, lineHeight: 1, borderRadius: 8, transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = CLR.ink; e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(0,0,0,0.62)'; e.currentTarget.style.background = 'none' }}
          >
            {label}
          </button>
        ))}
        <div style={{ width: 18 }} />
        <Link to="/mvp-8?start=1" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px 26px', borderRadius: 9999, lineHeight: 1,
          textDecoration: 'none', fontSize: 15, fontWeight: 600,
          fontFamily: TEXT, letterSpacing: '-0.2px',
          background: CLR.primary, color: '#fff', border: 'none', whiteSpace: 'nowrap',
          transition: 'transform 0.18s, box-shadow 0.18s',
          boxShadow: '0 2px 12px rgba(0,102,204,0.28)',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,102,204,0.44)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,102,204,0.28)' }}
        >
          지금 시작하기
        </Link>
      </nav>

      {/* ── HERO ──────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        background: '#e8f0fe',
        height: 'calc(100dvh - 96px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 48px 80px',
        overflow: 'hidden',
      }}>
        {/* Background image — img tag for reliable rendering + onError fallback */}
        {!heroBgErr && (
          <img
            src="/images/landing-hero-bg.png"
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center center',
              display: 'block', pointerEvents: 'none', zIndex: 0,
            }}
            onError={() => setHeroBgErr(true)}
          />
        )}
        {/* Left-to-right gradient overlay — lightened so background image is visible */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(100deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.58) 38%, rgba(255,255,255,0.24) 64%, rgba(255,255,255,0.04) 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Centered text content */}
        <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div
            ref={heroRevRef}
            className={`rv-up ${heroVis ? 'rv-in' : ''}`}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 16px', borderRadius: 9999,
              background: 'rgba(0,102,204,0.08)', border: '1px solid rgba(0,102,204,0.18)',
              fontSize: 13, fontWeight: 700, color: CLR.primary,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              marginBottom: 32, fontFamily: TEXT, whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 11 }}>⚡</span>
              EV 배송차량 충전 최적화 플랫폼
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 4.8vw, 72px)',
              fontWeight: 700, color: CLR.ink,
              fontFamily: DISPLAY, lineHeight: 1.08,
              letterSpacing: '-1.2px', marginBottom: 28,
              wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>
              배송 경로와 배터리 상태를<br />
              함께 분석해 가장 안전한<br />
              충전 시점과 충전소를 추천해요.
            </h1>
            <p style={{
              fontSize: 19, color: CLR.inkMuted80, fontFamily: TEXT,
              lineHeight: 1.65, letterSpacing: '-0.3px', marginBottom: 12,
              wordBreak: 'keep-all', maxWidth: 560, margin: '0 auto 12px',
            }}>
              출발 전 충전이 필요한지, 어디서 충전해야 하는지 바로 확인할 수 있어요.
            </p>
            <p style={{
              fontSize: 15, color: CLR.inkMuted48, fontFamily: TEXT,
              lineHeight: 1.7, letterSpacing: '-0.2px',
              margin: '0 auto 44px', wordBreak: 'keep-all', maxWidth: 520,
            }}>
              실제 도로 경로, 공공 충전소 데이터, EV-TSP 알고리즘을 바탕으로
              전기 배송차량의 운행 계획을 더 안전하게 만들어요.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <PillCta to="/mvp-8?start=1" size="lg">지금 시작하기</PillCta>
              <PillCta to="/mvp-flow" outline size="lg">개발 과정 보기</PillCta>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
          <div className="rv-bounce" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, userSelect: 'none' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ display: 'block' }}>
              <path d="M26 8 L26 42 M10 30 L26 46 L42 30" stroke="rgba(0,0,0,0.48)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.48)', letterSpacing: '0.22em', fontFamily: TEXT }}>SCROLL</div>
          </div>
        </div>
      </section>

      {/* ── ROVIQ 브랜드 개념 ────────────────────────────── */}
      <section style={{ background: CLR.parchment, padding: '78px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            ref={roviqRevRef}
            className={`rv-up ${roviqVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 42, alignItems: 'center' }}
          >
            {/* Left: explanatory text */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: CLR.primary, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 13, fontFamily: TEXT }}>
                EV Route Intelligence
              </div>
              <h2 style={{
                fontSize: 'clamp(22px, 2.7vw, 39px)',
                fontWeight: 700, color: CLR.ink,
                fontFamily: DISPLAY, lineHeight: 1.10,
                letterSpacing: '-0.4px', marginBottom: 18,
                wordBreak: 'keep-all',
              }}>
                ROVIQ,<br />왜 이런 이름일까요?
              </h2>
              <p style={{ fontSize: 17, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, letterSpacing: '-0.3px', marginBottom: 12, wordBreak: 'keep-all' }}>
                ROVIQ는 <strong style={{ color: CLR.ink }}>Route + Vision + IQ</strong>에서 가져온 이름이에요.
              </p>
              <p style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.8, letterSpacing: '-0.2px', marginBottom: 12, wordBreak: 'keep-all' }}>
                경로, 배터리 상태, 충전 시점, 충전소 후보를 함께 분석해 EV 배송 운전자가 더 안전하고 확실한 운행 판단을 내릴 수 있도록 도와요.
              </p>
              <p style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.8, letterSpacing: '-0.2px', wordBreak: 'keep-all' }}>
                가까운 충전소를 찾는 것만으로는 부족해요. 언제, 어디서 충전하는 것이 가장 안전한지를 함께 판단하는 것이 핵심이에요.
              </p>
            </div>
            {/* Right: keyword cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🗺', kw: 'Route Intelligence', desc: '출발지부터 배송지까지 실제 도로 경로를 분석해 배송 순서를 최적화해요.' },
                { icon: '🔋', kw: 'Battery-aware Decision', desc: '현재 SOC와 구간별 에너지 소모를 예측해 충전 여부를 판단해요.' },
                { icon: '⚡', kw: 'Smart Charging Timing', desc: '어느 배송지 이후에 충전하면 가장 효율적인지 계산해서 추천해요.' },
              ].map(({ icon, kw, desc }) => (
                <div key={kw} className="hover-card" style={{
                  background: CLR.canvas, border: `1px solid ${CLR.hairline}`,
                  borderRadius: 13, padding: '14px 17px',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 31, height: 31, borderRadius: 9, flexShrink: 0,
                    background: 'rgba(0,102,204,0.08)', border: '1px solid rgba(0,102,204,0.14)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: CLR.ink, fontFamily: TEXT, marginBottom: 6, letterSpacing: '-0.2px' }}>{kw}</div>
                    <div style={{ fontSize: 14, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.65 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 스마트 모빌리티 코크핏 ──────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '104px 24px 117px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div
            ref={cockpitRevRef}
            className={`rv-up ${cockpitVis ? 'rv-in' : ''}`}
            style={{ textAlign: 'center', marginBottom: 57 }}
          >
            <div style={{
              fontSize: 23, fontWeight: 700, color: CLR.primary,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 22, fontFamily: TEXT,
            }}>
              스마트 모빌리티 코크핏
            </div>
            <h2 style={{
              fontSize: 'clamp(28px, 3.6vw, 52px)',
              fontWeight: 700, color: CLR.ink,
              fontFamily: DISPLAY, lineHeight: 1.10,
              letterSpacing: '-0.4px', marginBottom: 18,
              wordBreak: 'keep-all', maxWidth: 760, margin: '0 auto 18px',
            }}>
              운전자가 바로 판단할 수 있는 화면을 만들었어요.
            </h2>
            <p style={{
              fontSize: 12, color: CLR.inkMuted48,
              fontFamily: TEXT, lineHeight: 1.6,
              letterSpacing: '-0.374px', maxWidth: 600, margin: '0 auto',
            }}>
              배송 가능 여부, 충전 시점, 추천 충전소, 운행 안정도를 한 화면에서 확인할 수 있어요.
              복잡한 계산 결과는 줄이고, 지금 필요한 판단만 먼저 보여줘요.
            </p>
          </div>

          {/* preview card */}
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.10)',
            border: `1px solid ${CLR.hairline}`,
            maxWidth: 1220, margin: '0 auto',
          }}>
            <div style={{ flex: '1 1 64%', minWidth: 0, height: 364, position: 'relative', background: '#131929', overflow: 'hidden' }}>
              <RouteMockup />
            </div>
            <div style={{ flex: '1 1 36%', minWidth: 200, background: CLR.parchment, padding: '23px 27px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: `1px solid ${CLR.hairline}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: CLR.primary, fontFamily: TEXT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 7 }}>
                충전 판단 요약
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E', fontFamily: DISPLAY, lineHeight: 1, marginBottom: 13 }}>
                배송 가능
              </div>
              <div style={{ height: 1, background: CLR.hairline, marginBottom: 12 }} />
              {[
                { label: '차량 종류',         value: '현대 ST1' },
                { label: '현재 SOC',          value: '78%' },
                { label: '충전 시점',          value: '충전 없이 배송 가능', green: true },
                { label: '추천 충전소',        value: '서울양원리 공영주차장' },
                { label: '안전 하한 SOC',      value: '20% 유지' },
                { label: '전체 배송 거리',     value: '85.5 km' },
                { label: '배송 완료 예상 SOC', value: '51.3%' },
              ].map(({ label, value, green }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${CLR.hairline}` }}>
                  <span style={{ fontSize: 13, color: CLR.inkMuted48, fontFamily: TEXT, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: green ? '#22C55E' : CLR.ink, fontFamily: TEXT, textAlign: 'right', marginLeft: 7 }}>{value}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(0,102,204,0.07)', borderRadius: 9, border: '1px solid rgba(0,102,204,0.18)' }}>
                <div style={{ fontSize: 11, color: CLR.primary, fontWeight: 600, marginBottom: 6, fontFamily: TEXT, letterSpacing: '0.10em', textTransform: 'uppercase' }}>운행 안정도</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, lineHeight: 1 }}>90</span>
                  <span style={{ fontSize: 12, color: CLR.inkMuted48, fontFamily: TEXT }}>점</span>
                </div>
              </div>
              <div style={{ marginTop: 8, padding: '9px 12px', background: CLR.canvas, borderRadius: 7, border: `1px solid ${CLR.hairline}` }}>
                <p style={{ margin: 0, fontSize: 14, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6 }}>
                  충전 시점을 판단한 이유도 화면에서 함께 확인할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 해결하는 문제 ──────────────────────────────── */}
      <section style={{ background: CLR.parchment, padding: '104px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={probRevRef} className={`rv-up ${probVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="해결하는 문제"
              title="전기 배송차량은 늘 충전 판단이 필요해요."
            />
          </div>
          <div
            className={`rv-grid ${probVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}
          >
            {PROBLEMS.map(p => (
              <div key={p.title} className="rv-card hover-card" style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 14, padding: 23, minHeight: 136 }}>
                <div style={{ fontSize: 23, marginBottom: 12 }}>{p.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.65, letterSpacing: '-0.2px' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 대상 사용자 ────────────────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '104px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={usersRevRef} className={`rv-up ${usersVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="이런 분들을 위해 만들었어요"
              title="전기 배송 운영의 모든 단계에서 사용할 수 있어요."
            />
          </div>
          <div
            className={`rv-grid ${usersVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}
          >
            {USERS.map(u => (
              <div key={u.title} className="rv-card hover-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 14, padding: 23, minHeight: 136 }}>
                <div style={{ fontSize: 23, marginBottom: 12 }}>{u.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 8, lineHeight: 1.3 }}>{u.title}</div>
                <div style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.65, letterSpacing: '-0.2px' }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 작동 방식 ──────────────────────────────────── */}
      <section ref={howRef} id="how-it-works" style={{ background: CLR.parchment, padding: '104px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div ref={stepsRevRef} className={`rv-up ${stepsVis ? 'rv-in' : ''}`}>
            <SectionHead label="작동 방식" title="다섯 단계면 운행 계획이 완성돼요." />
          </div>
          <div
            className={`rv-grid ${stepsVis ? 'rv-in' : ''}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 9 }}
          >
            {HOW_STEPS.map((s, i) => (
              <div key={i} className="rv-card hover-card" style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18, minHeight: 62 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: CLR.primary, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY }}>
                  {s.num}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 15, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 실제 사용 예시 (Interactive showcase) ─────── */}
      <section ref={showcaseSectionRef} style={{ background: CLR.canvas, padding: '104px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={showRevRef} className={`rv-up ${showVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="실제 사용 예시"
              title={<>차량 선택부터 충전 계획까지,<br />5단계면 완성돼요.</>}
              subtitle="각 단계를 눌러 실제 화면이 어떻게 보이는지 확인해 보세요."
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2.4fr',
            gap: 23,
            alignItems: 'start',
          }}>
            {/* Left: step tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {SHOWCASE_STEPS.map((s, i) => {
                const active = i === showcaseStep
                return (
                  <button
                    key={i}
                    onClick={() => handleShowcaseStep(i)}
                    className="step-tab"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: active ? `2px solid ${CLR.primary}` : `1.5px solid ${CLR.hairline}`,
                      background: active ? 'rgba(0,102,204,0.08)' : CLR.parchment,
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: TEXT,
                      boxShadow: active ? '0 4px 16px rgba(0,102,204,0.16), 0 1px 4px rgba(0,102,204,0.08)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.borderColor = `rgba(0,102,204,0.35)`
                        e.currentTarget.style.background = 'rgba(0,102,204,0.04)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.borderColor = CLR.hairline
                        e.currentTarget.style.background = CLR.parchment
                      }
                    }}
                  >
                    <div style={{
                      width: 29, height: 29, borderRadius: '50%', flexShrink: 0,
                      background: active ? CLR.primary : 'transparent',
                      border: `1.5px solid ${active ? CLR.primary : CLR.hairline}`,
                      color: active ? '#fff' : CLR.inkMuted48,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      transition: 'background 0.22s, border-color 0.22s, color 0.22s',
                      boxShadow: active ? `0 0 0 3px rgba(0,102,204,0.10)` : 'none',
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: active ? 700 : 600, color: active ? CLR.primary : CLR.ink, letterSpacing: '-0.1px', marginBottom: 3 }}>{s.title}</div>
                      <div style={{ fontSize: 14, color: CLR.inkMuted48, lineHeight: 1.45 }}>{s.desc}</div>
                    </div>
                    <div style={{ fontSize: 13, color: active ? CLR.primary : CLR.hairline, flexShrink: 0, transition: 'color 0.22s', fontWeight: active ? 700 : 400 }}>›</div>
                  </button>
                )
              })}
            </div>

            {/* Right: mockup preview — always light frame */}
            <div style={{
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 16px 48px -4px rgba(0,80,200,0.16), 0 6px 20px rgba(0,0,0,0.10)',
              border: '1px solid rgba(0,102,204,0.10)',
              height: 416,
              position: 'relative',
              background: '#F8F8F8',
            }}>
              {/* App-frame chrome — light */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 23, zIndex: 10,
                background: '#F0F0F0',
                borderBottom: '1px solid #E0E0E0',
                display: 'flex', alignItems: 'center', padding: '0 10px', gap: 4,
              }}>
                {['#ff5f57','#febc2e','#28c840'].map((c, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                ))}
                <div style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#999', fontFamily: TEXT, letterSpacing: '-0.1px' }}>
                  EV 배송 충전 최적화 · {SHOWCASE_STEPS[showcaseStep].title}
                </div>
              </div>
              <div style={{
                position: 'absolute', top: 23, left: 0, right: 0, bottom: 0,
                opacity: showcaseFading ? 0 : 1,
                transition: 'opacity 0.14s ease',
              }}>
                <ShowcaseMockup step={showcaseStep} />
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div style={{ marginTop: 42, textAlign: 'center' }}>
            <PillCta to="/mvp-8?start=1" size="lg">지금 직접 사용해 보기</PillCta>
          </div>
        </div>
      </section>

      {/* ── 코크핏 화면은 이렇게 읽어요 ─────────────────── */}
      <section style={{ background: CLR.parchment, padding: '104px 24px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          <div ref={cockpitExplRef} className={`rv-up ${cockpitExplVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="코크핏 화면 구조"
              title="코크핏 화면은 이렇게 읽어요."
              subtitle="운행 화면 각 영역이 무엇을 보여주는지 한눈에 파악해 보세요."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.4fr', gap: 31, alignItems: 'start' }}>
            {/* Left: clickable callout list */}
            <div className={`rv-grid ${cockpitExplVis ? 'rv-in' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  num: '①', area: '왼쪽 패널', areaKey: 'left', color: '#3E6AE1',
                  items: ['차량 종류 및 배터리 스펙', '현재 SOC와 예상 주행 가능 거리', '운행 안정도 점수', '배송 경로 요약'],
                },
                {
                  num: '②', area: '지도 영역', areaKey: 'center', color: '#0A6AFF',
                  items: ['실제 도로 기반 배송 경로', '배송 순서 마커', '충전소 위치', '지리적 맥락'],
                },
                {
                  num: '③', area: '오른쪽 패널', areaKey: 'right', color: '#7C55E8',
                  items: ['충전 판단 이유 설명', '충전 시점 근거', '운행 안정도 세부 점수', '충전소 후보 비교'],
                },
                {
                  num: '④', area: '하단 요약 바', areaKey: 'bottom', color: '#22C55E',
                  items: ['전체 경로 거리', '배송지 수', '주행 가능 거리', '최종 상태 배지'],
                },
              ].map(r => {
                const isActive = cockpitActiveArea === r.areaKey
                return (
                  <div
                    key={r.area}
                    className="rv-card"
                    onClick={() => setCockpitActiveArea(r.areaKey)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '13px 14px',
                      background: isActive ? r.color + '0A' : CLR.canvas,
                      border: `${isActive ? 2 : 1}px solid ${isActive ? r.color + '60' : CLR.hairline}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(.16,1,.3,1)',
                      boxShadow: isActive ? `0 4px 20px ${r.color}22` : 'none',
                    }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: isActive ? r.color + 'EE' : r.color + '16',
                      border: `1.5px solid ${r.color}${isActive ? 'EE' : '40'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800,
                      color: isActive ? '#ffffff' : r.color,
                      fontFamily: DISPLAY,
                      transition: 'all 0.3s ease',
                    }}>{r.num}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? r.color : CLR.ink, marginBottom: 5, fontFamily: TEXT, transition: 'color 0.3s ease' }}>{r.area}</div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {r.items.map(item => (
                          <li key={item} style={{ fontSize: 14, color: CLR.inkMuted48, display: 'flex', alignItems: 'center', gap: 5, fontFamily: TEXT }}>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: isActive ? r.color : CLR.inkMuted48, flexShrink: 0, display: 'inline-block', transition: 'background 0.3s ease' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {isActive && <div style={{ fontSize: 12, color: r.color, flexShrink: 0, fontWeight: 700 }}>›</div>}
                  </div>
                )
              })}
              <p style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, margin: '8px 0 0', textAlign: 'center' }}>
                카드를 클릭하면 해당 영역이 강조돼요
              </p>
            </div>

            {/* Right: annotated cockpit diagram */}
            <div className={`rv-up-fast ${cockpitExplVis ? 'rv-in' : ''}`}>
              <CockpitAnnotated activeArea={cockpitActiveArea} />
              <p style={{ marginTop: 20, fontSize: 14, color: CLR.inkMuted48, textAlign: 'center', fontFamily: TEXT, lineHeight: 1.6 }}>
                위 화면은 실제 MVP-8 코크핏 구조를 재현한 다이어그램이에요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 핵심 판단 로직 — Connected Flow ──────────── */}
      <section ref={techRef} id="technology" style={{ background: CLR.parchment, padding: '104px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={logicRevRef} className={`rv-up ${logicVis ? 'rv-in' : ''}`}>
            <SectionHead
              label="핵심 판단 로직"
              title="배송 순서와 충전 전략을 함께 계산해요."
              subtitle="단순히 가까운 충전소를 찾지 않아요. 배송 순서, 배터리 여유, 안전 하한 SOC, 우회거리, 충전소 후보를 함께 비교해요."
            />
          </div>

          {/* 6-card grid */}
          <div
            className={`rv-grid ${logicVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
          >
            {LOGIC_CARDS.map((card, i) => (
              <div key={i} className="rv-card logic-card hover-card" style={{
                borderRadius: 12, padding: '20px 18px',
                background: CLR.canvas,
                border: `1px solid ${CLR.hairline}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(0,102,204,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>{card.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: CLR.primary, fontFamily: TEXT, letterSpacing: '0.08em' }}>{card.num}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: CLR.ink, fontFamily: TEXT, marginBottom: 8, lineHeight: 1.3, wordBreak: 'keep-all' }}>{card.title}</div>
                <div style={{ fontSize: 13, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.65, wordBreak: 'keep-all' }}>{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 핵심 기술 구성 ─────────────────────────────── */}
      <section style={{ background: CLR.canvas, padding: '88px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div ref={techRevRef} className={`rv-up ${techVis ? 'rv-in' : ''}`} style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 23, fontWeight: 700, color: CLR.primary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 23, fontFamily: TEXT, wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>
              핵심 기술 구성 · Core Technology
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 52px)', fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, lineHeight: 1.10, letterSpacing: '-0.4px', marginBottom: 18, wordBreak: 'keep-all' }}>
              실제 API와 EV-TSP 알고리즘으로 배송·충전 경로를 최적화해요.
            </h2>
            <p style={{ fontSize: 16, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, letterSpacing: '-0.374px', maxWidth: 640, margin: '0 auto 20px', wordBreak: 'keep-all' }}>
              이 서비스는 정적인 화면이 아니에요. 실제 도로 경로 API, 공공 충전소 데이터, 배터리 상태, 안전 하한 SOC를 함께 계산해 운행 가능한 배송·충전 계획을 추천해요.
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
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}
          >
            <div className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8, fontFamily: TEXT }}>Frontend</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 7, lineHeight: 1.3 }}>사용자 인터페이스</div>
              <div style={{ fontSize: 14, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, marginBottom: 12, wordBreak: 'keep-all' }}>
                React + Vite 기반으로 차량 선택, SOC 입력, 지도 인터페이스, 판단 근거 패널을 구현했어요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['React + Vite', 'Kakao Map SDK', 'IVI 코크핏 UI'].map(t => (
                  <span key={t} style={{ fontSize: 9, color: CLR.inkMuted80, background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 4, padding: '3px 7px', fontFamily: TEXT }}>{t}</span>
                ))}
              </div>
            </div>

            <div className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8, fontFamily: TEXT }}>외부 API</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 7, lineHeight: 1.3 }}>실제 도로 · 공공 충전소 데이터</div>
              <div style={{ fontSize: 14, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, marginBottom: 12, wordBreak: 'keep-all' }}>
                Kakao Directions, Kakao Map, SafeMap, KE 공공 충전소 데이터를 활용해 실제 도로 경로와 충전소 후보를 불러와요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['Kakao Directions', 'Kakao Places', 'SafeMap API', 'KE 공공충전소 API'].map(t => (
                  <span key={t} style={{ fontSize: 9, color: CLR.inkMuted80, background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 4, padding: '3px 7px', fontFamily: TEXT }}>{t}</span>
                ))}
              </div>
            </div>

            <div className="rv-card" style={{ background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8, fontFamily: TEXT }}>Backend</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 7, lineHeight: 1.3 }}>API 중계 서버</div>
              <div style={{ fontSize: 14, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.7, marginBottom: 12, wordBreak: 'keep-all' }}>
                FastAPI 서버가 외부 API 요청을 중계하고, 충전소 데이터를 병합해 프론트엔드에 전달해요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['FastAPI (Python)', 'Render 배포', 'REST API'].map(t => (
                  <span key={t} style={{ fontSize: 9, color: CLR.inkMuted80, background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 4, padding: '3px 7px', fontFamily: TEXT }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 하단 2카드 */}
          <div
            className={`rv-grid ${techVis ? 'rv-in' : ''}`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}
          >
            <div className="rv-card" style={{ flex: '2 1 200px', background: 'linear-gradient(145deg, rgba(0,100,210,0.06) 0%, rgba(0,100,210,0.11) 100%)', border: '2px solid rgba(0,102,204,0.30)', borderRadius: 12, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -44, right: -44, width: 132, height: 132, borderRadius: '50%', background: 'rgba(0,102,204,0.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -33, left: -22, width: 100, height: 100, borderRadius: '50%', background: 'rgba(0,102,204,0.04)', pointerEvents: 'none' }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: CLR.primary, color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, fontFamily: TEXT }}>
                ⚡ 핵심 알고리즘
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, letterSpacing: '-0.4px', marginBottom: 12, lineHeight: 1.2 }}>
                EV-TSP 기반 경로·충전 최적화
              </div>
              <div style={{ fontSize: 14, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, marginBottom: 10, wordBreak: 'keep-all' }}>
                <strong style={{ color: CLR.ink }}>TSP(Traveling Salesman Problem)</strong>는 여러 목적지를 가장 효율적인 순서로 방문하는 경로를 찾는 대표적인 조합 최적화 문제예요.
              </div>
              <div style={{ fontSize: 14, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, marginBottom: 10, wordBreak: 'keep-all' }}>
                <strong style={{ color: CLR.ink }}>EV-TSP</strong>는 TSP에 전기차 특유의 제약 조건 — 배터리 잔량, 충전 시점 결정, 안전 하한 SOC, 충전소 후보 선택 — 을 추가한 확장 방식이에요.
              </div>
              <div style={{ fontSize: 14, color: CLR.inkMuted80, fontFamily: TEXT, lineHeight: 1.75, marginBottom: 16, wordBreak: 'keep-all' }}>
                이 프로젝트는 EV-TSP에서 영감을 받아 <strong style={{ color: CLR.ink }}>배송 순서와 충전 전략을 함께 판단</strong>해요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['배송 순서 최적화', 'SOC 시뮬레이션', '충전 전략 추천', '공공 충전소 후보 평가'].map(f => (
                  <span key={f} style={{ fontSize: 9, fontWeight: 600, color: CLR.primary, background: 'rgba(0,102,204,0.10)', border: '1px solid rgba(0,102,204,0.22)', borderRadius: 5, padding: '3px 8px', fontFamily: TEXT }}>{f}</span>
                ))}
              </div>
            </div>

            <div className="rv-card" style={{ flex: '1 1 144px', background: CLR.parchment, border: `1px solid ${CLR.hairline}`, borderRadius: 12, padding: '20px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: CLR.primary, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8, fontFamily: TEXT }}>판단 흐름</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: CLR.ink, fontFamily: TEXT, letterSpacing: '-0.374px', marginBottom: 14, lineHeight: 1.3 }}>배송·충전 계획 결정 흐름</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  '출발지·배송지 입력',
                  '배송 순서 최적화',
                  '실제 도로 경로 계산',
                  'SOC 시뮬레이션',
                  '충전 필요 구간 탐지',
                  '충전소 후보 비교',
                  '최종 운행 계획 추천',
                ].map((text, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: i === arr.length - 1 ? CLR.primary : 'rgba(0,102,204,0.12)',
                        border: i === arr.length - 1 ? 'none' : '1.5px solid rgba(0,102,204,0.30)',
                        color: i === arr.length - 1 ? '#fff' : CLR.primary,
                        fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: TEXT,
                      }}>
                        {i + 1}
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ width: 2, height: 10, background: 'rgba(0,102,204,0.18)', margin: '2px 0' }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: i === arr.length - 1 ? CLR.ink : CLR.inkMuted80,
                      fontWeight: i === arr.length - 1 ? 600 : 400,
                      fontFamily: TEXT, lineHeight: 1.5, paddingTop: 2, wordBreak: 'keep-all',
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

      {/* ── 개발 과정 ──────────────────────────────────── */}
      <section ref={devRef} id="development-process" style={{ background: CLR.parchment, padding: '104px 24px 117px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={devRevRef} className={`rv-up ${devVis ? 'rv-in' : ''}`} style={{ textAlign: 'center', marginBottom: 57 }}>
            <div style={{ fontSize: 23, fontWeight: 700, color: CLR.primary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 23, fontFamily: TEXT }}>
              개발 과정
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 52px)', fontWeight: 700, color: CLR.ink, fontFamily: DISPLAY, lineHeight: 1.10, letterSpacing: '-0.4px', marginBottom: 18, wordBreak: 'keep-all' }}>
              MVP-0부터 MVP-8까지<br />단계적으로 발전했어요.
            </h2>
            <p style={{ fontSize: 18, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.6, letterSpacing: '-0.374px', maxWidth: 580, margin: '0 auto 34px' }}>
              지도 연동에서 시작해 실제 도로 경로, SOC 예측, 충전소 추천, EV-TSP 기반 판단까지 확장했어요.
            </p>
            <PillCta to="/mvp-flow" outline size="lg">개발 과정 보기</PillCta>
          </div>

          {/* Row 1: MVP-0 ~ MVP-4 */}
          <div
            className={`rv-grid ${devVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 14 }}
          >
            {DEV_MILESTONES.slice(0, 5).map((m, i) => (
              <div key={i} className="rv-card hover-card" style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 14, padding: '20px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: CLR.primary, fontFamily: TEXT, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{m.stage}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: CLR.ink, fontFamily: TEXT, marginBottom: 10, lineHeight: 1.3 }}>{m.title}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {m.items.map((item, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.5 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: CLR.primary, flexShrink: 0, marginTop: 7, opacity: 0.5 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Row 2: MVP-5 ~ MVP-8 */}
          <div
            className={`rv-grid ${devVis ? 'rv-in' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}
          >
            {DEV_MILESTONES.slice(5).map((m, i) => (
              <div key={i} className="rv-card hover-card" style={{ background: CLR.canvas, border: `1px solid ${CLR.hairline}`, borderRadius: 14, padding: '20px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: CLR.primary, fontFamily: TEXT, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{m.stage}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: CLR.ink, fontFamily: TEXT, marginBottom: 10, lineHeight: 1.3 }}>{m.title}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {m.items.map((item, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: CLR.inkMuted48, fontFamily: TEXT, lineHeight: 1.5 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: CLR.primary, flexShrink: 0, marginTop: 7, opacity: 0.5 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ─────────────────────────────────────── */}
      <section style={{ background: CLR.primary, padding: '91px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div
            ref={ctaRevRef}
            className={`rv-up ${ctaVis ? 'rv-in' : ''}`}
          >
            <h2 style={{
              fontSize: 'clamp(22px, 2.9vw, 42px)',
              fontWeight: 700, color: '#ffffff',
              fontFamily: DISPLAY, lineHeight: 1.10,
              letterSpacing: '-0.4px', marginBottom: 16,
              wordBreak: 'keep-all',
            }}>
              복잡한 충전 판단,<br />이제 한 화면에서 시작하세요.
            </h2>
            <p style={{
              fontSize: 12, color: 'rgba(255,255,255,0.80)',
              fontFamily: TEXT, lineHeight: 1.75,
              letterSpacing: '-0.3px', maxWidth: 560, margin: '0 auto 31px',
              wordBreak: 'keep-all',
            }}>
              차량, 배터리, 출발지, 배송지만 입력하면 실제 도로 기반 충전 계획을 바로 확인할 수 있어요.
              ROVIQ가 경로와 배터리를 함께 분석해 더 안전한 EV 배송 운행을 도와드려요.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/mvp-8?start=1" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '13px 28px', borderRadius: 9999, lineHeight: 1,
                textDecoration: 'none', fontSize: 12, fontWeight: 600,
                fontFamily: TEXT, letterSpacing: '-0.374px',
                background: '#ffffff', color: CLR.primary, border: 'none', whiteSpace: 'nowrap',
                boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
                transition: 'transform 0.2s cubic-bezier(.16,1,.3,1), box-shadow 0.2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.28)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.20)' }}
              >
                지금 시작하기
              </Link>
              <button
                onClick={() => scrollToRef(showcaseSectionRef)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '13px 28px', borderRadius: 9999, lineHeight: 1,
                  fontSize: 12, fontWeight: 600,
                  fontFamily: TEXT, letterSpacing: '-0.374px',
                  background: 'transparent', color: '#ffffff',
                  border: '1.5px solid rgba(255,255,255,0.60)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'transform 0.2s cubic-bezier(.16,1,.3,1), background 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = '' }}
              >
                실제 사용 예시 보기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer style={{ background: CLR.parchment, padding: '56px 32px', borderTop: `1px solid ${CLR.hairline}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ fontFamily: TEXT, lineHeight: 1.9 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: CLR.inkMuted80 }}>EV 배송차량 충전 최적화 플랫폼</div>
            <div style={{ fontSize: 14, color: CLR.inkMuted48 }}>실제 도로 경로와 공공 충전소 데이터로 충전 계획을 도와요.</div>
            <div style={{ fontSize: 13, color: CLR.inkMuted48, fontStyle: 'italic', letterSpacing: '0.01em' }}>made by Hoyeon</div>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <Link to="/mvp-8?start=1" style={{ fontSize: 15, color: CLR.primary, fontFamily: TEXT, textDecoration: 'none', fontWeight: 500 }}>지금 시작하기</Link>
            <Link to="/mvp-flow" style={{ fontSize: 15, color: CLR.primary, fontFamily: TEXT, textDecoration: 'none', fontWeight: 500 }}>개발 과정 보기</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
