const isIpAddressHost = (host: string) => {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":");
};

export const extractTenantIdFromHost = (host: string): string => {
  const normalizedHost = host.trim().toLowerCase();

  if (!normalizedHost || normalizedHost === "localhost" || isIpAddressHost(normalizedHost)) {
    return "";
  }

  if (normalizedHost.endsWith(".localhost")) {
    const subdomain = normalizedHost.slice(0, -".localhost".length);
    if (!subdomain || subdomain === "www") {
      return "";
    }

    return subdomain.split(".")[0] || "";
  }

  const parts = normalizedHost.split(".");
  if (parts.length >= 3 && parts[0] !== "www") {
    return parts[0];
  }

  return "";
};

export const getTenantIdFromBrowserHost = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  return extractTenantIdFromHost(window.location.hostname);
};
