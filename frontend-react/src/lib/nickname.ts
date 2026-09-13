import { z } from "zod";

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

/**
 * A nickname is a single lowercase word — no spaces, nothing but letters,
 * digits and underscores. The backend enforces the same shape when it receives
 * one; checking it here too lets the form answer before a round trip.
 */
export const NicknameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(NICKNAME_MIN_LENGTH)
  .max(NICKNAME_MAX_LENGTH)
  .regex(/^[a-z0-9_]+$/);

/**
 * Drops the characters a nickname may not hold as they are typed, so the field
 * never contains something the schema would reject on submit. Accents are
 * folded rather than dropped — a Portuguese player typing "joão" should end up
 * with "joao", not "joo".
 */
export function normalizeNickname(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, NICKNAME_MAX_LENGTH);
}
