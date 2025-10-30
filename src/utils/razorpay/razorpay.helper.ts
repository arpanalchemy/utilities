import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import Razorpay from 'razorpay';
import {
  RazorpayCustomerCreateRequest,
  RazorpayCustomerUpdateRequest,
  RazorpayCustomerResponse,
  RazorpayCustomerValidationResult,
  RazorpayRetryConfig,
  RazorpayCustomerOperationResult,
  RazorpayTokenCollectionResponse,
  RazorpayTokenDeleteResult,
  RazorpayBankAccount,
  RazorpayCreateChargeOrderRequest,
  RazorpayCreateChargeOrderResponse,
  RazorpayRecurringPaymentRequest,
  RazorpayRecurringPaymentResponse,
} from './razorpay.dto';
import { SecretsService } from '../secretsService/secrets.service';
import { Logger } from 'winston';
import { RedisGenericHelper } from '../redisCache/redis.generic.helper';
import { EXTERNAL_API_FOR_STATUS, EXTERNAL_API_VALUES } from '../../constants';

type RazorpayOperation<T> = () => Promise<T>;

interface RetryableOperationConfig {
  operationName: string;
  retryConfig?: Partial<RazorpayRetryConfig>;
}

// Enum for mandate types
export enum RazorpayMandateType {
  UPI = 'UPI',
  E_MANDATE = 'E_MANDATE',
}

// Interface for Razorpay instance configuration
interface RazorpayInstanceConfig {
  keyId: string;
  keySecret: string;
  mandateType: RazorpayMandateType;
}

@Injectable()
export class RazorpayHelper {
  @Inject(WINSTON_MODULE_PROVIDER)
  private readonly logger: Logger;

  @Inject()
  private readonly secretService: SecretsService;

  @Inject()
  private readonly redisGenericHelper: RedisGenericHelper;

  // Multiple Razorpay instances for different mandate types
  private razorpayInstances: Map<RazorpayMandateType, Razorpay> = new Map();
  private initializationPromises: Map<RazorpayMandateType, Promise<void>> =
    new Map();
  private initializedTypes: Set<RazorpayMandateType> = new Set();

  /**
   * Get Razorpay instance for specific mandate type
   */
  private getRazorpayInstance(mandateType: RazorpayMandateType): Razorpay {
    const instance = this.razorpayInstances.get(mandateType);
    if (!instance) {
      throw new Error(`Razorpay instance for ${mandateType} not initialized`);
    }
    return instance;
  }

  /**
   * Initialize Razorpay instance for specific mandate type
   */
  async initialize(mandateType: RazorpayMandateType): Promise<void> {
    // If already initialized, return immediately
    if (this.initializedTypes.has(mandateType)) {
      return;
    }

    // If initialization is in progress, return the existing promise
    if (this.initializationPromises.has(mandateType)) {
      return this.initializationPromises.get(mandateType)!;
    }

    // Start initialization
    const initPromise = this.performInitialization(mandateType);
    this.initializationPromises.set(mandateType, initPromise);

    try {
      await initPromise;
      this.initializedTypes.add(mandateType);
    } catch (error) {
      // Reset promise on failure so retry is possible
      this.initializationPromises.delete(mandateType);
      throw error;
    }
  }

  /**
   * Initialize all mandate types at once
   */
  async initializeAll(): Promise<void> {
    const initPromises = [
      this.initialize(RazorpayMandateType.UPI),
      this.initialize(RazorpayMandateType.E_MANDATE),
    ];

    await Promise.allSettled(initPromises);

    // Check if all initialized successfully
    const failedTypes = [
      RazorpayMandateType.UPI,
      RazorpayMandateType.E_MANDATE,
    ].filter((type) => !this.initializedTypes.has(type));

    if (failedTypes.length > 0) {
      throw new Error(
        `Failed to initialize Razorpay for: ${failedTypes.join(', ')}`,
      );
    }
  }

