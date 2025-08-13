import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractHelpers, ExtendedContractTemplates } from '~/templates/contract-helpers';
import { ContractOptions } from '~/core/types';
import { z } from 'zod';

// Mock all the condition modules
vi.mock('~/conditions/auth', () => ({
  auth: vi.fn((role?: string) => vi.fn().mockResolvedValue(true))
}));

vi.mock('~/conditions/owns', () => ({
  owns: vi.fn((field) => vi.fn().mockResolvedValue(true))
}));

vi.mock('~/conditions/validation', () => ({
  validates: vi.fn((schema) => vi.fn().mockReturnValue({})),
  returns: vi.fn((schema) => vi.fn().mockReturnValue(true))
}));

vi.mock('~/conditions/rate-limit', () => ({
  rateLimit: vi.fn((operation, limit, windowMs) => vi.fn().mockResolvedValue(true))
}));

vi.mock('~/conditions/audit', () => ({
  auditLog: vi.fn((action) => vi.fn().mockResolvedValue(true))
}));

vi.mock('~/conditions/business-rules', () => ({
  businessRule: vi.fn((description, rule) => vi.fn().mockResolvedValue(true))
}));

// Import mocked functions
import { auth } from '~/conditions/auth';
import { owns } from '~/conditions/owns';
import { validates, returns } from '~/conditions/validation';
import { rateLimit } from '~/conditions/rate-limit';
import { auditLog } from '~/conditions/audit';
import { businessRule } from '~/conditions/business-rules';

describe('ContractHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combine', () => {
    it('should combine multiple contract options', () => {
      const mockCondition1 = vi.fn();
      const mockCondition2 = vi.fn();
      
      const contract1: Partial<ContractOptions> = {
        requires: [mockCondition1],
        layer: 'business'
      };
      const contract2: Partial<ContractOptions> = {
        requires: [mockCondition2],
        layer: 'action'
      };

      const result = ContractHelpers.combine(contract1, contract2);

      expect(result.requires).toEqual([mockCondition1, mockCondition2]);
      expect(result.layer).toBe('action'); // Later value wins
    });

    it('should handle empty contracts', () => {
      const result = ContractHelpers.combine({}, {});
      
      expect(result).toEqual({
        requires: [],
        ensures: [],
        invariants: []
      });
    });
  });

  describe('authenticated', () => {
    it('should create contract with default user role', () => {
      const result = ContractHelpers.authenticated();

      expect(auth).toHaveBeenCalledWith('user');
      expect(result.requires).toHaveLength(1);
    });

    it('should create contract with custom role', () => {
      const result = ContractHelpers.authenticated('admin');

      expect(auth).toHaveBeenCalledWith('admin');
      expect(result.requires).toHaveLength(1);
    });
  });

  describe('withOwnership', () => {
    it('should create contract with ownership check', () => {
      const result = ContractHelpers.withOwnership('documentId');

      expect(owns).toHaveBeenCalledWith('documentId');
      expect(result.requires).toHaveLength(1);
    });
  });

  describe('validated', () => {
    const inputSchema = z.object({ name: z.string() });
    const outputSchema = z.object({ id: z.string(), name: z.string() });

    it('should create contract with input validation only', () => {
      const result = ContractHelpers.validated(inputSchema);

      expect(validates).toHaveBeenCalledWith(inputSchema);
      expect(returns).not.toHaveBeenCalled();
      expect(result.requires).toHaveLength(1);
    });

    it('should create contract with input and output validation', () => {
      const result = ContractHelpers.validated(inputSchema, outputSchema);

      expect(validates).toHaveBeenCalledWith(inputSchema);
      expect(returns).toHaveBeenCalledWith(outputSchema);
      expect(result.requires).toHaveLength(1);
      expect(result.ensures).toHaveLength(1);
    });
  });

  describe('rateLimited', () => {
    it('should create contract with rate limiting', () => {
      const result = ContractHelpers.rateLimited('test_operation', 10);

      expect(rateLimit).toHaveBeenCalledWith('test_operation', 10, undefined);
      expect(result.requires).toHaveLength(1);
    });

    it('should create contract with custom window', () => {
      const result = ContractHelpers.rateLimited('test_operation', 5, 60000);

      expect(rateLimit).toHaveBeenCalledWith('test_operation', 5, 60000);
    });
  });

  describe('audited', () => {
    it('should create contract with audit logging', () => {
      const result = ContractHelpers.audited('user_action');

      expect(auditLog).toHaveBeenCalledWith('user_action');
      expect(result.ensures).toHaveLength(1);
    });
  });

  describe('withRetry', () => {
    it('should create contract with retry configuration', () => {
      const result = ContractHelpers.withRetry(3, 1000);

      expect(result.retryAttempts).toBe(3);
      expect(result.retryDelayMs).toBe(1000);
    });
  });

  describe('withBusinessRules', () => {
    it('should create contract with business rules', () => {
      const rules = [
        {
          description: 'Value must be positive',
          rule: (input: any) => input.value > 0
        },
        {
          description: 'User must be adult',
          rule: (input: any) => input.age >= 18
        }
      ];

      const result = ContractHelpers.withBusinessRules(...rules);

      expect(businessRule).toHaveBeenCalledTimes(2);
      expect(businessRule).toHaveBeenCalledWith(rules[0].description, rules[0].rule);
      expect(businessRule).toHaveBeenCalledWith(rules[1].description, rules[1].rule);
      expect(result.requires).toHaveLength(2);
    });
  });
});

