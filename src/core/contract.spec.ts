import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { contract } from './contract';
import { ContractError, ContractViolationError, ErrorCategory } from './errors';
import { AuthContext } from './types';

// Mock dependencies
vi.mock('zerot/utils/delay', () => ({
  delay: vi.fn((ms: number) => Promise.resolve())
}));

vi.mock('zerot/utils/logger', () => ({
  logger: {
    warn: vi.fn()
  }
}));

vi.mock('zerot/utils/type-guards', () => ({
  isValidator: vi.fn()
}));

vi.mock('./types', () => ({
  getAuthContext: vi.fn(),
  AuthContext: {}
}));

import { delay } from 'zerot/utils/delay';
import { logger } from 'zerot/utils/logger';
import { isValidator } from 'zerot/utils/type-guards';
import { getAuthContext } from './types';

// Test types
interface TestInput {
  name: string;
  value: number;
}

interface TestOutput {
  id: string;
  name: string;
  value: number;
  processed: boolean;
}

interface TestAuthContext extends AuthContext {
  userId: string;
  role: string;
}

class TestService {
  @contract({
    requires: [],
    ensures: [],
    invariants: [],
    layer: 'business' as const
  })
  async basicMethod(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '123',
      name: input.name,
      value: input.value,
      processed: true
    };
  }

  @contract({
    requires: [
      // Mock validator that doubles the value
      async (input: TestInput) => ({ ...input, value: input.value * 2 }),
      // Mock condition that checks name is not empty
      async (input: TestInput, context: TestAuthContext) => input.name.length > 0
    ],
    ensures: [
      // Mock postcondition that checks processed flag
      async (output: TestOutput) => output.processed === true
    ],
    invariants: [
      // Mock invariant that checks value consistency
      async (input: TestInput, output: TestOutput) => output.value === input.value
    ],
    layer: 'business' as const
  })
  async methodWithConditions(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '456',
      name: input.name,
      value: input.value,
      processed: true
    };
  }

  @contract({
    requires: [
      async (input: TestInput) => {
        throw new ContractError('Validation failed', {
          code: 'VALIDATION_ERROR',
          category: ErrorCategory.VALIDATION,
          details: { field: 'name' }
        });
      }
    ],
    layer: 'business' as const
  })
  async methodWithFailingPrecondition(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '789',
      name: input.name,
      value: input.value,
      processed: true
    };
  }

  @contract({
    ensures: [
      async (output: TestOutput) => {
        return new ContractError('Postcondition failed', {
          code: 'POSTCONDITION_ERROR',
          category: ErrorCategory.BUSINESS_LOGIC,
          details: { field: 'processed' }
        });
      }
    ],
    layer: 'business' as const
  })
  async methodWithFailingPostcondition(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '101',
      name: input.name,
      value: input.value,
      processed: false
    };
  }

  @contract({
    invariants: [
      async (input: TestInput, output: TestOutput) => false
    ],
    layer: 'business' as const
  })
  async methodWithFailingInvariant(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '102',
      name: input.name,
      value: input.value,
      processed: true
    };
  }

  @contract({
    requires: [
      async (input: TestInput) => {
        throw new ContractError('Recoverable error', {
          code: 'RECOVERABLE_ERROR',
          category: ErrorCategory.NETWORK,
          details: {},
          isRecoverable: true
        });
      }
    ],
    retryAttempts: 2,
    retryDelayMs: 50,
    layer: 'business' as const
  })
  async methodWithRetryableError(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '103',
      name: input.name,
      value: input.value,
      processed: true
    };
  }

  @contract({
    requires: [
      async (input: TestInput) => {
        throw new ContractError('Category-based retry error', {
          code: 'CATEGORY_ERROR',
          category: ErrorCategory.NETWORK,
          details: {},
          isRecoverable: false
        });
      }
    ],
    retryAttempts: 1,
    retryOnCategories: [ErrorCategory.NETWORK],
    layer: 'business' as const
  })
  async methodWithCategoryBasedRetry(input: TestInput, context?: TestAuthContext): Promise<TestOutput> {
    return {
      id: '104',
      name: input.name,
      value: input.value,
      processed: true
    };
  }

  async methodWithoutDecorator(input: TestInput): Promise<TestOutput> {
    return {
      id: '999',
      name: input.name,
      value: input.value,
      processed: true
    };
  }
}

