

## Construction Project Management App

A full-stack web app to replace your Excel-based project ledger, built for you, your team, and your clients.

### Core Data Structure
- **Projects** — Each property/job gets its own workspace (like "ASD Backyard, LLC")
- **Vendors** — Central directory of all subcontractors & vendors with contact info, type, and trade detail
- **Contracts** — Track contracts, change orders, and credits per subcontractor per project
- **Payments** — Log all payments across 4 categories: Subcontractor, Materials & Vendors, Soft Costs, and Field Labor
- **Budget** — Line-item budget by category (Site, Exterior, Interior, Landscape, etc.) with labor, material, and optional columns
- **Draws** — Track bank draw requests with amounts and dates

### Pages & Features

**1. Dashboard (Home)**
- Project selector dropdown at the top
- Summary cards: Contract Owed, Contract Paid, Contract Balance, Draw Requested, Draw Balance, Budget Total
- Subcontractor summary table: Contract, Change Orders, Credits, Total Owed, Payments, Balance
- Soft costs and other hard costs summaries
- Visual charts: spending by category, budget vs. actual, payment timeline

**2. Contracts Page**
- Table of all contracts, change orders, and credits with date, name, amount, and type
- Add/edit contract entries with a form
- Auto-rolls up to dashboard totals

**3. Payments Page**
- Tabbed view for the 4 payment types: Subcontractor, Materials & Vendors, Soft Costs, Field Labor
- Each tab shows a sortable/filterable payment log with date, name, amount, form, check #
- Add payment form with type selection

**4. Budget Page**
- Line-item budget organized by category sections (Site, Exterior, Interior, etc.)
- Columns: Labor, Material, Optional, Subcontractor, Notes, Status
- Totals auto-calculate: Hard Cost Total, Design Fee, Build Fee, Projected Grand Total

**5. Vendors Page**
- Searchable directory of all vendors and subcontractors
- Fields: Name, Detail/Trade, Type (Vendor/Subcontractor/Consultant), Contact, Email, Phone
- Click into a vendor to see all their contracts and payment history across projects

**6. Draws Page**
- Table of draw requests with date, draw number, and amount
- Running total and remaining draw balance

### User Access
- **You & Team**: Full access — add/edit projects, contracts, payments, vendors
- **Clients**: View-only access to the dashboard for their project(s)
- Authentication via email login with role-based access (admin, team, client)

### Backend
- **Lovable Cloud (Supabase)** for database, auth, and row-level security
- Import your existing Excel data to seed the first project

### Data Import
- We'll structure the database to match your Excel and pre-populate it with your current project data

