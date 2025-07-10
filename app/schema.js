const typeDefs = `#graphql
enum PackageStatus {
  PENDING
  INDUCTED
  STOWED
  STAGED
  PICKED
}

type Warehouse {
  id: ID!
  name: String!
  location: String
  pallets: [Pallet!]!
  packages: [Package!]!
}

type Client {
  id: ID!
  name: String!
  email: String
  packages: [Package!]!
}

type Pallet {
  id: ID!
  label: String
  storage_location: String
  stowed_ts: String
  staged_ts: String
  picked_ts: String
  warehouse: Warehouse!
  packages: [Package!]!
}

type Package {
  id: ID!
  weight_lbs: Float!
  status: PackageStatus!
  service_date: String
  received_ts: String
  warehouse: Warehouse
  client: Client!
  pallet: Pallet
}

type Query {
  packages: [Package!]!
  package(id: ID!): Package
  pallets: [Pallet!]!
  pallet(id: ID!): Pallet
  clients: [Client!]!
  client(id: ID!): Client
  warehouses: [Warehouse!]!
  warehouse(id: ID!): Warehouse
}

input InductPackagesInput {
  package_ids: [ID!]!
  warehouse_id: ID!
  client_id: ID!
}


input StowPackageInput {
  package_ids: [ID!]!
  pallet_id: ID!
}

type InductPackageResult {
  package_id: ID!
  success: Boolean!
  message: String!
}

type InductPackagePayload {
  results: [InductPackageResult!]!
}


type StowPackageResult {
  package_id: ID!
  success: Boolean!
  message: String!
  pallet_id: ID
}

type StowPackagePayload {
  results: [StowPackageResult!]!
}

type Mutation {
  inductPackages(
    package_ids: [ID!]!
    client_id: ID!
    warehouse_id: ID!
  ): InductPackagePayload!
  stowPackages(
    package_ids: [ID!]!
    pallet_id: ID
    warehouse_id: ID!
  ): StowPackagePayload!
}
`;

export default typeDefs;
