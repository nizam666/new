# Demo Accounts for Quarry ERP System

Below are the demo user accounts for testing the system. Each account represents a different role with specific permissions.

## Demo User Credentials

### 1. Director Account
- **Email:** director@quarryerp.com
- **Password:** Director@123
- **Role:** Managing Director
- **Access:** Full access to all modules, analytics, and approvals 

### 1. Admin Account
- **Email:** admin@quarryerp.com
- **Password:** Admin@123
- **Role:** Managing Director
- **Access:** Full access to all modules, analytics, and approvals

### 2. Manager Account
- **Email:** manager@quarryerp.com
- **Password:** Manager@123
- **Role:** Manager
- **Access:** Approvals, reports, operations oversight

### 3. Contractor Account
- **Email:** contractor@quarryerp.com
- **Password:** Contractor@123
- **Role:** Quarry Contractor
- **Access:** Drilling, blasting, loading operations, mobile app

### 4. Crusher Manager Account
- **Email:** crusher@quarryerp.com
- **Password:** Crusher@123
- **Role:** Crusher Manager
- **Access:** Production records, machine maintenance

### 5. Sales Account
- **Email:** sales@quarryerp.com
- **Password:** Sales@123
- **Role:** Sales Team
- **Access:** Customers, quotations, orders, invoices

---

## How to Create Demo Accounts

To set up these demo accounts, you need to:

1. Sign up each user through the application's login page
2. Or use Supabase Auth to create users programmatically

**Note:** Since email confirmation is disabled, you can log in immediately after sign-up.

## Quick Start

1. Go to the login page
2. Use any of the credentials above
3. Explore the role-specific dashboard and modules

---

## Role Capabilities Summary

| Role | Drilling | Blasting | Loading | Production | Sales | Customers | Approvals | Reports |
|------|----------|----------|---------|------------|-------|-----------|-----------|---------|
| Director | ✓ View | ✓ View | ✓ View | ✓ View | ✓ View | ✓ View | ✓ All | ✓ All |
| Manager | ✓ Approve | ✓ Approve | ✓ Approve | ✓ Approve | ✓ View | ✓ View | ✓ All | ✓ All |
| Contractor | ✓ Create | ✓ Create | ✓ Create | ✗ | ✗ | ✗ | ✗ | ✗ |
| Crusher Manager | ✗ | ✗ | ✗ | ✓ Create | ✗ | ✗ | ✗ | ✗ |
| Sales | ✗ | ✗ | ✗ | ✗ | ✓ Create | ✓ Create | ✗ | ✗ |
