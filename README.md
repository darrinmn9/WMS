# Warehouse Management System (WMS) – GraphQL API

This project uses **Node.js**, **Apollo GraphQL**, and **SQLite** (via Knex.js query builder).

The system supports the following GraphQL mutations:

- **Induct:** [Register incoming packages.](./app/mutations/inductPackages.js)
- **Stow:** [Place packages onto pallets.](./app/mutations/stowPackages.js)
    - This mutation tries to group similar packages onto pallets based on their future `service_date`
    - I also assumed a max weight of 500 lbs allowed per pallet
    - If the mutation input provides a valid `pallet_id`, it will add packages onto the existing pallet before creating
      a new one

---

## Setup & Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the server:**

   ```bash
   npm start
   
   # or
   
   npm run dev # (watch mode)
   ```

3. **Run integration tests:**
   ```bash
   npm run test
   ```
   Example test run output:
    ```
    PASS  tests/induct-packages-mutation.test.js
      inductPackages Mutation
        ✓ successfully inducts multiple valid packages (20 ms)
        ✓ fails for package with wrong client_id (2 ms)
        ✓ fails for package not in PENDING status (2 ms)
        ✓ partial success: mix of valid and invalid packages (3 ms)
        
    PASS  tests/stow-packages-mutation.test.js
      stowPackages Mutation
        ✓ successfully stows multiple inducted packages (27 ms)
        ✓ fails for package not in INDUCTED status (4 ms)
        ✓ fails for package already on a pallet (5 ms)
        ✓ partial success: some valid, some invalid packages (3 ms)
        ✓ should stow heavy packages into multiple pallets grouped by service_date (7 ms)
        
    PASS  tests/seed-data-test-db.test.js
      Seed data
        ✓ assert test data was seeded correctly (19 ms)
    ```

## Architectural Overview

This is a diagram of the database schema in my application.

![Database Schema](./db_schema.png)

## State Transitions

**Note:** The assignment mentioned that package data is sent in advance, so I am calling this the `PENDING` state. I
assumed `PENDING` packages have the following initial data:

- `weight_lbs` (weight of the package)
- `service_date` (when the package needs to be
  delivered to its final destination)
- `client_id` (who does this package belong to)

#### PENDING --> INDUCTED:

Receive and register incoming packages into the system

| Field                   | Before Induction | After Induction                                      |
|-------------------------|------------------|------------------------------------------------------|
| `packages.status`       | `PENDING`        | `INDUCTED`                                           |
| `packages.warehouse_id` | `NULL`           | Set to the ID of the warehouse receiving the package |
| `packages.received_ts`  | `NULL`           | Timestamp when inducted                              |

#### INDUCTED --> STOWED:

Place packages on a pallet

| Field                  | Before Stowing | After Stowing                                                   |
|------------------------|----------------|-----------------------------------------------------------------|
| `packages.status`      | `INDUCTED`     | `STOWED`                                                        |
| `packages.pallet_id`   | `NULL`         | Set to the ID of the pallet the package was/will be placed onto |
|                        |                |                                                                 |
| `pallets.id`           |                | A generated ID identifying this pallet                          |               
| `pallets.warehouse_id` |                | The warehouse where the pallet was created                      |         
| `pallets.stowed_ts`    |                | Timestamp when stowed                                           |         

#### STOWED --> STAGED:

Place pallets into a staging location

| Field                      | Before Staging | After Staging                          |
|----------------------------|----------------|----------------------------------------|
| `packages.status`          | `STOWED`       | `STAGED`                               |
|                            |                |                                        |
| `pallets.staged_ts`        | `NULL`         | Timestamp when staged                  |
| `pallets.storage_location` | `NULL`         | Location identifier (e.g., `"Dock A"`) |

#### STAGED --> PICKED:

Retrieve pallets from staging location

| Field               | Before Picking | After Picking         |
|---------------------|----------------|-----------------------|
| `packages.status`   | `STAGED`       | `PICKED`              |
|                     |                |                       |
| `pallets.picked_ts` | `NULL`         | Timestamp when picked |

## Limitations of Current Design / Future Enhancements

TBD - will complete by EOD Thurs
