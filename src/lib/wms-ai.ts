/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * WMS AI Rule Engine
 * -------------------------------------------------------
 * Initial rule-based AI assistant for Inventory + Outbound.
 *
 * Purpose:
 * - Analyze outbound shipment readiness
 * - Validate Product / SKU Master linkage
 * - Validate inventory availability
 * - Explain matching logic
 * - Suggest picking / allocation plan
 * - Generate errors, warnings, and recommendations
 *
 * Matching rules:
 * - SKU + Batch No + Plant are required
 * - Location is flexible if outbound line location is blank
 * - Expiry Date is flexible if outbound line expiry is blank
 * - Available inventory quantity must be >= required outbound quantity
 */

export type WmsAiSeverity = 'error' | 'warning' | 'info';

export type WmsAiStatus = 'ready' | 'warning' | 'blocked';

export interface WmsAiIssue {
  id: string;
  severity: WmsAiSeverity;
  title: string;
  message: string;
  lineNo?: number;
  sku?: string;
  field?: string;
}

export interface WmsAiRecommendation {
  id: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  lineNo?: number;
  sku?: string;
}

export interface WmsAiPickingPlanRow {
  lineNo: number;
  sku: string;
  productName?: string;
  batchNo?: string;
  plant?: string;
  location?: string;
  expiryDate?: string;
  inventoryId?: string;
  requiredQty: number;
  pickQty: number;
  remainingAfterPick?: number;
  availableQtyBeforePick?: number;
}

export interface WmsAiLineAnalysis {
  lineNo: number;
  sku: string;
  productName?: string;
  requiredQty: number;
  availableQty: number;
  allocatedQty: number;
  shortageQty: number;
  status: WmsAiStatus;
  errors: WmsAiIssue[];
  warnings: WmsAiIssue[];
  recommendations: WmsAiRecommendation[];
  pickingPlan: WmsAiPickingPlanRow[];
}

export interface WmsAiAnalysisResult {
  status: WmsAiStatus;
  score: number;
  summary: string;
  explanation: string;

  canConfirm: boolean;
  canShip: boolean;
  fullyAllocated: boolean;

  totalLines: number;
  totalRequiredQty: number;
  totalAllocatedQty: number;
  totalShortageQty: number;

  errors: WmsAiIssue[];
  warnings: WmsAiIssue[];
  infos: WmsAiIssue[];
  recommendations: WmsAiRecommendation[];

  pickingPlan: WmsAiPickingPlanRow[];
  lineAnalyses: WmsAiLineAnalysis[];

  generatedAt: string;
}

export interface AnalyzeOutboundShipmentInput {
  shipment: Record<string, any>;
  inventory?: Record<string, any>[];
  products?: Record<string, any>[];
  customers?: Record<string, any>[];
  movements?: Record<string, any>[];
  today?: Date | string;
  options?: {
    expiryWarningDays?: number;
    requireActiveProduct?: boolean;
    requireCustomerMaster?: boolean;
    requireBatchNo?: boolean;
    requirePlant?: boolean;
    allowPartialAllocation?: boolean;
  };
}

const DEFAULT_OPTIONS = {
  expiryWarningDays: 30,
  requireActiveProduct: true,
  requireCustomerMaster: false,
  requireBatchNo: true,
  requirePlant: true,
  allowPartialAllocation: false,
};

/**
 * Main AI function used by Outbound page.
 */
