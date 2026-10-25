const PRIVATE_KEY_HEADER =
  /-----BEGIN ((?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?)PRIVATE KEY-----/;

export function redactGeneric(value: string, prefixLength = 4, suffixLength = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= prefixLength + suffixLength + 2) {
    return "****";
  }
  return `${trimmed.slice(0, prefixLength)}****${trimmed.slice(-suffixLength)}`;
}

export function redactPrivateKey(value: string): string {
  const match = PRIVATE_KEY_HEADER.exec(value);
  if (!match) {
    return "-----BEGIN PRIVATE KEY-----****";
  }
  return `-----BEGIN ${match[1] ?? ""}PRIVATE KEY-----****`;
}

export function redactUrl(value: string): string {
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  if (!scheme) {
    return redactGeneric(value);
  }
  return `${scheme[1]?.toLowerCase() ?? "url"}://****`;
}

export function redactBearer(value: string): string {
  return `Bearer ${redactGeneric(value)}`;
}

export function redactLabeled(label: string, value: string): string {
  return `${label}=${redactGeneric(value)}`;
}
