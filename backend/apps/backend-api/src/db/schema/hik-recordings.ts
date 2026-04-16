import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { devices } from "./devices.js";

export const hikRecordings = pgTable(
  "hik_recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    channel: integer("channel").notNull().default(1),
    fileName: text("file_name").notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    fileType: text("file_type").default("video"),
    downloadStatus: text("download_status").default("pending"),
    localPath: text("local_path"),
    requestedBy: uuid("requested_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_hik_rec_device_time").on(
      table.deviceId,
      table.startTime,
      table.endTime,
    ),
    index("idx_hik_rec_tenant").on(table.tenantId),
  ],
);
