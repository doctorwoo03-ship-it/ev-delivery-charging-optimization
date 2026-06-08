import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  health: () => apiClient.get('/health'),
  deliveries: {
    list: () => apiClient.get('/deliveries'),
    create: (data) => apiClient.post('/deliveries', data),
    update: (id, data) => apiClient.put(`/deliveries/${id}`, data),
    delete: (id) => apiClient.delete(`/deliveries/${id}`),
  },
  vehicles: {
    list: () => apiClient.get('/vehicles'),
    getLocation: (vehicleId) => apiClient.get(`/vehicles/${vehicleId}/location`),
  },
  stations: {
    list: () => apiClient.get('/stations'),
    recommendations: (vehicleId) => apiClient.get(`/recommendations/${vehicleId}`),
  },
  battery: {
    getSoC: (vehicleId) => apiClient.get(`/battery/${vehicleId}/soc`),
  },
}

export default apiClient