  /**
   * Perform the actual initialization for a specific mandate type
   */
  private async performInitialization(
    mandateType: RazorpayMandateType,
  ): Promise<void> {
    try {
      const config = await this.getCredentialsForMandateType(mandateType);

      // Initialize Razorpay instance
      const razorpayInstance = new Razorpay({
        key_id: config.keyId,
        key_secret: config.keySecret,
      });

      this.razorpayInstances.set(mandateType, razorpayInstance);

      this.logger.info(
        `Razorpay instance initialized successfully for ${mandateType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize Razorpay instance for ${mandateType}`,
        {
          error: this.extractErrorMessage(error),
        },
      );
      throw error;
    }
  }

  /**
   * Get credentials for specific mandate type
   */
  private async getCredentialsForMandateType(
    mandateType: RazorpayMandateType,
  ): Promise<RazorpayInstanceConfig> {
    let keyId: string;
    let keySecret: string;

    switch (mandateType) {
      case RazorpayMandateType.UPI:
        [keyId, keySecret] = await Promise.all([
          this.secretService.getSecret('razorpay', 'upi_key_id'),
          this.secretService.getSecret('razorpay', 'upi_key_secret'),
        ]);
        break;

      case RazorpayMandateType.E_MANDATE:
        [keyId, keySecret] = await Promise.all([
          this.secretService.getSecret('razorpay', 'emandate_key_id'),
          this.secretService.getSecret('razorpay', 'emandate_key_secret'),
        ]);
        break;

      default:
        throw new Error(`Unsupported mandate type: ${mandateType}`);
    }

    // Check if credentials are available
    if (!keyId || !keySecret) {
      this.logger.warn(
        `Razorpay credentials not available for ${mandateType}`,
        {
          hasKeyId: !!keyId,
          hasKeySecret: !!keySecret,
        },
      );
      throw new Error(`Razorpay credentials not configured for ${mandateType}`);
    }

    return { keyId, keySecret, mandateType };
  }

  /**
   * Ensure Razorpay instance is initialized for specific mandate type
   */
  private async ensureInitialized(
    mandateType: RazorpayMandateType,
  ): Promise<void> {
    if (!this.initializedTypes.has(mandateType)) {
      await this.initialize(mandateType);
    }

    if (!this.razorpayInstances.has(mandateType)) {
      throw new Error(`Razorpay instance for ${mandateType} not available`);
    }
  }

  /**
   * Generic retry logic for any Razorpay operation with mandate type
   */
  private async executeWithRetryGeneric<T>(
    operation: RazorpayOperation<T>,
    config: RetryableOperationConfig,
    mandateType: RazorpayMandateType,
  ): Promise<T> {
    try {
      await this.ensureInitialized(mandateType);
    } catch (error) {
      throw new Error(
        `Failed to initialize Razorpay for ${mandateType}: ${this.extractErrorMessage(
          error,
        )}`,
      );
    }

    const retryConfig = {
      ...EXTERNAL_API_VALUES.razorpay.retryConfig,
      ...config.retryConfig,
    };

    const apiKey = EXTERNAL_API_FOR_STATUS.razorpay;

    const checkIfApiFailed = async (): Promise<boolean> => {
      try {
        const statusMap = await this.redisGenericHelper.getThirdPartyApiStatus(
          apiKey,
        );
        const status = statusMap?.[apiKey];
        return status === 'FAILED';
      } catch {
        return false;
      }
    };

    const resetFailureStatus = async () => {
      try {
        await this.redisGenericHelper.deleteCacheByKey(`STATUS_API_${apiKey}`);
      } catch {}
    };

    const incrementFailure = async () => {
      try {
        await this.redisGenericHelper.incrementExternalApiFaultCounter(apiKey);
      } catch {}
    };

    const runAttempt = async (attempt: number): Promise<T> => {
      // If API is marked as failed globally, short-circuit
      if (await checkIfApiFailed()) {
        throw new Error(
          'Razorpay temporarily disabled due to repeated failures. Please try again later.',
        );
      }

      try {
        const result = await operation();

        // On success, reset any previous failure status
        await resetFailureStatus();

        this.logger.info(
          `${config.operationName} completed successfully for ${mandateType}`,
        );
        return result;
      } catch (error) {
        const lastError = this.extractErrorMessage(error);

        // Log error only on final attempt or API failure
        if (attempt >= retryConfig.maxRetries || (await checkIfApiFailed())) {
          this.logger.error(
            `Failed to ${config.operationName.toLowerCase()} for ${mandateType}`,
            {
              error: lastError,
              attempts: attempt + 1,
            },
          );
        }

        // increment global failure counter in redis only for server/authorization errors
        if (this.shouldIncrementFailureCounter(error)) {
          await incrementFailure();
        }

        // If API globally marked as failed OR we've hit local retry cap, stop
        if (attempt >= retryConfig.maxRetries || (await checkIfApiFailed())) {
          throw new Error(lastError);
        }

        const delay =
          retryConfig.retryDelay *
          Math.pow(retryConfig.backoffMultiplier, attempt);
        await this.sleep(delay);
        return runAttempt(attempt + 1);
      }
    };

    return runAttempt(0);
  }

