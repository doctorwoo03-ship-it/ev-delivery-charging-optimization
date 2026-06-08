export const vehicle = {
  name: 'EV Van 01',
  batteryPercent: 45,
  batteryCapacityKwh: 58,
  minSafePercent: 20,
  needsCharge: true,
}

export const depot = {
  name: '출발지 (강남역)',
  lat: 37.4979,
  lng: 127.0276,
}

export const deliveries = [
  { id: 1, name: '배송지 1 - 선릉역', lat: 37.5045, lng: 127.0490 },
  { id: 2, name: '배송지 2 - 역삼역', lat: 37.5001, lng: 127.0369 },
  { id: 3, name: '배송지 3 - 교대역', lat: 37.4937, lng: 127.0140 },
  { id: 4, name: '배송지 4 - 양재역', lat: 37.4845, lng: 127.0343 },
  { id: 5, name: '배송지 5 - 매봉역', lat: 37.4891, lng: 127.0540 },
]

export const chargingStations = [
  {
    id: 1,
    name: '강남 충전소',
    lat: 37.5013,
    lng: 127.0247,
    speed: '완속 (7kW)',
    ports: 2,
    recommended: false,
  },
  {
    id: 2,
    name: '서초 충전소',
    lat: 37.4836,
    lng: 127.0324,
    speed: '완속 (7kW)',
    ports: 1,
    recommended: false,
  },
  {
    id: 3,
    name: '역삼 충전소',
    lat: 37.4999,
    lng: 127.0396,
    speed: '급속 (50kW)',
    ports: 3,
    recommended: true,
  },
]

export const recommendation = {
  stationName: '역삼 충전소',
  distance: '0.8km',
  speed: '급속 (50kW)',
  reason: '현재 위치에서 가장 가깝고 급속 충전이 가능합니다.',
}
