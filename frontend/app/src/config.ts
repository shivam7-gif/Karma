export const APP_NAME = 'Karma';

export const CONFIG = {
  brandName: APP_NAME,
  userName: 'Shiva',
  userInitials: 'S',
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || '/api/chat',
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
};

/** Origin for REST calls. Empty string uses same-origin (Vite proxy in local dev). */
export function getApiBase(): string {
  const endpoint = CONFIG.apiEndpoint || '/api/chat';
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint.replace(/\/api\/chat\/?$/, '');
  }
  return '';
}