describe('contract decorator', () => {
  let service: TestService;
  let mockAuthContext: TestAuthContext;

  beforeEach(() => {
    service = new TestService();
    mockAuthContext = { userId: 'user123', role: 'admin' };
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext);
    vi.mocked(isValidator).mockImplementation((fn: any) => {
      // Mock logic to determine if a function is a validator
      // In this test, we'll assume validators are functions that transform input
      // and conditions are functions that return boolean or ContractError
      return fn.toString().includes('value: input.value * 2');
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('basic functionality', () => {
    it('should execute method successfully with empty contract options', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      const result = await service.basicMethod(input);

      expect(result).toEqual({
        id: '123',
        name: 'test',
        value: 10,
        processed: true
      });
    });

    it('should use provided context when passed as argument', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      const customContext: TestAuthContext = { userId: 'custom', role: 'user' };
      
      const result = await service.basicMethod(input, customContext);
      
      expect(result).toBeDefined();
      expect(vi.mocked(getAuthContext)).not.toHaveBeenCalled();
    });

    it('should retrieve context from getAuthContext when not provided', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      await service.basicMethod(input);
      
      expect(vi.mocked(getAuthContext)).toHaveBeenCalledOnce();
    });
  });

  describe('preconditions (requires)', () => {
    it('should apply validators and transform input', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      // Mock isValidator to return true for the first condition (validator)
      vi.mocked(isValidator)
        .mockReturnValueOnce(true)  // First condition is a validator
        .mockReturnValueOnce(false); // Second condition is not a validator
      
      const result = await service.methodWithConditions(input);
      
      // The validator should have doubled the value
      expect(result.value).toBe(20);
    });

    it('should throw ContractViolationError when precondition returns false', async () => {
      const input: TestInput = { name: '', value: 10 }; // Empty name should fail
      
      vi.mocked(isValidator)
        .mockReturnValueOnce(true)  // First condition is a validator
        .mockReturnValueOnce(false); // Second condition returns false
      
      await expect(service.methodWithConditions(input))
        .rejects.toThrow(ContractViolationError);
    });

    it('should throw ContractViolationError when precondition returns ContractError', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      await expect(service.methodWithFailingPrecondition(input))
        .rejects.toThrow(ContractViolationError);
      
      try {
        await service.methodWithFailingPrecondition(input);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractViolationError);
        const originalError = (error as ContractViolationError).originalError;
        expect(originalError instanceof ContractError ? originalError.code : undefined).toBe('VALIDATION_ERROR');
      }
    });

    it('should wrap unexpected errors in ContractViolationError', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      class TestServiceWithError extends TestService {
        @contract({
          requires: [
            async () => {
              throw new Error('Unexpected error');
            }
          ],
          layer: 'business' as const
        })
        async methodWithUnexpectedError(input: TestInput): Promise<TestOutput> {
          return { id: '1', name: input.name, value: input.value, processed: true };
        }
      }
      
      const errorService = new TestServiceWithError();
      
      await expect(errorService.methodWithUnexpectedError(input))
        .rejects.toThrow(ContractViolationError);
    });
  });

  describe('postconditions (ensures)', () => {
    it('should throw ContractViolationError when postcondition returns ContractError', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      await expect(service.methodWithFailingPostcondition(input))
        .rejects.toThrow(ContractViolationError);
      
      try {
        await service.methodWithFailingPostcondition(input);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractViolationError);
        const originalError = (error as ContractViolationError).originalError;
        expect(originalError instanceof ContractError ? originalError.code : undefined).toBe('POSTCONDITION_ERROR');
      }
    });

    it('should throw ContractViolationError when postcondition returns false', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      class TestServiceWithFalsePostcondition extends TestService {
        @contract({
          ensures: [
            async () => false
          ],
          layer: 'business' as const
        })
        async methodWithFalsePostcondition(input: TestInput): Promise<TestOutput> {
          return { id: '1', name: input.name, value: input.value, processed: true };
        }
      }
      
      const errorService = new TestServiceWithFalsePostcondition();
      
      await expect(errorService.methodWithFalsePostcondition(input))
        .rejects.toThrow(ContractViolationError);
    });
  });

  describe('invariants', () => {
    it('should throw ContractViolationError when invariant returns false', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      await expect(service.methodWithFailingInvariant(input))
        .rejects.toThrow(ContractViolationError);
      
      try {
        await service.methodWithFailingInvariant(input);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractViolationError);
        const originalError = (error as ContractViolationError).originalError;
        expect(originalError instanceof ContractError ? originalError.code : undefined).toBe('INVARIANT_VIOLATION');
      }
    });

    it('should throw ContractViolationError when invariant returns ContractError', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      class TestServiceWithErrorInvariant extends TestService {
        @contract({
          invariants: [
            async () => new ContractError('Invariant error', {
              code: 'CUSTOM_INVARIANT_ERROR',
              category: ErrorCategory.BUSINESS_LOGIC,
              details: {}
            })
          ],
          layer: 'business' as const
        })
        async methodWithErrorInvariant(input: TestInput): Promise<TestOutput> {
          return { id: '1', name: input.name, value: input.value, processed: true };
        }
      }
      
      const errorService = new TestServiceWithErrorInvariant();
      
      await expect(errorService.methodWithErrorInvariant(input))
        .rejects.toThrow(ContractViolationError);
    });
  });

  describe('retry functionality', () => {
    it('should retry on recoverable errors', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      await expect(service.methodWithRetryableError(input))
        .rejects.toThrow(ContractViolationError);
      
      // Should have logged warnings for retries
      expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(2); // 2 retries
      expect(vi.mocked(delay)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(delay)).toHaveBeenCalledWith(50);
    });

    it('should retry on specific error categories', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      await expect(service.methodWithCategoryBasedRetry(input))
        .rejects.toThrow(ContractViolationError);
      
      // Should have logged warning for retry
      expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(delay)).toHaveBeenCalledTimes(1);
    });

    it('should eventually succeed after recoverable error is resolved', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      let attemptCount = 0;
      
      class TestServiceWithEventualSuccess extends TestService {
        @contract({
          requires: [
            async (input: TestInput) => {
              attemptCount++;
              if (attemptCount <= 2) {
                throw new ContractError('Temporary error', {
                  code: 'TEMP_ERROR',
                  category: ErrorCategory.NETWORK,
                  details: {},
                  isRecoverable: true
                });
              }
              return true; // Success on 3rd attempt
            }
          ],
          retryAttempts: 3,
          layer: 'business' as const
        })
        async methodWithEventualSuccess(input: TestInput): Promise<TestOutput> {
          return { id: '1', name: input.name, value: input.value, processed: true };
        }
      }
      
      const successService = new TestServiceWithEventualSuccess();
      const result = await successService.methodWithEventualSuccess(input);
      
      expect(result).toBeDefined();
      expect(result.processed).toBe(true);
      expect(attemptCount).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty contract options gracefully', async () => {
      class TestServiceWithEmptyOptions extends TestService {
        @contract({
          layer: 'business' as const
        })
        async methodWithEmptyOptions(input: TestInput): Promise<TestOutput> {
          return { id: '1', name: input.name, value: input.value, processed: true };
        }
      }
      
      const service = new TestServiceWithEmptyOptions();
      const input: TestInput = { name: 'test', value: 10 };
      
      const result = await service.methodWithEmptyOptions(input);
      expect(result).toBeDefined();
    });

    it('should handle undefined layer gracefully', async () => {
      class TestServiceWithNoLayer extends TestService {
        @contract({
          requires: [async () => false]
        })
        async methodWithNoLayer(input: TestInput): Promise<TestOutput> {
          return { id: '1', name: input.name, value: input.value, processed: true };
        }
      }
      
      const service = new TestServiceWithNoLayer();
      const input: TestInput = { name: 'test', value: 10 };
      
      try {
        await service.methodWithNoLayer(input);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractViolationError);
        expect((error as ContractViolationError).layer).toBe('unknown');
      }
    });

    it('should handle max retry attempts exceeded', async () => {
      const input: TestInput = { name: 'test', value: 10 };
      
      // This should exhaust all retry attempts and throw the final error
      await expect(service.methodWithRetryableError(input))
        .rejects.toThrow(ContractViolationError);
    });
  });

  describe('type safety', () => {
    it('should work with correctly typed inputs and outputs', async () => {
      const input: TestInput = { name: 'test', value: 42 };
      const result = await service.basicMethod(input, mockAuthContext);
      
      // TypeScript should ensure these properties exist
      expect(typeof result.id).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.value).toBe('number');
      expect(typeof result.processed).toBe('boolean');
    });
  });
});