function VehiclePanel({ vehicle, recommendation }) {
  const batteryColor =
    vehicle.batteryPercent <= vehicle.minSafePercent
      ? '#e74c3c'
      : vehicle.batteryPercent <= 50
      ? '#f39c12'
      : '#27ae60'

  return (
    <aside className="panel">
      <section className="panel-section">
        <h2 className="panel-title">차량 상태</h2>
        <div className="vehicle-info">
          <div className="info-row">
            <span className="info-label">차량명</span>
            <span className="info-value">{vehicle.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">현재 배터리</span>
            <span className="info-value">{vehicle.batteryPercent}%</span>
          </div>
          <div className="battery-bar-wrap">
            <div
              className="battery-bar"
              style={{ width: `${vehicle.batteryPercent}%`, backgroundColor: batteryColor }}
            />
          </div>
          <div className="info-row">
            <span className="info-label">배터리 용량</span>
            <span className="info-value">{vehicle.batteryCapacityKwh}kWh</span>
          </div>
          <div className="info-row">
            <span className="info-label">최소 안전 배터리</span>
            <span className="info-value">{vehicle.minSafePercent}%</span>
          </div>
          <div className="info-row">
            <span className="info-label">충전 필요 여부</span>
            <span className={vehicle.needsCharge ? 'badge badge-charge' : 'badge badge-ok'}>
              {vehicle.needsCharge ? '필요' : '불필요'}
            </span>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">추천 충전소</h2>
        <div className="recommendation-card">
          <div className="rec-name">{recommendation.stationName}</div>
          <div className="rec-row">
            <span className="rec-label">거리</span>
            <span>{recommendation.distance}</span>
          </div>
          <div className="rec-row">
            <span className="rec-label">충전 속도</span>
            <span>{recommendation.speed}</span>
          </div>
          <p className="rec-reason">{recommendation.reason}</p>
        </div>
      </section>
    </aside>
  )
}

export default VehiclePanel
