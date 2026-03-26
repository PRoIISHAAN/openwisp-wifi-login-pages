const DEFAULT_CAPTIVE_PORTAL_API_TIMEOUT = 2;

const isValidTimeout = (value) => Number.isFinite(value) && value > 0;

const getTimeout = (timeout) =>
  isValidTimeout(timeout) ? timeout : DEFAULT_CAPTIVE_PORTAL_API_TIMEOUT;

const getCaptivePortalLoginRequired = async (captivePortalApi = {}) => {
  const {enabled = false, url, timeout} = captivePortalApi;
  if (!enabled || !url || typeof fetch !== "function") {
    return null;
  }

  const timeoutSeconds = getTimeout(Number(timeout));
  let timeoutId;
  let controller;

  try {
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/captive+json, application/json",
      },
      ...(controller && {signal: controller.signal}),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || typeof data.captive !== "boolean") {
      return null;
    }

    return data.captive;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default getCaptivePortalLoginRequired;
