import { BOOLEAN_TYPE, OBJECT_TYPE, STRING_TYPE } from "./type-names";

export const isBoolean = (value: unknown): value is boolean => typeof value === BOOLEAN_TYPE;

export const isString = (value: unknown): value is string => typeof value === STRING_TYPE;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === OBJECT_TYPE && value !== null && !Array.isArray(value);
