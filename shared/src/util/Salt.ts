export function generateBytes12Salt() {
  const rand = Math.round(Math.random() * Number.MAX_SAFE_INTEGER).toString(16);
  const salt = `0x${rand}000000000000000000000000`.slice(0, 26);
  return salt as `0x${string}`;
}
