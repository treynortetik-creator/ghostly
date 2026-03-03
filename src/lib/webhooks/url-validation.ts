/**
 * SSRF protection for webhook destinations.
 * Blocks localhost, private/reserved networks, and cloud metadata endpoints.
 */

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();

  if (lower === '::1') return true; // loopback
  if (lower === '::') return true; // unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true; // link-local fe80::/10
  }

  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4MappedMatch) {
    const [, a, b] = v4MappedMatch.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 127 ||
      a === 0
    ) {
      return true;
    }
  }

  return false;
}

export function getUnsafeWebhookUrlReason(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'url must be a valid URL';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Webhook URL must use http or https';
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    return 'Webhook URL must not point to localhost';
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0 ||
      a === 127
    ) {
      return 'Webhook URL must not point to a private/reserved IP';
    }
  }

  const bareHost = hostname.replace(/^\[|\]$/g, '');
  if (isPrivateIPv6(bareHost)) {
    return 'Webhook URL must not point to a private/reserved IP';
  }

  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Webhook URL must not point to cloud metadata services';
  }

  return null;
}
