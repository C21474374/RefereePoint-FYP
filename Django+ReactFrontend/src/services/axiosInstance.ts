import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:8000/api",
});

// Add token automatically to every request
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access"); // your JWT access token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default axiosInstance;