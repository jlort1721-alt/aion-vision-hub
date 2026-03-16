import { z } from 'zod';

export const CreateContractInput = z.object({
  siteId: z.string().uuid().optional(),
  contractNumber: z.string().min(1).max(64),
  clientName: z.string().min(1).max(255),
  clientDocument: z.string().max(64).optional(),
  clientEmail: z.string().email().max(255).optional(),
  clientPhone: z.string().max(32).optional(),
  type: z.enum(['monthly', 'annual', 'one_time', 'project']).default('monthly'),
  status: z.enum(['draft', 'active', 'suspended', 'terminated', 'expired']).default('draft'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  monthlyAmount: z.string().default('0'),
  currency: z.string().max(3).default('COP'),
  services: z.array(z.object({ name: z.string(), qty: z.number().optional(), unitPrice: z.string().optional() }).passthrough()).default([]),
  paymentTerms: z.enum(['net_15', 'net_30', 'net_60', 'immediate']).default('net_30'),
  autoRenew: z.boolean().default(false),
  notes: z.string().optional(),
});

export const UpdateContractInput = CreateContractInput.partial();

export const ContractFilters = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const CreateInvoiceInput = z.object({
  contractId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(64),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'credited']).default('draft'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  subtotal: z.string().default('0'),
  taxRate: z.string().default('19'),
  currency: z.string().max(3).default('COP'),
  lineItems: z.array(z.object({ description: z.string(), qty: z.number().optional(), unitPrice: z.string().optional(), total: z.string().optional() }).passthrough()).default([]),
  notes: z.string().optional(),
});

export const UpdateInvoiceInput = CreateInvoiceInput.partial();

export const InvoiceFilters = z.object({
  status: z.string().optional(),
  contractId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const MarkPaidInput = z.object({
  paymentMethod: z.string().max(32),
  paymentReference: z.string().max(128).optional(),
  paidAmount: z.string(),
});

export type CreateContractInput = z.infer<typeof CreateContractInput>;
export type UpdateContractInput = z.infer<typeof UpdateContractInput>;
export type ContractFilters = z.infer<typeof ContractFilters>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInput>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceInput>;
export type InvoiceFilters = z.infer<typeof InvoiceFilters>;
export type MarkPaidInput = z.infer<typeof MarkPaidInput>;
