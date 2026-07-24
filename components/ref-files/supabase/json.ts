import type { Json } from "./database.types";

export type JsonObject = { [key: string]: Json | undefined };

export function isJsonObject(
  value: Json | null | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonArray(value: Json | null | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

export function jsonObject(value: Json | null | undefined): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("JSON numbers must be finite.");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJson);
  }

  if (typeof value === "object") {
    const result: JsonObject = {};

    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        result[key] = toJson(child);
      }
    }

    return result;
  }

  throw new TypeError(`Unsupported JSON value: ${typeof value}`);
}
