import Knex from 'knex';
import initDb from './app/db/index.js';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import typeDefs from './app/schema.js';
import resolvers from './app/resolvers/index.js';

export default async function createApolloServer({ port = 4000, TEST_ENV = false }) {
  const knex = Knex({
    client: 'better-sqlite3',
    connection: {
      filename: TEST_ENV ? './test-db.sqlite' : './db.sqlite',
    },
    useNullAsDefault: true,
  });
  await initDb(knex, TEST_ENV);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port },
    context: () => ({ db: knex }),
  });

  console.log(`Server ready at: ${url}`);
  return { server, url, knex };
}