export function analyzeOutboundShipment(
  input: AnalyzeOutboundShipmentInput,
): WmsAiAnalysisResult {
  const {
    shipment,
    inventory = [],
    products = [],
    customers = [],
    today,
    options,
  } = input;

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...(options || {}),
  };

  const now = today ? new Date(today) : new Date();

  const errors: WmsAiIssue[] = [];
  const warnings: WmsAiIssue[] = [];
  const infos: WmsAiIssue[] = [];
  const recommendations: WmsAiRecommendation[] = [];
  const pickingPlan: WmsAiPickingPlanRow[] = [];
  const lineAnalyses: WmsAiLineAnalysis[] = [];

  const shipmentNo = getString(
    shipment,
    ['shipmentNo', 'shipmentNumber', 'outboundNo', 'orderNo', 'id'],
    'Outbound Shipment',
  );

  const customerKey = getString(shipment, [
    'customerCode',
    'customerId',
    'customer',
    'customerName',
  ]);

  const lines = getShipmentLines(shipment);

  /**
   * Header checks
   */
  if (!lines.length) {
    errors.push({
      id: createIssueId('shipment', 'no-lines'),
      severity: 'error',
      title: 'No shipment lines',
      message: `${shipmentNo} has no item lines. Add at least one SKU before confirmation or shipping.`,
      field: 'items',
    });
  }

  if (mergedOptions.requireCustomerMaster && customerKey) {
    const customerFound = customers.some((customer) =>
      isSameCustomer(customer, customerKey),
    );

    if (!customerFound) {
      warnings.push({
        id: createIssueId('shipment', 'customer-not-found'),
        severity: 'warning',
        title: 'Customer not found in master data',
        message: `Customer "${customerKey}" was not found in Customer Master. Please verify before shipping.`,
        field: 'customer',
      });
    }
  }

  if (!customerKey) {
    warnings.push({
      id: createIssueId('shipment', 'missing-customer'),
      severity: 'warning',
      title: 'Missing customer',
      message: 'Shipment customer is blank. This may affect documentation, labels, and validation.',
      field: 'customer',
    });
  }

  /**
   * Inventory allocation working copy.
   * We reduce available qty in-memory so two outbound lines do not consume
   * the same stock twice during AI analysis.
   */
  const inventoryWorkingCopy = inventory.map((item, index) => ({
    source: item,
    index,
    availableQty: getInventoryAvailableQty(item),
  }));

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    const sku = getLineSku(line);
    const productNameFromLine = getString(line, [
      'productName',
      'itemName',
      'description',
      'name',
    ]);

    const batchNo = getString(line, ['batchNo', 'batch', 'lotNo', 'lot']);
    const plant = getString(line, ['plant', 'plantCode', 'site', 'factory']);
    const location = getString(line, [
      'location',
      'locationCode',
      'bin',
      'binLocation',
      'warehouseLocation',
    ]);
    const expiryDate = normalizeDateString(
      getString(line, ['expiryDate', 'expirationDate', 'expDate', 'mfgExpiry']),
    );

    const requiredQty = getLineRequiredQty(line);

    const lineErrors: WmsAiIssue[] = [];
    const lineWarnings: WmsAiIssue[] = [];
    const lineRecommendations: WmsAiRecommendation[] = [];
    const linePickingPlan: WmsAiPickingPlanRow[] = [];

    const product = findProductBySku(products, sku);
    const productName =
      getString(product || {}, ['productName', 'name', 'description']) ||
      productNameFromLine;

    /**
     * Basic line validation
     */
    if (!sku) {
      const issue = createError({
        key: 'missing-sku',
        lineNo,
        field: 'sku',
        title: 'Missing SKU',
        message: `Line ${lineNo}: SKU is required.`,
      });

      lineErrors.push(issue);
      errors.push(issue);
    }

    if (requiredQty <= 0) {
      const issue = createError({
        key: 'invalid-qty',
        lineNo,
        sku,
        field: 'quantity',
        title: 'Invalid quantity',
        message: `Line ${lineNo}${sku ? ` (${sku})` : ''}: quantity must be greater than 0.`,
      });

      lineErrors.push(issue);
      errors.push(issue);
    }

    if (mergedOptions.requireBatchNo && !batchNo) {
      const issue = createError({
        key: 'missing-batch',
        lineNo,
        sku,
        field: 'batchNo',
        title: 'Missing batch number',
        message: `Line ${lineNo}${sku ? ` (${sku})` : ''}: Batch No is required for inventory matching.`,
      });

      lineErrors.push(issue);
      errors.push(issue);
    }

    if (mergedOptions.requirePlant && !plant) {
      const issue = createError({
        key: 'missing-plant',
        lineNo,
        sku,
        field: 'plant',
        title: 'Missing plant',
        message: `Line ${lineNo}${sku ? ` (${sku})` : ''}: Plant is required for inventory matching.`,
      });

      lineErrors.push(issue);
      errors.push(issue);
    }

    /**
     * Product master validation
     */
    if (sku && !product) {
      const issue = createError({
        key: 'product-not-found',
        lineNo,
        sku,
        field: 'sku',
        title: 'SKU not found in Product Master',
        message: `Line ${lineNo}: SKU "${sku}" does not exist in Product / SKU Master.`,
      });

      lineErrors.push(issue);
      errors.push(issue);

      lineRecommendations.push({
        id: createIssueId(`line-${lineNo}`, 'create-product-master'),
        priority: 'high',
        lineNo,
        sku,
        title: 'Create or correct product master',
        message: `Add SKU "${sku}" to Product Master or correct the SKU before confirmation.`,
      });
    }

    if (product && mergedOptions.requireActiveProduct && !isProductActive(product)) {
      const issue = createError({
        key: 'inactive-product',
        lineNo,
        sku,
        field: 'sku',
        title: 'Inactive product',
        message: `Line ${lineNo}: SKU "${sku}" is inactive in Product Master.`,
      });

      lineErrors.push(issue);
      errors.push(issue);

      lineRecommendations.push({
        id: createIssueId(`line-${lineNo}`, 'reactivate-product'),
        priority: 'high',
        lineNo,
        sku,
        title: 'Review inactive SKU',
        message: `Reactivate SKU "${sku}" or replace it with an active SKU before shipping.`,
      });
    }

    if (product && isProductBatchControlled(product) && !batchNo) {
      const issue = createError({
        key: 'batch-controlled-missing-batch',
        lineNo,
        sku,
        field: 'batchNo',
        title: 'Batch-controlled SKU missing batch',
        message: `Line ${lineNo}: SKU "${sku}" is batch-controlled but Batch No is blank.`,
      });

      lineErrors.push(issue);
      errors.push(issue);
    }

    if (product && isProductExpiryControlled(product) && !expiryDate) {
      const issue = createWarning({
        key: 'expiry-controlled-no-expiry-filter',
        lineNo,
        sku,
        field: 'expiryDate',
        title: 'Expiry-controlled SKU without expiry filter',
        message: `Line ${lineNo}: SKU "${sku}" is expiry-controlled. Expiry Date is blank, so AI will use FEFO across matching stock.`,
      });

      lineWarnings.push(issue);
      warnings.push(issue);

      lineRecommendations.push({
        id: createIssueId(`line-${lineNo}`, 'use-fefo'),
        priority: 'medium',
        lineNo,
        sku,
        title: 'Use FEFO picking',
        message:
          'Pick inventory with the earliest expiry date first to reduce expiry risk.',
      });
    }

    /**
     * Flexible matching warnings
     */
    if (!location) {
      const issue = createInfo({
        key: 'blank-location-flexible-match',
        lineNo,
        sku,
        field: 'location',
        title: 'Location is flexible',
        message: `Line ${lineNo}${sku ? ` (${sku})` : ''}: Location is blank, so AI will match any location with available stock.`,
      });

      infos.push(issue);
    }

    if (!expiryDate) {
      const issue = createInfo({
        key: 'blank-expiry-flexible-match',
        lineNo,
        sku,
        field: 'expiryDate',
        title: 'Expiry date is flexible',
        message: `Line ${lineNo}${sku ? ` (${sku})` : ''}: Expiry Date is blank, so AI will match any expiry date.`,
      });

      infos.push(issue);
    }

    /**
     * Inventory matching and allocation
     */
    let availableQty = 0;
    let allocatedQty = 0;

    if (sku && requiredQty > 0) {
      const candidates = inventoryWorkingCopy
        .filter((inv) =>
          inventoryMatchesLine(inv.source, {
            sku,
            batchNo,
            plant,
            location,
            expiryDate,
          }),
        )
        .filter((inv) => inv.availableQty > 0)
        .sort((a, b) => compareInventoryForPicking(a.source, b.source));

      availableQty = candidates.reduce(
        (sum, inv) => sum + inv.availableQty,
        0,
      );

      let remainingQty = requiredQty;

      for (const candidate of candidates) {
        if (remainingQty <= 0) break;

        const pickQty = Math.min(candidate.availableQty, remainingQty);

        if (pickQty <= 0) continue;

        const invSource = candidate.source;

        const row: WmsAiPickingPlanRow = {
          lineNo,
          sku,
          productName,
          batchNo: getString(invSource, ['batchNo', 'batch', 'lotNo', 'lot']),
          plant: getString(invSource, [
            'plant',
            'plantCode',
            'site',
            'factory',
          ]),
          location: getString(invSource, [
            'location',
            'locationCode',
            'bin',
            'binLocation',
            'warehouseLocation',
          ]),
          expiryDate: normalizeDateString(
            getString(invSource, [
              'expiryDate',
              'expirationDate',
              'expDate',
              'mfgExpiry',
            ]),
          ),
          inventoryId: getString(invSource, ['id', 'inventoryId', 'stockId']),
          requiredQty,
          pickQty,
          availableQtyBeforePick: candidate.availableQty,
          remainingAfterPick: candidate.availableQty - pickQty,
        };

        candidate.availableQty -= pickQty;
        remainingQty -= pickQty;
        allocatedQty += pickQty;

        pickingPlan.push(row);
        linePickingPlan.push(row);
      }

      /**
       * Stock shortage validation
       */
      if (allocatedQty < requiredQty) {
        const shortageQty = requiredQty - allocatedQty;

        const issue = createError({
          key: 'insufficient-stock',
          lineNo,
          sku,
          field: 'quantity',
          title: 'Insufficient stock',
          message: `Line ${lineNo}: SKU "${sku}" requires ${formatQty(requiredQty)}, but only ${formatQty(allocatedQty)} can be allocated. Shortage: ${formatQty(shortageQty)}.`,
        });

        lineErrors.push(issue);
        errors.push(issue);

        lineRecommendations.push({
          id: createIssueId(`line-${lineNo}`, 'partial-allocation'),
          priority: 'high',
          lineNo,
          sku,
          title: 'Consider partial allocation',
          message: `Available quantity for SKU "${sku}" is ${formatQty(allocatedQty)}. Consider partial shipment or replenishment.`,
        });
      }

      if (availableQty <= 0 && sku) {
        lineRecommendations.push({
          id: createIssueId(`line-${lineNo}`, 'check-inbound-or-transfer'),
          priority: 'high',
          lineNo,
          sku,
          title: 'Check inbound or transfer stock',
          message: `No matching stock was found for SKU "${sku}". Check inbound receipts, transfer stock, or review batch/plant filters.`,
        });
      }

      /**
       * Expiry risk warning
       */
      linePickingPlan.forEach((pick) => {
        const daysToExpiry = getDaysUntilDate(pick.expiryDate, now);

        if (
          typeof daysToExpiry === 'number' &&
          daysToExpiry >= 0 &&
          daysToExpiry <= mergedOptions.expiryWarningDays
        ) {
          const issue = createWarning({
            key: `near-expiry-${pick.expiryDate}`,
            lineNo,
            sku,
            field: 'expiryDate',
            title: 'Near-expiry stock selected',
            message: `Line ${lineNo}: AI selected stock expiring on ${pick.expiryDate}, within ${mergedOptions.expiryWarningDays} days.`,
          });

          lineWarnings.push(issue);
          warnings.push(issue);

          lineRecommendations.push({
            id: createIssueId(`line-${lineNo}`, 'review-near-expiry'),
            priority: 'medium',
            lineNo,
            sku,
            title: 'Review near-expiry allocation',
            message:
              'Confirm customer accepts near-expiry stock or choose a later expiry batch.',
          });
        }

        if (typeof daysToExpiry === 'number' && daysToExpiry < 0) {
          const issue = createError({
            key: `expired-stock-${pick.expiryDate}`,
            lineNo,
            sku,
            field: 'expiryDate',
            title: 'Expired stock selected',
            message: `Line ${lineNo}: Matching inventory includes expired stock with expiry date ${pick.expiryDate}.`,
          });

          lineErrors.push(issue);
          errors.push(issue);
        }
      });
    }

    const shortageQty = Math.max(requiredQty - allocatedQty, 0);

    lineAnalyses.push({
      lineNo,
      sku,
      productName,
      requiredQty,
      availableQty,
      allocatedQty,
      shortageQty,
      status: lineErrors.length
        ? 'blocked'
        : lineWarnings.length
          ? 'warning'
          : 'ready',
      errors: lineErrors,
      warnings: lineWarnings,
      recommendations: lineRecommendations,
      pickingPlan: linePickingPlan,
    });

    recommendations.push(...lineRecommendations);
  });

  const totalRequiredQty = lineAnalyses.reduce(
    (sum, line) => sum + line.requiredQty,
    0,
  );
  const totalAllocatedQty = lineAnalyses.reduce(
    (sum, line) => sum + line.allocatedQty,
    0,
  );
  const totalShortageQty = lineAnalyses.reduce(
    (sum, line) => sum + line.shortageQty,
    0,
  );

  const fullyAllocated =
    totalRequiredQty > 0 && totalAllocatedQty >= totalRequiredQty;

  /**
   * General recommendations
   */
  if (pickingPlan.length > 1) {
    recommendations.push({
      id: createIssueId('shipment', 'review-picking-plan'),
      priority: 'low',
      title: 'Review AI picking plan',
      message:
        'AI generated a suggested picking plan based on SKU, Batch, Plant, optional Location, optional Expiry, and FEFO sequence.',
    });
  }

  if (warnings.length && !errors.length) {
    recommendations.push({
      id: createIssueId('shipment', 'confirm-with-warning'),
      priority: 'medium',
      title: 'Confirm with caution',
      message:
        'Shipment can be confirmed, but warnings should be reviewed before shipping.',
    });
  }

  if (!errors.length && fullyAllocated) {
    recommendations.push({
      id: createIssueId('shipment', 'ready-to-ship'),
      priority: 'low',
      title: 'Ready for outbound processing',
      message:
        'All lines have matching inventory and no blocking validation errors were found.',
    });
  }

  const status: WmsAiStatus = errors.length
    ? 'blocked'
    : warnings.length
      ? 'warning'
      : 'ready';

  const score = calculateScore({
    totalLines: lines.length,
    errorsCount: errors.length,
    warningsCount: warnings.length,
    totalShortageQty,
    totalRequiredQty,
  });

  const canConfirm = errors.length === 0;
  const canShip = errors.length === 0 && fullyAllocated;

  return {
    status,
    score,
    summary: createSummary(status, score, errors.length, warnings.length),
    explanation: createExplanation({
      shipmentNo,
      status,
      canConfirm,
      canShip,
      fullyAllocated,
      totalRequiredQty,
      totalAllocatedQty,
      totalShortageQty,
    }),

    canConfirm,
    canShip,
    fullyAllocated,

    totalLines: lines.length,
    totalRequiredQty,
    totalAllocatedQty,
    totalShortageQty,

    errors,
    warnings,
    infos,
    recommendations: dedupeRecommendations(recommendations),

    pickingPlan,
    lineAnalyses,

    generatedAt: new Date().toISOString(),
  };
}

