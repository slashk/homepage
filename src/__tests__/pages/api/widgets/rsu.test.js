import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getSettings, cachedRequest, logger } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  cachedRequest: vi.fn(),
  logger: { debug: vi.fn() },
}));

vi.mock("utils/config/config", () => ({
  getSettings,
}));

vi.mock("utils/proxy/http", () => ({
  cachedRequest,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

import handler from "pages/api/widgets/rsu";

describe("pages/api/widgets/rsu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when symbol is missing", async () => {
    const res = createMockRes();
    await handler({ query: { shares: "100", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("symbol");
  });

  it("returns 400 when shares is missing", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("shares");
  });

  it("returns 400 when provider is missing", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("provider");
  });

  it("returns 400 for invalid provider", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "nope" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Invalid provider");
  });

  it("returns 400 for non-positive shares", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "0", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Invalid shares");
  });

  it("returns 400 when API key is not configured", async () => {
    getSettings.mockReturnValueOnce({ providers: {} });
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("API Key");
  });

  it("tolerates missing providers config", async () => {
    getSettings.mockReturnValueOnce({});
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("API Key");
  });

  it("returns totalValue as price multiplied by shares", async () => {
    getSettings.mockReturnValueOnce({ providers: { finnhub: "testkey" } });
    cachedRequest.mockResolvedValueOnce({ c: 150.25, dp: 1.5 });

    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "finnhub", cache: "1" } }, res);

    expect(cachedRequest).toHaveBeenCalledWith("https://finnhub.io/api/v1/quote?symbol=AAPL&token=testkey", "1");
    expect(res.body).toEqual({ symbol: "AAPL", totalValue: 15025 });
  });

  it("returns totalValue null when Finnhub returns null price", async () => {
    getSettings.mockReturnValueOnce({ providers: { finnhub: "testkey" } });
    cachedRequest.mockResolvedValueOnce({ c: null, dp: null });

    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "50", provider: "finnhub" } }, res);

    expect(res.body).toEqual({ symbol: "AAPL", totalValue: null });
  });
});
