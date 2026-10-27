export type MachineStatus = "disponible" | "en_obra" | "mantenimiento";
export type JobStatus = "planificada" | "en_curso" | "terminada";

export interface Company {
  id: string;
  name: string;
  invite_code: string;
  industry: string | null;
  created_at: string;
}

export interface Machine {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  location: string | null;
  serial: string | null;
  status: MachineStatus;
  notes: string | null;
  created_at: string;
  purchase_price: number | null;
  purchase_price_currency: string;
  purchase_price_fx_rate: number;
  purchase_date: string | null;
  useful_life_years: number | null;
}

export interface MachineSpec {
  id: string;
  company_id: string;
  machine_id: string;
  label: string;
  value: string;
  created_at: string;
}

export interface MachineDepreciation {
  machine_id: string;
  purchase_price: number | null;
  purchase_price_currency: string;
  purchase_price_fx_rate: number;
  purchase_price_ref: number | null;
  purchase_date: string | null;
  useful_life_years: number | null;
  annual_depreciation: number | null;
  years_elapsed: number | null;
  book_value: number | null;
  maintenance_cost_total: number;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  company_id: string;
  name: string;
  client: string | null;
  status: JobStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  budget_currency: string;
  budget_fx_rate: number;
  category: string | null;
  location: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  responsible_name: string | null;
  created_at: string;
}

export interface JobPayment {
  id: string;
  company_id: string;
  job_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  paid_at: string;
  note: string | null;
  created_at: string;
}

export interface JobWorker {
  id: string;
  company_id: string;
  job_id: string;
  contact_id: string | null;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface JobExpense {
  id: string;
  company_id: string;
  job_id: string;
  description: string;
  amount: number;
  currency: string;
  fx_rate: number;
  invoice_photo_url: string | null;
  created_at: string;
}

export interface JobMachine {
  id: string;
  company_id: string;
  job_id: string;
  machine_id: string;
  assigned_at: string;
  returned_at: string | null;
  machine?: Machine;
}

export interface JobLogEntry {
  id: string;
  company_id: string;
  job_id: string;
  note: string;
  created_at: string;
}

export type UserRole = "admin" | "tecnico" | "lectura";

export interface Profile {
  id: string;
  company_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserRoleRow {
  user_id: string;
  company_id: string;
  role: UserRole;
  approved: boolean;
  created_at: string;
  profile?: Profile;
}

export type WorkOrderType = "correctivo" | "preventivo" | "inspeccion" | "emergencia";
export type WorkOrderPriority = "baja" | "media" | "alta";
export type WorkOrderStatus = "pendiente" | "en_curso" | "cerrada";

export interface WorkOrder {
  id: string;
  company_id: string;
  machine_id: string;
  job_id: string | null;
  type: WorkOrderType;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assigned_to: string | null;
  cost: number | null;
  closed_at: string | null;
  closed_note: string | null;
  created_at: string;
  machine?: Machine;
  job?: { name: string };
}

export interface MaintenanceSchedule {
  id: string;
  company_id: string;
  machine_id: string;
  name: string;
  frequency_days: number;
  last_done_at: string | null;
  next_due_at: string;
  reminder_days_before: number;
  active: boolean;
  created_at: string;
  machine?: Machine;
}

export interface JobInvoice {
  id: string;
  company_id: string;
  job_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  invoiced_at: string;
  note: string | null;
  invoice_photo_url: string | null;
  created_at: string;
}

export interface JobBudgetItem {
  id: string;
  company_id: string;
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  currency: string;
  fx_rate: number;
  created_at: string;
}

export interface JobWip {
  job_id: string;
  job_name: string;
  budget: number;
  budget_currency: string;
  cost_incurred: number;
  invoiced_amount: number;
  collected_amount: number;
  pct_complete: number;
  earned_revenue: number;
  over_under_billing: number;
  estimated_result: number;
}
