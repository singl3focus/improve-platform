import {
  MATERIAL_TYPE_TO_UNIT,
  type MaterialType,
  type MaterialUnit
} from "./materials-library-types";

export function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function parseNonNegativeInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function resolveUnitByType(type: MaterialType): MaterialUnit {
  return MATERIAL_TYPE_TO_UNIT[type];
}

export function computeProgressPercent(totalAmount: number, completedAmount: number): number {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(completedAmount)) {
    return 0;
  }

  const boundedCompleted = Math.min(Math.max(completedAmount, 0), totalAmount);
  return normalizeProgressPercent((boundedCompleted / totalAmount) * 100);
}

export function normalizeProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 100) {
    return 100;
  }

  return rounded;
}
