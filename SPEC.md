# QR Restaurant Ordering System

Build a lightweight web-based restaurant ordering system for a small restaurant in Thailand.

The system must prioritize:

- Simplicity
- Low hardware cost
- Mobile-first design
- Reliability
- Thai language support
- Real-time kitchen orders
- Easy future expansion
- No dedicated POS hardware required

This is an MVP intended for actual restaurant use.

---

# 1. Current Hardware

The restaurant currently has:

- Samsung Galaxy S24 Ultra
- One Android tablet planned for cashier/payment use
- One portable external monitor planned for kitchen display
- One PC at home for development and administration
- Customer smartphones for ordering

Future hardware:

- 80mm thermal receipt printer
- Possibly a cash drawer
- Possibly dedicated kitchen/cashier hardware later

Do NOT design the system assuming dedicated POS hardware is available.

---

# 2. System Architecture

The application should be a responsive web application/PWA.

Basic flow:

Customer phone

→ Scan table QR

→ Customer ordering page

→ Cloud backend/database

→ Kitchen Display

→ Cashier

The system should have four main interfaces:

1. Customer Ordering
2. Kitchen Display
3. Cashier
4. Admin

Suggested routes:

```text
/order/{tableToken}
/kitchen
/cashier
/admin
```

Do not expose sequential database table IDs in customer QR URLs.

Each table should have a random, revocable public QR token.

Example:

```text
/order/t_a8f3Kp92Lm
```

---

# 3. Customer Ordering

Customers must NOT need to:

- Install an app
- Register
- Create an account
- Login
- Enter a table number manually

Each physical table has its own QR code.

Scanning the QR automatically identifies the table.

Example:

```text
โต๊ะ 07

กรุณาพิมพ์รายการอาหาร
──────────────────────

ข้าวหมกไก่ 2
ซุปหางวัว 1
กะเพราเนื้อ 1 เผ็ดน้อย
ไข่ดาว 1

──────────────────────

[ ส่งออเดอร์ ]
```

The primary ordering method is intentionally free-form text.

Customers type their order one item per line.

DO NOT require customers to select items from a predefined product catalog in V1.

Preserve the customer's original text exactly.

---

# 4. Submitting an Order

Before submitting, show a confirmation screen.

Example:

```text
ตรวจสอบรายการ

โต๊ะ 07

ข้าวหมกไก่ 2
ซุปหางวัว 1
กะเพราเนื้อ 1 เผ็ดน้อย
ไข่ดาว 1

[ แก้ไข ]

[ ยืนยันส่งออเดอร์ ]
```

Prevent accidental double submissions.

Every submitted order must receive a unique order number.

Example:

```text
ส่งออเดอร์แล้ว

Order #1042
โต๊ะ 07

ครัวได้รับรายการของคุณแล้ว
```

Submission should use an idempotency mechanism so retrying a request after a network interruption cannot create duplicate orders.

---

# 5. Multiple Orders Per Table

A table can place additional orders without closing the previous order.

Example:

First order:

```text
Order #1042
โต๊ะ 07

ข้าวหมกไก่ 2
ซุปหางวัว 1
```

Later:

```text
Order #1048
โต๊ะ 07

น้ำเปล่า 2
ไข่ดาว 1
```

The cashier must be able to see all orders associated with the same active table session.

Do not assume one order equals one bill.

---

# 6. Table Sessions

Implement the concept of an active table session.

Example:

```text
Table 07

Session
12:15 → currently active

Orders:
#1042
#1048
#1051
```

When the cashier closes the bill, the session becomes CLOSED.

The next customer using that table creates a new session.

Historical orders must never be mixed with the next customer's bill.

---

# 7. Kitchen Display System

Route:

```text
/kitchen
```

Designed for:

- Galaxy S24 Ultra
- Tablet
- External monitor
- Future dedicated kitchen PC

Orders must appear in real time without manually refreshing the page.

Example desktop layout:

```text
┌────────────────┬────────────────┬────────────────┐
│ โต๊ะ 07         │ โต๊ะ 03         │ โต๊ะ 12         │
│ #1042          │ #1043          │ #1044          │
│ 12:34          │ 12:36          │ 12:38          │
│                │                │                │
│ ข้าวหมกไก่ 2   │ ข้าวมันไก่ 1   │ กะเพราเนื้อ 2  │
│ ซุปหางวัว 1    │ น้ำเปล่า 1      │ ไข่ดาว 2       │
│                │                │                │
│ [รับออเดอร์]   │ [รับออเดอร์]   │ [รับออเดอร์]   │
└────────────────┴────────────────┴────────────────┘
```

