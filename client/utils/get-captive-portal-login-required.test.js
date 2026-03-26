import getCaptivePortalLoginRequired from "./get-captive-portal-login-required";

describe("getCaptivePortalLoginRequired", () => {
  let originalFetch;
  let originalAbortController;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAbortController = global.AbortController;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.AbortController = originalAbortController;
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("should return null when disabled", async () => {
    global.fetch = jest.fn();
    const result = await getCaptivePortalLoginRequired({
      enabled: false,
      url: "https://portal.example.com/.well-known/captive-portal",
      timeout: 2,
    });

    expect(result).toBe(null);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should return captive status from API response", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({captive: false}),
      }),
    );

    const result = await getCaptivePortalLoginRequired({
      enabled: true,
      url: "https://portal.example.com/.well-known/captive-portal",
      timeout: 2,
    });

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://portal.example.com/.well-known/captive-portal",
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/captive+json, application/json",
        },
      }),
    );
  });

  it("should return null on non-success status", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: false}));

    const result = await getCaptivePortalLoginRequired({
      enabled: true,
      url: "https://portal.example.com/.well-known/captive-portal",
      timeout: 2,
    });

    expect(result).toBe(null);
  });

  it("should return null on malformed JSON payload", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({status: "ok"}),
      }),
    );

    const result = await getCaptivePortalLoginRequired({
      enabled: true,
      url: "https://portal.example.com/.well-known/captive-portal",
      timeout: 2,
    });

    expect(result).toBe(null);
  });

  it("should return null when request times out", async () => {
    jest.useFakeTimers();
    const listeners = [];
    const abort = jest.fn(() => {
      listeners.forEach((listener) => listener());
    });

    global.AbortController = jest.fn(() => ({
      abort,
      signal: {
        addEventListener: (event, callback) => {
          if (event === "abort") {
            listeners.push(callback);
          }
        },
      },
    }));

    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
        }),
    );

    const promise = getCaptivePortalLoginRequired({
      enabled: true,
      url: "https://portal.example.com/.well-known/captive-portal",
      timeout: 2,
    });

    jest.advanceTimersByTime(2000);

    const result = await promise;
    expect(result).toBe(null);
    expect(abort).toHaveBeenCalledTimes(1);
  });
});
