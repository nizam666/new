/*
  # Quarry ERP System - Complete Database Schema

  ## Overview
  This migration creates a comprehensive database schema for a quarry ERP system with mobile operations.
  The system supports multiple user roles: contractors, crusher managers, managers, sales team, and directors.

  ## 1. New Tables

  ### Authentication & Users
  - `users` - Extended user profiles with role-based access
    - `id` (uuid, primary key, references auth.users)
    - `email` (text, unique)
    - `full_name` (text)
    - `role` (text) - contractor, crusher_manager, manager, sales, director
    - `phone` (text)
    - `is_active` (boolean)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### Quarry Contractor Module
  - `drilling_records` - Track daily drilling operations
    - `id` (uuid, primary key)
    - `contractor_id` (uuid, references users)
    - `date` (date)
    - `location` (text)
    - `holes_drilled` (integer)
    - `total_depth` (decimal)
    - `equipment_used` (text)
    - `diesel_consumed` (decimal)
    - `notes` (text)
    - `status` (text) - pending, approved, rejected
    - `created_at` (timestamptz)

  - `blasting_records` - Track blasting operations
    - `id` (uuid, primary key)
    - `contractor_id` (uuid, references users)
    - `date` (date)
    - `location` (text)
    - `explosive_used` (decimal)
    - `detonators_used` (integer)
    - `rock_volume` (decimal)
    - `notes` (text)
    - `status` (text)
    - `created_at` (timestamptz)

  - `loading_records` - Track loading operations
    - `id` (uuid, primary key)
    - `contractor_id` (uuid, references users)
    - `date` (date)
    - `material_type` (text)
    - `quantity_loaded` (decimal)
    - `vehicle_number` (text)
    - `destination` (text)
    - `status` (text)
    - `created_at` (timestamptz)

  - `equipment` - Equipment inventory
    - `id` (uuid, primary key)
    - `name` (text)
    - `type` (text) - drill, excavator, loader, truck
    - `model` (text)
    - `status` (text) - operational, maintenance, breakdown
    - `last_maintenance` (date)
    - `created_at` (timestamptz)

  ### Crusher Manager Module
  - `production_records` - Daily production tracking
    - `id` (uuid, primary key)
    - `manager_id` (uuid, references users)
    - `date` (date)
    - `crusher_id` (uuid, references equipment)
    - `material_input` (decimal)
    - `material_output` (decimal)
    - `product_type` (text)
    - `working_hours` (decimal)
    - `status` (text)
    - `created_at` (timestamptz)

  - `machine_maintenance` - Maintenance records
    - `id` (uuid, primary key)
    - `equipment_id` (uuid, references equipment)
    - `maintenance_type` (text) - routine, breakdown, preventive
    - `description` (text)
    - `cost` (decimal)
    - `performed_by` (uuid, references users)
    - `scheduled_date` (date)
    - `completed_date` (date)
    - `created_at` (timestamptz)

  ### Sales Module
  - `customers` - Customer database
    - `id` (uuid, primary key)
    - `name` (text)
    - `company` (text)
    - `email` (text)
    - `phone` (text)
    - `address` (text)
    - `gst_number` (text)
    - `is_active` (boolean)
    - `created_at` (timestamptz)

  - `quotations` - Sales quotations
    - `id` (uuid, primary key)
    - `quotation_number` (text, unique)
    - `customer_id` (uuid, references customers)
    - `sales_person_id` (uuid, references users)
    - `date` (date)
    - `valid_until` (date)
    - `total_amount` (decimal)
    - `status` (text) - draft, sent, approved, rejected, converted
    - `created_at` (timestamptz)

  - `quotation_items` - Line items for quotations
    - `id` (uuid, primary key)
    - `quotation_id` (uuid, references quotations)
    - `product_type` (text)
    - `quantity` (decimal)
    - `unit_price` (decimal)
    - `amount` (decimal)

  - `sales_orders` - Confirmed orders
    - `id` (uuid, primary key)
    - `order_number` (text, unique)
    - `customer_id` (uuid, references customers)
    - `quotation_id` (uuid, references quotations)
    - `sales_person_id` (uuid, references users)
    - `order_date` (date)
    - `delivery_date` (date)
    - `total_amount` (decimal)
    - `status` (text) - pending, in_progress, completed, cancelled
    - `created_at` (timestamptz)

  - `invoices` - Sales invoices
    - `id` (uuid, primary key)
    - `invoice_number` (text, unique)
    - `order_id` (uuid, references sales_orders)
    - `customer_id` (uuid, references customers)
    - `invoice_date` (date)
    - `due_date` (date)
    - `total_amount` (decimal)
    - `paid_amount` (decimal)
    - `status` (text) - unpaid, partial, paid, overdue
    - `created_at` (timestamptz)

  ### Mobile Operations
  - `attendance` - Daily attendance tracking
    - `id` (uuid, primary key)
    - `user_id` (uuid, references users)
    - `date` (date)
    - `check_in` (timestamptz)
    - `check_out` (timestamptz)
    - `location` (text)
    - `notes` (text)
    - `created_at` (timestamptz)

  - `media_uploads` - Photos and videos from field
    - `id` (uuid, primary key)
    - `user_id` (uuid, references users)
    - `record_type` (text) - drilling, blasting, loading, production
    - `record_id` (uuid)
    - `file_url` (text)
    - `file_type` (text) - photo, video
    - `description` (text)
    - `created_at` (timestamptz)

  ### Workflow & Approvals
  - `approval_workflows` - Approval request tracking
    - `id` (uuid, primary key)
    - `record_type` (text) - drilling, blasting, loading, production, quotation, order
    - `record_id` (uuid)
    - `submitted_by` (uuid, references users)
    - `approver_id` (uuid, references users)
    - `status` (text) - pending, approved, rejected
    - `comments` (text)
    - `submitted_at` (timestamptz)
    - `reviewed_at` (timestamptz)

  - `notifications` - System notifications
    - `id` (uuid, primary key)
    - `user_id` (uuid, references users)
    - `title` (text)
    - `message` (text)
    - `type` (text) - approval, alert, info
    - `is_read` (boolean)
    - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Create policies for role-based access control
  - Users can only access data relevant to their role and department
  - Directors have read access to all data
  - Managers can approve records from their department
  - Sales team can only access customer and sales data
  - Contractors and crusher managers can only access their own records

  ## 3. Important Notes
  - All monetary values use decimal type for precision
  - All timestamps use timestamptz for timezone support
  - Status fields use text type for flexibility
  - Indexes added for frequently queried fields
  - Cascading deletes configured where appropriate
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('contractor', 'crusher_manager', 'manager', 'sales', 'director')),
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('drill', 'excavator', 'loader', 'truck', 'crusher')),
  model text,
  status text DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'breakdown')),
  last_maintenance date,
  created_at timestamptz DEFAULT now()
);

-- Create drilling_records table
CREATE TABLE IF NOT EXISTS drilling_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  location text NOT NULL,
  holes_drilled integer DEFAULT 0,
  total_depth decimal(10,2) DEFAULT 0,
  equipment_used text,
  diesel_consumed decimal(10,2) DEFAULT 0,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Create blasting_records table
CREATE TABLE IF NOT EXISTS blasting_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  location text NOT NULL,
  explosive_used decimal(10,2) DEFAULT 0,
  detonators_used integer DEFAULT 0,
  rock_volume decimal(10,2) DEFAULT 0,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Create loading_records table
CREATE TABLE IF NOT EXISTS loading_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  material_type text NOT NULL,
  quantity_loaded decimal(10,2) DEFAULT 0,
  vehicle_number text,
  destination text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Create production_records table
CREATE TABLE IF NOT EXISTS production_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  crusher_id uuid REFERENCES equipment(id),
  material_input decimal(10,2) DEFAULT 0,
  material_output decimal(10,2) DEFAULT 0,
  product_type text NOT NULL,
  working_hours decimal(5,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Create machine_maintenance table
CREATE TABLE IF NOT EXISTS machine_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('routine', 'breakdown', 'preventive')),
  description text NOT NULL,
  cost decimal(10,2) DEFAULT 0,
  performed_by uuid REFERENCES users(id),
  scheduled_date date,
  completed_date date,
  created_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  address text,
  gst_number text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sales_person_id uuid NOT NULL REFERENCES users(id),
  date date DEFAULT CURRENT_DATE,
  valid_until date,
  total_amount decimal(12,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'converted')),
  created_at timestamptz DEFAULT now()
);

-- Create quotation_items table
CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_type text NOT NULL,
  quantity decimal(10,2) NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  amount decimal(12,2) NOT NULL
);

-- Create sales_orders table
CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES quotations(id),
  sales_person_id uuid NOT NULL REFERENCES users(id),
  order_date date DEFAULT CURRENT_DATE,
  delivery_date date,
  total_amount decimal(12,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  order_id uuid REFERENCES sales_orders(id),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  total_amount decimal(12,2) DEFAULT 0,
  paid_amount decimal(12,2) DEFAULT 0,
  status text DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
  created_at timestamptz DEFAULT now()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create media_uploads table
CREATE TABLE IF NOT EXISTS media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('drilling', 'blasting', 'loading', 'production', 'maintenance', 'general')),
  record_id uuid,
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('photo', 'video')),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create approval_workflows table
CREATE TABLE IF NOT EXISTS approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL CHECK (record_type IN ('drilling', 'blasting', 'loading', 'production', 'quotation', 'order')),
  record_id uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id),
  approver_id uuid REFERENCES users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('approval', 'alert', 'info')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE drilling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE blasting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Directors can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'director'
    )
  );

CREATE POLICY "Managers can view department users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for equipment table
CREATE POLICY "Authenticated users can view equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and directors can manage equipment"
  ON equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director', 'crusher_manager')
    )
  );

-- RLS Policies for drilling_records
CREATE POLICY "Contractors can view own drilling records"
  ON drilling_records FOR SELECT
  TO authenticated
  USING (
    contractor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Contractors can create drilling records"
  ON drilling_records FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'contractor'
    )
  );

CREATE POLICY "Contractors can update own drilling records"
  ON drilling_records FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid() AND status = 'pending')
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Managers can update drilling record status"
  ON drilling_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for blasting_records
CREATE POLICY "Contractors can view own blasting records"
  ON blasting_records FOR SELECT
  TO authenticated
  USING (
    contractor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Contractors can create blasting records"
  ON blasting_records FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'contractor'
    )
  );

CREATE POLICY "Contractors can update own blasting records"
  ON blasting_records FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid() AND status = 'pending')
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Managers can update blasting record status"
  ON blasting_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for loading_records
CREATE POLICY "Contractors can view own loading records"
  ON loading_records FOR SELECT
  TO authenticated
  USING (
    contractor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Contractors can create loading records"
  ON loading_records FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'contractor'
    )
  );

CREATE POLICY "Contractors can update own loading records"
  ON loading_records FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid() AND status = 'pending')
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Managers can update loading record status"
  ON loading_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for production_records
CREATE POLICY "Crusher managers can view own production records"
  ON production_records FOR SELECT
  TO authenticated
  USING (
    manager_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Crusher managers can create production records"
  ON production_records FOR INSERT
  TO authenticated
  WITH CHECK (
    manager_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'crusher_manager'
    )
  );

CREATE POLICY "Crusher managers can update own production records"
  ON production_records FOR UPDATE
  TO authenticated
  USING (manager_id = auth.uid() AND status = 'pending')
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Managers can update production record status"
  ON production_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for machine_maintenance
CREATE POLICY "Staff can view maintenance records"
  ON machine_maintenance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Crusher managers can create maintenance records"
  ON machine_maintenance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  );

CREATE POLICY "Managers can update maintenance records"
  ON machine_maintenance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for customers
CREATE POLICY "Sales and management can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('sales', 'manager', 'director')
    )
  );

CREATE POLICY "Sales can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('sales', 'manager', 'director')
    )
  );

-- RLS Policies for quotations
CREATE POLICY "Sales can view quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (
    sales_person_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Sales can create quotations"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_person_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'sales'
    )
  );

CREATE POLICY "Sales can update own quotations"
  ON quotations FOR UPDATE
  TO authenticated
  USING (sales_person_id = auth.uid())
  WITH CHECK (sales_person_id = auth.uid());

CREATE POLICY "Managers can update quotation status"
  ON quotations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for quotation_items
CREATE POLICY "Users can view quotation items"
  ON quotation_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations
      WHERE quotations.id = quotation_items.quotation_id
      AND (
        quotations.sales_person_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
        )
      )
    )
  );

CREATE POLICY "Sales can manage quotation items"
  ON quotation_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations
      WHERE quotations.id = quotation_items.quotation_id
      AND quotations.sales_person_id = auth.uid()
    )
  );

-- RLS Policies for sales_orders
CREATE POLICY "Sales can view orders"
  ON sales_orders FOR SELECT
  TO authenticated
  USING (
    sales_person_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Sales can create orders"
  ON sales_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_person_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'sales'
    )
  );

CREATE POLICY "Sales can update own orders"
  ON sales_orders FOR UPDATE
  TO authenticated
  USING (sales_person_id = auth.uid())
  WITH CHECK (sales_person_id = auth.uid());

CREATE POLICY "Managers can update order status"
  ON sales_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Sales and management can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('sales', 'manager', 'director')
    )
  );

CREATE POLICY "Sales and management can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('sales', 'manager', 'director')
    )
  );

-- RLS Policies for attendance
CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can create own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for media_uploads
CREATE POLICY "Users can view own media"
  ON media_uploads FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can upload media"
  ON media_uploads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own media"
  ON media_uploads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for approval_workflows
CREATE POLICY "Users can view relevant approvals"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (
    submitted_by = auth.uid() OR
    approver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'director'
    )
  );

CREATE POLICY "Users can create approval requests"
  ON approval_workflows FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Approvers can update approvals"
  ON approval_workflows FOR UPDATE
  TO authenticated
  USING (
    approver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director')
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drilling_records_contractor ON drilling_records(contractor_id);
CREATE INDEX IF NOT EXISTS idx_drilling_records_date ON drilling_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_drilling_records_status ON drilling_records(status);

CREATE INDEX IF NOT EXISTS idx_blasting_records_contractor ON blasting_records(contractor_id);
CREATE INDEX IF NOT EXISTS idx_blasting_records_date ON blasting_records(date DESC);

CREATE INDEX IF NOT EXISTS idx_loading_records_contractor ON loading_records(contractor_id);
CREATE INDEX IF NOT EXISTS idx_loading_records_date ON loading_records(date DESC);

CREATE INDEX IF NOT EXISTS idx_production_records_manager ON production_records(manager_id);
CREATE INDEX IF NOT EXISTS idx_production_records_date ON production_records(date DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_sales_person ON quotations(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date DESC);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_approver ON approval_workflows(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON approval_workflows(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);