import { describe, it, expect } from 'vitest';
import {
  ErrorCategory,
  ContractError,
  ContractViolationError
} from '~/core/errors'; // Adjust import path as needed

describe('Error Classes', () => {
  describe('ErrorCategory', () => {
    it('should contain all expected error categories', () => {
      expect(ErrorCategory.NETWORK).toBe('NETWORK');
      expect(ErrorCategory.VALIDATION).toBe('VALIDATION');
      expect(ErrorCategory.AUTHENTICATION).toBe('AUTHENTICATION');
      expect(ErrorCategory.AUTHORIZATION).toBe('AUTHORIZATION');
      expect(ErrorCategory.BUSINESS_LOGIC).toBe('BUSINESS_LOGIC');
      expect(ErrorCategory.SYSTEM).toBe('SYSTEM');
      expect(ErrorCategory.UNKNOWN).toBe('UNKNOWN');
    });

    it('should have string values for all categories', () => {
      Object.values(ErrorCategory).forEach(category => {
        expect(typeof category).toBe('string');
      });
    });
  });

  describe('ContractError', () => {
    describe('Basic construction', () => {
      it('should create a basic error with message only', () => {
        const error = new ContractError('Something went wrong');

        expect(error.message).toBe('Something went wrong');
        expect(error.name).toBe('ContractError');
        expect(error.category).toBe(ErrorCategory.UNKNOWN);
        expect(error.code).toBeUndefined();
        expect(error.details).toBeUndefined();
        expect(error.isRecoverable).toBeUndefined();
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ContractError);
      });

      it('should create an error with all options', () => {
        const details = { userId: '123', action: 'update' };
        const error = new ContractError('Validation failed', {
          code: 'INVALID_INPUT',
          category: ErrorCategory.VALIDATION,
          details: details,
          isRecoverable: true
        });

        expect(error.message).toBe('Validation failed');
        expect(error.name).toBe('ContractError');
        expect(error.code).toBe('INVALID_INPUT');
        expect(error.category).toBe(ErrorCategory.VALIDATION);
        expect(error.details).toEqual(details);
        expect(error.isRecoverable).toBe(true);
      });

      it('should create an error with partial options', () => {
        const error = new ContractError('Network timeout', {
          category: ErrorCategory.NETWORK,
          isRecoverable: true
        });

        expect(error.message).toBe('Network timeout');
        expect(error.category).toBe(ErrorCategory.NETWORK);
        expect(error.isRecoverable).toBe(true);
        expect(error.code).toBeUndefined();
        expect(error.details).toBeUndefined();
      });
    });

    describe('Category-specific errors', () => {
      it('should create a network error', () => {
        const error = new ContractError('Connection failed', {
          category: ErrorCategory.NETWORK,
          code: 'CONN_TIMEOUT',
          isRecoverable: true
        });

        expect(error.category).toBe(ErrorCategory.NETWORK);
        expect(error.isRecoverable).toBe(true);
      });

      it('should create a validation error', () => {
        const error = new ContractError('Invalid email format', {
          category: ErrorCategory.VALIDATION,
          code: 'EMAIL_INVALID',
          details: { field: 'email', value: 'invalid-email' },
          isRecoverable: false
        });

        expect(error.category).toBe(ErrorCategory.VALIDATION);
        expect(error.details).toEqual({ field: 'email', value: 'invalid-email' });
      });

      it('should create an authentication error', () => {
        const error = new ContractError('Token expired', {
          category: ErrorCategory.AUTHENTICATION,
          code: 'TOKEN_EXPIRED',
          isRecoverable: false
        });

        expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(error.code).toBe('TOKEN_EXPIRED');
      });

      it('should create an authorization error', () => {
        const error = new ContractError('Insufficient permissions', {
          category: ErrorCategory.AUTHORIZATION,
          code: 'PERMISSION_DENIED',
          details: { requiredRole: 'admin', userRole: 'user' }
        });

        expect(error.category).toBe(ErrorCategory.AUTHORIZATION);
        expect(error.details?.requiredRole).toBe('admin');
      });

      it('should create a business logic error', () => {
        const error = new ContractError('Order cannot be cancelled', {
          category: ErrorCategory.BUSINESS_LOGIC,
          code: 'ORDER_CANCELLATION_FAILED',
          details: { orderId: '12345', status: 'shipped' }
        });

        expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
        expect(error.details?.orderId).toBe('12345');
      });

      it('should create a system error', () => {
        const error = new ContractError('Database connection failed', {
          category: ErrorCategory.SYSTEM,
          code: 'DB_CONNECTION_ERROR',
          isRecoverable: true
        });

        expect(error.category).toBe(ErrorCategory.SYSTEM);
        expect(error.isRecoverable).toBe(true);
      });
    });

    describe('Error inheritance', () => {
      it('should maintain Error properties', () => {
        const error = new ContractError('Test error');

        expect(error.stack).toBeDefined();
        expect(error.toString()).toContain('ContractError: Test error');
      });

      it('should be catchable as Error', () => {
        const error = new ContractError('Test error');

        expect(() => {
          throw error;
        }).toThrow(Error);
      });

      it('should be catchable as ContractError', () => {
        const error = new ContractError('Test error');

        expect(() => {
          throw error;
        }).toThrow(ContractError);
      });
    });
  });

  describe('ContractViolationError', () => {
    describe('Construction with ContractError', () => {
      it('should create violation error from ContractError', () => {
        const originalError = new ContractError('Validation failed', {
          code: 'INVALID_INPUT',
          category: ErrorCategory.VALIDATION,
          details: { field: 'email' },
          isRecoverable: false
        });

        const violationError = new ContractViolationError(
          'validateUser',
          'business',
          originalError
        );

        expect(violationError.message).toBe(
          'Contract violation in business.validateUser: Validation failed'
        );
        expect(violationError.name).toBe('ContractViolationError');
        expect(violationError.contractName).toBe('validateUser');
        expect(violationError.layer).toBe('business');
        expect(violationError.originalError).toBe(originalError);
        expect(violationError.code).toBe('INVALID_INPUT');
        expect(violationError.category).toBe(ErrorCategory.VALIDATION);
        expect(violationError.isRecoverable).toBe(false);
      });

      it('should preserve original error details and add metadata', () => {
        const originalDetails = { userId: '123', action: 'delete' };
        const originalError = new ContractError('Permission denied', {
          code: 'PERMISSION_DENIED',
          category: ErrorCategory.AUTHORIZATION,
          details: originalDetails,
          isRecoverable: false
        });

        const violationError = new ContractViolationError(
          'deleteUser',
          'action',
          originalError
        );

        expect(violationError.details).toEqual({
          ...originalDetails,
          originalErrorMessage: 'Permission denied',
          originalErrorStack: originalError.stack
        });
      });
    });

    describe('Construction with generic Error', () => {
      it('should create violation error from generic Error', () => {
        const originalError = new Error('Database connection failed');

        const violationError = new ContractViolationError(
          'saveUser',
          'data',
          originalError
        );

        expect(violationError.message).toBe(
          'Contract violation in data.saveUser: Database connection failed'
        );
        expect(violationError.name).toBe('ContractViolationError');
        expect(violationError.contractName).toBe('saveUser');
        expect(violationError.layer).toBe('data');
        expect(violationError.originalError).toBe(originalError);
        expect(violationError.code).toBe('CONTRACT_VIOLATION');
        expect(violationError.category).toBe(ErrorCategory.BUSINESS_LOGIC);
        expect(violationError.isRecoverable).toBe(false);
      });

      it('should add error metadata for generic Error', () => {
        const originalError = new Error('Something went wrong');
        originalError.stack = 'Error stack trace';

        const violationError = new ContractViolationError(
          'processOrder',
          'business',
          originalError
        );

        expect(violationError.details).toEqual({
          originalErrorMessage: 'Something went wrong',
          originalErrorStack: 'Error stack trace'
        });
      });
    });

    describe('getAppropriateResponse', () => {
      it('should return presentation layer response', () => {
        const originalError = new ContractError('Not authenticated');
        const violationError = new ContractViolationError(
          'getProfile',
          'presentation',
          originalError
        );

        const response = violationError.getAppropriateResponse();

        expect(response).toEqual({
          redirect: '/login',
          error: 'Authentication required'
        });
      });

      it('should return action layer response', () => {
        const originalError = new ContractError('Invalid data provided');
        const violationError = new ContractViolationError(
          'updateProfile',
          'action',
          originalError
        );

        const response = violationError.getAppropriateResponse();

        expect(response).toEqual({
          success: false,
          error: 'Invalid data provided'
        });
      });

      it('should return business layer response', () => {
        const originalError = new ContractError('Business rule violated');
        const violationError = new ContractViolationError(
          'processPayment',
          'business',
          originalError
        );

        const response = violationError.getAppropriateResponse();

        expect(response).toEqual({
          success: false,
          error: 'Permission denied'
        });
      });

      it('should return data layer response', () => {
        const originalError = new ContractError('Database query failed');
        const violationError = new ContractViolationError(
          'findUser',
          'data',
          originalError
        );

        const response = violationError.getAppropriateResponse();

        expect(response).toEqual({
          success: false,
          error: 'Operation failed'
        });
      });

      it('should return default response for unknown layer', () => {
        const originalError = new ContractError('Unknown error');
        const violationError = new ContractViolationError(
          'unknownMethod',
          'unknown',
          originalError
        );

        const response = violationError.getAppropriateResponse();

        expect(response).toEqual({
          success: false,
          error: 'An error occurred'
        });
      });

      it('should return default response for custom layer', () => {
        const originalError = new ContractError('Custom layer error');
        const violationError = new ContractViolationError(
          'customMethod',
          'custom_layer',
          originalError
        );

        const response = violationError.getAppropriateResponse();

        expect(response).toEqual({
          success: false,
          error: 'An error occurred'
        });
      });
    });

    describe('Error inheritance', () => {
      it('should be instance of Error and ContractError', () => {
        const originalError = new ContractError('Test error');
        const violationError = new ContractViolationError(
          'testMethod',
          'business',
          originalError
        );

        expect(violationError).toBeInstanceOf(Error);
        expect(violationError).toBeInstanceOf(ContractError);
        expect(violationError).toBeInstanceOf(ContractViolationError);
      });

      it('should maintain error stack trace', () => {
        const originalError = new ContractError('Test error');
        const violationError = new ContractViolationError(
          'testMethod',
          'business',
          originalError
        );

        expect(violationError.stack).toBeDefined();
        expect(typeof violationError.stack).toBe('string');
      });
    });

    describe('Complex scenarios', () => {
      it('should handle nested error scenarios', () => {
        const dataError = new ContractError('Failed to save user', {
          code: 'DATA_SAVE_ERROR',
          category: ErrorCategory.SYSTEM,
          isRecoverable: true
        });
        
        const violationError = new ContractViolationError(
          'saveUserProfile',
          'data',
          dataError
        );

        expect(violationError.originalError).toBe(dataError);
        expect(violationError.category).toBe(ErrorCategory.SYSTEM);
        expect(violationError.isRecoverable).toBe(true);
      });

      it('should handle error with extensive details', () => {
        const originalError = new ContractError('Validation failed', {
          code: 'COMPLEX_VALIDATION_ERROR',
          category: ErrorCategory.VALIDATION,
          details: {
            errors: [
              { field: 'email', message: 'Invalid format' },
              { field: 'age', message: 'Must be positive' }
            ],
            timestamp: new Date().toISOString(),
            userId: 'user-123',
            requestId: 'req-456'
          },
          isRecoverable: false
        });

        const violationError = new ContractViolationError(
          'validateComplexForm',
          'presentation',
          originalError
        );

        expect(violationError.details?.errors).toHaveLength(2);
        expect(violationError.details?.userId).toBe('user-123');
        expect(violationError.details?.originalErrorMessage).toBe('Validation failed');
        expect(violationError.details?.originalErrorStack).toBeDefined();
      });
    });
  });

  describe('Error interoperability', () => {
    it('should work correctly in try-catch blocks', () => {
      const originalError = new ContractError('Test error', {
        category: ErrorCategory.VALIDATION
      });
      
      let caughtError: any;

      try {
        throw new ContractViolationError('testMethod', 'business', originalError);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ContractViolationError);
      expect(caughtError.category).toBe(ErrorCategory.VALIDATION);
      expect(caughtError.contractName).toBe('testMethod');
    });

    it('should provide accessible properties for logging', () => {
      const originalError = new ContractError('Serialization test', {
        code: 'SERIALIZE_TEST',
        category: ErrorCategory.VALIDATION,
        details: { test: true }
      });

      const violationError = new ContractViolationError(
        'serializeTest',
        'business',
        originalError
      );

      // Test that all properties are accessible for logging purposes
      expect(violationError.message).toBe('Contract violation in business.serializeTest: Serialization test');
      expect(violationError.name).toBe('ContractViolationError');
      expect(violationError.contractName).toBe('serializeTest');
      expect(violationError.layer).toBe('business');
      expect(violationError.code).toBe('SERIALIZE_TEST');
      expect(violationError.category).toBe(ErrorCategory.VALIDATION);
      expect(violationError.details).toBeDefined();
      expect(violationError.stack).toBeDefined();

      // Test that properties can be extracted for custom logging
      const logData = {
        name: violationError.name,
        message: violationError.message,
        contractName: violationError.contractName,
        layer: violationError.layer,
        code: violationError.code,
        category: violationError.category
      };

      expect(logData.name).toBe('ContractViolationError');
      expect(logData.contractName).toBe('serializeTest');
      expect(logData.code).toBe('SERIALIZE_TEST');
    });
  });
});
