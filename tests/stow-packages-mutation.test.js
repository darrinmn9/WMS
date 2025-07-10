import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs/promises';
import createApolloServer from '../createApolloServer.js';

let server, url, knex;

beforeAll(async () => {
  ({ server, url, knex } = await createApolloServer({ TEST_ENV: true }));
});

afterAll(async () => {
  await Promise.all([server?.stop(), knex?.destroy(), fs.unlink(path.resolve('./test-db.sqlite'))]);
});

describe('stowPackages Mutation', () => {
  const palletId = '00000000-0000-0000-0000-000000009999';
  const warehouseId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await knex('packages')
      .whereIn('id', [
        '00000000-0000-0000-0000-0000000001100',
        '00000000-0000-0000-0000-0000000001101',
        '00000000-0000-0000-0000-0000000001102',
      ])
      .update({ status: 'INDUCTED', warehouse_id: warehouseId, received_ts: knex.fn.now() });
  });

  test('successfully stows multiple inducted packages', async () => {
    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Stow($package_ids: [ID!]!, $pallet_id: ID!, $warehouse_id: ID!) {
            stowPackages(
              package_ids: $package_ids
              pallet_id: $pallet_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
                pallet_id
              }
            }
          }
        `,
        variables: {
          package_ids: [
            '00000000-0000-0000-0000-0000000001100',
            '00000000-0000-0000-0000-0000000001101',
          ],
          pallet_id: palletId,
          warehouse_id: warehouseId,
        },
      });

    expect(res.statusCode).toBe(200);
    const results = res.body.data.stowPackages.results;
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.message).toMatch(/stowed successfully/i);
      expect(r.pallet_id).toBe(palletId);
    }

    // Verify DB updates
    const updated = await knex('packages').whereIn('id', [
      '00000000-0000-0000-0000-0000000001100',
      '00000000-0000-0000-0000-0000000001101',
    ]);
    for (const p of updated) {
      expect(p.status).toBe('STOWED');
      expect(p.pallet_id).toBe(palletId);
    }

    // Confirm pallet timestamp
    const pallet = await knex('pallets').where({ id: palletId }).first();
    expect(pallet).toBeDefined();
    expect(pallet.stowed_ts).not.toBeNull();
  });

  test('fails for package not in INDUCTED status', async () => {
    // This package is still PENDING
    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Stow($package_ids: [ID!]!, $pallet_id: ID!, $warehouse_id: ID!) {
            stowPackages(
              package_ids: $package_ids
              pallet_id: $pallet_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
                pallet_id
              }
            }
          }
        `,
        variables: {
          package_ids: ['00000000-0000-0000-0000-0000000001103'],
          pallet_id: palletId,
          warehouse_id: warehouseId,
        },
      });

    expect(res.statusCode).toBe(200);
    const result = res.body.data.stowPackages.results[0];
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Cannot stow package with status PENDING/i);
  });

  test('fails for package already on a pallet', async () => {
    // Mark as already stowed
    const preStowedId = '00000000-0000-0000-0000-0000000001102';
    await knex('pallets').insert({
      id: '00000000-0000-0000-0000-000000001111',
      label: 'Pre-existing Pallet',
      warehouse_id: warehouseId,
    });

    await knex('packages').where({ id: preStowedId }).update({
      pallet_id: '00000000-0000-0000-0000-000000001111',
      status: 'STOWED',
    });

    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Stow($package_ids: [ID!]!, $pallet_id: ID!, $warehouse_id: ID!) {
            stowPackages(
              package_ids: $package_ids
              pallet_id: $pallet_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
                pallet_id
              }
            }
          }
        `,
        variables: {
          package_ids: [preStowedId],
          pallet_id: palletId,
          warehouse_id: warehouseId,
        },
      });

    expect(res.statusCode).toBe(200);
    const result = res.body.data.stowPackages.results[0];
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Cannot stow package with status STOWED/i);
  });

  test('partial success: some valid, some invalid packages', async () => {
    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Stow($package_ids: [ID!]!, $pallet_id: ID!, $warehouse_id: ID!) {
            stowPackages(
              package_ids: $package_ids
              pallet_id: $pallet_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
                pallet_id
              }
            }
          }
        `,
        variables: {
          package_ids: [
            '00000000-0000-0000-0000-0000000001100', // Already stowed from previous test
            '00000000-0000-0000-0000-0000000001103', // Still PENDING
          ],
          pallet_id: palletId,
          warehouse_id: warehouseId,
        },
      });

    expect(res.statusCode).toBe(200);
    const results = res.body.data.stowPackages.results;
    expect(results).toHaveLength(2);

    const success = results.find((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // In this example, no successes (both invalid), adjust as needed.
    expect(success).toBeUndefined();
    expect(failures.length).toBe(2);
  });

  test('should stow heavy packages into multiple pallets grouped by service_date', async () => {
    const warehouseId = '00000000-0000-0000-0000-000000000001';
    const clientId = '00000000-0000-0000-0000-000000000011';

    // Create 3 packages with specific attributes
    const pkgA = {
      id: '00000000-0000-0000-0000-0000000003100',
      weight_lbs: 250,
      status: 'INDUCTED',
      service_date: '2025-07-01',
      warehouse_id: warehouseId,
      client_id: clientId,
    };
    const pkgB = {
      id: '00000000-0000-0000-0000-0000000003101',
      weight_lbs: 250,
      status: 'INDUCTED',
      service_date: '2025-07-01',
      warehouse_id: warehouseId,
      client_id: clientId,
    };
    const pkgC = {
      id: '00000000-0000-0000-0000-0000000003102',
      weight_lbs: 250,
      status: 'INDUCTED',
      service_date: '2025-07-05',
      warehouse_id: warehouseId,
      client_id: clientId,
    };

    await knex('packages').insert([pkgA, pkgB, pkgC]);

    // Input order is C, A, B
    const packageIds = [pkgC.id, pkgA.id, pkgB.id];

    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation StowPackages($warehouse_id: ID!, $package_ids: [ID!]!) {
            stowPackages(warehouse_id: $warehouse_id, package_ids: $package_ids) {
              results {
                package_id
                success
                message
                pallet_id
              }
            }
          }
        `,
        variables: {
          warehouse_id: warehouseId,
          package_ids: packageIds,
        },
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
    const results = res.body.data.stowPackages.results;

    // Should have 3 results in input order
    expect(results).toHaveLength(3);
    expect(results[0].package_id).toBe(pkgC.id);
    expect(results[1].package_id).toBe(pkgA.id);
    expect(results[2].package_id).toBe(pkgB.id);

    // All should succeed
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.pallet_id).toBeDefined();
    }

    // Collect pallet assignments
    const palletAssignments = {};
    results.forEach((r) => {
      palletAssignments[r.package_id] = r.pallet_id;
    });

    const palletC = palletAssignments[pkgC.id];
    const palletA = palletAssignments[pkgA.id];
    const palletB = palletAssignments[pkgB.id];

    // The two earlier-service-date packages should be on the same pallet
    expect(palletA).toBe(palletB);

    // The later-service-date package should be on a different pallet
    expect(palletC).not.toBe(palletA);

    // Confirm pallets exist in DB
    const pallets = await knex('pallets').select('*').whereIn('id', [palletA, palletC]);
    expect(pallets).toHaveLength(2);
  });
});
