import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
  },
  journals: {
    list: '/journals',
    create: '/journals',
    get: (id: string) => `/journals/${id}`,
    update: (id: string) => `/journals/${id}`,
    delete: (id: string) => `/journals/${id}`,
  },
  entries: {
    list: (journalId: string) => `/journals/${journalId}/entries`,
    create: (journalId: string) => `/journals/${journalId}/entries`,
    get: (journalId: string, entryId: string) => `/journals/${journalId}/entries/${entryId}`,
    update: (journalId: string, entryId: string) => `/journals/${journalId}/entries/${entryId}`,
    delete: (journalId: string, entryId: string) => `/journals/${journalId}/entries/${entryId}`,
  },
};

// API methods
export const apiService = {
  // Auth methods
  login: (credentials: { email: string; password: string }) =>
    api.post(endpoints.auth.login, credentials),
  register: (userData: { email: string; password: string; name: string }) =>
    api.post(endpoints.auth.register, userData),
  logout: () => api.post(endpoints.auth.logout),

  // Journal methods
  getJournals: () => api.get(endpoints.journals.list),
  createJournal: (data: { title: string; description?: string }) =>
    api.post(endpoints.journals.create, data),
  getJournal: (id: string) => api.get(endpoints.journals.get(id)),
  updateJournal: (id: string, data: { title?: string; description?: string }) =>
    api.put(endpoints.journals.update(id), data),
  deleteJournal: (id: string) => api.delete(endpoints.journals.delete(id)),

  // Entry methods
  getEntries: (journalId: string) => api.get(endpoints.entries.list(journalId)),
  createEntry: (journalId: string, data: { title: string; content: string }) =>
    api.post(endpoints.entries.create(journalId), data),
  getEntry: (journalId: string, entryId: string) =>
    api.get(endpoints.entries.get(journalId, entryId)),
  updateEntry: (
    journalId: string,
    entryId: string,
    data: { title?: string; content?: string }
  ) => api.put(endpoints.entries.update(journalId, entryId), data),
  deleteEntry: (journalId: string, entryId: string) =>
    api.delete(endpoints.entries.delete(journalId, entryId)),
};

export default api; 