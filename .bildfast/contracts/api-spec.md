# API Spec

## Public booking

- `hotelpms.public_api.catalog_index()` resolves the live booking catalog and site/listing mode.
- `hotelpms.public_api.showcase(property)` returns property profile, gallery, room types, meal plans, experiences, locations and locale/currency data.
- `hotelpms.public_api.search_stay(property, check_in_date, check_out_date, adults, children)` returns live room availability and quotes.
- `hotelpms.public_api.book(...)` creates a direct reservation from the public booking flow.

## Operations

- `hotelpms.api` provides authenticated operational APIs for reservations, rooms, guests, housekeeping, folios, POS, inventory, reports and setup.
- New public endpoints must validate all user input and remain limited to the public data required by the booking flow.

## Compatibility

- The `hotelpms.*` method namespace is intentionally retained even though visible branding is HotelPMS.
