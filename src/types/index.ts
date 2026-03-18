export interface Project {
  id: string;
  name: string;
  address?: string;
  status: 'active' | 'completed' | 'on-hold' | 'archived';
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  detail: string;
  type: 'Subcontractor' | 'Vendor' | 'Consultant';
  contact: string;
  email: string;
  phone: string;
}

export interface Contract {
  id: string;
  project_id: string;
  date: string;
  name: string;
  amount: number;
  type: 'Contract' | 'Change Order' | 'Credit';
  vendor_id?: string;
}

export type PaymentCategory = 'subcontractor' | 'materials' | 'soft_costs' | 'field_labor';

export interface Payment {
  id: string;
  project_id: string;
  date: string;
  name: string;
  amount: number;
  category: PaymentCategory;
  form: string;
  check_number?: string;
  vendor_id?: string;
  external_id?: string;
  source?: string;
}

export interface BudgetItem {
  id: string;
  project_id: string;
  category: string;
  description: string;
  labor: number;
  material: number;
  optional: number;
  subcontractor: string;
  notes: string;
  status: 'complete' | 'contracted' | 'proposed' | 'estimated';
}

export interface Draw {
  id: string;
  project_id: string;
  date: string;
  draw_number: number;
  amount: number;
}

// COI Types
export type COIStatus = 'valid' | 'expiring' | 'expired';

export interface CoverageProvision {
  name: string;
  status: 'included' | 'excluded' | 'unknown';
  details?: string;
}

export interface GLPolicy {
  policyNumber: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  coverageLimit: string;
  perOccurrenceLimit: string;
  aggregateLimit: string;
  provisions: CoverageProvision[];
}

export interface WCPolicy {
  policyNumber: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  status: COIStatus;
  daysUntilExpiry: number;
}

export interface UmbrellaPolicy {
  policyNumber: string;
  carrier: string;
  limit: string;
  effectiveDate: string;
  expirationDate: string;
}

export interface COI {
  id: string;
  project_id: string;
  vendor_id?: string;
  insured_name: string;
  company: string;
  policyNumber: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  status: COIStatus;
  daysUntilExpiry: number;
  glPolicy?: GLPolicy;
  wcPolicy?: WCPolicy;
  umbrellaPolicy?: UmbrellaPolicy;
  additional_insured?: string;
  certificate_holder?: string;
  is_active?: boolean;
  contact_email1?: string;
  contact_email2?: string;
}

export function getStatusFromDays(days: number): COIStatus {
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}
