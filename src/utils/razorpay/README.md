# Razorpay Helper

A comprehensive helper class for integrating with the Razorpay payment gateway, supporting multiple accounts for different mandate types.

## Features

- **Multi-Account Support**: Manage separate Razorpay accounts for UPI and E-MANDATE
- **Customer Management**: Create, fetch, update, and validate customers
- **Token Management**: Fetch and delete mandate tokens
- **Payment Operations**: Create charge orders and recurring payments
- **Advanced Retry Logic**: Configurable retry with exponential backoff
- **Health Monitoring**: Track API health and gracefully degrade when needed

## Setup

### 1. Configure Secrets

Set up the following secrets in your secrets service:

```typescript
// UPI Account
razorpay.upi_key_id: "your_upi_key_id"
razorpay.upi_key_secret: "your_upi_key_secret"

// E-MANDATE Account  
razorpay.emandate_key_id: "your_emandate_key_id"
razorpay.emandate_key_secret: "your_emandate_key_secret"
```

### 2. Initialize the Helper

```typescript
import { RazorpayHelper, RazorpayMandateType } from './razorpay.helper';

@Injectable()
export class PaymentService {
  constructor(private readonly razorpayHelper: RazorpayHelper) {}

  async initialize() {
    // Initialize all mandate types at once
    await this.razorpayHelper.initializeAll();
    
    // Or initialize specific types
    await this.razorpayHelper.initialize(RazorpayMandateType.UPI);
    await this.razorpayHelper.initialize(RazorpayMandateType.E_MANDATE);
  }
}
```

## Usage Examples

### Customer Management

```typescript
// Create customer for UPI
const upiCustomer = await this.razorpayHelper.createCustomer(
  customerData,
  RazorpayMandateType.UPI
);

// Create customer for E-MANDATE
const emandateCustomer = await this.razorpayHelper.createCustomer(
  customerData,
  RazorpayMandateType.E_MANDATE
);

// Fetch customer from specific account
const customer = await this.razorpayHelper.fetchCustomer(
  customerId,
  RazorpayMandateType.UPI
);
```

### Payment Operations

```typescript
// Create charge order for UPI
const upiOrder = await this.razorpayHelper.createChargeOrder(
  orderRequest,
  RazorpayMandateType.UPI
);

// Create recurring payment for E-MANDATE
const emandatePayment = await this.razorpayHelper.createRecurringPayment(
  paymentRequest,
  RazorpayMandateType.E_MANDATE
);
```

### Token Management

```typescript
// Fetch tokens for UPI customer
const upiTokens = await this.razorpayHelper.fetchTokenByCustomerId(
  customerId,
  RazorpayMandateType.UPI
);

// Delete mandate token from E-MANDATE account
await this.razorpayHelper.deleteMandateToken(
  tokenId,
  customerId,
  RazorpayMandateType.E_MANDATE
);
```

## Mandate Types

### UPI (Unified Payments Interface)
- Used for UPI-based recurring payments
- Requires separate Razorpay account credentials
- Handles UPI-specific payment flows

### E-MANDATE (Electronic Mandate)
- Used for bank account-based recurring payments
- Requires separate Razorpay account credentials
- Handles NACH/e-mandate specific flows

## Error Handling

The helper includes comprehensive error handling with:
- Retry logic with exponential backoff
- Error categorization for recurring payments
- User-friendly error messages with solutions
- Graceful degradation when APIs are unhealthy

## Security Features

- All sensitive data is redacted in logs
- Credentials are managed through secrets service
- No sensitive information is exposed in error messages

## Best Practices

1. **Initialize Early**: Call `initializeAll()` during application startup
2. **Handle Failures**: Always check operation results for success/failure
3. **Use Appropriate Mandate Type**: Choose UPI or E-MANDATE based on payment method
4. **Monitor Health**: The helper automatically tracks API health and degrades gracefully
5. **Secure Logging**: Sensitive data is automatically redacted

## Configuration

### Retry Configuration

```typescript
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

const result = await this.razorpayHelper.createCustomer(
  customerData,
  RazorpayMandateType.UPI,
  retryConfig
);
```

### Health Monitoring

The helper automatically:
- Tracks API health in Redis
- Disables operations when APIs are unhealthy
- Resets health status on successful operations
- Provides graceful degradation during outages
