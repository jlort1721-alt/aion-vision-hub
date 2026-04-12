import {
  pgSchema,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  customType,
  bigserial,
  index,
  uniqueIndex,
  inet,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const reverse = pgSchema("reverse");

export const reverseDevices = reverse.table(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendor: text("vendor").notNull(),
    deviceId: text("device_id").notNull(),
    siteId: uuid("site_id"),
    displayName: text("display_name"),
    channelCount: integer("channel_count").default(1),
    credentialsEnc: jsonb("credentials_enc").default({}),
    usernameEnc: bytea("username_enc"),
    passwordEnc: bytea("password_enc"),
    isupKeyEnc: bytea("isup_key_enc"),
    status: text("status").notNull().default("online"),
    firstSeenAt: timestamp("first_seen_at", {
      withTimezone: true,
    }).defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
  },
  (t) => ({
    vendorDeviceUnique: uniqueIndex("devices_vendor_device_id_key").on(
      t.vendor,
      t.deviceId,
    ),
    statusIdx: index("devices_status_idx").on(t.status),
  }),
);

export const reverseSessions = reverse.table(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    devicePk: uuid("device_pk")
      .notNull()
      .references(() => reverseDevices.id, { onDelete: "cascade" }),
    remoteAddr: inet("remote_addr").notNull(),
    state: text("state").notNull().default("online"),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
    firmware: text("firmware"),
    sdkVersion: text("sdk_version"),
    capabilities: jsonb("capabilities").default({}),
  },
  (t) => ({
    deviceStateIdx: index("sessions_device_state_idx").on(t.devicePk, t.state),
  }),
);

export const reverseStreams = reverse.table(
  "streams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => reverseSessions.id, { onDelete: "cascade" }),
    channel: integer("channel").notNull(),
    go2rtcName: text("go2rtc_name").notNull(),
    codec: text("codec"),
    resolution: text("resolution"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  },
  (t) => ({
    nameUnique: uniqueIndex("streams_go2rtc_name_key").on(t.go2rtcName),
    sessionIdx: index("streams_session_idx").on(t.sessionId),
  }),
);

export const reverseEvents = reverse.table(
  "events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    devicePk: uuid("device_pk")
      .notNull()
      .references(() => reverseDevices.id, { onDelete: "cascade" }),
    channel: integer("channel"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    deviceTimeIdx: index("events_device_time_idx").on(t.devicePk, t.createdAt),
    kindTimeIdx: index("events_kind_time_idx").on(t.kind, t.createdAt),
  }),
);

export const reverseAuditLog = reverse.table("audit_log", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
