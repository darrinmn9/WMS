import { v4 as uuidv4 } from 'uuid';
import { STATUS_INDUCTED, STATUS_STOWED, MAX_PALLET_WEIGHT_ALLOWED } from '../consts.js';

export default async function stowPackages(
  _,
  { package_ids, warehouse_id, pallet_id = null }, // in a prod ready app, warehouse_id would come from auth
  { db },
) {
  // *Assumed Business Logic* - sort by service_date so we can "smartly" group packages with similar service_date's on the same pallet
  const sortedPackages = await db('packages')
    .whereIn('id', package_ids)
    .orderBy([
      { column: 'service_date', order: 'asc' },
      { column: 'weight_lbs', order: 'asc' },
    ]);

  // use the existing pallet if it exists, otherwise create a new one
  const pallet = pallet_id ? await db('pallets').where({ id: pallet_id }).first() : null;
  let currentPalletId = pallet_id ?? uuidv4();
  let currentPalletWeight = 0;
  try {
    if (pallet) {
      const [sumResult] = await db('packages')
        .where({ pallet_id: currentPalletId })
        .sum({ total_weight: 'weight_lbs' });

      currentPalletWeight = sumResult.total_weight ?? 0;

      await db('pallets').where({ id: currentPalletId }).update({
        stowed_ts: db.fn.now(),
      });
    } else {
      await db('pallets').insert({
        id: currentPalletId,
        warehouse_id,
        stowed_ts: db.fn.now(),
      });
    }
  } catch (e) {
    console.log(e);
    return {
      results: {
        package_id: null,
        success: false,
        message: 'Server error while attempt INSERT or UPDATE pallet',
        pallet_id: currentPalletId,
      },
    };
  }

  const packageResultMap = {};
  for (const pkg of sortedPackages) {
    if (pkg.status !== STATUS_INDUCTED) {
      packageResultMap[pkg.id] = {
        package_id: pkg.id,
        success: false,
        message: `Cannot stow package with status ${pkg.status}`,
        pallet_id: null,
      };
      continue;
    }

    if (pkg.warehouse_id !== warehouse_id) {
      packageResultMap[pkg.id] = {
        package_id: pkg.id,
        success: false,
        message: `Package belongs to a different warehouse (${pkg.warehouse_id})`,
        pallet_id: null,
      };
      continue;
    }

    // *Assumed Business Logic* - don't allow a pallet to hold over 500 lbs of packages
    if (currentPalletWeight + pkg.weight_lbs > MAX_PALLET_WEIGHT_ALLOWED) {
      currentPalletId = uuidv4();
      currentPalletWeight = 0;

      await db('pallets').insert({
        id: currentPalletId,
        warehouse_id,
        stowed_ts: db.fn.now(),
      });
    }

    try {
      await db('packages').where({ id: pkg.id }).update({
        pallet_id: currentPalletId,
        status: STATUS_STOWED,
      });
      currentPalletWeight += pkg.weight_lbs;
    } catch (e) {
      console.log(e);
      packageResultMap[pkg.id] = {
        package_id: pkg.id,
        success: false,
        message: 'Server error while attempt to STOW package',
        pallet_id: null,
      };
      continue;
    }

    packageResultMap[pkg.id] = {
      package_id: pkg.id,
      success: true,
      message: `Package ${STATUS_STOWED} successfully`,
      pallet_id: currentPalletId,
    };
  }

  return {
    results: package_ids.map((package_id) => {
      if (packageResultMap[package_id]) {
        return packageResultMap[package_id];
      }
      return {
        package_id,
        success: false,
        message: 'Package not found',
        pallet_id: null,
      };
    }),
  };
}
