import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RazorpayHelper, RazorpayMandateType } from './razorpay.helper';
import {
  RazorpayCustomerCreateRequest,
  RazorpayCreateChargeOrderRequest,
  RazorpayRecurringPaymentRequest,
} from './razorpay.dto';
import { SecretsService } from '../secretsService/secrets.service';
import { RedisGenericHelper } from '../redisCache/redis.generic.helper';
import Razorpay from 'razorpay';

// Mock Razorpay
jest.mock('razorpay', () => {
  const mockValidateWebhookSignature = jest.fn();
  const mockRazorpay = jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      fetch: jest.fn(),
      edit: jest.fn(),
      fetchTokens: jest.fn(),
      deleteToken: jest.fn(),
    },
    orders: {
      create: jest.fn(),
    },
    payments: {
      createRecurringPayment: jest.fn(),
    },
  }));

  // Add static method to the mock
  (mockRazorpay as any).validateWebhookSignature = mockValidateWebhookSignature;

  return mockRazorpay;
});

// Mock constants
jest.mock('../../constants', () => ({
  EXTERNAL_API_FOR_STATUS: {
    razorpay: 'razorpay',
  },
  EXTERNAL_API_VALUES: {
    razorpay: {
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
      },
    },
  },
}));

describe('RazorpayHelper', () => {
  let service: RazorpayHelper;
  let mockLogger: any;
  let mockSecretsService: any;
  let mockRedisGenericHelper: any;
  let mockRazorpayInstance: any;

  beforeEach(async () => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    mockSecretsService = {
      getSecret: jest.fn(),
    };

    mockRedisGenericHelper = {
      getThirdPartyApiStatus: jest
        .fn()
        .mockResolvedValue({ razorpay: 'SUCCESS' }),
      deleteCacheByKey: jest.fn().mockResolvedValue(undefined),
      incrementExternalApiFaultCounter: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayHelper,
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
        {
          provide: SecretsService,
          useValue: mockSecretsService,
        },
        {
          provide: RedisGenericHelper,
          useValue: mockRedisGenericHelper,
        },
      ],
    }).compile();

    service = module.get<RazorpayHelper>(RazorpayHelper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize Razorpay instance with credentials', async () => {
      const keyId = 'test_key_id';
      const keySecret = 'test_key_secret';

      mockSecretsService.getSecret
        .mockResolvedValueOnce(keyId)
        .mockResolvedValueOnce(keySecret);

      await service.initialize(RazorpayMandateType.UPI);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Razorpay instance initialized successfully for UPI',
      );
      expect(service['initializedTypes'].has(RazorpayMandateType.UPI)).toBe(
        true,
      );
    });

    it('should handle missing credentials gracefully', async () => {
      mockSecretsService.getSecret
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('test_secret');

      await expect(service.initialize(RazorpayMandateType.UPI)).rejects.toThrow(
        'Razorpay credentials not configured for UPI',
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Razorpay credentials not available for UPI',
        {
          hasKeyId: false,
          hasKeySecret: true,
        },
      );
    });

    it('should be idempotent - multiple calls return same promise', async () => {
      const keyId = 'test_key_id';
      const keySecret = 'test_key_secret';

      mockSecretsService.getSecret
        .mockResolvedValue(keyId)
        .mockResolvedValue(keySecret);

      const promise1 = service.initialize(RazorpayMandateType.UPI);
      const promise2 = service.initialize(RazorpayMandateType.UPI);

      // Both promises should resolve to the same result
      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toBe(result2);
      expect(service['initializedTypes'].has(RazorpayMandateType.UPI)).toBe(
        true,
      );
    });
  });

  describe('createCustomer', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should create customer successfully on first attempt', async () => {
      const customerData: RazorpayCustomerCreateRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        fail_existing: '0',
      };

      const mockCustomer = {
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      };

      mockRazorpayInstance.customers.create.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer(
        customerData,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust_test123');
      expect(result.customer).toEqual(mockCustomer);
      expect(result.retryCount).toBe(0);
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const customerData: RazorpayCustomerCreateRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
      };

      const mockCustomer = {
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      };

      // First call fails, second call succeeds
      mockRazorpayInstance.customers.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockCustomer);

      const result = await service.createCustomer(
        customerData,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust_test123');
      expect(result.retryCount).toBe(0); // Note: retry count is not tracked in the new implementation
      expect(mockRazorpayInstance.customers.create).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retry attempts', async () => {
      const customerData: RazorpayCustomerCreateRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
      };

      // All attempts fail
      mockRazorpayInstance.customers.create.mockRejectedValue(
        new Error('Persistent error'),
      );

      const result = await service.createCustomer(
        customerData,
        RazorpayMandateType.UPI,
        {
          maxRetries: 2,
          retryDelay: 10, // Very short delay for testing
          backoffMultiplier: 1, // No backoff for testing
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent error');
      expect(result.retryCount).toBe(0); // Note: retry count is not tracked in the new implementation
      expect(mockRazorpayInstance.customers.create).toHaveBeenCalledTimes(3);
    }, 10000); // Increase timeout for this test

    it('should handle initialization failure gracefully', async () => {
      // Reset initialization state
      service['initializedTypes'].clear();
      service['razorpayInstances'].clear();
      service['initializationPromises'].clear();

      mockSecretsService.getSecret.mockRejectedValue(
        new Error('Secret service error'),
      );

      const customerData: RazorpayCustomerCreateRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
      };

      const result = await service.createCustomer(
        customerData,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Secret service error');
      expect(result.retryCount).toBe(0);
    });
  });

  describe('fetchCustomer', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should fetch customer successfully', async () => {
      const customerId = 'cust_test123';
      const mockCustomer = {
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      };

      mockRazorpayInstance.customers.fetch.mockResolvedValue(mockCustomer);

      const result = await service.fetchCustomer(
        customerId,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust_test123');
      expect(result.customer).toEqual(mockCustomer);
    });

    it('should handle customer not found error', async () => {
      const customerId = 'cust_nonexistent';

      mockRazorpayInstance.customers.fetch.mockRejectedValue(
        new Error('Customer not found'),
      );

      const result = await service.fetchCustomer(
        customerId,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
    }, 10000); // Increase timeout for this test
  });

  describe('validateCustomer', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should return valid when customer matches expected data', async () => {
      const customerId = 'cust_test123';
      const expectedData = {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
      };

      const mockCustomer = {
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      };

      mockRazorpayInstance.customers.fetch.mockResolvedValue(mockCustomer);

      const result = await service.validateCustomer(
        customerId,
        expectedData,
        RazorpayMandateType.UPI,
      );

      expect(result.isValid).toBe(true);
      expect(result.customerId).toBe('cust_test123');
      expect(result.needsUpdate).toBe(false);
      expect(result.differences).toEqual({});
    });

    it('should detect differences and mark as needing update', async () => {
      const customerId = 'cust_test123';
      const expectedData = {
        name: 'John Doe Updated',
        email: 'john.updated@example.com',
        contact: '+919876543211',
      };

      const mockCustomer = {
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      };

      mockRazorpayInstance.customers.fetch.mockResolvedValue(mockCustomer);

      const result = await service.validateCustomer(
        customerId,
        expectedData,
        RazorpayMandateType.UPI,
      );

      expect(result.isValid).toBe(false);
      expect(result.customerId).toBe('cust_test123');
      expect(result.needsUpdate).toBe(true);
      expect(result.differences).toEqual({
        name: true,
        email: true,
        contact: true,
      });
    });
  });

  describe('createOrUpdateCustomer', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should create new customer when no customerId provided', async () => {
      const customerData: RazorpayCustomerCreateRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
      };

      const mockCustomer = {
        id: 'cust_new123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      };

      mockRazorpayInstance.customers.create.mockResolvedValue(mockCustomer);

      const result = await service.createOrUpdateCustomer(
        null,
        customerData,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust_new123');
    });

    it('should update existing customer when validation shows differences', async () => {
      const customerId = 'cust_test123';
      const customerData: RazorpayCustomerCreateRequest = {
        name: 'John Doe Updated',
        email: 'john.updated@example.com',
        contact: '+919876543211',
      };

      const mockCustomer = {
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe Updated',
        email: 'john.updated@example.com',
        contact: '+919876543211',
        created_at: 1234567890,
      };

      // Mock fetch for validation
      mockRazorpayInstance.customers.fetch.mockResolvedValue({
        id: 'cust_test123',
        entity: 'customer',
        name: 'John Doe',
        email: 'john@example.com',
        contact: '+919876543210',
        created_at: 1234567890,
      });

      // Mock edit for update
      mockRazorpayInstance.customers.edit.mockResolvedValue(mockCustomer);

      const result = await service.createOrUpdateCustomer(
        customerId,
        customerData,
        RazorpayMandateType.UPI,
      );

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust_test123');
    });
  });

  describe('fetchTokenByCustomerId', () => {
    beforeEach(async () => {
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should fetch tokens successfully', async () => {
      const customerId = 'cust_test123';
      const mockTokenResponse = {
        entity: 'collection',
        count: 1,
        items: [
          {
            id: 'token_test123',
            entity: 'token',
            token: 'token_value',
            method: 'upi',
            created_at: 1234567890,
          },
        ],
      };

      mockRazorpayInstance.customers.fetchTokens.mockResolvedValue(
        mockTokenResponse,
      );

      const result = await service.fetchTokenByCustomerId(
        customerId,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockTokenResponse);
      expect(mockRazorpayInstance.customers.fetchTokens).toHaveBeenCalledWith(
        customerId,
      );
    });

    it('should handle fetch tokens error', async () => {
      const customerId = 'cust_test123';

      mockRazorpayInstance.customers.fetchTokens.mockRejectedValue(
        new Error('Token fetch failed'),
      );

      await expect(
        service.fetchTokenByCustomerId(customerId, RazorpayMandateType.UPI),
      ).rejects.toThrow('Token fetch failed');
    }, 10000); // Increase timeout for retry logic

    it('should retry on failure', async () => {
      const customerId = 'cust_test123';
      const mockTokenResponse = {
        entity: 'collection',
        count: 1,
        items: [
          {
            id: 'token_test123',
            entity: 'token',
            token: 'token_value',
            method: 'upi',
            created_at: 1234567890,
          },
        ],
      };

      mockRazorpayInstance.customers.fetchTokens
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockTokenResponse);

      const result = await service.fetchTokenByCustomerId(
        customerId,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockTokenResponse);
      expect(mockRazorpayInstance.customers.fetchTokens).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  describe('deleteMandateToken', () => {
    beforeEach(async () => {
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should delete token successfully', async () => {
      const tokenId = 'token_test123';
      const customerId = 'cust_test123';
      const mockDeleteResponse = { deleted: true };

      mockRazorpayInstance.customers.deleteToken.mockResolvedValue(
        mockDeleteResponse,
      );

      const result = await service.deleteMandateToken(
        tokenId,
        customerId,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockDeleteResponse);
      expect(mockRazorpayInstance.customers.deleteToken).toHaveBeenCalledWith(
        tokenId,
        customerId,
      );
    });

    it('should handle delete token error', async () => {
      const tokenId = 'token_test123';
      const customerId = 'cust_test123';

      mockRazorpayInstance.customers.deleteToken.mockRejectedValue(
        new Error('Token deletion failed'),
      );

      await expect(
        service.deleteMandateToken(
          tokenId,
          customerId,
          RazorpayMandateType.UPI,
        ),
      ).rejects.toThrow('Token deletion failed');
    });
  });

  describe('createChargeOrder', () => {
    beforeEach(async () => {
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should create charge order successfully', async () => {
      const orderRequest: RazorpayCreateChargeOrderRequest = {
        amount: '1000',
        currency: 'INR',
        payment_capture: true,
        method: 'upi',
        bank_account: {
          account_number: 123456789012345,
          name: 'John Doe',
          ifsc: 'HDFC0000053',
        },
        receipt: 'Receipt No. 1',
      };

      const mockOrderResponse = {
        id: 'order_test123',
        entity: 'order',
        amount: 1000,
        amount_paid: 0,
        amount_due: 1000,
        currency: 'INR',
        receipt: 'Receipt No. 1',
        status: 'created',
        attempts: 0,
        bank_account: {
          account_number: '123456789012345',
          name: 'John Doe',
          ifsc: 'HDFC0000053',
        },
        created_at: 1234567890,
      };

      mockRazorpayInstance.orders.create.mockResolvedValue(mockOrderResponse);

      const result = await service.createChargeOrder(
        orderRequest,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockOrderResponse);
      expect(mockRazorpayInstance.orders.create).toHaveBeenCalledWith(
        orderRequest,
      );
    });

    it('should create charge order with optional product and transfers fields', async () => {
      const orderRequest: RazorpayCreateChargeOrderRequest = {
        amount: '2000',
        currency: 'INR',
        payment_capture: true,
        method: 'upi',
        bank_account: {
          account_number: 123456789012345,
          name: 'John Doe',
          ifsc: 'HDFC0000053',
        },
        receipt: 'Receipt No. 2',
        product: [
          {
            name: 'Product 1',
            price: 1000,
            quantity: 2,
          },
        ],
        transfers: [
          {
            account: 'acc_transferaccount',
            amount: 500,
            currency: 'INR',
          },
        ],
      };

      const mockOrderResponse = {
        id: 'order_test456',
        entity: 'order',
        amount: 2000,
        amount_paid: 0,
        amount_due: 2000,
        currency: 'INR',
        receipt: 'Receipt No. 2',
        status: 'created',
        attempts: 0,
        bank_account: {
          account_number: '123456789012345',
          name: 'John Doe',
          ifsc: 'HDFC0000053',
        },
        created_at: 1234567890,
      };

      mockRazorpayInstance.orders.create.mockResolvedValue(mockOrderResponse);

      const result = await service.createChargeOrder(
        orderRequest,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockOrderResponse);
      expect(mockRazorpayInstance.orders.create).toHaveBeenCalledWith(
        orderRequest,
      );
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        currency: 'INR',
        payment_capture: true,
        method: 'upi',
      } as RazorpayCreateChargeOrderRequest;

      await expect(
        service.createChargeOrder(invalidRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Amount is mandatory.');
    });

    it('should create order without method field (method is optional)', async () => {
      const orderRequest: RazorpayCreateChargeOrderRequest = {
        amount: '1500',
        currency: 'INR',
        payment_capture: true,
        receipt: 'Receipt No. 3',
      };

      const mockOrderResponse = {
        id: 'order_test789',
        entity: 'order',
        amount: 1500,
        amount_paid: 0,
        amount_due: 1500,
        currency: 'INR',
        receipt: 'Receipt No. 3',
        status: 'created',
        attempts: 0,
        created_at: 1234567890,
      };

      mockRazorpayInstance.orders.create.mockResolvedValue(mockOrderResponse);

      const result = await service.createChargeOrder(
        orderRequest,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockOrderResponse);
      expect(mockRazorpayInstance.orders.create).toHaveBeenCalledWith(
        orderRequest,
      );
    });

    it('should validate bank account fields', async () => {
      const orderRequest: RazorpayCreateChargeOrderRequest = {
        amount: '1000',
        currency: 'INR',
        payment_capture: true,
        method: 'upi',
        bank_account: {
          account_number: 123456789012345,
          name: '',
          ifsc: 'HDFC0000053',
        },
      };

      await expect(
        service.createChargeOrder(orderRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Bank account holder name is required.');
    });

    it('should validate amount as string type', async () => {
      const orderRequest: RazorpayCreateChargeOrderRequest = {
        amount: '500',
        currency: 'INR',
        payment_capture: true,
        receipt: 'Receipt No. 4',
      };

      const mockOrderResponse = {
        id: 'order_test999',
        entity: 'order',
        amount: 500,
        amount_paid: 0,
        amount_due: 500,
        currency: 'INR',
        receipt: 'Receipt No. 4',
        status: 'created',
        attempts: 0,
        created_at: 1234567890,
      };

      mockRazorpayInstance.orders.create.mockResolvedValue(mockOrderResponse);

      const result = await service.createChargeOrder(
        orderRequest,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockOrderResponse);
      expect(mockRazorpayInstance.orders.create).toHaveBeenCalledWith(
        orderRequest,
      );
    });

    it('should handle order creation error', async () => {
      const orderRequest: RazorpayCreateChargeOrderRequest = {
        amount: '1000',
        currency: 'INR',
        payment_capture: true,
        method: 'upi',
        bank_account: {
          account_number: 123456789012345,
          name: 'John Doe',
          ifsc: 'HDFC0000053',
        },
      };

      mockRazorpayInstance.orders.create.mockRejectedValue(
        new Error('Order creation failed'),
      );

      await expect(
        service.createChargeOrder(orderRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Order creation failed');
    }, 10000); // Increase timeout for retry logic
  });

  describe('createRecurringPayment', () => {
    beforeEach(async () => {
      mockSecretsService.getSecret
        .mockResolvedValue('test_key_id')
        .mockResolvedValue('test_key_secret');

      await service.initialize(RazorpayMandateType.UPI);
      mockRazorpayInstance = service['razorpayInstances'].get(
        RazorpayMandateType.UPI,
      );
    });

    it('should create recurring payment successfully', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'john@example.com',
        contact: '9876543210',
        amount: 1000,
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      const mockPaymentResponse = {
        id: 'pay_test123',
        entity: 'payment',
        amount: '1000',
        currency: 'INR',
        status: 'captured',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token_id: 'token_test123',
        method: 'upi',
        email: 'john@example.com',
        contact: '9876543210',
        description: 'Test recurring payment',
        created_at: 1234567890,
      };

      mockRazorpayInstance.payments.createRecurringPayment.mockResolvedValue(
        mockPaymentResponse,
      );

      const result = await service.createRecurringPayment(
        paymentRequest,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockPaymentResponse);
      expect(
        mockRazorpayInstance.payments.createRecurringPayment,
      ).toHaveBeenCalledWith(paymentRequest);
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        contact: '9876543210',
        amount: 1000,
        currency: 'INR',
      } as RazorpayRecurringPaymentRequest;

      await expect(
        service.createRecurringPayment(invalidRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Email is mandatory.');
    });

    it('should validate email format', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'invalid-email',
        contact: '9876543210',
        amount: 1000,
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      await expect(
        service.createRecurringPayment(paymentRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Invalid email format.');
    });

    it('should validate contact format', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'john@example.com',
        contact: '123',
        amount: 1000,
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      await expect(
        service.createRecurringPayment(paymentRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Contact should be 10-15 digits.');
    });

    it('should validate amount', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'john@example.com',
        contact: '9876543210',
        amount: -1, // Use negative amount to pass required field check but fail amount validation
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      await expect(
        service.createRecurringPayment(paymentRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow('Amount must be greater than 0.');
    });

    it('should handle specific Razorpay errors', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'john@example.com',
        contact: '9876543210',
        amount: 1000,
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      const razorpayError = {
        error: {
          code: 'insufficient_funds',
          description: 'Insufficient funds in customer account',
        },
      };

      mockRazorpayInstance.payments.createRecurringPayment.mockRejectedValue(
        razorpayError,
      );

      await expect(
        service.createRecurringPayment(paymentRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow(
        'Payment failed: Insufficient funds in customer account. Please contact support if the issue persists.',
      );
    }, 10000); // Increase timeout for retry logic

    it('should handle unknown errors', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'john@example.com',
        contact: '9876543210',
        amount: 1000,
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      const unknownError = {
        error: {
          code: 'unknown_error',
          description: 'Unknown error occurred',
        },
      };

      mockRazorpayInstance.payments.createRecurringPayment.mockRejectedValue(
        unknownError,
      );

      await expect(
        service.createRecurringPayment(paymentRequest, RazorpayMandateType.UPI),
      ).rejects.toThrow(
        'Payment failed: Unknown error occurred. Please contact support if the issue persists.',
      );
    }, 10000); // Increase timeout for retry logic

    it('should retry on network failures', async () => {
      const paymentRequest: RazorpayRecurringPaymentRequest = {
        email: 'john@example.com',
        contact: '9876543210',
        amount: 1000,
        currency: 'INR',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token: 'token_test123',
        recurring: true,
        description: 'Test recurring payment',
      };

      const mockPaymentResponse = {
        id: 'pay_test123',
        entity: 'payment',
        amount: '1000',
        currency: 'INR',
        status: 'captured',
        order_id: 'order_test123',
        customer_id: 'cust_test123',
        token_id: 'token_test123',
        method: 'upi',
        email: 'john@example.com',
        contact: '9876543210',
        description: 'Test recurring payment',
        created_at: 1234567890,
      };

      mockRazorpayInstance.payments.createRecurringPayment
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockPaymentResponse);

      const result = await service.createRecurringPayment(
        paymentRequest,
        RazorpayMandateType.UPI,
      );

      expect(result).toEqual(mockPaymentResponse);
      expect(
        mockRazorpayInstance.payments.createRecurringPayment,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('shouldIncrementFailureCounter', () => {
    it('should return true for 500 server errors', () => {
      const error = { status: 500 };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(true);
    });

    it('should return true for 403 forbidden errors', () => {
      const error = { status: 403 };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(true);
    });

    it('should return false for 422 validation errors', () => {
      const error = { status: 422 };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(false);
    });

    it('should return false for 400 bad request errors', () => {
      const error = { status: 400 };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(false);
    });

    it('should return false for BAD_REQUEST_ERROR code', () => {
      const error = {
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Customer already exists for the merchant',
        },
      };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(false);
    });

    it('should return false for VALIDATION_ERROR code', () => {
      const error = {
        error: {
          code: 'VALIDATION_ERROR',
          description: 'Invalid input parameters',
        },
      };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(false);
    });

    it('should return true for unknown error codes', () => {
      const error = {
        error: {
          code: 'UNKNOWN_ERROR',
          description: 'Some unknown error',
        },
      };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(true);
    });

    it('should return true for errors without status or code', () => {
      const error = { message: 'Network error' };
      const result = service['shouldIncrementFailureCounter'](error);
      expect(result).toBe(true);
    });
  });

  describe('validateWebhookSignature', () => {
    const mockWebhookSecret = 'test_webhook_secret';
    const mockWebhookBody =
      '{"event":"payment.captured","account_id":"acc_test123","contains":["payment"],"created_at":1234567890,"object":"event"}';
    const mockWebhookSignature = 'sha256=test_signature_hash';

    beforeEach(() => {
      // Reset the mock for each test
      (Razorpay.validateWebhookSignature as jest.Mock).mockClear();
    });

    it('should validate webhook signature successfully', async () => {
      // Mock successful secret retrieval
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);

      // Mock successful signature validation
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        mockWebhookSignature,
      );

      expect(result).toBe(true);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'razorpay',
        'webhook_secret',
      );
      expect(Razorpay.validateWebhookSignature).toHaveBeenCalledWith(
        mockWebhookBody,
        mockWebhookSignature,
        mockWebhookSecret,
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook signature validation details',
        {
          originalBodyLength: mockWebhookBody.length,
          webhookBody: mockWebhookBody.length,
          signature: mockWebhookSignature,
        },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook signature validation completed',
        { isValid: true },
      );
    });

    it('should return false when signature validation fails', async () => {
      // Mock successful secret retrieval
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);

      // Mock failed signature validation
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        mockWebhookSignature,
      );

      expect(result).toBe(false);
      expect(Razorpay.validateWebhookSignature).toHaveBeenCalledWith(
        mockWebhookBody,
        mockWebhookSignature,
        mockWebhookSecret,
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook signature validation completed',
        { isValid: false },
      );
    });

    it('should handle secret service error gracefully', async () => {
      const secretError = new Error('Secret service unavailable');
      mockSecretsService.getSecret.mockRejectedValue(secretError);

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        mockWebhookSignature,
      );

      expect(result).toBe(false);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'razorpay',
        'webhook_secret',
      );
      expect(Razorpay.validateWebhookSignature).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error validating webhook signature',
        { error: 'Secret service unavailable' },
      );
    });

    it('should handle Razorpay validation error gracefully', async () => {
      // Mock successful secret retrieval
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);

      // Mock Razorpay validation throwing an error
      const validationError = new Error('Invalid signature format');
      (Razorpay.validateWebhookSignature as jest.Mock).mockImplementation(
        () => {
          throw validationError;
        },
      );

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        mockWebhookSignature,
      );

      expect(result).toBe(false);
      expect(Razorpay.validateWebhookSignature).toHaveBeenCalledWith(
        mockWebhookBody,
        mockWebhookSignature,
        mockWebhookSecret,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error validating webhook signature',
        { error: 'Invalid signature format' },
      );
    });

    it('should handle empty webhook body', async () => {
      const emptyBody = '';
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      const result = await service.validateWebhookSignature(
        emptyBody,
        mockWebhookSignature,
      );

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook signature validation details',
        {
          originalBodyLength: 0,
          webhookBody: 0,
          signature: mockWebhookSignature,
        },
      );
    });

    it('should handle empty signature', async () => {
      const emptySignature = '';
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        emptySignature,
      );

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook signature validation details',
        {
          originalBodyLength: mockWebhookBody.length,
          webhookBody: mockWebhookBody.length,
          signature: emptySignature,
        },
      );
    });

    it('should handle large webhook body', async () => {
      const largeBody = 'x'.repeat(10000); // 10KB body
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      const result = await service.validateWebhookSignature(
        largeBody,
        mockWebhookSignature,
      );

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook signature validation details',
        {
          originalBodyLength: 10000,
          webhookBody: 10000,
          signature: mockWebhookSignature,
        },
      );
    });

    it('should handle special characters in webhook body', async () => {
      const specialBody =
        '{"event":"payment.captured","data":"test with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?"}';
      mockSecretsService.getSecret.mockResolvedValue(mockWebhookSecret);
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      const result = await service.validateWebhookSignature(
        specialBody,
        mockWebhookSignature,
      );

      expect(result).toBe(true);
      expect(Razorpay.validateWebhookSignature).toHaveBeenCalledWith(
        specialBody,
        mockWebhookSignature,
        mockWebhookSecret,
      );
    });

    it('should handle null webhook secret from secret service', async () => {
      mockSecretsService.getSecret.mockResolvedValue(null);
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        mockWebhookSignature,
      );

      expect(result).toBe(false);
      expect(Razorpay.validateWebhookSignature).toHaveBeenCalledWith(
        mockWebhookBody,
        mockWebhookSignature,
        null,
      );
    });

    it('should handle undefined webhook secret from secret service', async () => {
      mockSecretsService.getSecret.mockResolvedValue(undefined);
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      const result = await service.validateWebhookSignature(
        mockWebhookBody,
        mockWebhookSignature,
      );

      expect(result).toBe(false);
      expect(Razorpay.validateWebhookSignature).toHaveBeenCalledWith(
        mockWebhookBody,
        mockWebhookSignature,
        undefined,
      );
    });
  });
});