/**
 * Lightweight helper for table badge rendering.
 * Outbound page can call this when it only needs the status.
 */
export function getOutboundAiStatus(
  input: AnalyzeOutboundShipmentInput,
): WmsAiStatus {
  return analyzeOutboundShipment(input).status;
}

/**
 * Helper for showing readable label in UI.
 */
export function getOutboundAiStatusLabel(status: WmsAiStatus): string {
  if (status === 'blocked') return 'Blocked';
  if (status === 'warning') return 'Warning';
  return 'Ready';
}

/**
 * Helper for Ant Design status colors.
 */
export function getOutboundAiStatusColor(status: WmsAiStatus): string {
  if (status === 'blocked') return 'red';
  if (status === 'warning') return 'orange';
  return 'green';
}

/* -------------------------------------------------------------------------- */
/*                               Helper methods                               */
/* -------------------------------------------------------------------------- */

function getShipmentLines(shipment: Record<string, any>): Record<string, any>[] {
  const possibleKeys = [
    'items',
    'lines',
    'details',
    'shipmentItems',
    'orderItems',
    'products',
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(shipment?.[key])) {
      return shipment[key];
    }
  }

  return [];
}

function getLineSku(line: Record<string, any>): string {
  return getString(line, [
    'sku',
    'skuCode',
    'productSku',
    'productCode',
    'itemCode',
    'materialCode',
  ]);
}

