### Stock movement import

Warehouses send us records of stock arriving and leaving. Build a service that imports these records and lets us retrieve a product’s stock movement totals.

Each record contains:

- Warehouse ID.
- Product ID.
- Movement ID.
- Movement date.
- Direction: `in` or `out`.
- Quantity.

The service must:

- Accept a batch of stock movement records.
- Return total incoming quantity, total outgoing quantity, and net change for a product within an inclusive date range.
- Report which records were accepted or rejected, with reasons.
- Allow a warehouse to resend a batch without counting the same movement twice.

Additional requirements:

- Product and movement IDs are unique within a warehouse, not across all warehouses.
- Quantity must be a positive integer.
- Dates must be valid calendar dates in `YYYY-MM-DD` format.
- An identical repeated movement is a duplicate. A repeated movement ID with different details is a conflict and must not overwrite the original.
- Invalid records must not prevent valid records in the same batch from being processed.
- Data must remain isolated between warehouses.
- Net change is incoming quantity minus outgoing quantity and may be negative.
- A query with no matching movements must return zero for all totals.

In-memory storage is sufficient. No authentication, frontend, or external inventory integration is required.