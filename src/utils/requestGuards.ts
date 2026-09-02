import { NextRequest } from "next/server";

/**
 * Shared guard for routes that must only be reachable from the local machine
 * (file-system access, native dialogs, process execution).
 *
 * The dev server binds to 0.0.0.0 (see server.js), so every API route is
 * reachable from the LAN. Header-only checks (Host / X-Forwarded-For) are
 * client-controlled and cannot be trusted on their own.
 *
 * Primary signal: the custom server (server.js) strips any client-supplied
 * copy of REMOTE_ADDR_HEADER and re-sets it from the TCP socket, which a
 * remote client cannot spoof. When the app is run via plain `next dev` /
 * `next start` (no custom server), we fall back to a conservative heuristic:
 * the Host header must be loopback AND no forwarding headers may be present
 * (their presence means an unverifiable proxy sits in front).
 */

export const REMOTE_ADDR_HEADER = "x-node-banana-remote-addr";

const LOOPBACK_ADDRS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
]);

export function isLocalRequest(request: NextRequest): boolean {
  const socketAddr = request.headers.get(REMOTE_ADDR_HEADER);
  if (socketAddr) {
    return LOOPBACK_ADDRS.has(socketAddr);
  }

  // Fallback path: no authoritative socket info available.
  if (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")) {
    return false;
  }
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

