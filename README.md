# Inventory Harmony

Prompt:

Build a modern, visually polished inventory management web app with tasteful 3D-style animations and micro-interactions — it should feel like a premium SaaS product, not a generic AI-generated template. Avoid boilerplate Bootstrap/Material defaults; use custom styling, intentional typography, a cohesive color palette, smooth transitions (Framer Motion or GSAP), and subtle depth (soft shadows, layered cards, parallax or tilt-on-hover effects) rather than literal 3D models unless specified.

Core functionality:

Users can create custom categories (e.g., "Doors", "Goats", "Laptops") — fully dynamic, not hardcoded.

For each category, users define custom attributes/fields (e.g., Doors → material, width, height; Goats → breed, age, weight).

Users can add items under a category, filling in the custom fields plus common fields: name, quantity, location, value, date added, status.

Full CRUD (create, read, update, delete) for categories, attributes, and items.

A dashboard showing: total items, total stock value, low-stock alerts, recent activity/movement log.

Search and filter items by category, name, or custom attribute values.

Stock adjustment history (who changed what, when, and why).

Tech preferences:

Frontend: React (or Next.js), Tailwind CSS, Framer Motion for animations

Backend/data: [specify — e.g., Supabase, Firebase, Node + PostgreSQL, or local state for a demo]

Use a flexible schema: an Items table with core fields + an ItemAttributes (EAV-style) table or JSON custom_fields column so any category can have its own attribute set without schema changes.

Design direction:

Distinct visual identity — not the default AI blue-and-white SaaS look. Pick a bold or unexpected palette and a real typographic hierarchy.

Animated transitions when switching categories, adding items, or opening detail views (card expand, staggered list entry, etc.)

Empty states, loading states, and success/error feedback should all be designed, not afterthoughts.

Responsive layout (desktop-first is fine, but should degrade gracefully on mobile).

A few things worth deciding before you use this — want help settling them?

What should this run on?only frontend now

Is this for a course project or a personal/business tool?Personal or business use

Got it — frontend-only, for a real personal/business tool (not just a demo). Here's the refined prompt:

Prompt:

Build a modern, visually polished inventory management web app — frontend-only, no backend required. It should feel like a premium SaaS product, not a generic AI-generated template. Avoid boilerplate Bootstrap/Material defaults; use custom styling, intentional typography, a cohesive color palette, smooth transitions (Framer Motion), and subtle depth (soft shadows, layered cards, tilt-on-hover, staggered animations) rather than literal 3D models.

Data persistence: Since there's no backend, store all data in the browser using IndexedDB (preferred over localStorage for larger datasets and structured queries) — with a clean data-access layer so it could be swapped for a real backend later without rewriting the UI.

Core functionality:

Users can create custom categories (e.g., "Doors", "Goats", "Laptops") — fully dynamic, not hardcoded.

For each category, users define custom attributes/fields (e.g., Doors → material, width, height; Goats → breed, age, weight) with types (text, number, date, dropdown).

Users add items under a category, filling in the custom fields plus common fields: name, quantity, location, value, date added, status.

Full CRUD (create, read, update, delete) for categories, attributes, and items.

A dashboard showing: total items, total stock value, low-stock alerts, recent activity/movement log.

Search and filter items by category, name, or any custom attribute value.

Stock adjustment history (what changed and when) — stored locally per item.

Import/export data as JSON or CSV, so users can back up or move their data since it's stored only in the browser.

Tech stack:

React (or Next.js in static/client-only mode)

Tailwind CSS

Framer Motion for animations

IndexedDB via a lightweight wrapper (e.g., idb or Dexie.js)

Design direction:

Distinct visual identity — not the default AI blue-and-white SaaS look. Pick a bold or unexpected palette and real typographic hierarchy.

Animated transitions when switching categories, adding items, opening detail views (card expand, staggered list entry, etc.)

Well-designed empty states, loading states, and success/error toasts.

Responsive layout, desktop-first but usable on mobile.

Clear warning/notice somewhere in the UI (e.g., settings) that data lives in this browser only, with a prominent export/backup option.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://inventary-management-system.lovable.app

## Demo access

Use either role on the login screen:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@veridian.local` | `admin123` |
| Staff | `staff@veridian.local` | `staff123` |

Demo accounts and inventory data are stored in the current browser. Staff access is limited to categories assigned by an administrator.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/81f8bac2-532a-4748-a1b3-9f4c352f26ec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
