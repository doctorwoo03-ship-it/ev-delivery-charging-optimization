// Mock user driving profiles.
// In a future MVP these will be persisted in a database and updated from real driving records.
// For now they serve as architecture placeholders for the personalized efficiency model.
//
// confidenceLevel reflects how reliable the efficiency estimates are:
//   'none'   — no real driving data, default vehicle spec only
//   'low'    — fewer than 10 samples, use with caution
//   'medium' — 10–29 samples, reasonable estimate
//   'high'   — 30+ samples, reliable personalized estimate

export const USER_DRIVING_PROFILES = [
  {
    userId: 'demo-driver-001',
    vehicleId: 'porter2',
    cityEfficiencyKmPerKwh: 3.1,
    highwayEfficiencyKmPerKwh: 3.8,
    mixedEfficiencyKmPerKwh: 3.4,
    sampleCount: 12,
    confidenceLevel: 'low',
    lastUpdated: '2026-05-20T09:00:00.000Z',
  },
  {
    userId: 'demo-driver-002',
    vehicleId: 'porter2',
    cityEfficiencyKmPerKwh: 2.9,
    highwayEfficiencyKmPerKwh: 3.6,
    mixedEfficiencyKmPerKwh: 3.2,
    sampleCount: 47,
    confidenceLevel: 'high',
    lastUpdated: '2026-06-01T14:30:00.000Z',
  },
  {
    userId: 'demo-driver-003',
    vehicleId: 'bongo3',
    cityEfficiencyKmPerKwh: null,
    highwayEfficiencyKmPerKwh: null,
    mixedEfficiencyKmPerKwh: null,
    sampleCount: 0,
    confidenceLevel: 'none',
    lastUpdated: null,
  },
]
