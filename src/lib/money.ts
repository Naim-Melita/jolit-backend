export function toMoney(value: number | string | { toString(): string }) {
  return Number(value.toString()).toFixed(2);
}