On mobile, display cards vertically.

---

# 8. Kitchen Order Status

Minimum statuses:

```text
NEW
ACKNOWLEDGED
PREPARING
DONE
CANCELLED
```

Suggested workflow:

```text
NEW
 ↓
ACKNOWLEDGED
 ↓
PREPARING
 ↓
DONE
```

Record timestamps for status transitions where practical.

Kitchen staff should be able to clearly distinguish:

- New orders
- Orders currently being prepared
- Completed orders

Do not permanently delete cancelled orders.

---

# 9. New Order Notification

When a new order arrives:

- Play an audible notification
- Make the new order visually obvious
- Bring it to the user's attention without disruptive browser behavior

Provide:

```text
Sound ON/OFF
```

Remember the setting on that device.

Handle browser autoplay restrictions gracefully.

The Kitchen page should clearly indicate if notification sound permission/interaction is required.

---

# 10. Customer Actions

Customer page should additionally provide:

```text
[ 🔔 เรียกพนักงาน ]

[ 💵 เรียกคิดเงิน ]
```

These actions should appear in real time on staff devices.

Example:

```text
🔔 โต๊ะ 04 เรียกพนักงาน
```

and:

```text
💵 โต๊ะ 07 เรียกคิดเงิน
```

Prevent button spam using reasonable cooldown/rate limiting.

---

# 11. Cashier

Route:

```text
/cashier
```

The cashier interface will primarily run on an Android tablet.

Show active tables.

Example:

```text
โต๊ะที่เปิดอยู่

โต๊ะ 01
โต๊ะ 04
โต๊ะ 07 ← เรียกคิดเงิน
โต๊ะ 12
```

Selecting a table shows every order in the current table session.

---

# 12. Manual Pricing

Because customers type orders as free-form text, the cashier must be able to assign prices manually.

Example:

```text
โต๊ะ 07

ข้าวหมกไก่ 2             [ 120 ]
ซุปหางวัว 1              [ 100 ]
กะเพราเนื้อ 1 เผ็ดน้อย   [ 70 ]
ไข่ดาว 1                 [ 15 ]

──────────────────────────

รวม                       305 บาท
```

For V1, price can be entered as the total price for that line.

Do not attempt to automatically interpret or price arbitrary Thai food text.

Store:

- Original customer text
- Cashier price
- Who/when changed the price where practical

Money must NOT be stored using floating point.

Use integer satang or an appropriate fixed-precision decimal representation.

---

# 13. Payment

Minimum payment methods:

```text
CASH
PROMPTPAY
OTHER
```

Allow cashier to enter:

- Total
- Amount received for cash
- Change
- Payment method
- Payment timestamp

Example:

```text
ยอดรวม       305 บาท

รับเงิน       500 บาท

เงินทอน       195 บาท

[ เงินสด ]
[ PromptPay ]
[ อื่น ๆ ]
```

Do NOT integrate directly with banking APIs in V1.

The cashier can independently verify payment using the banking application on the tablet.

---

# 14. Closing a Table

Cashier should explicitly close a bill.

Before closing:

- Show total
- Confirm payment
- Confirm table

Then:

```text
CLOSE TABLE
```

Closing the table should:

1. Mark payment as completed
2. Close the current table session
3. Preserve all orders
4. Free the table for the next customer

Closed transactions must remain available in history.

---

# 15. Admin

Route:

```text
/admin
```

Admin should support:

- Create table
- Rename table
- Enable/disable table
- Generate/regenerate QR token
- Display/download printable QR code
- View active table sessions
- View order history
- View completed bills
- View basic daily totals
- Manage staff access

Example tables:

```text
โต๊ะ 01
โต๊ะ 02
โต๊ะ 03
...
```

Regenerating a table QR token must invalidate the old public ordering URL.

---

# 16. Authentication

Customers:

```text
NO LOGIN
```

Staff pages must require authentication:

```text
/kitchen
/cashier
/admin
```

Keep authentication simple for V1.

Roles:

```text
KITCHEN
CASHIER
ADMIN
```

Enforce authorization on the server/backend, not only by hiding UI elements.

---

# 17. Suggested Data Model

Design a proper relational database.

Suggested entities:

```text
TABLES

id
name
public_token
enabled
created_at
updated_at
```

```text
TABLE_SESSIONS

id
table_id
status
opened_at
closed_at
```

