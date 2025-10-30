# Razorpay Helper Changelog

## [2.0.0] - Multi-Instance Support - 2024-09-01

### 🚀 Major New Features

#### **Multi-Account Support**

- **UPI Account**: Dedicated Razorpay instance for UPI-based payments
- **E-MANDATE Account**: Dedicated Razorpay instance for electronic mandate payments
- **Separate Credentials**: Each account type uses different API keys and secrets
- **Independent Initialization**: Initialize accounts individually or all at once

#### **Enhanced Architecture**

- **Instance Management**: Map-based storage for multiple Razorpay instances
- **Type-Safe Operations**: All methods now require mandate type specification
- **Credential Isolation**: Separate secret management for each account type

### 🔧 API Changes

#### **Breaking Changes**

- All public methods now require `mandateType` parameter
- `initialize()` method signature changed to accept mandate type
- New enum `RazorpayMandateType` for type safety

#### **New Methods**

- `initialize(mandateType: RazorpayMandateType)`: Initialize specific account
- `initializeAll()`: Initialize all mandate types at once
- `getRazorpayInstance(mandateType)`: Get instance for specific type

#### **Updated Method Signatures**

```typescript
// Before
await razorpayHelper.createCustomer(customerData);

// After
await razorpayHelper.createCustomer(customerData, RazorpayMandateType.UPI);
await razorpayHelper.createCustomer(
  customerData,
  RazorpayMandateType.E_MANDATE,
);
```

### 🔐 Security Improvements

#### **Credential Management**

- **UPI Credentials**: `razorpay.upi_key_id` and `razorpay.upi_key_secret`
- **E-MANDATE Credentials**: `razorpay.emandate_key_id` and `razorpay.emandate_key_secret`
- **Automatic Fallback**: Graceful handling when credentials are unavailable

#### **Enhanced Logging Security**

- All sensitive identifiers redacted in logs
- No customer IDs, tokens, or payment IDs exposed
- Clean, secure logging without complexity

### 📝 Simplified Logging

#### **Before (Complex)**

```typescript
logContext: {
  amount: paymentRequest.amount,
  currency: paymentRequest.currency,
  customer_id: '[REDACTED]',
  order_id: '[REDACTED]',
  token: '[REDACTED]',
}
```

#### **After (Simple)**

```typescript
// No complex context objects
// Only essential information logged
// Cleaner, more maintainable code
```

### 🏗️ Architecture Improvements

#### **Instance Management**

```typescript
// Multiple instances stored in Map
private razorpayInstances: Map<RazorpayMandateType, Razorpay> = new Map();

// Independent initialization tracking
private initializedTypes: Set<RazorpayMandateType> = new Set();
```

#### **Credential Resolution**

```typescript
private async getCredentialsForMandateType(mandateType: RazorpayMandateType) {
  switch (mandateType) {
    case RazorpayMandateType.UPI:
      return await this.getUPICredentials();
    case RazorpayMandateType.E_MANDATE:
      return await this.getEMandateCredentials();
  }
}
```

### 📚 New Documentation

#### **Usage Examples**

- Complete usage examples for multi-instance setup
- Batch operations across multiple accounts
- Payment processing by mandate type
- Token management for different account types

#### **Configuration Guide**

- Secret configuration for multiple accounts
- Initialization patterns
- Best practices for multi-account usage

### 🔄 Migration Guide

#### **Step 1: Update Secret Configuration**

```typescript
// Old
razorpay.mf_key_id: "single_key_id"
razorpay.mf_key_secret: "single_key_secret"

// New
razorpay.upi_key_id: "upi_key_id"
razorpay.upi_key_secret: "upi_key_secret"
razorpay.emandate_key_id: "emandate_key_id"
razorpay.emandate_key_secret: "emandate_key_secret"
```

#### **Step 2: Update Method Calls**

```typescript
// Old
const customer = await razorpayHelper.createCustomer(customerData);

// New
const customer = await razorpayHelper.createCustomer(
  customerData,
  RazorpayMandateType.UPI,
);
```

#### **Step 3: Update Initialization**

```typescript
// Old
await razorpayHelper.initialize();

// New
await razorpayHelper.initializeAll();
// OR
await razorpayHelper.initialize(RazorpayMandateType.UPI);
```

### 🧪 Testing

#### **Comprehensive Coverage**

- Multi-instance initialization tests
- Cross-account operation tests
- Error handling for different mandate types
- Credential validation tests

### 🚦 Performance Improvements

#### **Lazy Initialization**

- Instances initialized only when needed
- Parallel initialization support
- Efficient credential caching

#### **Reduced Logging Overhead**

- Simplified log context objects
- Fewer string operations
- Cleaner error handling

### 🔍 Monitoring & Observability

#### **Enhanced Logging**

- Mandate type context in all operations
- Clear account identification in logs
- Simplified debugging information

#### **Health Tracking**

- Independent health monitoring per account
- Graceful degradation when accounts are unhealthy
- Redis-based API status tracking

### 📋 Backward Compatibility

#### **Not Supported**

- Old single-instance method signatures
- Legacy credential configuration
- Single account initialization

#### **Migration Required**

- All method calls must specify mandate type
- Secret configuration must be updated
- Initialization patterns must be changed

### 🎯 Use Cases

#### **UPI Payments**

- UPI-based recurring payments
- UPI mandate management
- UPI-specific payment flows

#### **E-MANDATE Payments**

- Bank account-based recurring payments
- NACH/e-mandate processing
- Electronic mandate management

#### **Hybrid Scenarios**

- Multiple payment methods per customer
- Cross-account customer management
- Batch operations across account types

---

## [1.0.0] - Initial Release

### Features

- Basic Razorpay integration
- Customer management
- Token operations
- Payment processing
- Retry logic
- Error handling
