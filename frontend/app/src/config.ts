export const APP_NAME = 'Karma';

export const CONFIG = {
  brandName: APP_NAME,
  userName: 'Shiva',
  userInitials: 'S',
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || '/api/chat',
  useMock: import.meta.env.VITE_USE_MOCK === 'true', // real backend by default
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1061393811883-deqf9vd8itiq7p4uk2c6e8q5hci15d39.apps.googleusercontent.com',
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23liVWZlxSKjEY2RjI',
};