function getLineRequiredQty(line: Record<string, any>): number {
  return getNumber(line, [
    'quantity',
    'qty',
    'requiredQty',
    'shipQty',
    'orderQty',
    'plannedQty',
    'requestedQty',
  ]);
}

function findProductBySku(
  products: Record<string, any>[],
  sku: string,
): Record<string, any> | undefined {
  if (!sku) return undefined;

  return products.find((product) => {
    const productSku = getString(product, [
      'sku',
      'skuCode',
      'productSku',
      'productCode',
      'itemCode',
      'materialCode',
    ]);

    return normalizeKey(productSku) === normalizeKey(sku);
  });
}

function isProductActive(product: Record<string, any>): boolean {
  const status = getString(product, ['status', 'productStatus']);

  if (status) {
    return !['inactive', 'disabled', 'blocked', 'deleted', 'obsolete'].includes(
      status.toLowerCase(),
    );
  }

  const activeValue = product.active ?? product.isActive ?? product.enabled;

  if (typeof activeValue === 'boolean') {
    return activeValue;
  }

  if (typeof activeValue === 'string') {
    return ['true', 'yes', 'y', 'active', 'enabled'].includes(
      activeValue.toLowerCase(),
    );
  }

  return true;
}

function isProductBatchControlled(product: Record<string, any>): boolean {
  return getBoolean(product, [
    'batchControlled',
    'isBatchControlled',
    'batchControl',
    'isBatchControl',
    'lotControlled',
    'isLotControlled',
    'requireBatch',
    'requiresBatch',
    'batchManaged',
  ]);
}