  /**
   * Execute a Razorpay customer operation with retry logic (wrapper for backward compatibility)
   */
  private async executeWithRetry<T>(
    operation: RazorpayOperation<T>,
    config: RetryableOperationConfig,
    mandateType: RazorpayMandateType,
  ): Promise<RazorpayCustomerOperationResult> {
    try {
      const result = await this.executeWithRetryGeneric(
        operation,
        config,
        mandateType,
      );
      return {
        success: true,
        customerId: (result as any).id,
        customer: result as unknown as RazorpayCustomerResponse,
        retryCount: 0, // Note: actual retry count would need to be tracked separately
      };
    } catch (error) {
      return {
        success: false,
        error: this.extractErrorMessage(error),
        retryCount: 0, // Note: actual retry count would need to be tracked separately
      };
    }
  }

  /**
   * Create a new customer on Razorpay for specific mandate type
   */
  async createCustomer(
    customerData: RazorpayCustomerCreateRequest,
    mandateType: RazorpayMandateType,
    retryConfig?: Partial<RazorpayRetryConfig>,
  ): Promise<RazorpayCustomerOperationResult> {
    return this.executeWithRetry(
      () =>
        this.getRazorpayInstance(mandateType).customers.create(
          customerData as any,
        ),
      {
        operationName: 'Creating Razorpay customer',
        retryConfig,
      },
      mandateType,
    );
  }

  /**
   * Fetch customer details from Razorpay for specific mandate type
   */
  async fetchCustomer(
    customerId: string,
    mandateType: RazorpayMandateType,
    retryConfig?: Partial<RazorpayRetryConfig>,
  ): Promise<RazorpayCustomerOperationResult> {
    return this.executeWithRetry(
      () => this.getRazorpayInstance(mandateType).customers.fetch(customerId),
      {
        operationName: 'Fetching Razorpay customer',
        retryConfig,
      },
      mandateType,
    );
  }

  /**
   * Update customer details on Razorpay for specific mandate type
   */
  async updateCustomer(
    customerId: string,
    updateData: RazorpayCustomerUpdateRequest,
    mandateType: RazorpayMandateType,
    retryConfig?: Partial<RazorpayRetryConfig>,
  ): Promise<RazorpayCustomerOperationResult> {
    return this.executeWithRetry(
      () =>
        this.getRazorpayInstance(mandateType).customers.edit(
          customerId,
          updateData,
        ),
      {
        operationName: 'Updating Razorpay customer',
        retryConfig,
      },
      mandateType,
    );
  }

