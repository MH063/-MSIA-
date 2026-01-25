import axios from 'axios';

const host = window.location.hostname;

const api = axios.create({
  baseURL: `http://${host}:4000/api`,
});

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
}

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