```text
ORDERS

id
order_number
session_id
status
original_text
created_at
acknowledged_at
completed_at
```

```text
ORDER_LINES

id
order_id
line_number
original_text
price_amount
created_at
updated_at
```

Important:

`original_text` must preserve what the customer submitted.

Do not destroy or silently normalize the source text.

---

Additional entities:

```text
SERVICE_REQUESTS

id
session_id
type
status
created_at
resolved_at
```

Types:

```text
CALL_STAFF
REQUEST_BILL
```

Payments:

```text
PAYMENTS

id
session_id
amount
method
amount_received
change_amount
status
paid_at
```

Print jobs:

```text
PRINT_JOBS

id
session_id
type
printer
status
attempt_count
created_at
printed_at
last_error
```

---

# 18. Thermal Printer Support

There is currently NO thermal printer.

Do not make a physical printer required for V1.

However, architect the software for future 80mm thermal printing.

Create a printer abstraction such as:

```text
PrintService

printKitchenTicket()
printBill()
testPrint()
```

Do not hard-code the application around one printer model.

Future target:

```text
80mm Thermal Printer
ESC/POS
USB and/or LAN
```

The browser itself should not be assumed to have direct raw access to ESC/POS printers.

Future architecture may use a small local print agent/service running on a staff PC, Android device, Raspberry Pi, or other local hardware.

---

# 19. Print Preview

V1 must support print preview without physical hardware.

Support at least:

### Kitchen Ticket

```text
================================
          KITCHEN ORDER
             โต๊ะ 07
             #1042
================================

ข้าวหมกไก่ 2
ซุปหางวัว 1
กะเพราเนื้อ 1 เผ็ดน้อย
ไข่ดาว 1

--------------------------------

12:34

================================
```

### Bill

```text
================================
             โต๊ะ 07
================================

ข้าวหมกไก่ 2             120
ซุปหางวัว 1              100
กะเพราเนื้อ 1             70
ไข่ดาว 1                  15

--------------------------------

รวม                       305

ชำระ: เงินสด
รับเงิน                    500
เงินทอน                    195

================================
```

Optimize print CSS for approximately 80mm thermal paper.

This document is an internal restaurant bill/order slip, not a tax invoice system.

---

# 20. PWA

Make the staff application installable as a PWA where practical.

The Galaxy S24 Ultra and Android tablet should be able to add it to the home screen.

Support:

- App manifest
- Appropriate icons/placeholders
- Full-screen/standalone display
- Responsive layouts
- Reconnection behavior

Do NOT claim full offline ordering unless it is actually implemented and tested.

---

# 21. Network Failure

Reliability is important.

Customer submission must clearly distinguish:

```text
Submitting...
```

from:

```text
Order successfully received by server
```

Never display success merely because the user pressed the button.

If network submission fails:

- Preserve typed text locally
- Tell the customer that submission failed
- Allow retry
- Do not silently discard the order

Use idempotency keys to prevent retry from creating duplicate orders.

---

# 22. Kitchen Reconnection

If `/kitchen` temporarily loses connection:

Display something obvious such as:

```text
⚠️ การเชื่อมต่อขัดข้อง
กำลังเชื่อมต่อใหม่...
```

When connection returns:

- Re-sync orders from the server
- Do not depend exclusively on realtime events
- Do not duplicate existing orders
- Restore the authoritative current state from the database

---

# 23. Security

Even though this is a small restaurant system, implement basic security correctly.

At minimum:

- Validate all server inputs
- Escape/safely render customer text
- Protect staff routes
- Server-side authorization
- Rate-limit public actions where appropriate
- CSRF protection where relevant to the chosen architecture
- Never expose service-role/database admin credentials to the browser
- Do not trust table ID supplied separately by the client
- Resolve table identity from the public QR token server-side
- Audit important cashier/admin actions where practical

Customer text must always be treated as untrusted input.

---

# 24. Thai Language

The primary UI language is Thai.

Code, database fields, internal documentation, and variable names can be English.

Use UTF-8 everywhere.

The system must correctly display:

```text
ข้าวมันไก่
ข้าวหมกไก่
ซุปเนื้อ
ซุปหางวัว
กะเพราเนื้อ
ไม่ใส่ผัก
เผ็ดน้อย
```

Test long Thai text on:

- Smartphone
- Tablet
- Kitchen display
- 80mm print preview

---

# 25. Recommended Technology

Prefer a simple, maintainable stack.

Suggested:

