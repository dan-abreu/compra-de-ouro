const isIpAddressHost = (host: string) => {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":");
};

export const extractTenantIdFromHost = (host: string): string | null => {
  const normalizedHost = host.trim().toLowerCase();

  if (!normalizedHost || normalizedHost === "localhost" || isIpAddressHost(normalizedHost)) {
    return null;
  }

  if (normalizedHost.endsWith(".localhost")) {
    const subdomain = normalizedHost.slice(0, -".localhost".length);
    if (!subdomain || subdomain === "www") {
      return null;
    }

    return subdomain.split(".")[0] || null;
  }

  const parts = normalizedHost.split(".");
  if (parts.length >= 3 && parts[0] !== "www") {
    return parts[0];
  }

  return null;
};