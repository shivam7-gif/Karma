export const CONFIG = {
  brandName: 'Karma',
  userName: 'Shiva',
  userInitials: 'S',
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || 'https://karma-ai-vf5p.onrender.com/api/chat',
  useMock: import.meta.env.VITE_USE_MOCK !== 'false', // defaults to true if not set
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1061393811883-deqf9vd8itiq7p4uk2c6e8q5hci15d39.apps.googleusercontent.com',
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23liVWZlxSKjEY2RjI',
};
