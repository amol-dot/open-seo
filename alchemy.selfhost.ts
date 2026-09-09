// Self-host-only deploy inputs read from .env.selfhost: the custom hostname(s)
// the Worker serves and the region hint for D1/R2. Kept beside
// alchemy.access.ts so alchemy.run.ts stays the stage wiring alone.

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { z } from "zod";

// D1 primary-location / R2 location hints Cloudflare accepts. Fixed at
// creation: changing the value later replaces the database.
export const LOCATION_HINTS = [
  "wnam",
  "enam",
  "weur",
  "eeur",
  "apac",
  "oc",
] as const;
export type LocationHint = (typeof LOCATION_HINTS)[number];

const optionalVar = (name: string) =>
  Config.string(name).pipe(
    Config.withDefault(""),
    Config.map((value) => value.trim()),
  );

/**
 * SELFHOST_DOMAIN, comma-separated hostnames. Each must sit on a zone in the
 * deploying Cloudflare account; alchemy infers the zone from the hostname.
 * When set, the Worker's workers.dev URL is switched off so the Access-gated
 * hostname is the only entry point.
 */
export const readSelfHostDomains = () =>
  optionalVar("SELFHOST_DOMAIN").pipe(
    Config.map((value) =>
      value
        .split(",")
        .map((hostname) => hostname.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

/**
 * SELFHOST_LOCATION_HINT: where D1 keeps the primary copy and R2 stores
 * objects. Optional; Cloudflare otherwise places them near wherever the
 * deploy runs from.
 */
export const readSelfHostLocationHint = () =>
  Effect.gen(function* () {
    const value = yield* optionalVar("SELFHOST_LOCATION_HINT");
    if (!value) return undefined;
    const parsed = z.enum(LOCATION_HINTS).safeParse(value);
    if (!parsed.success) {
      return yield* Effect.die(
        new Error(
          `SELFHOST_LOCATION_HINT must be one of ${LOCATION_HINTS.join(", ")} (got "${value}").`,
        ),
      );
    }
    return parsed.data;
  });
