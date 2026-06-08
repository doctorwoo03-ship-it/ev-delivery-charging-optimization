import { useState, useMemo } from 'react'
import { BRANDS, VEHICLES } from '../data/vehicleData'

const EMPTY_CUSTOM = {
  name: '',
  batteryCapacityKwh: '',
  maxRangeKm: '',
  efficiencyKmPerKwh: '',
}

function BatteryBar({ percent }) {
  const color = percent >= 30 ? '#22c55e' : '#ef4444'
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 8, height: 14, overflow: 'hidden', margin: '6px 0' }}>
      <div
        style={{
          width: `${percent}%`,
          background: color,
          height: '100%',
          borderRadius: 8,
          transition: 'width 0.3s',
        }}
      />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
    </div>
  )
}

function ResultCard({ label, value, unit, color }) {
  return (
    <div style={{
      flex: 1,
      background: '#f8fafc',
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: '18px 16px',
      textAlign: 'center',
      minWidth: 130,
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{unit}</div>
    </div>
  )
}

function BrandCard({ brand, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: selected ? '2px solid #3b82f6' : '2px solid #e2e8f0',
        background: selected ? '#eff6ff' : '#fff',
        borderRadius: 10,
        padding: '12px 8px',
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: selected ? '#3b82f6' : '#f1f5f9',
        color: selected ? '#fff' : '#475569',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: brand.logoText.length > 3 ? 9 : brand.logoText.length > 1 ? 11 : 16,
        fontWeight: 700,
        margin: '0 auto 8px',
        letterSpacing: '-0.5px',
        transition: 'background 0.15s, color 0.15s',
      }}>
        {brand.logoText}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: selected ? 700 : 400,
        color: selected ? '#1d4ed8' : '#374151',
      }}>
        {brand.name}
      </div>
    </div>
  )
}

