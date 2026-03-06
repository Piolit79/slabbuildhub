import { Project, Vendor, Contract, Payment, BudgetItem, Draw } from '@/types';

export const mockProjects: Project[] = [
  { id: '1', name: 'ASD Backyard, LLC', address: '123 Main St', status: 'active', created_at: '2024-01-15' },
  { id: '2', name: 'Riverside Renovation', address: '456 Oak Ave', status: 'active', created_at: '2024-03-01' },
];

export const mockVendors: Vendor[] = [
  { id: '1', name: 'Smith Plumbing', detail: 'Plumbing', type: 'Subcontractor', contact: 'John Smith', email: 'john@smithplumb.com', phone: '555-0101' },
  { id: '2', name: 'Elite Electric', detail: 'Electrical', type: 'Subcontractor', contact: 'Sarah Lee', email: 'sarah@eliteelec.com', phone: '555-0102' },
  { id: '3', name: 'Concrete Kings', detail: 'Concrete & Flatwork', type: 'Subcontractor', contact: 'Mike Torres', email: 'mike@concretekings.com', phone: '555-0103' },
  { id: '4', name: 'HD Supply', detail: 'Building Materials', type: 'Vendor', contact: 'Front Desk', email: 'orders@hdsupply.com', phone: '555-0201' },
  { id: '5', name: 'ABC Lumber', detail: 'Lumber & Framing', type: 'Vendor', contact: 'Tom Brown', email: 'tom@abclumber.com', phone: '555-0202' },
  { id: '6', name: 'Design Studio Pro', detail: 'Architecture & Design', type: 'Consultant', contact: 'Ana Rivera', email: 'ana@designstudio.com', phone: '555-0301' },
];

export const mockContracts: Contract[] = [
  { id: '1', project_id: '1', date: '2024-01-20', name: 'Smith Plumbing', amount: 45000, type: 'Contract', vendor_id: '1' },
  { id: '2', project_id: '1', date: '2024-01-22', name: 'Elite Electric', amount: 38000, type: 'Contract', vendor_id: '2' },
  { id: '3', project_id: '1', date: '2024-02-10', name: 'Concrete Kings', amount: 62000, type: 'Contract', vendor_id: '3' },
  { id: '4', project_id: '1', date: '2024-03-15', name: 'Smith Plumbing', amount: 5500, type: 'Change Order', vendor_id: '1' },
  { id: '5', project_id: '1', date: '2024-04-01', name: 'Elite Electric', amount: -2000, type: 'Credit', vendor_id: '2' },
  { id: '6', project_id: '1', date: '2024-02-05', name: 'Design Studio Pro', amount: 15000, type: 'Contract', vendor_id: '6' },
];

export const mockPayments: Payment[] = [
  { id: '1', project_id: '1', date: '2024-02-01', name: 'Smith Plumbing', amount: 15000, category: 'subcontractor', form: 'Check', check_number: '1001', vendor_id: '1' },
  { id: '2', project_id: '1', date: '2024-02-15', name: 'Elite Electric', amount: 12000, category: 'subcontractor', form: 'Check', check_number: '1002', vendor_id: '2' },
  { id: '3', project_id: '1', date: '2024-03-01', name: 'Concrete Kings', amount: 25000, category: 'subcontractor', form: 'ACH', vendor_id: '3' },
  { id: '4', project_id: '1', date: '2024-02-10', name: 'HD Supply', amount: 8500, category: 'materials', form: 'Credit Card', vendor_id: '4' },
  { id: '5', project_id: '1', date: '2024-03-05', name: 'ABC Lumber', amount: 12300, category: 'materials', form: 'Check', check_number: '1003', vendor_id: '5' },
  { id: '6', project_id: '1', date: '2024-02-20', name: 'Permit Fees', amount: 3200, category: 'soft_costs', form: 'Check', check_number: '1004' },
  { id: '7', project_id: '1', date: '2024-03-10', name: 'Insurance', amount: 4800, category: 'soft_costs', form: 'ACH' },
  { id: '8', project_id: '1', date: '2024-03-15', name: 'Day Labor - Framing', amount: 2400, category: 'field_labor', form: 'Cash' },
  { id: '9', project_id: '1', date: '2024-04-01', name: 'Smith Plumbing', amount: 15000, category: 'subcontractor', form: 'Check', check_number: '1005', vendor_id: '1' },
  { id: '10', project_id: '1', date: '2024-04-10', name: 'Design Studio Pro', amount: 7500, category: 'soft_costs', form: 'ACH', vendor_id: '6' },
];

export const mockBudgetItems: BudgetItem[] = [
  { id: '1', project_id: '1', category: 'Site', description: 'Demolition', labor: 5000, material: 2000, optional: 0, subcontractor: 'Concrete Kings', notes: '', status: 'complete' },
  { id: '2', project_id: '1', category: 'Site', description: 'Grading & Excavation', labor: 8000, material: 0, optional: 1500, subcontractor: 'Concrete Kings', notes: 'Weather dependent', status: 'complete' },
  { id: '3', project_id: '1', category: 'Exterior', description: 'Framing', labor: 18000, material: 22000, optional: 0, subcontractor: '', notes: '', status: 'in-progress' },
  { id: '4', project_id: '1', category: 'Exterior', description: 'Roofing', labor: 6000, material: 9000, optional: 0, subcontractor: '', notes: 'Tile selected', status: 'pending' },
  { id: '5', project_id: '1', category: 'Exterior', description: 'Windows & Doors', labor: 3000, material: 15000, optional: 2500, subcontractor: '', notes: '', status: 'pending' },
  { id: '6', project_id: '1', category: 'Interior', description: 'Plumbing Rough', labor: 0, material: 5000, optional: 0, subcontractor: 'Smith Plumbing', notes: '', status: 'in-progress' },
  { id: '7', project_id: '1', category: 'Interior', description: 'Electrical Rough', labor: 0, material: 4000, optional: 0, subcontractor: 'Elite Electric', notes: '', status: 'in-progress' },
  { id: '8', project_id: '1', category: 'Interior', description: 'Drywall', labor: 10000, material: 6000, optional: 0, subcontractor: '', notes: '', status: 'pending' },
  { id: '9', project_id: '1', category: 'Interior', description: 'Flooring', labor: 5000, material: 12000, optional: 3000, subcontractor: '', notes: 'Hardwood + tile', status: 'pending' },
  { id: '10', project_id: '1', category: 'Landscape', description: 'Hardscape', labor: 8000, material: 6000, optional: 0, subcontractor: '', notes: '', status: 'pending' },
  { id: '11', project_id: '1', category: 'Landscape', description: 'Planting', labor: 3000, material: 4000, optional: 1000, subcontractor: '', notes: '', status: 'pending' },
];

export const mockDraws: Draw[] = [
  { id: '1', project_id: '1', date: '2024-02-01', draw_number: 1, amount: 50000 },
  { id: '2', project_id: '1', date: '2024-03-01', draw_number: 2, amount: 45000 },
  { id: '3', project_id: '1', date: '2024-04-01', draw_number: 3, amount: 35000 },
];
