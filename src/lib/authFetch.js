import { API_BASE_URL } from "./api";

const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
    if (url && url.startsWith(API_BASE_URL)) {
      const token = localStorage.getItem("auth_token");
      if (token) {
        const req = new Request(input, init);
        if (!req.headers.has("Authorization")) req.headers.set("Authorization", "Bearer " + token);
        return nativeFetch(req);
      }
    }
  } catch (e) { /* fall through to plain fetch */ }
  return nativeFetch(input, init);
};
