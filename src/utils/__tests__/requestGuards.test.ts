// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isLocalRequest, REMOTE_ADDR_HEADER } from "../requestGuards";

function createRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("isLocalRequest", () => {
  it("trusts a loopback socket header even with a foreign Host", () => {
    expect(
      isLocalRequest(createRequest({ [REMOTE_ADDR_HEADER]: "127.0.0.1", host: "example.com" }))
    ).toBe(true);
  });

  it("accepts IPv6 and mapped IPv4 loopback socket addresses", () => {
    expect(isLocalRequest(createRequest({ [REMOTE_ADDR_HEADER]: "::1" }))).toBe(true);
    expect(isLocalRequest(createRequest({ [REMOTE_ADDR_HEADER]: "::ffff:127.0.0.1" }))).toBe(true);
  });

  it("rejects a non-loopback socket header even with localhost Host", () => {
    expect(
      isLocalRequest(createRequest({ [REMOTE_ADDR_HEADER]: "192.168.1.50", host: "localhost:3000" }))
    ).toBe(false);
  });

  it("falls back to the Host header when no socket header is present", () => {
    expect(isLocalRequest(createRequest({ host: "localhost:3000" }))).toBe(true);
    expect(isLocalRequest(createRequest({ host: "127.0.0.1:3000" }))).toBe(true);
    expect(isLocalRequest(createRequest({ host: "192.168.1.10:3000" }))).toBe(false);
    expect(isLocalRequest(createRequest({ host: "example.com" }))).toBe(false);
  });

  it("rejects fallback requests carrying forwarding headers", () => {
    expect(
      isLocalRequest(createRequest({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1" }))
    ).toBe(false);
    expect(
      isLocalRequest(createRequest({ host: "localhost:3000", "x-real-ip": "127.0.0.1" }))
    ).toBe(false);
  });
});
