export type MachineStatus = "disponible" | "en_obra" | "mantenimiento";
// Texto libre: arranca con 5 sugerencias por defecto (ver lib/itemTypes.ts)
// pero no está limitado a ellas — el usuario puede agregar tipos propios.
export type ItemType = string;
export type JobStatus = "planificada" | "en_curso" | "terminada";

export interface Company {
  id: string;
  name: string;
  invite_code: string;
  industry: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  company_id: string;
  name: string;
  coordinates: string | null;
  created_at: string;
}

export type MachineSource = "import" | "manual";

export interface Machine {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  item_type: ItemType;
  location: string | null;
  location_id: string | null;
  location_obj?: Location | null;
  serial: string | null;
  serial_photo_url: string | null;
  parent_machine_id: string | null;
  status: MachineStatus;
  notes: string | null;
  created_at: string;
  purchase_price: number | null;
  purchase_price_currency: string;
  purchase_price_fx_rate: number;
  purchase_date: string | null;
  useful_life_years: number | null;
  quantity: number;
  item_code: string | null;
  temporary_location: string | null;
  inventory_date: string | null;
  source: MachineSource;
}

export interface ImportLog {
  id: string;
  company_id: string;
  created_at: string;
  file_name: string;
  uploaded_by_email: string | null;
  mode: "update" | "replace";
  created_count: number;
  updated_count: number;
  unchanged_count: number;
  ignored_count: number;
  not_found_count: number;
  total_value: number | null;
  total_value_currency: string | null;
}

export type ToolCondition = "bueno" | "regular" | "malo" | "reponer";

export interface ToolConditionLog {
  id: string;
  company_id: string;
  machine_id: string;
  condition: ToolCondition;
  note: string | null;
  logged_by_email: string | null;
  created_at: string;
}

export interface JobRequirement {
  id: string;
  company_id: string;
  job_id: string;
  description: string;
  quantity: number;
  match_text: string | null;
  created_at: string;
}

export interface TransferNote {
  id: string;
  company_id: string;
  machine_id: string;
  from_location: string | null;
  to_location: string;
  note: string | null;
  created_by_email: string | null;
  share_token: string;
  created_at: string;
}

export interface MachinePhoto {
  id: string;
  company_id: string;
  machine_id: string;
  photo_url: string;
  created_at: string;
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