function isProductExpiryControlled(product: Record<string, any>): boolean {
  return getBoolean(product, [
    'expiryControlled',
    'isExpiryControlled',
    'expiryControl',
    'isExpiryControl',
    'expirationControlled',
    'isExpirationControlled',
    'requireExpiry',
    'requiresExpiry',
    'shelfLifeManaged',
    'expiryManaged',
  ]);
}

function isSameCustomer(customer: Record<string, any>, customerKey: string) {
  const keys = [
    'customerCode',
    'customerId',
    'id',
    'code',
    'name',
    'customerName',
  ];

  return keys.some(
    (key) => normalizeKey(customer?.[key]) === normalizeKey(customerKey),
  );
}

function getInventoryAvailableQty(item: Record<string, any>): number {
  const explicitAvailableQty = getNumber(item, [
    'availableQty',
    'availableQuantity',
    'freeQty',
    'unrestrictedQty',
  ]);

  if (explicitAvailableQty > 0) {
    return explicitAvailableQty;
  }

  const totalQty = getNumber(item, [
    'quantity',
    'qty',
    'onHandQty',
    'stockQty',
    'balanceQty',
    'currentQty',
  ]);

  const allocatedQty = getNumber(item, [
    'allocatedQty',
    'reservedQty',
    'committedQty',
  ]);

  return Math.max(totalQty - allocatedQty, 0);
}

