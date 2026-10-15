export const CONFIG = {
  brandName: 'Echo Sim',
  userName: 'Olivia',
  userInitials: 'O',
  apiEndpoint: 'http://localhost:4000/api/chat',
  useMock: import.meta.env.VITE_USE_MOCK !== 'false', // defaults to true in dev if not set
};