  /**
   * Validate if customer exists and matches the provided details for specific mandate type
   */
  async validateCustomer(
    customerId: string,
    expectedData: {
      name: string;
      email: string;
      contact: string;
    },
    mandateType: RazorpayMandateType,
  ): Promise<RazorpayCustomerValidationResult> {
    try {
      this.logger.info(`Validating Razorpay customer for ${mandateType}`);

      const fetchResult = await this.fetchCustomer(customerId, mandateType);

      if (!fetchResult.success || !fetchResult.customer) {
        return {
          isValid: false,
          error: fetchResult.error || 'Failed to fetch customer',
        };
      }

      const customer = fetchResult.customer;
      const differences: RazorpayCustomerValidationResult['differences'] = {};

      // Check for differences
      if (customer.name !== expectedData.name) {
        differences.name = true;
      }
      if (customer.email !== expectedData.email) {
        differences.email = true;
      }
      if (customer.contact !== expectedData.contact) {
        differences.contact = true;
      }

      const needsUpdate = Object.values(differences).some(Boolean);

      this.logger.info('Customer validation completed', {
        isValid: !needsUpdate,
        needsUpdate,
        differences,
        mandateType,
      });

      return {
        isValid: !needsUpdate,
        customerId,
        needsUpdate,
        differences,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(`Error validating customer for ${mandateType}`, {
        error: errorMessage,
      });

      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create or update customer based on validation for specific mandate type
   */
  async createOrUpdateCustomer(
    customerId: string | null,
    customerData: RazorpayCustomerCreateRequest,
    mandateType: RazorpayMandateType,
    retryConfig?: Partial<RazorpayRetryConfig>,
  ): Promise<RazorpayCustomerOperationResult> {
    try {
      // If no customer ID provided, create new customer
      if (!customerId) {
        return await this.createCustomer(
          customerData,
          mandateType,
          retryConfig,
        );
      }

      // Validate existing customer
      const validationResult = await this.validateCustomer(
        customerId,
        {
          name: customerData.name,
          email: customerData.email,
          contact: customerData.contact,
        },
        mandateType,
      );

      if (!validationResult.isValid) {
        if (validationResult.error) {
          // Customer doesn't exist or can't be fetched, create new one
          return await this.createCustomer(
            customerData,
            mandateType,
            retryConfig,
          );
        }

        if (validationResult.needsUpdate) {
          // Customer exists but needs update
          const updateData: RazorpayCustomerUpdateRequest = {
            name: customerData.name,
            email: customerData.email,
            contact: customerData.contact,
            notes: customerData.notes,
          };
          return await this.updateCustomer(
            customerId,
            updateData,
            mandateType,
            retryConfig,
          );
        }
      }

      // Customer is valid and matches
      return {
        success: true,
        customerId,
        retryCount: 0,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(`Error in createOrUpdateCustomer for ${mandateType}`, {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract error message from Razorpay error response
   */
  private extractErrorMessage(error: any): string {
    if (error?.error?.description) {
      return error.error.description;
    }
    if (error?.message) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  /**
   * Check if error should increment failure counter
   * Only increment for server errors (500) or authorization errors (403)
   * Do not increment for validation errors (422, 400) or client errors
   */
  private shouldIncrementFailureCounter(error: any): boolean {
    // Check for HTTP status code first
    const statusCode =
      error?.status || error?.statusCode || error?.response?.status;

    if (statusCode) {
      // Only increment for server errors (5xx) or forbidden (403)
      return statusCode === 403 || (statusCode >= 500 && statusCode < 600);
    }

    // If no status code, check Razorpay error codes
    const errorCode = error?.error?.code;

    if (errorCode) {
      // Do not increment for validation/bad request errors
      const nonRetryableErrorCodes = [
        'BAD_REQUEST_ERROR',
        'VALIDATION_ERROR',
        'INVALID_REQUEST_ERROR',
        'DUPLICATE_ENTRY_ERROR',
        'NOT_FOUND_ERROR',
        'UNAUTHORIZED_ERROR', // This is different from 403 Forbidden
      ];

      return !nonRetryableErrorCodes.includes(errorCode);
    }

    // If we can't determine the error type, err on the side of caution and increment
    // This ensures we don't miss actual server failures
    return true;
  }

  /**
   * Fetch token by customer id for specific mandate type
   */
  async fetchTokenByCustomerId(
    customerId: string,
    mandateType: RazorpayMandateType,
    retryConfig?: Partial<RazorpayRetryConfig>,
  ): Promise<RazorpayTokenCollectionResponse> {
    return this.executeWithRetryGeneric<RazorpayTokenCollectionResponse>(
      async () =>
        this.getRazorpayInstance(mandateType).customers.fetchTokens(
          customerId,
        ) as unknown as RazorpayTokenCollectionResponse,
      {
        operationName: 'Fetching Razorpay tokens by customer ID',
        retryConfig,
      },
      mandateType,
    ).catch((error) => {
      this.logger.error(`Failed to fetch tokens for customer ${customerId}`, {
        error: this.extractErrorMessage(error),
        mandateType,
      });
      throw error;
    });
  }

  /**
   * Delete mandate token by token id and customer id for specific mandate type
   */
  async deleteMandateToken(
    tokenId: string,
    customerId: string,
    mandateType: RazorpayMandateType,
  ): Promise<RazorpayTokenDeleteResult> {
    await this.ensureInitialized(mandateType);
    return this.getRazorpayInstance(mandateType).customers.deleteToken(
      tokenId,
      customerId,
    );
  }

  /**
   * Create subsequent payments - Create an Order to Charge the Customer for specific mandate type
   * As per Razorpay documentation: You have to create a new order every time you want to charge your customers.
   * This order is different from the one created when you created the authorisation transaction.
   */
  async createChargeOrder(
    paymentRequest: RazorpayCreateChargeOrderRequest,
    mandateType: RazorpayMandateType,
    retryConfig?: Partial<RazorpayRetryConfig>,
  ): Promise<RazorpayCreateChargeOrderResponse> {
    this.validateCreateChargeOrderRequest(paymentRequest);

    return this.executeWithRetryGeneric<RazorpayCreateChargeOrderResponse>(
      async () =>
        this.getRazorpayInstance(mandateType).orders.create(
          paymentRequest as any,
        ) as unknown as RazorpayCreateChargeOrderResponse,
      {
        operationName: 'Creating subsequent payment order',
        retryConfig,
      },
      mandateType,
    ).catch((error) => {
      this.logger.error(`Failed to create charge order`, {
        error: this.extractErrorMessage(error),
        mandateType,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
      });
      throw error;
    });
  }

  /**
   * Validate create charge order request as per Razorpay documentation
   */
  private validateCreateChargeOrderRequest(
    paymentRequest: RazorpayCreateChargeOrderRequest,
  ): void {
    // Required field validations with early returns
    const requiredFields = [
      { field: paymentRequest.amount, message: 'Amount is mandatory.' },
      { field: paymentRequest.currency, message: 'Currency is mandatory.' },
    ];

    for (const { field, message } of requiredFields) {
      if (!field) {
        if (
          field === paymentRequest.method &&
          paymentRequest.method === 'upi' &&
          !paymentRequest.bank_account
        ) {
          throw new Error('bank_account is mandatory for UPI payments.');
        }
        throw new Error(message);
      }
    }

    // Type validation for payment_capture
    if (typeof paymentRequest.payment_capture !== 'boolean') {
      throw new Error(
        'Payment capture flag is mandatory and must be a boolean.',
      );
    }

    // Bank account validation (if provided)
    if (paymentRequest.method === 'upi') {
      this.validateBankAccount(paymentRequest.bank_account);
    }
  }

  /**
   * Validate bank account details
   */
  private validateBankAccount(bankAccount?: RazorpayBankAccount): void {
    if (!bankAccount) return;

    const bankAccountFields = [
      {
        field: bankAccount.account_number,
        message: 'Bank account number is required.',
      },
      {
        field: bankAccount.name,
        message: 'Bank account holder name is required.',
      },
      { field: bankAccount.ifsc, message: 'Bank IFSC code is required.' },
    ];

    for (const { field, message } of bankAccountFields) {
      if (!field) {
        throw new Error(message);
      }
    }
  }

  /**
   * Create recurring payment order for specific mandate type
   */
  async createRecurringPayment(
    paymentRequest: RazorpayRecurringPaymentRequest,
    mandateType: RazorpayMandateType,
  ): Promise<RazorpayRecurringPaymentResponse> {
    this.validateRecurringPaymentRequest(paymentRequest);

    return this.executeWithRetryGeneric<RazorpayRecurringPaymentResponse>(
      async () =>
        this.getRazorpayInstance(mandateType).payments.createRecurringPayment(
          paymentRequest as any,
        ) as unknown as RazorpayRecurringPaymentResponse,
      {
        operationName: 'Creating recurring payment',
      },
      mandateType,
    ).catch((error) => {
      const enhancedError = this.handleRecurringPaymentError(error);
      this.logger.error(`Failed to create recurring payment`, {
        error: enhancedError,
        mandateType,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
      });
      throw new Error(enhancedError);
    });
  }

  /**
   * Validate recurring payment request as per Razorpay documentation
   */
  private validateRecurringPaymentRequest(
    paymentRequest: RazorpayRecurringPaymentRequest,
  ): void {
    // Required field validations
    const requiredFields = [
      { field: paymentRequest.email, message: 'Email is mandatory.' },
      { field: paymentRequest.contact, message: 'Contact is mandatory.' },
      { field: paymentRequest.amount, message: 'Amount is mandatory.' },
      { field: paymentRequest.currency, message: 'Currency is mandatory.' },
      { field: paymentRequest.order_id, message: 'Order ID is mandatory.' },
      {
        field: paymentRequest.customer_id,
        message: 'Customer ID is mandatory.',
      },
      { field: paymentRequest.token, message: 'Token is mandatory.' },
      {
        field: paymentRequest.recurring,
        message: 'Recurring flag is mandatory.',
      },
    ];

    for (const { field, message } of requiredFields) {
      if (!field) {
        throw new Error(message);
      }
    }

    // Type validation for recurring flag
    if (typeof paymentRequest.recurring !== 'boolean') {
      throw new Error('Recurring flag must be a boolean.');
    }

    // Amount validation
    if (paymentRequest.amount <= 0) {
      throw new Error('Amount must be greater than 0.');
    }

    // Email validation (basic)
    const emailRegex = /^[^\s@]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    if (!emailRegex.test(paymentRequest.email)) {
      throw new Error('Invalid email format.');
    }

    // Contact validation (basic - should be numeric and reasonable length)
    if (!/^\d{10,15}$/.test(paymentRequest.contact)) {
      throw new Error('Contact should be 10-15 digits.');
    }
  }

  /**
   * Handle and categorize Razorpay recurring payment errors
   */
  private handleRecurringPaymentError(error: any): string {
    const errorCode = error?.error?.code || error?.code;
    const errorDescription =
      error?.error?.description || error?.message || 'Unknown error occurred';

    // Map of Razorpay error codes to user-friendly messages with solutions
    const errorMap: Record<
      string,
      { message: string; solution: string; retryable: boolean }
    > = {
      // Amount related errors
      amount_exceeds_maximum_amount_allowed: {
        message: 'Amount exceeds maximum amount allowed for this token.',
        solution:
          'Please use an amount equal to or less than the maximum authorized amount for this token.',
        retryable: false,
      },
      invalid_amount: {
        message: 'Invalid amount or currency provided.',
        solution:
          'Please check the amount and currency values in your request.',
        retryable: false,
      },
      amount_mismatch: {
        message: 'Payment amount differs from order amount.',
        solution: 'Ensure the order and payment amounts are identical.',
        retryable: false,
      },

      // Bank account related errors
      bank_account_invalid: {
        message: 'Customer bank account is closed or invalid.',
        solution:
          'Customer needs to re-register the mandate with a valid bank account.',
        retryable: false,
      },
      bank_account_validation_failed: {
        message: 'Bank could not validate customer registration.',
        solution: 'Please retry after some time or contact Razorpay support.',
        retryable: true,
      },
      insufficient_funds: {
        message: 'Insufficient funds in customer account.',
        solution:
          'Customer should add funds to their bank account before retrying.',
        retryable: true,
      },

      // Technical errors (retryable)
      bank_technical_error: {
        message: 'Bank technical error occurred.',
        solution: 'Temporary bank system issue. Please retry after some time.',
        retryable: true,
      },
      gateway_technical_error: {
        message: 'Gateway technical error occurred.',
        solution: 'Temporary gateway issue. Please retry after some time.',
        retryable: true,
      },
      server_error: {
        message: 'Razorpay server error occurred.',
        solution: 'Temporary server issue. Please retry after some time.',
        retryable: true,
      },
      payment_timed_out: {
        message: 'Payment timed out.',
        solution: 'Bank could not process the payment in time. Please retry.',
        retryable: true,
      },

      // Account/Instrument related errors
      debit_instrument_blocked: {
        message: 'Customer account is temporarily blocked for withdrawals.',
        solution: 'Customer should contact their bank to unblock the account.',
        retryable: false,
      },
      debit_instrument_inactive: {
        message: 'Customer account is inactive for withdrawals.',
        solution: 'Customer should contact their bank to activate the account.',
        retryable: false,
      },
      transaction_limit_exceeded: {
        message: 'Transaction limit exceeded.',
        solution:
          'Customer should update their transaction limits with the bank.',
        retryable: true,
      },

      // Mandate related errors
      mandate_not_active: {
        message: 'Registered mandate is no longer active.',
        solution: 'Customer needs to re-register the mandate.',
        retryable: false,
      },
      payment_mandate_not_active: {
        message: 'Mandate is not yet activated by the bank.',
        solution:
          'Please retry after some time as banks may take time to activate mandates.',
        retryable: true,
      },

      // Payment status errors
      payment_cancelled: {
        message: 'Payment was cancelled by the customer.',
        solution:
          'Customer should remove the cancellation request with their bank.',
        retryable: true,
      },
      payment_declined: {
        message: 'Payment was declined by the bank or gateway.',
        solution: 'Please retry after some time or contact Razorpay support.',
        retryable: true,
      },
      payment_failed: {
        message: 'Payment failed due to business or technical reasons.',
        solution: 'Please retry after some time or contact Razorpay support.',
        retryable: true,
      },

      // Validation errors
      input_validation_failed: {
        message: 'Input validation failed.',
        solution:
          'Please check your request parameters and correct any validation issues.',
        retryable: false,
      },
    };

    const errorInfo = errorMap[errorCode];

    if (errorInfo) {
      this.logger.error('Recurring payment error categorized', {
        errorCode,
        message: errorInfo.message,
        retryable: errorInfo.retryable,
      });

      return `${errorInfo.message} Solution: ${errorInfo.solution}`;
    }

    // Handle unknown errors
    this.logger.error('Unknown recurring payment error', {
      errorCode,
      errorDescription,
    });

    return `Payment failed: ${errorDescription}. Please contact support if the issue persists.`;
  }

  /**
   * Validate webhook signature using Razorpay's validateWebhookSignature method
   * This method verifies that the webhook request is authentic and comes from Razorpay
   *
   * @param webhookBody - The raw webhook request body as a string (can be AWS Lambda event or direct webhook body)
   * @param webhookSignature - The signature from the 'X-Razorpay-Signature' header
   * @returns boolean - true if signature is valid, false otherwise
   */
  async validateWebhookSignature(
    webhookBody: string,
    webhookSignature: string,
  ): Promise<boolean> {
    try {
      const webhookSecret = await this.secretService.getSecret(
        'razorpay',
        'webhook_secret',
      );

      this.logger.info('Webhook signature validation details', {
        originalBodyLength: webhookBody.length,
        webhookBody: webhookBody.length,
        signature: webhookSignature,
      });

      // Use Razorpay's built-in validation method
      const isValid = Razorpay.validateWebhookSignature(
        webhookBody,
        webhookSignature,
        webhookSecret,
      );

      this.logger.info('Webhook signature validation completed', {
        isValid,
      });

      return isValid;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error('Error validating webhook signature', {
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
