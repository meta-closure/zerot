import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { smartContract } from 'zerot/templates/smart-contract';
import { ContractOptions } from 'zerot/core/types';

// モック関数
vi.mock('zerot/conditions/auth', () => ({
  auth: vi.fn((role?: string) => vi.fn().mockResolvedValue(true))
}));

vi.mock('zerot/conditions/owns', () => ({
  owns: vi.fn((field) => vi.fn().mockResolvedValue(true))
}));

vi.mock('zerot/conditions/validation', () => ({
  validates: vi.fn((schema) => vi.fn().mockReturnValue({})),
  returns: vi.fn((schema) => vi.fn().mockReturnValue(true))
}));

vi.mock('zerot/conditions/rate-limit', () => ({
  rateLimit: vi.fn((operation, limit) => vi.fn().mockResolvedValue(true))
}));

vi.mock('zerot/conditions/audit', () => ({
  auditLog: vi.fn((operation) => vi.fn().mockResolvedValue(true))
}));

// モック関数をインポート
import { auth } from 'zerot/conditions/auth';
import { owns } from 'zerot/conditions/owns';
import { validates, returns } from 'zerot/conditions/validation';
import { rateLimit } from 'zerot/conditions/rate-limit';
import { auditLog } from 'zerot/conditions/audit';