```text
Frontend:
Next.js + TypeScript

Backend:
Next.js server functionality or similarly simple API

Database/Auth/Realtime:
Supabase / PostgreSQL

Styling:
Tailwind CSS

Validation:
Zod or equivalent
```

Alternative technologies are acceptable if there is a strong technical reason.

Do not introduce Kubernetes, microservices, Redis, message brokers, or other infrastructure that is unnecessary for a single small restaurant.

Prefer a modular monolith.

---

# 26. Development Environment

The project will initially be developed on a home PC using Codex.

Provide:

```text
README.md
.env.example
database migrations
seed data
development instructions
production deployment instructions
```

Provide demo tables such as:

```text
โต๊ะ 01
โต๊ะ 02
โต๊ะ 03
โต๊ะ 04
โต๊ะ 05
```

Provide development/demo accounts for each staff role through a documented local seed process.

Never commit real passwords or production secrets.

---

# 27. Testing

At minimum test these critical flows:

### Customer

```text
Scan table URL
→ type order
→ confirmation
→ submit
→ success
```

### Kitchen

```text
Customer submits
→ kitchen receives order
→ notification
→ acknowledge
→ preparing
→ done
```

### Additional Order

```text
same table
→ second order
→ same table session
→ cashier sees both
```

### Cashier

```text
open table
→ enter line prices
→ calculate total
→ choose payment
→ calculate change
→ close table
```

### Network Retry

```text
submit
→ connection failure
→ retry
→ exactly ONE order exists
```

### New Customer

```text
close Table 07
→ scan Table 07 QR again
→ create new session
→ previous customer's orders are NOT included
```

---

# 28. Out of Scope for V1

DO NOT implement these yet:

- Inventory management
- Ingredient stock
- Accounting
- Tax invoices
- Delivery platform integration
- Customer accounts
- Loyalty points
- Promotions
- Complex menu management
- AI order interpretation
- Automatic Thai food price recognition
- Banking API integration
- Multiple restaurant branches
- Employee payroll
- Advanced analytics

Design the database cleanly enough that future features can be added, but do not implement speculative systems.

---

# 29. Development Strategy

Do NOT attempt to generate the entire application in one huge step.

Work incrementally.

Recommended order:

### Phase 1 — Foundation

Create:

- Project structure
- Database schema
- Migrations
- Authentication
- Table/session model
- Seed data

Stop and verify.

### Phase 2 — Customer Ordering

Implement:

```text
/order/{tableToken}
```

including:

- Free-form multiline order
- Confirmation
- Idempotent submission
- Success state

Stop and test on a phone-sized viewport.

### Phase 3 — Kitchen

Implement:

```text
/kitchen
```

including:

- Realtime updates
- Status changes
- Sound notifications
- Reconnection/resync

Stop and test.

### Phase 4 — Cashier

Implement:

```text
/cashier
```

including:

- Active tables
- Table sessions
- Manual prices
- Total
- Payment
- Change
- Close table

Stop and test.

### Phase 5 — Service Requests

Implement:

```text
เรียกพนักงาน
เรียกคิดเงิน
```

with realtime staff notifications.

### Phase 6 — Admin

Implement:

```text
/admin
```

including table/QR management and history.

### Phase 7 — Printing Preparation

Implement:

- PrintService abstraction
- Kitchen ticket preview
- Bill preview
- 80mm print CSS

Do not implement hardware-specific ESC/POS integration until the printer model/interface is known.

### Phase 8 — PWA & Hardening

Implement:

- PWA
- Responsive testing
- Error handling
- Reconnection
- Security review
- Critical-flow automated tests

---

# 30. Codex Working Rules

Before writing code:

1. Review this specification.
2. Propose the final architecture.
3. Identify assumptions or technical risks.
4. Produce the proposed database schema.
5. Produce the planned directory structure.
6. Produce an implementation checklist.

Do NOT start implementing every feature immediately.

After presenting the plan, begin with Phase 1.

After each phase:

1. Run linting.
2. Run type checking.
3. Run automated tests.
4. Fix errors before continuing.
5. Briefly document what was implemented.
6. State what remains incomplete.

Do not replace working architecture merely to introduce newer or more complicated technology.

Prioritize a system that a small restaurant can actually operate and maintain.

# Customer Feedback / Food Issue Reporting

Add a third customer action alongside:

```text
[ 🔔 เรียกพนักงาน ]
[ 💵 เรียกคิดเงิน ]
[ 💬 ติชม / แจ้งปัญหา ]
```

