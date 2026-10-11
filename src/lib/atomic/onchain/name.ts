/** Conservative .eth name syntax check — shared by client and server code. */
const ENS_NAME_RE = /^[a-z0-9][a-z0-9-]{0,61}(\.[a-z0-9][a-z0-9-]{0,61})*\.eth$/i;

export function isEnsName(value: string): boolean {
  return ENS_NAME_RE.test(value.trim());
}
