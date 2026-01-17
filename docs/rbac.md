# RBAC / Role Model (v1)

## Goals
- Support customer mini program (browse, cart, intent order, requests, after-sales)
- Support internal roles (sales binding & follow-up, procurement shipment updates, admin operations)
- Provide *scoped access* (customer sees self; sales sees owned customers; admin sees all)
- Only the admin console is web; all other user-facing surfaces are mini programs
- Auth is enforced at gateway-bff; downstream services perform resource-level checks.

## User Types
- customer: external user authenticated via WeChat/Alipay mini program
- staff: internal user authenticated via staff mini program (sales/procurement/CS)
- admin: internal user authenticated via web console (admin only)

## Roles (system roles)
- CUSTOMER
- SALES
- PROCUREMENT
- CS (customer service)
- ADMIN

## Scope Rules
- SELF: only the authenticated user's own resources (e.g., my orders)
- OWNED: resources owned/assigned to the user (e.g., customers bound to a sales)
- ALL: all resources

## Permission Codes (examples)
Catalog / Shopping:
- catalog:read
- wishlist:manage
- cart:manage
- order:create
- order:read
- tracking:read

Requests / After-sales / Negotiation:
- product_request:create
- product_request:read
- product_request:export
- after_sales:create
- after_sales:read
- after_sales:manage
- inquiry:create
- inquiry:read
- inquiry:manage

Admin / Ops:
- customer:transfer
- customer:read
- product:manage
- import:product
- import:shipment
- shipment:manage
- import:cart
- config:feature_flags
- payment:manage
- rbac:manage

## Default Role → Permission Mapping (suggested)
### CUSTOMER
- catalog:read (public)
- wishlist:manage (SELF)
- cart:manage (SELF)
- import:cart (SELF)  # bulk add-to-cart Excel
- order:create (SELF)
- order:read (SELF)
- tracking:read (SELF)
- product_request:create (SELF)
- product_request:read (SELF)
- after_sales:create (SELF)
- after_sales:read (SELF)
- inquiry:create (SELF)
- inquiry:read (SELF)

### SALES
- catalog:read
- order:read (OWNED)
- tracking:read (OWNED)
- inquiry:manage (OWNED)
- product_request:read (OWNED)
- after_sales:manage (OWNED)
- customer:read (OWNED)

### PROCUREMENT
- order:read (ALL)
- tracking:read (ALL)
- import:shipment (ALL) # bulk waybill import
- shipment:manage (ALL)

### CS
- after_sales:manage (ALL)
- inquiry:manage (ALL)
- order:read (ALL, read-only)
- tracking:read (ALL)
- product_request:read (ALL)

### ADMIN
- ALL permissions with ALL scope

## Ownership Fields (recommended)
- customers.ownerSalesUserId: sales ownership (set on first QR bind; only admin transfer can change)
- orders.ownerSalesUserId: snapshot from customer ownership at order submit time
- afterSalesTickets.ownerSalesUserId: derived from order/customer for routing
- inquiries.assignedSalesUserId: assigned for follow-up

## Audit Log (must)
Track these actions:
- customer transfer (from sales A to B)
- feature flag changes (paymentEnabled)
- product import job submissions and results
- shipment bulk imports

## Notes
- CS uses permissive access initially to reduce support friction; tighten as needed.