function inventoryMatchesLine(
  inventoryItem: Record<string, any>,
  line: {
    sku: string;
    batchNo?: string;
    plant?: string;
    location?: string;
    expiryDate?: string;
  },
): boolean {
  const invSku = getString(inventoryItem, [
    'sku',
    'skuCode',
    'productSku',
    'productCode',
    'itemCode',
    'materialCode',
  ]);

  const invBatchNo = getString(inventoryItem, [
    'batchNo',
    'batch',
    'lotNo',
    'lot',
  ]);

  const invPlant = getString(inventoryItem, [
    'plant',
    'plantCode',
    'site',
    'factory',
  ]);

  const invLocation = getString(inventoryItem, [
    'location',
    'locationCode',
    'bin',
    'binLocation',
    'warehouseLocation',
  ]);

  const invExpiryDate = normalizeDateString(
    getString(inventoryItem, [
      'expiryDate',
      'expirationDate',
      'expDate',
      'mfgExpiry',
    ]),
  );

  if (normalizeKey(invSku) !== normalizeKey(line.sku)) return false;

  /**
   * Batch + Plant are strict when provided.
   * The outbound page validation requires them, but this function also
   * supports safe matching when called from other modules.
   */
  if (line.batchNo && normalizeKey(invBatchNo) !== normalizeKey(line.batchNo)) {
    return false;
  }

  if (line.plant && normalizeKey(invPlant) !== normalizeKey(line.plant)) {
    return false;
  }

  /**
   * Location and expiry are flexible if outbound line is blank.
   */
  if (
    line.location &&
    normalizeKey(invLocation) !== normalizeKey(line.location)
  ) {
    return false;
  }

  if (
    line.expiryDate &&
    normalizeDateString(invExpiryDate) !== normalizeDateString(line.expiryDate)
  ) {
    return false;
  }

  return true;
}

