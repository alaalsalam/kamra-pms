# Data Models

## Hospitality core

- **Property**: hotel profile, Saudi locale/currency/VAT, public brand assets, gallery, booking policy and amenities.
- **Room Type**: sellable accommodation category, price, capacity, amenities and media.
- **Room**: physical room attached to a Property and Room Type.
- **Guest**: guest identity, contact and stay preferences.
- **Reservation**: stay dates, guest, room type, operational state and pricing.
- **Folio / Folio Charge / Folio Payment**: guest account, charges, VAT and settlement.

## Operations and sales

- **Housekeeping Task**, **Laundry Order**, **POS Outlet / POS Order / Menu Item**, **Ingredient / Ingredient Stock**, **Venue / Banquet** and **Experience** support hotel operations and the demo catalogue.

## Demo data

- Seed source: `hotelpms.scripts.seed_arabic_demo.execute`.
- Demo assets use licensed remote image URLs for hotel, room, dining and wellness presentation.
