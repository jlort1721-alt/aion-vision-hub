import { z } from 'zod';

export const emailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const attachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1), // base64
  contentType: z.string().min(1),
});

// ── Send generic email ──────────────────────────────────
export const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1).max(998),
  html: z.string().optional(),
  text: z.string().optional(),
  replyTo: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// ── Send event alert ────────────────────────────────────
export const sendEventAlertSchema = z.object({
  to: z.array(z.string().email()).min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  eventType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  deviceName: z.string().optional(),
  siteName: z.string().optional(),
  timestamp: z.string().optional(),
  snapshotUrl: z.string().url().optional(),
});

export type SendEventAlertInput = z.infer<typeof sendEventAlertSchema>;

// ── Send incident report ────────────────────────────────
export const sendIncidentReportSchema = z.object({
  to: z.array(z.string().email()).min(1),
  incidentId: z.string().uuid(),
  title: z.string().min(1),
  status: z.string().min(1),
  priority: z.string().min(1),
  summary: z.string().min(1),
  assignedTo: z.string().optional(),
  eventsCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().optional(),
});

export type SendIncidentReportInput = z.infer<typeof sendIncidentReportSchema>;

// ── Send periodic report ────────────────────────────────
export const sendPeriodicReportSchema = z.object({
  to: z.array(z.string().email()).min(1),
  reportName: z.string().min(1),
  period: z.string().min(1),
  totalEvents: z.number().int().nonnegative(),
  criticalEvents: z.number().int().nonnegative(),
  activeIncidents: z.number().int().nonnegative(),
  devicesOnline: z.number().int().nonnegative(),
  devicesTotal: z.number().int().nonnegative(),
  topEventTypes: z.array(z.object({ type: z.string(), count: z.number() })).default([]),
});

export type SendPeriodicReportInput = z.infer<typeof sendPeriodicReportSchema>;

// ── Send evidence package ───────────────────────────────
export const sendEvidencePackageSchema = z.object({
  to: z.array(z.string().email()).min(1),
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  deviceName: z.string().min(1),
  siteName: z.string().min(1),
  timestamp: z.string().optional(),
  recipientName: z.string().optional(),
  exportedBy: z.string().min(1),
  attachments: z.array(attachmentSchema).optional(),
});

export type SendEvidencePackageInput = z.infer<typeof sendEvidencePackageSchema>;

// ── Test connection ─────────────────────────────────────
export const testConnectionSchema = z.object({
  to: z.string().email().optional(),
});

export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
