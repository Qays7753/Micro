export type Currency = 'JOD';
export type MoneyMinor = number;

export type KnowledgeState =
  | 'known'
  | 'estimated'
  | 'partial'
  | 'incomplete'
  | 'stale'
  | 'variable';

export type ResultStatus =
  | 'final'
  | 'estimated'
  | 'incomplete'
  | 'review_required';

export type DepositSettlementDecision =
  | 'refund_deposit'
  | 'retain_deposit'
  | 'needs_review';

export type CostSource = 'user_input' | 'historical_price' | 'estimate';
export type CostConfidence = 'known' | 'estimated';

export interface MaterialCostItem {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: MoneyMinor;
  priceDate: string;
  source: CostSource;
  confidence: CostConfidence;
}

export interface TimeCost {
  minutes: number | null;
  hourlyRateMinor: MoneyMinor | null;
  confidence: CostConfidence;
}

export interface CostSnapshotInput {
  currency: Currency;
  materialItems: MaterialCostItem[];
  time: TimeCost | null;
  packagingMinor: MoneyMinor;
  deliveryMinor: MoneyMinor;
  wasteMinor: MoneyMinor;
  safetyBufferMinor: MoneyMinor;
  quantity: number;
  createdAt: string;
  source: 'draft' | 'price_approval' | 'order_confirmation' | 'revision';
  freshnessDays?: number | null;
}

export interface CostSnapshot {
  id: string;
  currency: Currency;
  materialCostMinor: MoneyMinor;
  timeCostMinor: MoneyMinor;
  packagingMinor: MoneyMinor;
  deliveryMinor: MoneyMinor;
  wasteMinor: MoneyMinor;
  plannedCostMinor: MoneyMinor;
  unitCostMinor: MoneyMinor;
  priceFloorMinor: MoneyMinor;
  quantity: number;
  knowledgeState: KnowledgeState;
  input: CostSnapshotInput;
  createdAt: string;
}

export type OrderStatus =
  | 'draft'
  | 'provisional_agreement'
  | 'confirmed'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'settled'
  | 'postponed'
  | 'cancelled'
  | 'needs_review';

export type SettlementStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'debt'
  | 'cancelled'
  | 'cancelled_pending'
  | 'cancelled_refunded'
  | 'cancelled_retained';

export type OrderEventType =
  | 'created'
  | 'price_approved'
  | 'status_changed'
  | 'deposit_collected'
  | 'deposit_refunded'
  | 'deposit_retained'
  | 'collection_recorded'
  | 'debt_registered'
  | 'specification_revised'
  | 'cancelled';

export interface OrderEvent {
  id: string;
  type: OrderEventType;
  idempotencyKey: string;
  createdAt: string;
  note?: string;
  amountMinor?: MoneyMinor;
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
}

export interface CraftOrder {
  id: string;
  customerName: string;
  itemName: string;
  specifications: string;
  quantity: number;
  currency: Currency;
  agreedPriceMinor: MoneyMinor;
  costSnapshot: CostSnapshot;
  costSnapshots: CostSnapshot[];
  status: OrderStatus;
  settlementStatus: SettlementStatus;
  depositCollectedMinor: MoneyMinor;
  depositSettlement: DepositSettlementDecision | null;
  collectedMinor: MoneyMinor;
  receivableMinor: MoneyMinor;
  recognizedRevenueMinor: MoneyMinor;
  recognizedCostMinor: MoneyMinor;
  profitIndicatorMinor: MoneyMinor | null;
  resultStatus: ResultStatus;
  nextAction: string;
  events: OrderEvent[];
  createdAt: string;
}

export interface CreateCraftOrderInput {
  id: string;
  customerName: string;
  itemName: string;
  specifications: string;
  quantity: number;
  agreedPriceMinor: MoneyMinor;
  costSnapshot: CostSnapshot;
  createdAt: string;
}

export interface OrderTransitionInput {
  to: OrderStatus;
  idempotencyKey: string;
  createdAt: string;
  note?: string;
}
