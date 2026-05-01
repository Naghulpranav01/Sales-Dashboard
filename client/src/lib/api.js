const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

export function getToken() {
  return localStorage.getItem("sales_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("sales_token", token);
  else localStorage.removeItem("sales_token");
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || "Request failed.");
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function uploadDataset({ file, displayName }) {
  const form = new FormData();
  form.append("file", file);
  if (displayName) form.append("displayName", displayName);
  return api("/datasets/upload", { method: "POST", body: form });
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}