function compareInventoryForPicking(
  a: Record<string, any>,
  b: Record<string, any>,
): number {
  /**
   * FEFO first:
   * - Earliest expiry first
   * - Blank expiry goes last
   */
  const aExpiry = normalizeDateString(
    getString(a, ['expiryDate', 'expirationDate', 'expDate', 'mfgExpiry']),
  );
  const bExpiry = normalizeDateString(
    getString(b, ['expiryDate', 'expirationDate', 'expDate', 'mfgExpiry']),
  );

  const aTime = aExpiry ? new Date(aExpiry).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = bExpiry ? new Date(bExpiry).getTime() : Number.MAX_SAFE_INTEGER;

  if (aTime !== bTime) return aTime - bTime;

  /**
   * Then by location for stable picking.
   */
  const aLocation = getString(a, [
    'location',
    'locationCode',
    'bin',
    'binLocation',
    'warehouseLocation',
  ]);
  const bLocation = getString(b, [
    'location',
    'locationCode',
    'bin',
    'binLocation',
    'warehouseLocation',
  ]);

  return aLocation.localeCompare(bLocation);
}

function calculateScore(input: {
  totalLines: number;
  errorsCount: number;
  warningsCount: number;
  totalShortageQty: number;
  totalRequiredQty: number;
}): number {
  const {
    totalLines,
    errorsCount,
    warningsCount,
    totalShortageQty,
    totalRequiredQty,
  } = input;

  if (totalLines <= 0) return 0;

  let score = 100;

  score -= errorsCount * 25;
  score -= warningsCount * 8;

  if (totalRequiredQty > 0 && totalShortageQty > 0) {
    const shortageRatio = totalShortageQty / totalRequiredQty;
    score -= Math.round(shortageRatio * 40);
  }

  return Math.max(0, Math.min(100, score));
}

function createSummary(
  status: WmsAiStatus,
  score: number,
  errorsCount: number,
  warningsCount: number,
): string {
  if (status === 'blocked') {
    return `Blocked — AI found ${errorsCount} error(s). Readiness score: ${score}%.`;
  }

  if (status === 'warning') {
    return `Warning — AI found ${warningsCount} warning(s). Readiness score: ${score}%.`;
  }

  return `Ready — AI found no blocking issues. Readiness score: ${score}%.`;
}

