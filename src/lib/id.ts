import { ulid } from "ulid";

export function newId(): string {
  return ulid();
}

export function newToken(): string {
  return ulid();
}
