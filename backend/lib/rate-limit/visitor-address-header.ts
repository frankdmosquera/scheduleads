// Backend: the header Railway's proxy names the visitor in, trusted in production only, by our
// own limits (visitor-address.ts) and by Better Auth's (auth-server.ts) alike.

export const VISITOR_ADDRESS_HEADER = "x-real-ip";