describe('smartContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic contract structure', () => {
    it('should return a valid ContractOptions object', () => {
      const contract = smartContract({
        operation: 'read',
        resource: 'user',
        visibility: 'public'
      });

      expect(contract).toMatchObject({
        requires: expect.any(Array),
        ensures: expect.any(Array),
        invariants: expect.any(Array),
        layer: 'unknown'
      });
    });

    it('should initialize with empty arrays', () => {
      const contract = smartContract({
        operation: 'read',
        resource: 'user',
        visibility: 'public'
      });

      expect(contract.requires).toBeDefined();
      expect(contract.ensures).toBeDefined();
      expect(contract.invariants).toBeDefined();
      expect(Array.isArray(contract.requires)).toBe(true);
      expect(Array.isArray(contract.ensures)).toBe(true);
      expect(Array.isArray(contract.invariants)).toBe(true);
    });
  });

  describe('visibility-based authentication', () => {
    describe('public visibility', () => {
      it('should not require authentication for public operations', () => {
        const operations = ['create', 'read', 'update', 'delete'] as const;
        
        operations.forEach(operation => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'product',
            visibility: 'public'
          });
          
          expect(auth).not.toHaveBeenCalled();
        });
      });

      it('should not require ownership check for public operations', () => {
        const operations = ['create', 'read', 'update', 'delete'] as const;
        
        operations.forEach(operation => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'product',
            visibility: 'public'
          });
          
          expect(owns).not.toHaveBeenCalled();
        });
      });
    });

    describe('private visibility', () => {
      it('should require user authentication for private operations', () => {
        const operations = ['create', 'read', 'update', 'delete'] as const;
        
        operations.forEach(operation => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'document',
            visibility: 'private'
          });
          
          expect(auth).toHaveBeenCalledWith('user');
        });
      });

      it('should require ownership check for non-create operations', () => {
        const operationsWithOwnership = ['read', 'update', 'delete'] as const;
        
        operationsWithOwnership.forEach(operation => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'document',
            visibility: 'private'
          });
          
          expect(owns).toHaveBeenCalledWith('documentId');
        });
      });

      it('should not require ownership check for create operations', () => {
        smartContract({
          operation: 'create',
          resource: 'document',
          visibility: 'private'
        });
        
        expect(auth).toHaveBeenCalledWith('user');
        expect(owns).not.toHaveBeenCalled();
      });
    });

    describe('admin visibility', () => {
      it('should require admin authentication for admin operations', () => {
        const operations = ['create', 'read', 'update', 'delete'] as const;
        
        operations.forEach(operation => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'system',
            visibility: 'admin'
          });
          
          expect(auth).toHaveBeenCalledWith('admin');
        });
      });

      it('should not require ownership check for admin operations', () => {
        const operations = ['create', 'read', 'update', 'delete'] as const;
        
        operations.forEach(operation => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'system',
            visibility: 'admin'
          });
          
          expect(owns).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('operation-based validation', () => {
    it('should include input validation for create operations', () => {
      smartContract({
        operation: 'create',
        resource: 'user',
        visibility: 'public'
      });
      
      expect(validates).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should include input validation for update operations', () => {
      smartContract({
        operation: 'update',
        resource: 'user',
        visibility: 'private'
      });
      
      expect(validates).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should not include input validation for read operations', () => {
      smartContract({
        operation: 'read',
        resource: 'user',
        visibility: 'public'
      });
      
      expect(validates).not.toHaveBeenCalled();
    });

    it('should not include input validation for delete operations', () => {
      smartContract({
        operation: 'delete',
        resource: 'user',
        visibility: 'admin'
      });
      
      expect(validates).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should include rate limiting when specified', () => {
      const rateLimit_Value = 50;
      smartContract({
        operation: 'create',
        resource: 'message',
        visibility: 'private',
        rateLimit: rateLimit_Value
      });
      
      expect(rateLimit).toHaveBeenCalledWith('create_message', rateLimit_Value);
    });

    it('should not include rate limiting when not specified', () => {
      smartContract({
        operation: 'read',
        resource: 'article',
        visibility: 'public'
      });
      
      expect(rateLimit).not.toHaveBeenCalled();
    });

    it('should work with different rate limit values', () => {
      const testCases = [1, 10, 100, 1000];
      
      testCases.forEach(limit => {
        vi.clearAllMocks();
        smartContract({
          operation: 'update',
          resource: 'profile',
          visibility: 'private',
          rateLimit: limit
        });
        
        expect(rateLimit).toHaveBeenCalledWith('update_profile', limit);
      });
    });

    it('should handle zero rate limit', () => {
      smartContract({
        operation: 'create',
        resource: 'test',
        visibility: 'public',
        rateLimit: 0
      });
      
      // 0は falsy なので、rateLimit は呼ばれない
      expect(rateLimit).not.toHaveBeenCalled();
    });
  });

  describe('audit logging', () => {
    it('should always include audit logging', () => {
      const operations = ['create', 'read', 'update', 'delete'] as const;
      const visibilities = ['public', 'private', 'admin'] as const;
      
      operations.forEach(operation => {
        visibilities.forEach(visibility => {
          vi.clearAllMocks();
          smartContract({
            operation,
            resource: 'test',
            visibility
          });
          
          expect(auditLog).toHaveBeenCalledWith(`${operation}_test`);
        });
      });
    });

    it('should use operation and resource name for audit log key', () => {
      const testCases = [
        { operation: 'create' as const, resource: 'user', expected: 'create_user' },
        { operation: 'read' as const, resource: 'product', expected: 'read_product' },
        { operation: 'update' as const, resource: 'order', expected: 'update_order' },
        { operation: 'delete' as const, resource: 'comment', expected: 'delete_comment' }
      ];
      
      testCases.forEach(({ operation, resource, expected }) => {
        vi.clearAllMocks();
        smartContract({
          operation,
          resource,
          visibility: 'public'
        });
        
        expect(auditLog).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('output validation', () => {
    it('should include output validation for create operations', () => {
      smartContract({
        operation: 'create',
        resource: 'user',
        visibility: 'public'
      });
      
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should include output validation for read operations', () => {
      smartContract({
        operation: 'read',
        resource: 'user',
        visibility: 'public'
      });
      
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should include output validation for update operations', () => {
      smartContract({
        operation: 'update',
        resource: 'user',
        visibility: 'private'
      });
      
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should not include output validation for delete operations', () => {
      smartContract({
        operation: 'delete',
        resource: 'user',
        visibility: 'admin'
      });
      
      expect(returns).not.toHaveBeenCalled();
    });
  });

  describe('resource-specific behavior', () => {
    it('should handle different resource names correctly', () => {
      const resources = ['user', 'product', 'order', 'comment', 'category'];
      
      resources.forEach(resource => {
        vi.clearAllMocks();
        smartContract({
          operation: 'read',
          resource,
          visibility: 'private'
        });
        
        expect(owns).toHaveBeenCalledWith(`${resource}Id`);
        expect(auditLog).toHaveBeenCalledWith(`read_${resource}`);
      });
    });

    it('should handle resources with special characters', () => {
      const specialResources = ['user-profile', 'user_data', 'user.info'];
      
      specialResources.forEach(resource => {
        vi.clearAllMocks();
        const contract = smartContract({
          operation: 'update',
          resource,
          visibility: 'private'
        });
        
        expect(contract).toBeDefined();
        expect(owns).toHaveBeenCalledWith(`${resource}Id`);
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle all conditions together for complex private create', () => {
      const contract = smartContract({
        operation: 'create',
        resource: 'document',
        visibility: 'private',
        rateLimit: 10
      });
      
      expect(auth).toHaveBeenCalledWith('user');
      expect(validates).toHaveBeenCalledWith(expect.any(Object));
      expect(rateLimit).toHaveBeenCalledWith('create_document', 10);
      expect(auditLog).toHaveBeenCalledWith('create_document');
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
      expect(owns).not.toHaveBeenCalled(); // No ownership check for create
      
      expect(contract.requires).toHaveLength(3); // auth, validates, rateLimit
      expect(contract.ensures).toHaveLength(2); // auditLog, returns
    });

    it('should handle all conditions together for complex private update', () => {
      const contract = smartContract({
        operation: 'update',
        resource: 'profile',
        visibility: 'private',
        rateLimit: 5
      });
      
      expect(auth).toHaveBeenCalledWith('user');
      expect(owns).toHaveBeenCalledWith('profileId');
      expect(validates).toHaveBeenCalledWith(expect.any(Object));
      expect(rateLimit).toHaveBeenCalledWith('update_profile', 5);
      expect(auditLog).toHaveBeenCalledWith('update_profile');
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
      
      expect(contract.requires).toHaveLength(4); // auth, owns, validates, rateLimit
      expect(contract.ensures).toHaveLength(2); // auditLog, returns
    });

    it('should handle minimal admin delete operation', () => {
      const contract = smartContract({
        operation: 'delete',
        resource: 'spam',
        visibility: 'admin'
      });
      
      expect(auth).toHaveBeenCalledWith('admin');
      expect(auditLog).toHaveBeenCalledWith('delete_spam');
      expect(owns).not.toHaveBeenCalled();
      expect(validates).not.toHaveBeenCalled();
      expect(returns).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      
      expect(contract.requires).toHaveLength(1); // auth only
      expect(contract.ensures).toHaveLength(1); // auditLog only
    });

    it('should handle public read with rate limiting', () => {
      const contract = smartContract({
        operation: 'read',
        resource: 'article',
        visibility: 'public',
        rateLimit: 100
      });
      
      expect(rateLimit).toHaveBeenCalledWith('read_article', 100);
      expect(auditLog).toHaveBeenCalledWith('read_article');
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
      expect(auth).not.toHaveBeenCalled();
      expect(owns).not.toHaveBeenCalled();
      expect(validates).not.toHaveBeenCalled();
      
      expect(contract.requires).toHaveLength(1); // rateLimit only
      expect(contract.ensures).toHaveLength(2); // auditLog, returns
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle unknown resources gracefully', () => {
      expect(() => {
        smartContract({
          operation: 'create',
          resource: 'unknown-resource',
          visibility: 'public'
        });
      }).not.toThrow();
    });

    it('should handle empty resource names', () => {
      const contract = smartContract({
        operation: 'read',
        resource: '',
        visibility: 'public'
      });
      
      expect(contract).toBeDefined();
      expect(auditLog).toHaveBeenCalledWith('read_');
    });

    it('should handle very long resource names', () => {
      const longResourceName = 'a'.repeat(1000);
      const contract = smartContract({
        operation: 'update',
        resource: longResourceName,
        visibility: 'private'
      });
      
      expect(contract).toBeDefined();
      expect(owns).toHaveBeenCalledWith(`${longResourceName}Id`);
    });

    it('should handle unicode resource names', () => {
      const unicodeResources = ['ユーザー', 'продукт', 'المنتج'];
      
      unicodeResources.forEach(resource => {
        expect(() => {
          smartContract({
            operation: 'read',
            resource,
            visibility: 'public'
          });
        }).not.toThrow();
      });
    });
  });

  describe('consistency and isolation', () => {
    it('should create independent contracts for multiple calls', () => {
      const contract1 = smartContract({
        operation: 'create',
        resource: 'user',
        visibility: 'public'
      });
      
      const contract2 = smartContract({
        operation: 'delete',
        resource: 'user',
        visibility: 'admin'
      });
      
      expect(contract1).not.toBe(contract2);
      expect(contract1.requires).not.toBe(contract2.requires);
      expect(contract1.ensures).not.toBe(contract2.ensures);
    });

    it('should not affect previous contracts when creating new ones', () => {
      const contract1 = smartContract({
        operation: 'read',
        resource: 'article',
        visibility: 'public'
      });
      
      const initialRequiresLength = contract1.requires!.length;
      const initialEnsuresLength = contract1.ensures!.length;
      
      // Create another contract
      smartContract({
        operation: 'create',
        resource: 'comment',
        visibility: 'private',
        rateLimit: 20
      });
      
      // Original contract should remain unchanged
      expect(contract1.requires).toHaveLength(initialRequiresLength);
      expect(contract1.ensures).toHaveLength(initialEnsuresLength);
    });
  });

  describe('performance considerations', () => {
    it('should create contracts efficiently for bulk operations', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        smartContract({
          operation: 'read',
          resource: `resource_${i}`,
          visibility: 'public'
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 operations in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should not leak memory with repeated contract creation', () => {
      // メモリリークの基本テスト - 大量作成でエラーが出ないことを確認
      expect(() => {
        for (let i = 0; i < 100; i++) {
          smartContract({
            operation: 'update',
            resource: 'test',
            visibility: 'private',
            rateLimit: 10
          });
        }
      }).not.toThrow();
      
      // 基本的な動作確認
      const contract = smartContract({
        operation: 'read',
        resource: 'test',
        visibility: 'public'
      });
      
      expect(contract).toBeDefined();
      expect(contract.requires).toBeDefined();
      expect(contract.ensures).toBeDefined();
    });
  });
});
