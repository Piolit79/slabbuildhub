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
  fileUrl?: string;
}

export interface UmbrellaPolicy {
  policyNumber: string;
  carrier: string;
  limit: string;
  effectiveDate: string;
  expirationDate: string;
}

export interface WCPolicy {
  policyNumber: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  status: COIStatus;
  daysUntilExpiry: number;
}

export interface COI {
  id: string;
  subcontractor: string;
  company: string;
  // GL / COI fields
  policyNumber: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  status: COIStatus;
  daysUntilExpiry: number;
  glPolicy?: GLPolicy;
  // Workers' Comp
  wcPolicy?: WCPolicy;
  // Umbrella
  umbrellaPolicy?: UmbrellaPolicy;
  // File paths
  gl_policy_file_path?: string | null;
  coi_file_path?: string | null;
  additional_insured?: string;
  certificate_holder?: string;
  description_of_operations?: string;
  is_active?: boolean;
  contact_email1?: string;
  contact_email2?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  address: string;
  status: 'active' | 'completed' | 'on-hold';
  coiCount: number;
  expiringCount: number;
  expiredCount: number;
  cois: COI[];
  createdAt: string;
}

export function getStatusFromDays(days: number): COIStatus {
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}
