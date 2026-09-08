export interface MasterOption {
  label: string;
  value: string;
  record?: any;
}

export interface ProductMasterOption extends MasterOption {
  sku?: string;
  productName?: string;
  uom?: string;
}

export interface SupplierMasterOption extends MasterOption {
  supplierCode?: string;
  supplierName?: string;
}

export interface PlantMasterOption extends MasterOption {
  plantCode?: string;
  plantName?: string;
}

export interface LocationMasterOption extends MasterOption {
  locationCode?: string;
  locationName?: string;
  plantCode?: string;
  plantName?: string;
}

export interface UomMasterOption extends MasterOption {
  uomCode?: string;
  uomName?: string;
}

export interface StatusMasterOption extends MasterOption {
  statusCode?: string;
  statusName?: string;
  module?: string;
  isDefault?: boolean;
}

export interface MovementTypeMasterOption extends MasterOption {
  movementCode?: string;
  movementName?: string;
  category?: string;
  direction?: string;
  affectsStock?: boolean;
  requiresSource?: boolean;
  requiresDestination?: boolean;
  allowNegativeStock?: boolean;
}

function safeJsonParse<T = any[]>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getLocalStorageArray<T = any>(key: string): T[] {
  if (typeof window === 'undefined') return [];

  const raw = window.localStorage.getItem(key);
  const parsed = safeJsonParse<T[]>(raw, []);

  return Array.isArray(parsed) ? parsed : [];
}

function normalizeText(value: any): string {
  return String(value ?? '').trim();
}

function normalizeUpper(value: any): string {
  return normalizeText(value).toUpperCase();
}

function isActiveRecord(record: any): boolean {
  const status =
    record?.status ??
    record?.recordStatus ??
    record?.activeStatus ??
    record?.isActive ??
    record?.enabled;

  if (typeof status === 'boolean') return status;

  const text = normalizeUpper(status);

  if (!text) return true;

  return !['INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N'].includes(text);
}

function getFirstValue(record: any, keys: string[]): string {
  for (const key of keys) {
    const value = normalizeText(record?.[key]);
    if (value) return value;
  }

  return '';
}

function getBooleanValue(record: any, keys: string[], defaultValue = false): boolean {
  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === 'boolean') return value;

    const text = normalizeUpper(value);

    if (['TRUE', 'YES', 'Y', '1'].includes(text)) return true;
    if (['FALSE', 'NO', 'N', '0'].includes(text)) return false;
  }

  return defaultValue;
}

/**
 * Storage Keys
 * Adjust here only if any page uses a different localStorage key.
 */
export const MASTER_STORAGE_KEYS = {
  product: 'wms_product_master',
  supplier: 'wms_supplier_master',
  plant: 'wms_plant_master',
  location: 'wms_location_master',
  uom: 'wms_uom_master',
  uomConversion: 'wms_uom_conversion_master',
  status: 'wms_status_master',
  movementType: 'wms_movement_type_master',
};

/**
 * Product Master Options
 */