describe('ExtendedContractTemplates', () => {
  const inputSchema = z.object({ name: z.string() });
  const outputSchema = z.object({ id: z.string(), name: z.string() });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('secureCRUD', () => {
    it('should create secure CRUD contract with all options', () => {
      const result = ExtendedContractTemplates.secureCRUD({
        role: 'admin',
        resourceField: 'documentId',
        inputSchema,
        outputSchema,
        operation: 'update_document',
        rateLimit: 10
      });

      expect(auth).toHaveBeenCalledWith('admin');
      expect(owns).toHaveBeenCalledWith('documentId');
      expect(validates).toHaveBeenCalledWith(inputSchema);
      expect(returns).toHaveBeenCalledWith(outputSchema);
      expect(rateLimit).toHaveBeenCalledWith('update_document', 10, undefined);
      expect(auditLog).toHaveBeenCalledWith('update_document');

      expect(result.layer).toBe('action');
      expect(result.requires).toHaveLength(4);
      expect(result.ensures).toHaveLength(2);
    });

    it('should create minimal secure CRUD contract', () => {
      const result = ExtendedContractTemplates.secureCRUD({
        inputSchema,
        outputSchema,
        operation: 'create_item'
      });

      expect(auth).toHaveBeenCalledWith('user');
      expect(owns).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(result.requires).toHaveLength(2); // auth, validates
    });
  });

  describe('publicEndpoint', () => {
    it('should create public endpoint contract', () => {
      const result = ExtendedContractTemplates.publicEndpoint({
        inputSchema,
        outputSchema,
        operation: 'get_products',
        rateLimit: 100
      });

      expect(validates).toHaveBeenCalledWith(inputSchema);
      expect(returns).toHaveBeenCalledWith(outputSchema);
      expect(rateLimit).toHaveBeenCalledWith('get_products', 100, undefined);
      expect(auditLog).toHaveBeenCalledWith('public_get_products');

      expect(result.layer).toBe('presentation');
      expect(auth).not.toHaveBeenCalled(); // No auth for public endpoints
    });

    it('should work without output schema', () => {
      const result = ExtendedContractTemplates.publicEndpoint({
        inputSchema,
        operation: 'search_items',
        rateLimit: 50
      });

      expect(returns).not.toHaveBeenCalled();
      expect(result.ensures).toHaveLength(1); // auditLog only
    });
  });

  describe('businessLogic', () => {
    it('should create business logic contract', () => {
      const rules = [
        {
          description: 'Balance must be sufficient',
          rule: (input: any) => input.balance > input.amount
        }
      ];

      const result = ExtendedContractTemplates.businessLogic({
        rules,
        retryAttempts: 3,
        auditAction: 'process_payment'
      });

      expect(businessRule).toHaveBeenCalledWith(rules[0].description, rules[0].rule);
      expect(auditLog).toHaveBeenCalledWith('process_payment');

      expect(result.layer).toBe('business');
      expect(result.retryAttempts).toBe(3);
      expect(result.requires).toHaveLength(1);
      expect(result.ensures).toHaveLength(1);
    });
  });

  describe('adminOperation', () => {
    it('should create admin operation contract', () => {
      const result = ExtendedContractTemplates.adminOperation({
        operation: 'system_maintenance',
        inputSchema,
        rateLimit: 5,
        retryAttempts: 2
      });

      expect(auth).toHaveBeenCalledWith('admin');
      expect(validates).toHaveBeenCalledWith(inputSchema);
      expect(rateLimit).toHaveBeenCalledWith('admin_system_maintenance', 5, undefined);
      expect(auditLog).toHaveBeenCalledWith('admin_system_maintenance');

      expect(result.layer).toBe('action');
      expect(result.retryAttempts).toBe(2);
    });

    it('should create minimal admin operation', () => {
      const result = ExtendedContractTemplates.adminOperation({
        operation: 'simple_task'
      });

      expect(auth).toHaveBeenCalledWith('admin');
      expect(validates).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(result.requires).toHaveLength(1); // auth only
    });
  });
});