Route or modal behavior can remain inside the customer ordering page.

---

# Feedback Types

When the customer presses:

```text
💬 ติชม / แจ้งปัญหา
```

Show simple choices:

```text
เลือกประเภท

[ 🍽️ ปัญหาเกี่ยวกับอาหาร ]
[ 🧑‍🍳 การบริการ ]
[ 🧹 ความสะอาด / สถานที่ ]
[ 💬 ข้อเสนอแนะทั่วไป ]
```

For food-related issues, optionally allow the customer to select the relevant order or order line from the current table session.

Example:

```text
รายการที่มีปัญหา

○ ข้าวหมกไก่ 2
○ ซุปหางวัว 1
○ กะเพราเนื้อ 1 เผ็ดน้อย
○ ไม่เกี่ยวกับรายการใดโดยเฉพาะ
```

Then provide a multiline text field:

```text
รายละเอียด

[________________________________]
[________________________________]
[________________________________]
```

Example customer messages:

```text
ซุปเย็นไปหน่อย
```

```text
ข้าวหมกไก่ยังไม่สุกบางส่วน
```

```text
สั่งไม่ใส่ผักแต่มีผักมา
```

```text
รออาหารค่อนข้างนาน
```

---

# Severity

For food issues, optionally allow:

```text
ระดับปัญหา

○ ข้อเสนอแนะ
○ มีปัญหา แต่ยังทานได้
○ ต้องการให้พนักงานช่วย
```

Do not require customers to understand technical severity levels.

If the customer chooses:

```text
ต้องการให้พนักงานช่วย
```

the system should create both:

```text
FEEDBACK
```

and an urgent:

```text
SERVICE_REQUEST
```

so staff are notified immediately.

---

# Staff Notification

Important food issues should appear in real time on staff devices.

Example:

```text
⚠️ โต๊ะ 07 แจ้งปัญหาอาหาร

กะเพราเนื้อ 1 เผ็ดน้อย

"สั่งไม่ใส่ผักแต่มีผักมา"

[ รับทราบ ]
```

Feedback that is only a general suggestion does not need to interrupt the kitchen.

Suggested behavior:

```text
GENERAL_FEEDBACK
→ Cashier/Admin

FOOD_ISSUE
→ Kitchen + Cashier

SERVICE_ISSUE
→ Cashier/Staff

URGENT_ASSISTANCE
→ Kitchen + Cashier/Staff
```

Avoid making every feedback submission trigger a loud kitchen alarm.

---

# Feedback Status

Suggested statuses:

```text
NEW
ACKNOWLEDGED
RESOLVED
DISMISSED
```

Do not permanently delete feedback.

Store timestamps for:

```text
created_at
acknowledged_at
resolved_at
```

---

# Suggested Database Entity

Add:

```text
FEEDBACK

id
session_id
order_id nullable
order_line_id nullable
type
severity
message
status
created_at
acknowledged_at
resolved_at
```

Suggested `type` values:

```text
FOOD
SERVICE
CLEANLINESS
GENERAL
```

Suggested `severity` values:

```text
FEEDBACK
ISSUE
NEEDS_ASSISTANCE
```

Keep these enums simple in V1.

---

# Privacy

Customer feedback in V1 should NOT require:

- Name
- Phone number
- Account
- Email

It should automatically associate the feedback with the current table session.

Do not expose previous customers' feedback when a new table session begins.

---

# Customer Confirmation

After submission, show a clear confirmation:

```text
ส่งข้อความเรียบร้อยแล้ว

ขอบคุณสำหรับความคิดเห็น

หากเป็นปัญหาที่ต้องการความช่วยเหลือ
พนักงานจะได้รับแจ้งทันที
```

Prevent accidental duplicate submissions.

Use reasonable rate limiting/cooldown to prevent spam.

---

# Admin Feedback History

The `/admin` interface should provide a simple feedback history.

Allow filtering by:

```text
วันที่
โต๊ะ
ประเภท
สถานะ
```

Admin should be able to review recurring problems such as:

```text
อาหารช้า
อาหารผิดรายการ
อาหารเย็น
ความสะอาด
การบริการ
```

Do not implement advanced sentiment analysis or AI classification in V1.

---

# Update Customer Actions Section

The customer page should now contain:

```text
[ 🔔 เรียกพนักงาน ]

[ 💵 เรียกคิดเงิน ]

[ 💬 ติชม / แจ้งปัญหา ]
```

The feedback function should remain lightweight and mobile-friendly.