export default function MVP3Page() {
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [custom, setCustom] = useState(EMPTY_CUSTOM)
  const [soc, setSoc] = useState(80)

  const isCustomBrand = selectedBrand === 'custom'

  const filteredVehicles = useMemo(() => {
    if (!selectedBrand || isCustomBrand) return []
    const brandName = BRANDS.find((b) => b.id === selectedBrand)?.name
    return VEHICLES.filter((v) => v.brand === brandName)
  }, [selectedBrand, isCustomBrand])

  const vehicle = useMemo(() => {
    if (!selectedBrand) return null
    if (isCustomBrand) {
      const capacity = parseFloat(custom.batteryCapacityKwh) || 0
      const range = parseFloat(custom.maxRangeKm) || 0
      const enteredEff = parseFloat(custom.efficiencyKmPerKwh)
      const efficiency =
        enteredEff > 0
          ? enteredEff
          : capacity > 0 && range > 0
          ? parseFloat((range / capacity).toFixed(1))
          : 0
      return {
        id: 'custom',
        fullName: custom.name || '커스텀 차량',
        grade: '직접 입력',
        batteryCapacityKwh: capacity,
        maxRangeKm: range,
        efficiencyKmPerKwh: efficiency,
      }
    }
    if (!selectedId) return null
    return VEHICLES.find((v) => v.id === selectedId) ?? null
  }, [selectedBrand, isCustomBrand, selectedId, custom])

  const isReady =
    vehicle &&
    vehicle.batteryCapacityKwh > 0 &&
    vehicle.efficiencyKmPerKwh > 0

  const showSocSection =
    vehicle && (isCustomBrand ? vehicle.batteryCapacityKwh > 0 : true)

  const remainingKwh = isReady
    ? ((vehicle.batteryCapacityKwh * soc) / 100).toFixed(1)
    : null
  const estimatedRangeKm = isReady
    ? (parseFloat(remainingKwh) * vehicle.efficiencyKmPerKwh).toFixed(1)
    : null

  function handleBrandChange(brandId) {
    setSelectedBrand(brandId)
    setSelectedId('')
    setCustom(EMPTY_CUSTOM)
  }

  function handleCustomChange(field, value) {
    setCustom((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>MVP-3: 배터리 SOC 계산</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        차량을 선택하고 현재 배터리 잔량을 입력하면 남은 주행 가능 거리를 자동으로 계산합니다.
      </p>

      {/* 1단계: 브랜드 선택 */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>
          1단계: 브랜드 선택
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
          gap: 10,
        }}>
          {BRANDS.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              selected={selectedBrand === brand.id}
              onClick={() => handleBrandChange(brand.id)}
            />
          ))}
        </div>
      </section>

      {/* 2단계: 차량 선택 (커스텀 제외) */}
      {selectedBrand && !isCustomBrand && (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>
            2단계: 차량 선택
          </h3>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 15,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="">-- 차량을 선택하세요 --</option>
            {filteredVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* 2단계: 커스텀 차량 입력 */}
      {isCustomBrand && (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>
            2단계: 차량 정보 입력
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={labelStyle}>
              차량명
              <input
                type="text"
                placeholder="예) 테슬라 세미"
                value={custom.name}
                onChange={(e) => handleCustomChange('name', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              배터리 용량 (kWh)
              <input
                type="number"
                min="1"
                placeholder="예) 100"
                value={custom.batteryCapacityKwh}
                onChange={(e) => handleCustomChange('batteryCapacityKwh', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              1회 충전 주행거리 (km)
              <input
                type="number"
                min="1"
                placeholder="예) 300"
                value={custom.maxRangeKm}
                onChange={(e) => handleCustomChange('maxRangeKm', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              전비 (km/kWh) — 미입력 시 자동 계산
              <input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="예) 3.5"
                value={custom.efficiencyKmPerKwh}
                onChange={(e) => handleCustomChange('efficiencyKmPerKwh', e.target.value)}
                style={inputStyle}
              />
            </label>
            {custom.batteryCapacityKwh && custom.maxRangeKm && !custom.efficiencyKmPerKwh && (
              <div style={{ fontSize: 12, color: '#3b82f6', padding: '6px 10px', background: '#eff6ff', borderRadius: 6 }}>
                자동 계산된 전비: {(parseFloat(custom.maxRangeKm) / parseFloat(custom.batteryCapacityKwh)).toFixed(1)} km/kWh
              </div>
            )}
          </div>
        </section>
      )}

      {/* 차량 정보 카드 (프리셋 차량만) */}
      {vehicle && !isCustomBrand && (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>차량 정보</h3>
          <InfoRow label="차량명" value={vehicle.fullName} />
          <InfoRow label="차량 등급" value={vehicle.grade} />
          <InfoRow label="배터리 용량" value={`${vehicle.batteryCapacityKwh} kWh`} />
          <InfoRow label="1회 충전 주행거리" value={`${vehicle.maxRangeKm} km`} />
          <InfoRow label="전비" value={`${vehicle.efficiencyKmPerKwh.toFixed(1)} km/kWh`} />
        </section>
      )}

      {/* 현재 배터리 입력 */}
      {showSocSection && (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>현재 배터리 잔량</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <input
              type="range"
              min="0"
              max="100"
              value={soc}
              onChange={(e) => setSoc(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min="0"
                max="100"
                value={soc}
                onChange={(e) => setSoc(Math.min(100, Math.max(0, Number(e.target.value))))}
                style={{ width: 60, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, textAlign: 'center' }}
              />
              <span style={{ fontSize: 15, color: '#475569' }}>%</span>
            </div>
          </div>
          <BatteryBar percent={soc} />
          <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: soc >= 30 ? '#22c55e' : '#ef4444' }}>
            {soc >= 30 ? '충분' : '충전 필요'}
          </div>
        </section>
      )}

      {/* 계산 결과 */}
      {isReady && (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#1e293b' }}>계산 결과</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ResultCard label="남은 배터리 용량" value={remainingKwh} unit="kWh" color="#3b82f6" />
            <ResultCard label="전비" value={vehicle.efficiencyKmPerKwh.toFixed(1)} unit="km/kWh" color="#8b5cf6" />
            <ResultCard label="예상 주행 가능 거리" value={estimatedRangeKm} unit="km" color="#22c55e" />
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 13, color: '#475569', lineHeight: 1.9 }}>
            <strong>계산식</strong><br />
            남은 배터리 = {vehicle.batteryCapacityKwh} kWh × {soc}% ÷ 100 = <strong>{remainingKwh} kWh</strong><br />
            예상 거리 = {remainingKwh} kWh × {vehicle.efficiencyKmPerKwh.toFixed(1)} km/kWh = <strong>{estimatedRangeKm} km</strong>
          </div>
        </section>
      )}

      {/* 초기 안내 */}
      {!selectedBrand && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 24 }}>
          위에서 브랜드를 선택하면 차량 선택이 시작됩니다.
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 13,
  color: '#475569',
  fontWeight: 500,
}

const inputStyle = {
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  background: '#fff',
}
