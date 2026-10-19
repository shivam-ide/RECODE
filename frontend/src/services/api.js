/**
 * Re:Code Frontend API Client & Configuration
 * Provides relative baseURL for Vite proxy forwarding or direct backend resolution.
 */
import { API_BASE_URL, getApiBaseUrl } from '../config/api';

export { API_BASE_URL, getApiBaseUrl };

export const API_V1_BASE = API_BASE_URL ? `${API_BASE_URL}/api/v1` : '/api/v1';

export const API = {
  baseURL: API_V1_BASE,
  async post(endpoint, data = {}, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_V1_BASE}${cleanEndpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: JSON.stringify(data),
      ...options,
    });
    return response;
  },
  async get(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_V1_BASE}${cleanEndpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(options.headers || {}),
      },
      ...options,
    });
    return response;
  },
};

export default API;
