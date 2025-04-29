import { AxiosInstance } from 'axios';

export interface Endpoints {
  auth: {
    login: string;
    register: string;
    logout: string;
  };
  journals: {
    list: string;
    create: string;
    get: (id: string) => string;
    update: (id: string) => string;
    delete: (id: string) => string;
  };
  entries: {
    list: (journalId: string) => string;
    create: (journalId: string) => string;
    get: (journalId: string, entryId: string) => string;
    update: (journalId: string, entryId: string) => string;
    delete: (journalId: string, entryId: string) => string;
  };
}

export interface ApiService {
  login: (credentials: { email: string; password: string }) => Promise<any>;
  register: (userData: { email: string; password: string; name: string }) => Promise<any>;
  logout: () => Promise<any>;
  getJournals: () => Promise<any>;
  createJournal: (data: { title: string; description?: string }) => Promise<any>;
  getJournal: (id: string) => Promise<any>;
  updateJournal: (id: string, data: { title?: string; description?: string }) => Promise<any>;
  deleteJournal: (id: string) => Promise<any>;
  getEntries: (journalId: string) => Promise<any>;
  createEntry: (journalId: string, data: { title: string; content: string }) => Promise<any>;
  getEntry: (journalId: string, entryId: string) => Promise<any>;
  updateEntry: (journalId: string, entryId: string, data: { title?: string; content?: string }) => Promise<any>;
  deleteEntry: (journalId: string, entryId: string) => Promise<any>;
}

declare const api: AxiosInstance;
export const endpoints: Endpoints;
export const apiService: ApiService;
export default api; 