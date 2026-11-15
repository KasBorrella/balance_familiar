export function parseMoney(input: string): number {
  const value = input.trim().replace(/\s|€/g, "");
  if (!/^-?\d{1,10}([,.]\d{1,2})?$/.test(value))
    throw new Error("Usa un importe como 130,50, sin separadores de miles.");
  const negative = value.startsWith("-");
  const [whole, decimal = ""] = value.replace("-", "").split(/[,.]/);
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 999_999_999_999)
    throw new Error("Importe demasiado grande.");
  return negative ? -result : result;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const moneyInput = (cents: number) =>
  `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, "0")}`;
export function sum(values: number[]) {
  const result = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(result))
    throw new Error("El total supera el límite de cálculo seguro.");
  return result;
}
export function monthlyProvision(target: number, months: number) {
  if (!Number.isInteger(months) || months <= 0)
    throw new Error("Plazo inválido");
  return Math.ceil(target / months);
}
