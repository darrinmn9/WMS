import { STATUSES, STATUS_PENDING } from '../consts.js';

async function initDb(knex, isTestEnv = false) {
  const warehouseIds = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
  ];

  const clientIds = [
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000013',
  ];

  await knex.schema.hasTable('packages').then(async function (exists) {
    if (!exists) {
      await knex.schema
        .createTable('warehouses', (table) => {
          table.uuid('id').primary();
          table.string('name').notNullable();
          table.string('location');
        })
        .createTable('clients', (table) => {
          table.uuid('id').primary();
          table.string('name').notNullable();
          table.string('email');
        })
        .createTable('pallets', (table) => {
          table.uuid('id').primary();
          table.string('label');
          table.string('storage_location');
          table.timestamp('stowed_ts');
          table.timestamp('staged_ts');
          table.timestamp('picked_ts');
          table
            .uuid('warehouse_id')
            .notNullable()
            .references('id')
            .inTable('warehouses')
            .onDelete('CASCADE');
        })
        .createTable('packages', (table) => {
          table.uuid('id').primary();
          table.float('weight_lbs').notNullable();
          table.enu('status', STATUSES).notNullable();
          table.date('service_date');
          table.timestamp('received_ts');
          table.timestamps(true, true);
          table
            .uuid('warehouse_id')
            .nullable()
            .references('id')
            .inTable('warehouses')
            .onDelete('CASCADE');
          table
            .uuid('client_id')
            .notNullable()
            .references('id')
            .inTable('clients')
            .onDelete('CASCADE');
          table
            .uuid('pallet_id')
            .nullable()
            .references('id')
            .inTable('pallets')
            .onDelete('CASCADE');
        });

      const warehouses = [
        { id: warehouseIds[0], name: 'Warehouse A', location: 'New York' },
        { id: warehouseIds[1], name: 'Warehouse B', location: 'Chicago' },
        { id: warehouseIds[2], name: 'Warehouse C', location: 'Los Angeles' },
      ];
      await knex('warehouses').insert(warehouses);

      const clients = [
        { id: clientIds[0], name: 'Client One', email: 'one@example.com' },
        { id: clientIds[1], name: 'Client Two', email: 'two@example.com' },
        { id: clientIds[2], name: 'Client Three', email: 'three@example.com' },
      ];
      await knex('clients').insert(clients);

      const randomDate = () => {
        const today = new Date();
        const daysOffset = Math.floor(Math.random() * 30);
        today.setDate(today.getDate() + daysOffset);
        return today.toISOString().split('T')[0];
      };

      const packages = Array.from({ length: 50 }).map((_, idx) => ({
        id: `00000000-0000-0000-0000-0000000001${(100 + idx).toString().padStart(2, '0')}`,
        weight_lbs: parseFloat((Math.random() * 50 + 1).toFixed(2)),
        status: STATUS_PENDING,
        service_date: randomDate(),
        client_id: clientIds[idx % clientIds.length],
      }));

      return knex('packages').insert(packages);
    }
  });

  if (!isTestEnv) {
    knex.on('query', function ({ sql, bindings }) {
      // for local dev debugging purposes
      console.log(`${sql}; bindings: ${bindings}`);
    });
  }
}

export default initDb;
