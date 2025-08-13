// Quick type assertion helpers for deployment fix
export const asString = (value: unknown): string => value as string;
export const asNumber = (value: unknown): number => value as number;
export const asDate = (value: unknown): Date => new Date(value as string | number);
export const asAny = (value: unknown): any => value as any;

// Common data type helpers
export function safeParseDate(value: unknown): Date {
  if (!value) return new Date();
  return new Date(value as string | number);
}

export function safeGetString(value: unknown): string {
  return (value as string) || '';
}

export function safeGetNumber(value: unknown): number {
  return (value as number) || 0;
}

export function safeGetArray<T = any>(value: unknown): T[] {
  return (value as T[]) || [];
}