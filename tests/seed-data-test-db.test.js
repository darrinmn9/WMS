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

describe('Seed data', () => {
  test('assert test data was seeded correctly', async () => {
    const packagesRequest = await request(url)
      .post('/')
      .send({
        query: `
          query {
            packages {
              id
            }
          }
        `,
      });

    expect(packagesRequest.statusCode).toBe(200);
    expect(packagesRequest.body.data).toHaveProperty('packages');
    expect(Array.isArray(packagesRequest.body.data.packages)).toBe(true);
    expect(packagesRequest.body.data.packages.length).toBe(50);

    const warehousesRequest = await request(url)
      .post('/')
      .send({
        query: `
          query {
            warehouses {
              id
            }
          }
        `,
      });

    expect(warehousesRequest.statusCode).toBe(200);
    expect(warehousesRequest.body.data).toHaveProperty('warehouses');
    expect(Array.isArray(warehousesRequest.body.data.warehouses)).toBe(true);
    expect(warehousesRequest.body.data.warehouses.length).toBe(3);

    const clientsRequest = await request(url)
      .post('/')
      .send({
        query: `
          query {
            clients {
              id
            }
          }
        `,
      });

    expect(clientsRequest.statusCode).toBe(200);
    expect(clientsRequest.body.data).toHaveProperty('clients');
    expect(Array.isArray(clientsRequest.body.data.clients)).toBe(true);
    expect(clientsRequest.body.data.clients.length).toBe(3);
  });
});
