import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { devices } from "./devices.js";

export const cameraLinks = pgTable(
  "camera_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    cameraId: uuid("camera_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    linkedDeviceId: uuid("linked_device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    linkType: text("link_type").notNull(),
    priority: integer("priority").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.cameraId, t.linkedDeviceId, t.linkType)],
);
