StockLine Inventory OS
StockLine Inventory OS is a web-based inventory management system for businesses that hold stock across one or more branches. It tracks what each branch has, how stock moves between branches, what is sold and returned, and what it is all worth. It is designed for everyday use by staff on the shop floor, as well as by managers and owners who need a clear view of the whole business. All money values are shown in Ghana cedis (GH₵).

The application runs in any modern browser on a computer or phone, and it can be installed on a device like a regular app. It connects to a central server, so everyone in the business works from the same up-to-date information wherever they sign in.

Who uses it
StockLine has three main roles, and each one sees only what it needs.

Administrators manage the whole workspace. They see every branch, set up products and categories, add suppliers, manage the team, and control settings and permissions.

Managers look after operations at their branches. They can manage products, review their team's sales, submit branch summaries and open the financial reports. Administrators can switch this manager layer on or off for the whole business; when it is off, managers use the same screens as staff.

Staff work within the branches they are assigned to. A staff member who belongs to more than one branch chooses which branch to work in after signing in and can switch at any time. Staff do not see cost prices or profit figures.

Products and categories
Every business stocks different things, so StockLine does not assume a fixed product list. Administrators create categories, such as Laptops, Doors or Livestock, and give each category its own custom fields. A field can hold text, a number, a date or a choice from a list, and it can be marked as required. A Doors category might record material, width and height, while a Laptops category records processor, memory and storage.

Each product belongs to a category and carries a name, SKU, optional barcode, notes, selling price and cost price, plus the custom fields of its category. Products are shared across all branches, while the quantity held is tracked separately for each branch.

Inventory
The Inventory screen shows the stock held at the current branch, with search and filters. From here, users record stock coming in and going out, set a low-stock threshold for each product, and view each product's movement history. Products that fall below their threshold are flagged so they can be reordered before they run out.

Adjustments
When stock needs correcting because of damage, loss or a counting error, users submit an adjustment. Adjustments wait for approval before they change stock levels, and an approver can accept or reject each one. This keeps an accountable record of every correction and prevents silent changes to the figures.

Transfers between branches
Stock moves from one branch to another through a transfer, which passes through clear stages. It is requested, approved or rejected, dispatched by the sending branch and received by the destination branch, and it can be cancelled before it completes. The navigation shows how many transfers are waiting for approval, dispatch or receipt, so nothing is left in transit unnoticed.

Stocktaking
StockLine supports a weekly physical stock count for each branch. Staff start a count, enter the quantity they find for each product and submit it. The system compares the counted quantities with recorded stock and creates adjustments for any differences. The screen shows whether each branch has started or submitted its count for the week.

Sales and returns
Staff submit a daily sales report listing what they sold. Managers review their team's reports and submit a summary for the branch, and administrators can inspect reports across all branches. Returns are recorded against sales, and the system checks how many units were sold and how many were already returned, so more items cannot be returned than were sold.

Purchasing
The Purchasing section covers restocking. Team members raise stock requests, which are approved or rejected. Purchase orders are raised with suppliers, and when the goods arrive the order is marked as received; orders can also be cancelled. Administrators maintain the list of suppliers the business buys from.

Reports
Managers and administrators can open three reports, each for a single branch or for the whole business:

Profit and loss: revenue, cost and profit over a chosen date range, with a chart and a detailed breakdown.
Stock value: the value of the stock currently held, grouped for easy comparison.
Slow movers: products that have not sold within a chosen number of days, highlighting stock that is tying up money.
Dashboard, activity and notifications
The dashboard gives an at-a-glance view of the current branch or the whole business: the number of products and branches, stock value, low-stock and out-of-stock counts, pending adjustments, transfer work waiting, and the most recent stock movements.

The activity log records stock movements and user actions, showing who did what and when, with filters to narrow the history. Notifications alert users to events that need their attention, and unread counts appear in the navigation.

Team and access management
Administrators add team members, give each one a role and one or more branches, and can deactivate accounts that are no longer needed. New users receive an activation link to set their own password, and administrators can issue password-reset links. Users can change their own password from their account settings, which also signs them out of their other sessions.

Security
Sign-in and permissions are handled by the server rather than the browser. The short-lived access token is kept only in memory, while the longer-lived session token is stored in a secure cookie that scripts on the page cannot read. Requests carry protection against cross-site request forgery, and sessions refresh safely even when several tabs are open. When a session expires, the user is returned to the sign-in screen.

Design and experience
The interface uses a deep teal and green palette with light and dark modes, smooth transitions, and clear loading, empty and error states. On a computer, navigation sits in a sidebar; on a phone, it moves to a bottom bar with a menu for the remaining sections. Wide tables scroll sideways on small screens so nothing is cut off.

Technology
The front end is built with React 19 and TypeScript on TanStack Start and TanStack Router, with TanStack Query for fetching and caching data. Styling uses Tailwind CSS 4 and Radix UI components, animation uses Motion, charts use Recharts, and icons come from Lucide. The front end is deployed on Vercel and communicates with a separate inventory API.

Summary
StockLine Inventory OS brings stock control, branch transfers, stocktaking, sales, purchasing and financial reporting together in one shared system. Its flexible categories adapt to whatever a business sells, its approval steps keep records accountable, and its role-based access ensures each person sees what they need and nothing they should not.

The server code isn't in this folder, so I described its behaviour from how the app calls it. The Security section is based on the front-end code; check it with whoever runs the server before you show it to clients.
