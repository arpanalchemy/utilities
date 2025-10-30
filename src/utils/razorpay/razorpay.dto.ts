export interface RazorpayCustomerCreateRequest {
  name: string;
  email: string;
  contact: string;
  fail_existing?: string;
  notes?: Record<string, string>;
}

export interface RazorpayCustomerUpdateRequest {
  name?: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string>;
}

export interface RazorpayCustomerResponse {
  id: string;
  entity: string;
  name: string;
  email: string;
  contact: string;
  gstin?: string;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayErrorResponse {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, any>;
  };
}

export interface RazorpayCustomerValidationResult {
  isValid: boolean;
  customerId?: string;
  needsUpdate?: boolean;
  differences?: {
    name?: boolean;
    email?: boolean;
    contact?: boolean;
  };
  error?: string;
}

export interface RazorpayRetryConfig {
  maxRetries: number;
  retryDelay: number; // in milliseconds
  backoffMultiplier: number;
}

export interface RazorpayCustomerOperationResult {
  success: boolean;
  customerId?: string;
  customer?: RazorpayCustomerResponse;
  error?: string;
  retryCount?: number;
}

export interface RazorpayTokenCard {
  entity: string;
  name: string;
  last4: string;
  network: string;
  type: string;
  issuer: string;
  international: boolean;
  emi: boolean;
  sub_type: string;
  expiry_month: string | number;
  expiry_year: string | number;
  flows?: {
    otp?: boolean;
    recurring: boolean;
  };
}

export interface RazorpayTokenVpa {
  username: string;
  handle: string;
  name: string | null;
}

export interface RazorpayTokenRecurringDetails {
  status: 'initiated' | 'confirmed' | 'rejected' | 'cancelled' | 'paused';
  failure_reason?: string | null;
}

export interface RazorpayToken {
  id: string;
  entity: string;
  token: string;
  bank?: string | null;
  wallet?: string | null;
  method: string;
  card?: RazorpayTokenCard;
}

export interface RazorpayTokenCollectionResponse {
  entity: string;
  count: number;
  items: RazorpayToken[];
  vpa?: RazorpayTokenVpa | null;
  recurring?: boolean;
  recurring_details?: RazorpayTokenRecurringDetails | null;
  auth_type?: string | null;
  mrn?: string | null;
  used_at?: number;
  expired_at?: number;
  dcc_enabled?: boolean;
  created_at?: number;
}

export interface RazorpayTokenDeleteResult {
  deleted: boolean;
}

export interface RazorpayBankAccount {
  account_number: number;
  name: string;
  ifsc: string;
}

export interface RazorpayCreateChargeOrderRequest {
  amount: string;
  currency: string;
  payment_capture: boolean;
  method?: string;
  bank_account?: RazorpayBankAccount;
  receipt?: string;
  product?: any[];
  transfers?: any[];
  notes?: Record<string, string>;
}

export interface RazorpayCreateChargeOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  offer_id: string | null;
  status: string;
  attempts: number;
  bank_account?: RazorpayBankAccount;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayRecurringPaymentRequest {
  email: string;
  contact: string;
  amount: number;
  currency: string;
  order_id: string;
  customer_id: string;
  token: string;
  recurring: boolean | string;
  description: string;
  notes?: Record<string, string>;
}

export interface RazorpayRecurringPaymentResponse {
  razorpay_payment_id: string;
}
