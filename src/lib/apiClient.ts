// Centralized API Client for Kalpanaaa HRMS Java Spring Boot Backend

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).env?.VITE_API_BASE_URL) {
    return (window as any).env.VITE_API_BASE_URL;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
};

const API_BASE_URL = getBaseUrl();

export function getAuthToken(): string | null {
  return localStorage.getItem('kalpanaaa_jwt_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('kalpanaaa_jwt_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('kalpanaaa_jwt_token');
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      removeAuthToken();
      // Safe fallback redirect if unauthenticated
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.message) errorMessage = errJson.message;
      } catch (e) {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 24) return {} as T; // 204 No Content

    return await response.json();
  } catch (error) {
    console.warn(`API Request Error [${endpoint}]:`, error);
    throw error;
  }
}
