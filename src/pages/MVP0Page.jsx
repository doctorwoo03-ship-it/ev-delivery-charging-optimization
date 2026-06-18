import { useEffect, useRef, useState } from 'react'

function MVP0Page() {
  const mapContainer = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY

    if (!apiKey) {
      setStatus('error')
      return
    }

    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`
    script.async = true

    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) {
        setStatus('error')
        return
      }
      window.kakao.maps.load(() => {
        const center = new window.kakao.maps.LatLng(37.4979, 127.0276)
        const map = new window.kakao.maps.Map(mapContainer.current, {
          center,
          level: 3,
        })
        const marker = new window.kakao.maps.Marker({ position: center, map })
        const infoWindow = new window.kakao.maps.InfoWindow({
          content: '<div style="padding:8px;font-size:14px;">강남역 테스트 위치</div>',
        })
        window.kakao.maps.event.addListener(marker, 'click', () => {
          infoWindow.open(map, marker)
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
      <h2 className="page-title">Kakao Map 테스트</h2>
      <p className="description">EV 배송차량 충전 스케줄 추천 시스템의 지도 연동 테스트 화면입니다.</p>
      {status === 'loading' && (
        <p className="loading-message">지도를 불러오는 중입니다...</p>
      )}
      {status === 'error' && (
        <p className="error-message">
          Kakao Map을 불러오지 못했습니다. API 키와 도메인 설정을 확인해주세요.
        </p>
      )}
      <div
        ref={mapContainer}
        className="map-container"
        style={{ display: status === 'error' ? 'none' : 'block' }}
      />
    </>
  )
}

export default MVP0Page
