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

describe('inductPackages Mutation', () => {
  test('successfully inducts multiple valid packages', async () => {
    const validPackageIds = [
      '00000000-0000-0000-0000-0000000001100',
      '00000000-0000-0000-0000-0000000001103',
    ];

    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Induct($package_ids: [ID!]!, $client_id: ID!, $warehouse_id: ID!) {
            inductPackages(
              package_ids: $package_ids
              client_id: $client_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
              }
            }
          }
        `,
        variables: {
          package_ids: validPackageIds,
          client_id: '00000000-0000-0000-0000-000000000011',
          warehouse_id: '00000000-0000-0000-0000-000000000001',
        },
      });

    expect(res.statusCode).toBe(200);
    const results = res.body.data.inductPackages.results;
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.message).toMatch(/Package INDUCTED successfully/i);
    }

    const rows = await knex('packages').whereIn('id', validPackageIds);
    for (const p of rows) {
      expect(p.status).toBe('INDUCTED');
      expect(p.warehouse_id).toBe('00000000-0000-0000-0000-000000000001');
      expect(p.received_ts).not.toBeNull();
    }
  });

  test('fails for package with wrong client_id', async () => {
    const packageId = '00000000-0000-0000-0000-0000000001102';

    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Induct($package_ids: [ID!]!, $client_id: ID!, $warehouse_id: ID!) {
            inductPackages(
              package_ids: $package_ids
              client_id: $client_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
              }
            }
          }
        `,
        variables: {
          package_ids: [packageId],
          client_id: '00000000-0000-0000-0000-000000000011',
          warehouse_id: '00000000-0000-0000-0000-000000000001',
        },
      });

    expect(res.statusCode).toBe(200);
    const result = res.body.data.inductPackages.results[0];
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Package ID not found/i);
  });

  test('fails for package not in PENDING status', async () => {
    const packageId = '00000000-0000-0000-0000-0000000001103';
    await knex('packages').where({ id: packageId }).update({ status: 'INDUCTED' });

    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Induct($package_ids: [ID!]!, $client_id: ID!, $warehouse_id: ID!) {
            inductPackages(
              package_ids: $package_ids
              client_id: $client_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
              }
            }
          }
        `,
        variables: {
          package_ids: [packageId],
          client_id: '00000000-0000-0000-0000-000000000011',
          warehouse_id: '00000000-0000-0000-0000-000000000001',
        },
      });

    expect(res.statusCode).toBe(200);
    const result = res.body.data.inductPackages.results[0];
    expect(result.success).toBe(false);
    expect(result.message).toMatch(
      /Package status is INDUCTED, only PENDING packages can be INDUCTED/i,
    );
  });

  test('partial success: mix of valid and invalid packages', async () => {
    const validPackageId = '00000000-0000-0000-0000-0000000001104';
    const invalidPackageId = '00000000-0000-0000-0000-0000000001999';

    const res = await request(url)
      .post('/')
      .send({
        query: `
          mutation Induct($package_ids: [ID!]!, $client_id: ID!, $warehouse_id: ID!) {
            inductPackages(
              package_ids: $package_ids
              client_id: $client_id
              warehouse_id: $warehouse_id
            ) {
              results {
                package_id
                success
                message
              }
            }
          }
        `,
        variables: {
          package_ids: [validPackageId, invalidPackageId],
          client_id: '00000000-0000-0000-0000-000000000012',
          warehouse_id: '00000000-0000-0000-0000-000000000001',
        },
      });

    expect(res.statusCode).toBe(200);
    const results = res.body.data.inductPackages.results;

    const valid = results.find((r) => r.package_id === validPackageId);
    const invalid = results.find((r) => r.package_id === invalidPackageId);

    expect(valid.success).toBe(true);
    expect(valid.message).toMatch(/Package INDUCTED successfully/i);

    expect(invalid.success).toBe(false);
    expect(invalid.message).toMatch(/Package ID not found/i);
  });
});
