const rawApiBaseUrl = import.meta.env.VITE_API_URL?.trim() ?? "";
const apiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeApiBaseUrl(value: string) {
  if (!value) {
    return "";
  }

  const url = value.replace(/\/$/, "");

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
}
