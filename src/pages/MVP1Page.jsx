import { useEffect, useRef, useState } from 'react'
import VehiclePanel from '../components/VehiclePanel'
import { vehicle, depot, deliveries, chargingStations, recommendation } from '../data/sampleData'

function MVP1Page() {
  const mapContainer = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY

    if (!apiKey) {
      setStatus('error')
      return
    }

    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`
    script.async = true

    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) {
        setStatus('error')
        return
      }
      window.kakao.maps.load(() => {
        const center = new window.kakao.maps.LatLng(depot.lat, depot.lng)
        const map = new window.kakao.maps.Map(mapContainer.current, {
          center,
          level: 5,
        })

        const infoWindow = new window.kakao.maps.InfoWindow({ removable: true })

        // 출발지 마커
        const depotMarker = new window.kakao.maps.Marker({ position: center, map })
        window.kakao.maps.event.addListener(depotMarker, 'click', () => {
          infoWindow.setContent(`<div style="padding:8px;font-size:13px;">${depot.name}</div>`)
          infoWindow.open(map, depotMarker)
        })

        // 배송지 마커 (번호 표시)
        deliveries.forEach((d, i) => {
          const pos = new window.kakao.maps.LatLng(d.lat, d.lng)
          const el = document.createElement('div')
          el.className = 'custom-marker marker-delivery'
          el.textContent = `${i + 1}`
          el.addEventListener('click', () => {
            infoWindow.setContent(`<div style="padding:8px;font-size:13px;">${d.name}</div>`)
            infoWindow.setPosition(pos)
            infoWindow.open(map)
          })
          new window.kakao.maps.CustomOverlay({
            position: pos,
            content: el,
            yAnchor: 1,
          }).setMap(map)
        })

        // 충전소 마커
        chargingStations.forEach((s) => {
          const pos = new window.kakao.maps.LatLng(s.lat, s.lng)
          const el = document.createElement('div')
          el.className = `custom-marker ${s.recommended ? 'marker-recommended' : 'marker-station'}`
          el.textContent = '충'
          el.addEventListener('click', () => {
            const recLabel = s.recommended ? ' ★ 추천' : ''
            infoWindow.setContent(
              `<div style="padding:8px;font-size:13px;">${s.name}${recLabel}<br>${s.speed} · ${s.ports}포트</div>`
            )
            infoWindow.setPosition(pos)
            infoWindow.open(map)
          })
          new window.kakao.maps.CustomOverlay({
            position: pos,
            content: el,
            yAnchor: 1,
          }).setMap(map)
        })

        setStatus('ready')
      })
    }

    script.onerror = () => setStatus('error')
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  return (
    <>
      {status === 'loading' && (
        <p className="loading-message">지도를 불러오는 중입니다...</p>
      )}
      {status === 'error' && (
        <p className="error-message">
          Kakao Map을 불러오지 못했습니다. API 키와 도메인 설정을 확인해주세요.
        </p>
      )}
      <div className="dashboard" style={{ display: status === 'error' ? 'none' : 'flex' }}>
        <VehiclePanel vehicle={vehicle} recommendation={recommendation} />
        <div className="map-section">
          <div ref={mapContainer} className="map-container" />
          <div className="map-legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#e74c3c' }} />
              출발지
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#3498db' }} />
              배송지
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#27ae60' }} />
              충전소
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#FFD700', border: '1px solid #e6ac00' }} />
              추천 충전소
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

export default MVP1Page
