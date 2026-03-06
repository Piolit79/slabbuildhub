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