export function getProductMasterOptions(activeOnly = true): ProductMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.product);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .map((record) => {
      const sku = getFirstValue(record, [
        'sku',
        'SKU',
        'productCode',
        'productSku',
        'itemCode',
      ]);

      const productName = getFirstValue(record, [
        'productName',
        'name',
        'itemName',
        'description',
      ]);

      const uom = getFirstValue(record, ['uom', 'baseUom', 'uomCode']);

      return {
        label: sku && productName ? `${sku} - ${productName}` : sku || productName,
        value: sku || productName,
        sku,
        productName,
        uom,
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * Supplier Master Options
 */
export function getSupplierMasterOptions(activeOnly = true): SupplierMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.supplier);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .map((record) => {
      const supplierCode = getFirstValue(record, [
        'supplierCode',
        'code',
        'vendorCode',
      ]);

      const supplierName = getFirstValue(record, [
        'supplierName',
        'name',
        'vendorName',
      ]);

      return {
        label:
          supplierCode && supplierName
            ? `${supplierCode} - ${supplierName}`
            : supplierCode || supplierName,
        value: supplierCode || supplierName,
        supplierCode,
        supplierName,
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * Plant Master Options
 */
export function getPlantMasterOptions(activeOnly = true): PlantMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.plant);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .map((record) => {
      const plantCode = getFirstValue(record, [
        'plantCode',
        'code',
        'warehouseCode',
      ]);

      const plantName = getFirstValue(record, [
        'plantName',
        'name',
        'warehouseName',
      ]);

      return {
        label:
          plantCode && plantName
            ? `${plantCode} - ${plantName}`
            : plantCode || plantName,
        value: plantCode || plantName,
        plantCode,
        plantName,
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * Location Master Options
 */
export function getLocationMasterOptions(
  activeOnly = true,
  plantCodeFilter?: string
): LocationMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.location);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .filter((record) => {
      if (!plantCodeFilter) return true;

      const plantCode = getFirstValue(record, [
        'plantCode',
        'plant',
        'warehouseCode',
      ]);

      return normalizeUpper(plantCode) === normalizeUpper(plantCodeFilter);
    })
    .map((record) => {
      const locationCode = getFirstValue(record, [
        'locationCode',
        'code',
        'binCode',
        'storageLocation',
      ]);

      const locationName = getFirstValue(record, [
        'locationName',
        'name',
        'binName',
      ]);

      const plantCode = getFirstValue(record, [
        'plantCode',
        'plant',
        'warehouseCode',
      ]);

      const plantName = getFirstValue(record, [
        'plantName',
        'warehouseName',
      ]);

      return {
        label:
          locationCode && locationName
            ? `${locationCode} - ${locationName}`
            : locationCode || locationName,
        value: locationCode || locationName,
        locationCode,
        locationName,
        plantCode,
        plantName,
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * UOM Master Options
 */
export function getUomMasterOptions(activeOnly = true): UomMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.uom);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .map((record) => {
      const uomCode = getFirstValue(record, [
        'uomCode',
        'code',
        'uom',
        'unitCode',
      ]);

      const uomName = getFirstValue(record, [
        'uomName',
        'name',
        'unitName',
      ]);

      return {
        label:
          uomCode && uomName
            ? `${uomCode} - ${uomName}`
            : uomCode || uomName,
        value: uomCode || uomName,
        uomCode,
        uomName,
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * Status Master Options
 */
export function getStatusMasterOptions(
  activeOnly = true,
  moduleFilter?: string
): StatusMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.status);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .filter((record) => {
      if (!moduleFilter) return true;

      const module = getFirstValue(record, [
        'module',
        'moduleCode',
        'statusModule',
      ]);

      return (
        normalizeUpper(module) === normalizeUpper(moduleFilter) ||
        normalizeUpper(module) === 'GENERAL'
      );
    })
    .map((record) => {
      const statusCode = getFirstValue(record, [
        'statusCode',
        'code',
        'status',
      ]);

      const statusName = getFirstValue(record, [
        'statusName',
        'name',
      ]);

      const module = getFirstValue(record, [
        'module',
        'moduleCode',
        'statusModule',
      ]);

      const isDefault = getBooleanValue(record, [
        'isDefault',
        'default',
        'defaultStatus',
      ]);

      return {
        label:
          statusCode && statusName
            ? `${statusCode} - ${statusName}`
            : statusCode || statusName,
        value: statusCode || statusName,
        statusCode,
        statusName,
        module,
        isDefault,
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * Movement Type Master Options
 */
export function getMovementTypeMasterOptions(
  activeOnly = true,
  categoryFilter?: string
): MovementTypeMasterOption[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.movementType);

  return records
    .filter((record) => (activeOnly ? isActiveRecord(record) : true))
    .filter((record) => {
      if (!categoryFilter) return true;

      const category = getFirstValue(record, [
        'category',
        'movementCategory',
      ]);

      return normalizeUpper(category) === normalizeUpper(categoryFilter);
    })
    .map((record) => {
      const movementCode = getFirstValue(record, [
        'movementCode',
        'code',
      ]);

      const movementName = getFirstValue(record, [
        'movementName',
        'name',
      ]);

      const category = getFirstValue(record, [
        'category',
        'movementCategory',
      ]);

      const direction = getFirstValue(record, [
        'direction',
        'movementDirection',
      ]);

      return {
        label:
          movementCode && movementName
            ? `${movementCode} - ${movementName}`
            : movementCode || movementName,
        value: movementCode || movementName,
        movementCode,
        movementName,
        category,
        direction,
        affectsStock: getBooleanValue(record, ['affectsStock']),
        requiresSource: getBooleanValue(record, ['requiresSource']),
        requiresDestination: getBooleanValue(record, ['requiresDestination']),
        allowNegativeStock: getBooleanValue(record, ['allowNegativeStock']),
        record,
      };
    })
    .filter((option) => option.value);
}

/**
 * UOM Conversion Master Records
 */
export function getUomConversionRecords(activeOnly = true): any[] {
  const records = getLocalStorageArray(MASTER_STORAGE_KEYS.uomConversion);

  return records.filter((record) => (activeOnly ? isActiveRecord(record) : true));
}

/**
 * Get default status by module
 */
export function getDefaultStatusByModule(module: string): string | undefined {
  const statuses = getStatusMasterOptions(true, module);

  const defaultStatus = statuses.find((status) => status.isDefault);

  return defaultStatus?.value || statuses[0]?.value;
}

/**
 * Get product by SKU
 */
export function getProductBySku(sku: string): ProductMasterOption | undefined {
  const options = getProductMasterOptions(false);

  return options.find(
    (item) => normalizeUpper(item.sku || item.value) === normalizeUpper(sku)
  );
}

/**
 * Get supplier by code
 */
export function getSupplierByCode(code: string): SupplierMasterOption | undefined {
  const options = getSupplierMasterOptions(false);

  return options.find(
    (item) =>
      normalizeUpper(item.supplierCode || item.value) === normalizeUpper(code)
  );
}

/**
 * Get plant by code
 */
export function getPlantByCode(code: string): PlantMasterOption | undefined {
  const options = getPlantMasterOptions(false);

  return options.find(
    (item) => normalizeUpper(item.plantCode || item.value) === normalizeUpper(code)
  );
}

/**
 * Get location by code
 */
export function getLocationByCode(code: string): LocationMasterOption | undefined {
  const options = getLocationMasterOptions(false);

  return options.find(
    (item) =>
      normalizeUpper(item.locationCode || item.value) === normalizeUpper(code)
  );
}

/**
 * Get movement type by code
 */
export function getMovementTypeByCode(
  code: string
): MovementTypeMasterOption | undefined {
  const options = getMovementTypeMasterOptions(false);

  return options.find(
    (item) =>
      normalizeUpper(item.movementCode || item.value) === normalizeUpper(code)
  );
}