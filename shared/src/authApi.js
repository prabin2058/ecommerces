import api from "./apiClient.js";

const d = (p) => p.then((r) => r.data);

export const authApi = {
  login: (body) => d(api.post("/auth/login", body)),
  verify2fa: (body) => d(api.post("/auth/2fa/verify", body)),
  register: (body) => d(api.post("/auth/register", body)),
  me: () => d(api.get("/auth/me")),
  logout: () => d(api.post("/auth/logout")),
  setup2fa: () => d(api.post("/auth/2fa/setup")),
  confirm2fa: (code) => d(api.post("/auth/2fa/confirm", { code })),
  forgot: (email) => d(api.post("/auth/forgot-password", { email })),
};
