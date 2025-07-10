import { STATUS_PENDING, STATUS_INDUCTED, MAX_PALLET_WEIGHT_ALLOWED } from '../consts.js';

export default async function inductPackages(
  _,
  { package_ids, client_id, warehouse_id }, // in a prod ready app, warehouse_id would come from auth
  { db },
) {
  const packages = await db('packages').whereIn('id', package_ids);

  const packageMap = {};
  packages.forEach((p) => (packageMap[p.id] = p));

  const results = [];
  for (const package_id of package_ids) {
    const pkg = packageMap[package_id];

    if (!pkg || pkg.client_id !== client_id) {
      results.push({
        package_id,
        success: false,
        message: 'Package ID not found', // or package does not belong to that client
      });
      continue;
    }

    if (pkg.status !== STATUS_PENDING) {
      results.push({
        package_id,
        success: false,
        message: `Package status is ${pkg.status}, only ${STATUS_PENDING} packages can be ${STATUS_INDUCTED}`,
      });
      continue;
    }

    if (pkg.weight_lbs > MAX_PALLET_WEIGHT_ALLOWED) {
      results.push({
        package_id,
        success: false,
        message: `Package weight of ${pkg.weight_lbs} exceeds weight limit of ${MAX_PALLET_WEIGHT_ALLOWED} lbs`,
      });
      continue;
    }

    try {
      await db('packages')
        .where({ id: package_id })
        .update({ status: STATUS_INDUCTED, warehouse_id, received_ts: db.fn.now() });
    } catch (e) {
      console.error(e);

      results.push({
        package_id,
        success: false,
        message: 'Server Error',
      });
      continue;
    }

    results.push({
      package_id,
      success: true,
      message: `Package ${STATUS_INDUCTED} successfully`,
    });
  }

  return { results };
}
