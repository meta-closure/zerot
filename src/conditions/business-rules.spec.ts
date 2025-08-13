import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { businessRule } from '~/conditions/business-rules';
import { ContractError, ErrorCategory } from '~/core/errors';
import { AuthContext } from '~/core/types';

describe('businessRule', () => {
  let mockContext: AuthContext;

  beforeEach(() => {
    mockContext = {
      user: {
        id: 'user123',
        username: 'testuser',
        roles: ['user']
      },
      session: {
        id: 'session456',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date().toISOString()
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('function creation', () => {
    it('should return a function', () => {
      const condition = businessRule('Test rule', () => true);
      expect(typeof condition).toBe('function');
    });

    it('should create different functions for different rules', () => {
      const condition1 = businessRule('Rule 1', () => true);
      const condition2 = businessRule('Rule 2', () => true);
      expect(condition1).not.toBe(condition2);
    });
  });

  describe('successful business rule validation', () => {
    it('should return true when synchronous rule passes', async () => {
      const rule = vi.fn().mockReturnValue(true);
      const condition = businessRule('Test rule', rule);
      
      const input = { value: 100 };
      const result = await condition(input, mockContext);
      
      expect(result).toBe(true);
      expect(rule).toHaveBeenCalledWith(input, mockContext);
      expect(rule).toHaveBeenCalledTimes(1);
    });

    it('should return true when asynchronous rule passes', async () => {
      const rule = vi.fn().mockResolvedValue(true);
      const condition = businessRule('Async test rule', rule);
      
      const input = { userId: 'user123', amount: 50 };
      const result = await condition(input, mockContext);
      
      expect(result).toBe(true);
      expect(rule).toHaveBeenCalledWith(input, mockContext);
      expect(rule).toHaveBeenCalledTimes(1);
    });

    it('should handle complex input objects', async () => {
      const rule = vi.fn().mockReturnValue(true);
      const condition = businessRule('Complex rule', rule);
      
      const complexInput = {
        order: {
          id: 'order123',
          items: [
            { id: 'item1', price: 10.99, quantity: 2 },
            { id: 'item2', price: 25.50, quantity: 1 }
          ],
          total: 47.48,
          currency: 'USD'
        },
        user: {
          id: 'user123',
          preferences: {
            currency: 'USD',
            notifications: true
          }
        }
      };
      
      const result = await condition(complexInput, mockContext);
      
      expect(result).toBe(true);
      expect(rule).toHaveBeenCalledWith(complexInput, mockContext);
    });
  });

  describe('business rule violations', () => {
    it('should throw ContractError when synchronous rule fails', async () => {
      const rule = vi.fn().mockReturnValue(false);
      const description = 'Order value must be positive';
      const condition = businessRule(description, rule);
      
      const input = { value: -10 };
      
      await expect(condition(input, mockContext)).rejects.toThrow(ContractError);
      await expect(condition(input, mockContext)).rejects.toThrow(description);
      
      try {
        await condition(input, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toBe(description);
        expect((error as ContractError).code).toBe('BUSINESS_RULE_VIOLATION');
        expect((error as ContractError).category).toBe(ErrorCategory.BUSINESS_LOGIC);
      }
      
      expect(rule).toHaveBeenCalledWith(input, mockContext);
    });

    it('should throw ContractError when asynchronous rule fails', async () => {
      const rule = vi.fn().mockResolvedValue(false);
      const description = 'User must have sufficient balance';
      const condition = businessRule(description, rule);
      
      const input = { userId: 'user123', value: 1000 };
      
      await expect(condition(input, mockContext)).rejects.toThrow(ContractError);
      await expect(condition(input, mockContext)).rejects.toThrow(description);
      
      try {
        await condition(input, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toBe(description);
        expect((error as ContractError).code).toBe('BUSINESS_RULE_VIOLATION');
        expect((error as ContractError).category).toBe(ErrorCategory.BUSINESS_LOGIC);
      }
    });

    it('should preserve custom error messages', async () => {
      const customMessages = [
        'Inventory level too low',
        'User age must be at least 18',
        'Order total exceeds daily limit',
        'Invalid payment method for this region'
      ];

      for (const message of customMessages) {
        const rule = vi.fn().mockReturnValue(false);
        const condition = businessRule(message, rule);
        
        try {
          await condition({}, mockContext);
        } catch (error) {
          expect(error).toBeInstanceOf(ContractError);
          expect((error as ContractError).message).toBe(message);
        }
      }
    });
  });

  describe('rule function error handling', () => {
    it('should propagate errors thrown by synchronous rule function', async () => {
      const ruleError = new Error('Database connection failed');
      const rule = vi.fn().mockImplementation(() => {
        throw ruleError;
      });
      const condition = businessRule('Database rule', rule);
      
      await expect(condition({}, mockContext)).rejects.toThrow(ruleError);
      expect(rule).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from rejected asynchronous rule function', async () => {
      const ruleError = new Error('Network timeout');
      const rule = vi.fn().mockRejectedValue(ruleError);
      const condition = businessRule('Network rule', rule);
      
      await expect(condition({}, mockContext)).rejects.toThrow(ruleError);
      expect(rule).toHaveBeenCalledTimes(1);
    });

    it('should handle custom ContractError thrown by rule function', async () => {
      const customError = new ContractError('Custom business error', {
        code: 'CUSTOM_ERROR',
        category: ErrorCategory.BUSINESS_LOGIC
      });
      const rule = vi.fn().mockImplementation(() => {
        throw customError;
      });
      const condition = businessRule('Custom rule', rule);
      
      await expect(condition({}, mockContext)).rejects.toThrow(customError);
      expect(rule).toHaveBeenCalledTimes(1);
    });
  });

  describe('input and context handling', () => {
    it('should pass correct input to rule function', async () => {
      const rule = vi.fn().mockReturnValue(true);
      const condition = businessRule('Input test', rule);
      
      const inputs = [
        'string input',
        123,
        { key: 'value' },
        [1, 2, 3],
        null,
        undefined,
        true,
        false
      ];

      for (const input of inputs) {
        rule.mockClear();
        await condition(input, mockContext);
        expect(rule).toHaveBeenCalledWith(input, mockContext);
      }
    });

    it('should pass correct context to rule function', async () => {
      const rule = vi.fn().mockReturnValue(true);
      const condition = businessRule('Context test', rule);
      
      const differentContexts = [
        mockContext,
        { ...mockContext, user: { ...mockContext.user!, id: 'different-user' } },
        { ...mockContext, session: undefined },
        { user: undefined, session: undefined } // Ensure session is undefined, not null
      ] as AuthContext[];

      for (const context of differentContexts) {
        rule.mockClear();
        await condition({ test: 'input' }, context);
        expect(rule).toHaveBeenCalledWith({ test: 'input' }, context);
      }
    });
  });

  describe('real-world business rule examples', () => {
    it('should validate positive order values', async () => {
      const positiveValueRule = (input: { value: number }) => input.value > 0;
      const condition = businessRule('Order value must be positive', positiveValueRule);
      
      // Valid cases
      await expect(condition({ value: 100 }, mockContext)).resolves.toBe(true);
      await expect(condition({ value: 0.01 }, mockContext)).resolves.toBe(true);
      
      // Invalid cases
      await expect(condition({ value: 0 }, mockContext)).rejects.toThrow('Order value must be positive');
      await expect(condition({ value: -10 }, mockContext)).rejects.toThrow('Order value must be positive');
    });

    it('should validate user age requirements', async () => {
      const ageRule = (input: { age: number }) => input.age >= 18;
      const condition = businessRule('User must be at least 18 years old', ageRule);
      
      // Valid cases
      await expect(condition({ age: 18 }, mockContext)).resolves.toBe(true);
      await expect(condition({ age: 25 }, mockContext)).resolves.toBe(true);
      
      // Invalid cases
      await expect(condition({ age: 17 }, mockContext)).rejects.toThrow('User must be at least 18 years old');
      await expect(condition({ age: 0 }, mockContext)).rejects.toThrow('User must be at least 18 years old');
    });

    it('should validate inventory levels', async () => {
      const mockInventoryCheck = vi.fn();
      const inventoryRule = async (input: { productId: string, quantity: number }) => {
        const availableStock = await mockInventoryCheck(input.productId);
        return availableStock >= input.quantity;
      };
      const condition = businessRule('Insufficient inventory', inventoryRule);
      
      // Sufficient inventory
      mockInventoryCheck.mockResolvedValue(100);
      await expect(condition({ productId: 'prod123', quantity: 50 }, mockContext)).resolves.toBe(true);
      
      // Insufficient inventory
      mockInventoryCheck.mockResolvedValue(10);
      await expect(condition({ productId: 'prod123', quantity: 50 }, mockContext))
        .rejects.toThrow('Insufficient inventory');
    });

    it('should validate user permissions with context', async () => {
      const permissionRule = (input: { action: string }, context: AuthContext) => {
        if (input.action === 'delete') {
          return context.user?.roles?.includes('admin') || false;
        }
        return context.user?.roles?.includes('user') || false;
      };
      const condition = businessRule('Insufficient permissions', permissionRule);
      
      // Regular user trying to read
      await expect(condition({ action: 'read' }, mockContext)).resolves.toBe(true);
      
      // Regular user trying to delete
      await expect(condition({ action: 'delete' }, mockContext))
        .rejects.toThrow('Insufficient permissions');
      
      // Admin user trying to delete
      const adminContext = {
        ...mockContext,
        user: { ...mockContext.user!, roles: ['user', 'admin'] }
      };
      await expect(condition({ action: 'delete' }, adminContext)).resolves.toBe(true);
    });

    it('should validate complex business constraints', async () => {
      const complexRule = async (input: { 
        orderId: string, 
        items: Array<{ price: number, quantity: number }>,
        discountCode?: string 
      }, context: AuthContext) => {
        // Business rule: Order total must be at least $10 after discount
        const subtotal = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = input.discountCode === 'SAVE10' ? 0.1 : 0;
        const total = subtotal * (1 - discount);
        
        return total >= 10;
      };
      
      const condition = businessRule('Order total must be at least $10', complexRule);
      
      // Valid order
      const validOrder = {
        orderId: 'order123',
        items: [
          { price: 5, quantity: 2 },
          { price: 3, quantity: 2 }
        ]
      };
      await expect(condition(validOrder, mockContext)).resolves.toBe(true);
      
      // Invalid order (too small)
      const invalidOrder = {
        orderId: 'order456',
        items: [
          { price: 2, quantity: 1 }
        ]
      };
      await expect(condition(invalidOrder, mockContext))
        .rejects.toThrow('Order total must be at least $10');
      
      // Valid order with discount
      const discountOrder = {
        orderId: 'order789',
        items: [
          { price: 6, quantity: 2 }
        ],
        discountCode: 'SAVE10'
      };
      await expect(condition(discountOrder, mockContext)).resolves.toBe(true);
    });
  });

  describe('edge cases and corner scenarios', () => {
    it('should handle rule functions that return non-boolean values', async () => {
      const truthyRule = vi.fn().mockReturnValue('truthy string');
      const falsyRule = vi.fn().mockReturnValue('');
      
      const truthyCondition = businessRule('Truthy rule', truthyRule);
      const falsyCondition = businessRule('Falsy rule', falsyRule);
      
      await expect(truthyCondition({}, mockContext)).resolves.toBe(true);
      await expect(falsyCondition({}, mockContext)).rejects.toThrow('Falsy rule');
    });

    it('should handle rule functions that return Promise of non-boolean values', async () => {
      const truthyAsyncRule = vi.fn().mockResolvedValue(1);
      const falsyAsyncRule = vi.fn().mockResolvedValue(0);
      
      const truthyCondition = businessRule('Truthy async rule', truthyAsyncRule);
      const falsyCondition = businessRule('Falsy async rule', falsyAsyncRule);
      
      await expect(truthyCondition({}, mockContext)).resolves.toBe(true);
      await expect(falsyCondition({}, mockContext)).rejects.toThrow('Falsy async rule');
    });

    it('should handle undefined and null return values', async () => {
      const undefinedRule = vi.fn().mockReturnValue(undefined);
      const nullRule = vi.fn().mockReturnValue(null);
      
      const undefinedCondition = businessRule('Undefined rule', undefinedRule);
      const nullCondition = businessRule('Null rule', nullRule);
      
      await expect(undefinedCondition({}, mockContext)).rejects.toThrow('Undefined rule');
      await expect(nullCondition({}, mockContext)).rejects.toThrow('Null rule');
    });

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(1000);
      const rule = vi.fn().mockReturnValue(false);
      const condition = businessRule(longDescription, rule);
      
      try {
        await condition({}, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toBe(longDescription);
      }
    });

    it('should handle special characters in descriptions', async () => {
      const specialDescriptions = [
        'Rule with émojis 🚀 and ñ characters',
        'Rule with "quotes" and \'apostrophes\'',
        'Rule with <HTML> & XML entities',
        'Rule with newlines\nand\ttabs'
      ];

      for (const description of specialDescriptions) {
        const rule = vi.fn().mockReturnValue(false);
        const condition = businessRule(description, rule);
        
        try {
          await condition({}, mockContext);
        } catch (error) {
          expect(error).toBeInstanceOf(ContractError);
          expect((error as ContractError).message).toBe(description);
        }
      }
    });
  });

  describe('performance considerations', () => {
    it('should handle rules that take time to execute', async () => {
      const slowRule = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });
      
      const condition = businessRule('Slow rule', slowRule);
      
      const startTime = Date.now();
      const result = await condition({}, mockContext);
      const endTime = Date.now();
      
      expect(result).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(slowRule).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent rule executions', async () => {
      const rule = vi.fn().mockResolvedValue(true);
      const condition = businessRule('Concurrent rule', rule);
      
      const promises = Array.from({ length: 10 }, (_, i) => 
        condition({ id: i }, mockContext)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toEqual(Array(10).fill(true));
      expect(rule).toHaveBeenCalledTimes(10);
    });
  });
});