function createExplanation(input: {
  shipmentNo: string;
  status: WmsAiStatus;
  canConfirm: boolean;
  canShip: boolean;
  fullyAllocated: boolean;
  totalRequiredQty: number;
  totalAllocatedQty: number;
  totalShortageQty: number;
}): string {
  const {
    shipmentNo,
    status,
    canConfirm,
    canShip,
    fullyAllocated,
    totalRequiredQty,
    totalAllocatedQty,
    totalShortageQty,
  } = input;

  const statusText =
    status === 'blocked'
      ? 'has blocking validation issues'
      : status === 'warning'
        ? 'has warnings but no blocking errors'
        : 'is ready';

  return `${shipmentNo} ${statusText}. AI checked Product Master status, required SKU/Batch/Plant fields, flexible Location/Expiry matching, and available inventory. Required quantity is ${formatQty(totalRequiredQty)}, allocated quantity is ${formatQty(totalAllocatedQty)}, and shortage quantity is ${formatQty(totalShortageQty)}. Confirmation is ${
    canConfirm ? 'allowed' : 'not allowed'
  }. Shipping is ${
    canShip && fullyAllocated ? 'allowed' : 'not recommended until fully allocated'
  }.`;
}

function createError(input: {
  key: string;
  title: string;
  message: string;
  lineNo?: number;
  sku?: string;
  field?: string;
}): WmsAiIssue {
  return {
    id: createIssueId(
      input.lineNo ? `line-${input.lineNo}` : 'shipment',
      input.key,
      input.sku,
    ),
    severity: 'error',
    title: input.title,
    message: input.message,
    lineNo: input.lineNo,
    sku: input.sku,
    field: input.field,
  };
}

function createWarning(input: {
  key: string;
  title: string;
  message: string;
  lineNo?: number;
  sku?: string;
  field?: string;
}): WmsAiIssue {
  return {
    id: createIssueId(
      input.lineNo ? `line-${input.lineNo}` : 'shipment',
      input.key,
      input.sku,
    ),
    severity: 'warning',
    title: input.title,
    message: input.message,
    lineNo: input.lineNo,
    sku: input.sku,
    field: input.field,
  };
}

function createInfo(input: {
  key: string;
  title: string;
  message: string;
  lineNo?: number;
  sku?: string;
  field?: string;
}): WmsAiIssue {
  return {
    id: createIssueId(
      input.lineNo ? `line-${input.lineNo}` : 'shipment',
      input.key,
      input.sku,
    ),
    severity: 'info',
    title: input.title,
    message: input.message,
    lineNo: input.lineNo,
    sku: input.sku,
    field: input.field,
  };
}

function createIssueId(...parts: Array<string | number | undefined>): string {
  return parts
    .filter((part) => part !== undefined && part !== null && `${part}` !== '')
    .map((part) =>
      `${part}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    )
    .join('-');
}

function dedupeRecommendations(
  items: WmsAiRecommendation[],
): WmsAiRecommendation[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.title}-${item.message}-${item.lineNo || ''}-${item.sku || ''}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getString(
  obj: Record<string, any> | undefined,
  keys: string[],
  fallback = '',
): string {
  if (!obj) return fallback;

  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return `${value}`.trim();
    }
  }

  return fallback;
}

function getNumber(obj: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = obj?.[key];

    if (value !== undefined && value !== null && value !== '') {
      const parsed = Number(value);

      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function getBoolean(obj: Record<string, any>, keys: string[]): boolean {
  for (const key of keys) {
    const value = obj?.[key];

    if (typeof value === 'boolean') return value;

    if (typeof value === 'string') {
      return ['true', 'yes', 'y', '1', 'active', 'enabled'].includes(
        value.toLowerCase(),
      );
    }

    if (typeof value === 'number') {
      return value === 1;
    }
  }

  return false;
}

function normalizeKey(value: any): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function normalizeDateString(value?: string): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return `${value}`.trim();
  }

  return date.toISOString().slice(0, 10);
}

function getDaysUntilDate(value: string | undefined, today: Date): number | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const targetDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diff = targetDate.getTime() - startToday.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatQty(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}