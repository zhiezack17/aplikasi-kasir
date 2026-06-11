import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Bearer token as fallback (cookies are primary)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pos_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export function formatRp(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "Rp 0";
  return `Rp ${Number(amount).toLocaleString("id-ID")}`;
}

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(", ");
  if (d?.msg) return d.msg;
  return err?.message || "Terjadi kesalahan";
}
