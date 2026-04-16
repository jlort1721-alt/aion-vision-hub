import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { devices } from "./devices.js";
import { profiles } from "./users.js";

export const liveRecordings = pgTable("live_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  cameraId: uuid("camera_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  startedBy: uuid("started_by")
    .notNull()
    .references(() => profiles.id),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSec: integer("duration_sec"),
  storageUrl: text("storage_url"),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
