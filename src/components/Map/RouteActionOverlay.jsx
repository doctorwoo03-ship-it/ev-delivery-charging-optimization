import { FONT } from '../../theme/themes'

function RouteActionOverlay({ state, data, onOpenSocModal, T, themeName, hmi }) {
  if (!state || !data) return null

  const bgColor = themeName === 'dark' ? 'rgba(17,19,23,0.93)' : 'rgba(255,255,255,0.95)'
  const cfgMap = {
    canDeliver:           { color: T.success, icon: '✓', title: '배송 가능' },
    lowMargin:            { color: T.warning, icon: '⚠', title: '배송 가능 · 여유 부족' },
    reserveWarning:       { color: T.warning, icon: '⚡', title: '배송 가능 - 충전 권장' },
    'predeparture-charge':{ color: T.danger,  icon: '!', title: '출발 전 충전 필요' },
    chargeNeeded:         { color: T.warning, icon: '⚡', title: '출발 전 충전 필요' },
    unreachable:          { color: T.danger,  icon: '!', title: '충전소 도달 불가' },
    'api-error':          { color: T.danger,  icon: '!', title: '충전소 정보 재확인 필요' },
    'api-empty':          { color: T.warning, icon: '?', title: '주변 충전소 데이터 없음' },
    'no-local-data':      { color: T.warning, icon: '?', title: '주변 충전소 데이터 없음' },
    critical:             { color: T.warning, icon: '⟳', title: 'SOC 확인 필요' },
    'no-suitable-charger':{ color: T.warning, icon: '⚠', title: '출발지 인근 적합한 충전소 없음' },
    'needs-review':       { color: T.warning, icon: '!', title: '충전 계획 재검토 필요' },
    'review-candidate':   { color: T.warning, icon: '⚠', title: '충전 후보 검토 필요' },
  }
  const cfg = cfgMap[state] ?? { color: T.warning, icon: '!', title: '상태 확인 필요' }

  const fs = hmi?.text ?? {
    caption:    '13px',
    body:       '15px',
    bodyStrong: '17px',
    title:      '19px',
  }
  const touchNormal = hmi?.touch?.normal ?? 48

  const isMidRouteCharge = state === 'chargeNeeded' && data?.insertionType && data.insertionType !== 'before-departure'

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      width: isMidRouteCharge
        ? 'min(clamp(780px, 68vw, 1080px), calc(100% - 32px))'
        : 'min(clamp(660px, 56vw, 920px), calc(100% - 32px))',
      background: bgColor,
      borderRadius: 12,
      border: `1px solid ${cfg.color}45`,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
      fontFamily: FONT,
    }}>
      {/* Status strip */}
      <div style={{
        padding: '8px 16px',
        background: `${cfg.color}18`,
        borderBottom: `1px solid ${cfg.color}28`,
        display: 'flex', alignItems: 'center', gap: 8,
        borderRadius: '12px 12px 0 0',
      }}>
        <span style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: cfg.color, whiteSpace: 'nowrap' }}>
          {cfg.icon}{' '}
          {state === 'chargeNeeded' && data?.insertionLabel
            ? data.insertionLabel
            : (state === 'review-candidate' && data?.hasNearbyReachableCharger)
              ? '출발 전 충전 필요'
              : (state === 'review-candidate' && data?.recommendationSource === 'mid-route')
                ? '경로 중 충전 검토 필요'
                : cfg.title}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 20px 16px' }}>
        {state === 'canDeliver' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Next action */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                다음 배송지
              </div>
              <div style={{ fontSize: fs.title, fontWeight: 600, color: T.text, marginBottom: 4, lineHeight: 1.25 }}>
                {data.nextDeliveryName}
              </div>
              {data.nextSegmentKm > 0 && (
                <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                  {data.nextSegmentKm} km 이동
                </div>
              )}
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Delivery summary */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                전체 배송
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                {data.displayRouteKm} km · {data.deliveryCount}개 배송지
              </div>
              <div style={{ fontSize: fs.body, color: T.success, fontWeight: 500 }}>
                현재 배터리로 완주 가능
              </div>
              {data.estimatedConsumptionKwh != null && (
                <div style={{ fontSize: fs.caption, color: T.textSecondary, marginTop: 3 }}>
                  예상 소비 {data.estimatedConsumptionKwh} kWh
                </div>
              )}
              {data.confidenceLevel && (
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2, color: ({ none: T.textSecondary, low: T.warning, medium: T.accent, high: T.success })[data.confidenceLevel] ?? T.textSecondary }}>
                  {({ none: '데이터 없음', low: '낮은 신뢰도', medium: '보통 신뢰도', high: '높은 신뢰도' })[data.confidenceLevel]}
                </div>
              )}
            </div>
          </div>
        )}

        {state === 'lowMargin' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Next action */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                다음 배송지
              </div>
              <div style={{ fontSize: fs.title, fontWeight: 600, color: T.text, marginBottom: 4, lineHeight: 1.25 }}>
                {data.nextDeliveryName}
              </div>
              {data.nextSegmentKm > 0 && (
                <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                  {data.nextSegmentKm} km 이동
                </div>
              )}
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Battery status: low margin */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 현황
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.warning, marginBottom: 2 }}>
                배송 완료 예상 SOC {data.remainingSocAfterDelivery != null ? `${data.remainingSocAfterDelivery.toFixed(1)}%` : '-'}
              </div>
              <div style={{ fontSize: fs.body, color: T.warning, fontWeight: 600, marginBottom: 3 }}>
                안전 여유 부족
              </div>
              {data.surplusRangeKm > 0.05 && (
                <div style={{ fontSize: fs.caption, color: T.textSecondary }}>
                  남은 주행 여유 +{data.surplusRangeKm.toFixed(1)} km
                </div>
              )}
            </div>
          </div>
        )}

        {state === 'reserveWarning' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Next action */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                다음 배송지
              </div>
              <div style={{ fontSize: fs.title, fontWeight: 600, color: T.text, marginBottom: 4, lineHeight: 1.25 }}>
                {data.nextDeliveryName}
              </div>
              {data.nextSegmentKm > 0 && (
                <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                  {data.nextSegmentKm} km 이동
                </div>
              )}
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Reserve warning: SOC gap */}
            <div style={{ flex: 1, paddingRight: data.recommendedCharger ? 20 : 0 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 현황
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.warning, marginBottom: 2 }}>
                예상 도착 {data.remainingSocAfterDelivery != null ? `${data.remainingSocAfterDelivery.toFixed(1)}%` : '-'}
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, marginBottom: 2 }}>
                안전 하한 SOC {data.userMinReserveSoc ?? 10}%
              </div>
              {data.gap != null && data.gap > 0 && (
                <div style={{ fontSize: fs.caption, color: T.warning, fontWeight: 600 }}>
                  기준보다 {data.gap.toFixed(1)}%p 부족
                </div>
              )}
            </div>

            {/* Optional charger */}
            {data.recommendedCharger && (
              <>
                <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />
                <div style={{ flex: '0 0 auto', minWidth: 140 }}>
                  <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    권장 충전소
                  </div>
                  <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 2, lineHeight: 1.25 }}>
                    {data.recommendedCharger.name}
                  </div>
                  {data.chargerDistKm != null && (
                    <div style={{ fontSize: fs.body, color: T.textSecondary, marginBottom: 3 }}>
                      {data.chargerDistKm} km
                    </div>
                  )}
                  <div style={{ fontSize: fs.caption, color: T.warning, fontWeight: 500 }}>
                    선택 경유 시 여유 확보
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {state === 'predeparture-charge' && (
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {/* Block 1: Current SOC vs threshold */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 현황
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.danger, marginBottom: 2 }}>
                현재 SOC {data.currentSoc ?? '-'}%
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, marginBottom: 2 }}>
                안전 하한 SOC {data.userMinReserveSoc ?? '-'}%
              </div>
              {data.currentSocGap != null && data.currentSocGap > 0 && (
                <div style={{ fontSize: fs.caption, color: T.danger, fontWeight: 600 }}>
                  기준보다 {data.currentSocGap.toFixed(1)}%p 부족
                </div>
              )}
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Action required */}
            <div style={{ flex: 1, paddingRight: data.recommendedCharger ? 20 : 0 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                충전 시점
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.danger, marginBottom: 2 }}>
                출발 전 충전
              </div>
              <div style={{ fontSize: fs.caption, color: T.textSecondary }}>
                현재 배터리가 안전 하한 SOC보다 낮습니다.
              </div>
            </div>

            {/* Block 3: Recommended charger if available */}
            {data.recommendedCharger && (
              <>
                <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />
                <div style={{ flex: '0 0 auto', minWidth: 140 }}>
                  <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    권장 충전소
                  </div>
                  <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 2, lineHeight: 1.25 }}>
                    {data.recommendedCharger.name}
                  </div>
                  {data.chargerDistKm != null && (
                    <div style={{ fontSize: fs.body, color: T.textSecondary, marginBottom: 3 }}>
                      {data.chargerDistKm} km
                    </div>
                  )}
                  <div style={{ fontSize: fs.caption, color: T.danger, fontWeight: 500 }}>
                    출발 전 충전 권장
                  </div>
                </div>
              </>
            )}

            {/* Violation label — full width second row */}
            {data.firstViolationLabel && (
              <div style={{ flex: '1 1 100%', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}30`, fontSize: fs.caption, color: T.danger }}>
                {data.firstViolationLabel}
              </div>
            )}
          </div>
        )}

        {state === 'chargeNeeded' && (
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {/* Block 1: Charger stop */}
            <div style={{ flex: '0 0 auto', minWidth: 180, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                경유 충전소
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 2, lineHeight: 1.25 }}>
                {data.chargerName}
              </div>
              {data.chargerOperator && (
                <div style={{ fontSize: fs.caption, color: T.textSecondary, marginBottom: 2 }}>
                  {data.chargerOperator}
                </div>
              )}
              {data.chargerPricePerKwh != null && (
                <div style={{ fontSize: fs.caption, color: T.text, fontWeight: 600, marginBottom: 3 }}>
                  {data.chargerPricePerKwh.toLocaleString('ko-KR')}원/kWh
                </div>
              )}
              {data.recommendationReason && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                  {data.recommendationReason.split(' · ')
                    .filter(tag => tag !== '대기 정보 미확인')
                    .map(tag => (
                      <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, color: cfg.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {tag}
                      </span>
                    ))}
                </div>
              )}
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                {data.distKm} km 이동
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Charging plan */}
            {data.chargePlan && (
              <div style={{ flex: 1, paddingRight: 20 }}>
                <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  충전 계획
                </div>
                <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                  {data.chargePlan.chargeAmountKwh} kWh · {data.chargePlan.chargeTimeMin}분
                </div>
                <div style={{ fontSize: fs.body, color: T.textSecondary, marginBottom: 2 }}>
                  약 {data.chargePlan.totalExtraCost.toLocaleString('ko-KR')}원
                </div>
                {data.deliverySuccessPct != null && (
                  <div style={{ fontSize: fs.caption, color: T.success, fontWeight: 600, marginTop: 4 }}>
                    배송 성공 {data.deliverySuccessPct}%
                  </div>
                )}
                {data.confidenceLevel && (
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2, color: ({ none: T.textSecondary, low: T.warning, medium: T.accent, high: T.success })[data.confidenceLevel] ?? T.textSecondary }}>
                    {({ none: '데이터 없음', low: '낮은 신뢰도', medium: '보통 신뢰도', high: '높은 신뢰도' })[data.confidenceLevel]}
                  </div>
                )}
              </div>
            )}

            {data.chargePlan && (
              <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />
            )}

            {/* Block 3: Delivery feasibility */}
            {data.chargePlan && (
              <div style={{ flex: '0 0 auto', minWidth: 150 }}>
                <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  충전 후 배송
                </div>
                {data.remainingSocAfterDelivery != null && (
                  <div style={{ fontSize: fs.caption, color: T.danger, fontWeight: 600, marginBottom: 5 }}>
                    충전 없이 배송 완료 예상 SOC {data.remainingSocAfterDelivery.toFixed(1)}%
                  </div>
                )}
                <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.success, marginBottom: 2 }}>
                  충전 후 배송 완료 예상 SOC {(data.chargePlan.finalDeliverySOC ?? data.chargePlan.targetSoc)}%
                </div>
                <div style={{ fontSize: fs.caption, color: T.success, fontWeight: 500 }}>
                  안전 하한 SOC 기준 충족
                </div>
              </div>
            )}
            {data.firstViolationLabel && (
              <div style={{ flex: '1 1 100%', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}30`, fontSize: fs.caption, color: T.textSecondary }}>
                안전 하한 SOC 위반 구간: {data.firstViolationLabel}
              </div>
            )}
            {isMidRouteCharge && (
              <div style={{ flex: '1 1 100%', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}30`, fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.65 }}>
                현재 배터리로 앞 배송지는 가능하지만, 다음 구간에서 안전 하한 SOC 아래로 떨어질 수 있어 중간 충전을 권장해요.
              </div>
            )}
          </div>
        )}

        {state === 'unreachable' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Block 1: Problem */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                충전소까지 거리
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.danger, marginBottom: 3 }}>
                {data.chargerDistKm != null ? `${data.chargerDistKm} km 필요` : '충전소 정보 없음'}
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                주행 가능 {data.drivableKm ?? '-'} km
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Shortage */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                부족 거리
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.danger, marginBottom: 3 }}>
                {data.shortageKm != null
                  ? `${data.shortageKm} km 부족`
                  : '안전 여유 부족'}
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                현재 SOC {data.currentSoc ?? '-'}%
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 3: Next action */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                다음 액션
              </div>
              <button
                onClick={onOpenSocModal}
                style={{
                  padding: '0 20px', borderRadius: 6, border: 'none',
                  background: T.accent, color: '#fff',
                  fontSize: fs.body, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  minHeight: touchNormal, marginBottom: 4,
                  display: 'block', width: '100%',
                }}
              >
                SOC 수정
              </button>
              <div style={{ fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.4 }}>
                배터리 조정 또는<br/>더 가까운 충전소 필요
              </div>
            </div>
          </div>
        )}

        {state === 'critical' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Block 1: Checking status — temporary state, not a confirmed error */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <svg width={12} height={12} viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                  <circle cx={6} cy={6} r={4.5} fill="none" stroke={`${T.warning}40`} strokeWidth={2} />
                  <path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6" fill="none" stroke={T.warning} strokeWidth={2} strokeLinecap="round" />
                </svg>
                <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  확인 중…
                </div>
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.warning, marginBottom: 3 }}>
                충전소 도달 가능 여부 확인 중
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, lineHeight: 1.4 }}>
                배터리 상태와 충전소 접근<br/>가능성을 확인하고 있습니다
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Battery status */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 상태
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                {data.drivableKm ?? '-'} km 주행 가능
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                현재 SOC {data.currentSoc ?? '-'}%
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 3: Next action */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                다음 액션
              </div>
              <button
                onClick={onOpenSocModal}
                style={{
                  padding: '0 20px', borderRadius: 6, border: 'none',
                  background: T.accent, color: '#fff',
                  fontSize: fs.body, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  minHeight: touchNormal, marginBottom: 4,
                  display: 'block', width: '100%',
                }}
              >
                배터리 수정
              </button>
              <div style={{ fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.4 }}>
                SOC 재설정 후<br/>다시 확인하세요
              </div>
            </div>
          </div>
        )}

        {state === 'api-error' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Block 1: Driver action */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                조치 필요
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.danger, marginBottom: 3 }}>
                충전소 최신 정보 재확인 필요
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, lineHeight: 1.4 }}>
                현재 확인 가능한 충전소<br/>정보가 없습니다
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Battery status */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 상태
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                {data.drivableKm ?? '-'} km 주행 가능
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                현재 SOC {data.currentSoc ?? '-'}%
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 3: Guidance */}
            <div style={{ flex: '0 0 auto', minWidth: 130 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                안내
              </div>
              <div style={{ fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.5 }}>
                충전소 다시 조회 후<br/>정보를 확인하세요.<br/>배송 경로는 정상 표시됩니다.
              </div>
            </div>
          </div>
        )}

        {state === 'api-empty' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Block 1: Situation */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                현재 상황
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.warning, marginBottom: 3 }}>
                표시 가능한 실시간 충전소 없음
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, lineHeight: 1.4 }}>
                출발지 주변에 API로<br/>확인된 충전소가 없습니다
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Battery status */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 상태
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                {data.drivableKm ?? '-'} km 주행 가능
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                현재 SOC {data.currentSoc ?? '-'}%
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 3: Guidance */}
            <div style={{ flex: '0 0 auto', minWidth: 130 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                안내
              </div>
              <div style={{ fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.5 }}>
                배송 경로는 정상 표시됩니다.<br/>다른 출발지 또는 더 넓은<br/>조회 범위에서 다시 확인하세요.
              </div>
            </div>
          </div>
        )}

        {state === 'no-local-data' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Block 1: Situation */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                현재 상황
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.warning, marginBottom: 3 }}>
                주변 충전소 데이터 없음
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, lineHeight: 1.4 }}>
                현재 위치 주변에 충전소<br/>데이터가 없습니다
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Battery status */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                배터리 상태
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                {data.drivableKm ?? '-'} km 주행 가능
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                현재 SOC {data.currentSoc ?? '-'}%
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 3: Guidance */}
            <div style={{ flex: '0 0 auto', minWidth: 130 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                안내
              </div>
              <div style={{ fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.5 }}>
                배송 경로는 정상 표시됩니다.
              </div>
            </div>
          </div>
        )}

        {state === 'no-suitable-charger' && (
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Block 1: Situation */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                현재 상황
              </div>
              <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.warning, marginBottom: 3 }}>
                출발지 3km 이내 적합 후보 없음
              </div>
              <div style={{ fontSize: fs.body, color: T.textSecondary, lineHeight: 1.4 }}>
                출발지 3km 이내에<br/>바로 권장할 수 있는 충전소가 없습니다.
              </div>
            </div>

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 2: Nearest rejected candidate (if any) */}
            {data?.nearestRejectedDepartureCharger ? (
              <div style={{ flex: 1, paddingRight: 20 }}>
                <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  가장 가까운 후보
                </div>
                <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 2, lineHeight: 1.25 }}>
                  {data.nearestRejectedDepartureChargerName}
                </div>
                <div style={{ fontSize: fs.body, color: T.textSecondary, marginBottom: 4 }}>
                  {data.nearestRejectedDepartureDistanceKm} km
                </div>
                <div style={{ fontSize: fs.caption, color: T.warning, lineHeight: 1.4 }}>
                  출발 전 위치와 이용 가능 여부를<br/>직접 확인하세요.
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, paddingRight: 20 }}>
                <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  검토 결과
                </div>
                {data?.insertionLabel && (
                  <div style={{ fontSize: fs.body, color: T.text, fontWeight: 500, marginBottom: 3, lineHeight: 1.3 }}>
                    {data.insertionLabel}
                  </div>
                )}
                <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                  현재 SOC {data?.currentSoc ?? '-'}%
                </div>
                <div style={{ fontSize: fs.caption, color: T.textSecondary }}>
                  주행 가능 {data?.drivableKm ?? '-'} km
                </div>
              </div>
            )}

            <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

            {/* Block 3: Guidance */}
            <div style={{ flex: '0 0 auto', minWidth: 130 }}>
              <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                안내
              </div>
              <div style={{ fontSize: fs.caption, color: T.textSecondary, lineHeight: 1.5 }}>
                다른 출발 지점이나<br/>충전 시점을 검토하세요.
              </div>
            </div>
          </div>
        )}

        {state === 'review-candidate' && (() => {
          const isMidRoute = data?.recommendationSource === 'mid-route'
          const hasDetour = data?.detourKm != null && data.detourKm > 0
          const guidanceText = isMidRoute && hasDetour
            ? '경로 중 우회 거리가 있어 위치 확인이 필요합니다.'
            : '충전소 위치를 지도에서 직접 확인하세요.'
          const situationText = isMidRoute
            ? '경로 중 충전 검토 필요'
            : data?.hasNearbyReachableCharger
              ? '출발 전 가까운 후보 있음'
              : '출발 전 충전 검토 필요'
          const timingText = data?.insertionExplanation
            ?? (data?.hasNearbyReachableCharger ? '출발 전 충전 필요' : '충전 시점 검토 필요')
          return (
            <div>
              <div style={{ display: 'flex', gap: 0 }}>
                {/* Column 1: Current situation */}
                <div style={{ flex: 1, paddingRight: 20 }}>
                  <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    현재 상황
                  </div>
                  <div style={{ fontSize: fs.body, fontWeight: 600, color: T.warning, lineHeight: 1.35 }}>
                    {situationText}
                  </div>
                </div>

                <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

                {/* Column 2: Charging timing — primary emphasis */}
                <div style={{ flex: 1, paddingRight: 20 }}>
                  <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    충전 시점
                  </div>
                  <div style={{ fontSize: fs.bodyStrong, fontWeight: 700, color: cfg.color, lineHeight: 1.25 }}>
                    {timingText}
                  </div>
                </div>

                <div style={{ width: 1, background: `${T.border}60`, alignSelf: 'stretch', marginRight: 20 }} />

                {/* Column 3: Candidate charger */}
                <div style={{ flex: '0 0 auto', minWidth: 130 }}>
                  <div style={{ fontSize: fs.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    후보 충전소
                  </div>
                  {data?.chargerName && (
                    <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 2, lineHeight: 1.25 }}>
                      {data.chargerName}
                    </div>
                  )}
                  {isMidRoute && hasDetour && (
                    <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                      우회 {data.detourKm.toFixed(1)} km
                    </div>
                  )}
                  {!isMidRoute && data?.originToChargerKm != null && (
                    <div style={{ fontSize: fs.body, color: T.textSecondary }}>
                      약 {data.originToChargerKm} km
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary guidance */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}30`, fontSize: fs.caption, color: T.textSecondary }}>
                {guidanceText}
              </div>
            </div>
          )
        })()}

        {/* Fallback for unknown states */}
        {!cfgMap[state] && state && (
          <div style={{ fontSize: fs.body, color: T.textSecondary }}>
            상태를 확인하는 중입니다.
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteActionOverlay
