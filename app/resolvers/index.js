import mutations from '../mutations/index.js';

const resolvers = {
  Query: {
    packages(parent, args, { db }) {
      return db('packages').select();
    },
    package(parent, { id }, { db }) {
      return db('packages').where({ id }).first();
    },
    pallets(parent, args, { db }) {
      return db('pallets').select();
    },
    pallet(parent, { id }, { db }) {
      return db('pallets').where({ id }).first();
    },
    client(parent, { id }, { db }) {
      return db('clients').where({ id }).first();
    },
    clients(parent, args, { db }) {
      return db('clients').select();
    },
    warehouse(parent, { id }, { db }) {
      return db('warehouses').where({ id }).first();
    },
    warehouses(parent, args, { db }) {
      return db('warehouses').select();
    },
  },
  Package: {
    client: async (parent, args, { db }) => {
      if (!parent.client_id) return null;
      return db('clients').where({ id: parent.client_id }).first();
    },
    warehouse: async (parent, args, { db }) => {
      if (!parent.warehouse_id) return null;
      return db('warehouses').where({ id: parent.warehouse_id }).first();
    },
    pallet: async (parent, args, { db }) => {
      if (!parent.pallet_id) return null;
      return db('pallets').where({ id: parent.pallet_id }).first();
    },
  },
  Mutation: mutations,
};

export default resolvers;
