import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContractTemplates } from './contract-templates';
import { ContractError, ErrorCategory } from '../core/errors';
import { AuthContext } from '../core/types';

// モック関数
vi.mock('../conditions/auth', () => ({
  auth: vi.fn((role?: string) => vi.fn().mockResolvedValue(true))
}));

vi.mock('../conditions/validation', () => ({
  validates: vi.fn((schema) => vi.fn().mockReturnValue({})),
  returns: vi.fn((schema) => vi.fn().mockReturnValue(true))
}));

vi.mock('../conditions/owns', () => ({
  owns: vi.fn((field) => vi.fn().mockResolvedValue(true))
}));

vi.mock('../conditions/rate-limit', () => ({
  rateLimit: vi.fn((operation, limit) => vi.fn().mockResolvedValue(true))
}));

vi.mock('../conditions/audit', () => ({
  auditLog: vi.fn((operation) => vi.fn().mockResolvedValue(true))
}));

// モック関数をインポート
import { auth } from '../conditions/auth';
import { validates, returns } from '../conditions/validation';
import { owns } from '../conditions/owns';
import { rateLimit } from '../conditions/rate-limit';
import { auditLog } from '../conditions/audit';

describe('ContractTemplates', () => {
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

  describe('userCRUD template', () => {
    it('should return correct contract options with default role', () => {
      const contract = ContractTemplates.userCRUD();

      expect(contract.layer).toBe('action');
      expect(contract.requires).toHaveLength(4);
      expect(contract.ensures).toHaveLength(2);
    });

    it('should call auth with default "user" role', () => {
      ContractTemplates.userCRUD();
      
      expect(auth).toHaveBeenCalledWith('user');
    });

    it('should call auth with custom role when provided', () => {
      ContractTemplates.userCRUD('admin');
      
      expect(auth).toHaveBeenCalledWith('admin');
    });

    it('should include input validation for user update schema', () => {
      ContractTemplates.userCRUD();
      
      expect(validates).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should include ownership check for userId field', () => {
      ContractTemplates.userCRUD();
      
      expect(owns).toHaveBeenCalledWith('userId');
    });

    it('should include rate limiting for userCRUD operation', () => {
      ContractTemplates.userCRUD();
      
      expect(rateLimit).toHaveBeenCalledWith('userCRUD', 10);
    });

    it('should include output validation and audit logging', () => {
      ContractTemplates.userCRUD();
      
      expect(returns).toHaveBeenCalledWith(expect.any(Object));
      expect(auditLog).toHaveBeenCalledWith('user_crud');
    });

    it('should work with different roles', () => {
      const roles = ['user', 'admin', 'moderator', 'custom'];
      
      roles.forEach(role => {
        vi.clearAllMocks();
        ContractTemplates.userCRUD(role);
        expect(auth).toHaveBeenCalledWith(role);
      });
    });
  });

  describe('adminOnly template', () => {
    it('should return correct contract options', () => {
      const contract = ContractTemplates.adminOnly('delete_user');

      expect(contract.layer).toBe('action');
      expect(contract.requires).toHaveLength(2);
      expect(contract.ensures).toHaveLength(1);
    });

    it('should require admin authentication', () => {
      ContractTemplates.adminOnly('manage_settings');
      
      expect(auth).toHaveBeenCalledWith('admin');
    });

    it('should include rate limiting with operation-specific key', () => {
      const operation = 'delete_user';
      ContractTemplates.adminOnly(operation);
      
      expect(rateLimit).toHaveBeenCalledWith(`admin_${operation}`, 20);
    });

    it('should include audit logging with operation-specific key', () => {
      const operation = 'manage_settings';
      ContractTemplates.adminOnly(operation);
      
      expect(auditLog).toHaveBeenCalledWith(`admin_${operation}`);
    });

    it('should work with different operation names', () => {
      const operations = [
        'delete_user',
        'manage_settings', 
        'system_maintenance',
        'bulk_operations'
      ];
      
      operations.forEach(operation => {
        vi.clearAllMocks();
        ContractTemplates.adminOnly(operation);
        expect(rateLimit).toHaveBeenCalledWith(`admin_${operation}`, 20);
        expect(auditLog).toHaveBeenCalledWith(`admin_${operation}`);
      });
    });

    it('should handle special characters in operation names', () => {
      const specialOperations = [
        'delete-user',
        'manage_settings',
        'system.maintenance',
        'bulk:operations'
      ];
      
      specialOperations.forEach(operation => {
        vi.clearAllMocks();
        const contract = ContractTemplates.adminOnly(operation);
        expect(contract).toBeDefined();
        expect(rateLimit).toHaveBeenCalledWith(`admin_${operation}`, 20);
      });
    });
  });

  describe('publicAPI template', () => {
    it('should return correct contract options', () => {
      const contract = ContractTemplates.publicAPI('get_products');

      expect(contract.layer).toBe('presentation');
      expect(contract.requires).toHaveLength(2);
      expect(contract.ensures).toHaveLength(1);
    });

    it('should include basic input validation', () => {
      ContractTemplates.publicAPI('search_items');
      
      expect(validates).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should include rate limiting with operation-specific key and higher limit', () => {
      const operation = 'get_products';
      ContractTemplates.publicAPI(operation);
      
      expect(rateLimit).toHaveBeenCalledWith(`public_${operation}`, 100);
    });

    it('should include audit logging with operation-specific key', () => {
      const operation = 'search_items';
      ContractTemplates.publicAPI(operation);
      
      expect(auditLog).toHaveBeenCalledWith(`public_${operation}`);
    });

    it('should work with different operation names', () => {
      const operations = [
        'get_products',
        'search_items',
        'get_categories',
        'health_check'
      ];
      
      operations.forEach(operation => {
        vi.clearAllMocks();
        ContractTemplates.publicAPI(operation);
        expect(rateLimit).toHaveBeenCalledWith(`public_${operation}`, 100);
        expect(auditLog).toHaveBeenCalledWith(`public_${operation}`);
      });
    });

    it('should not include authentication requirements', () => {
      ContractTemplates.publicAPI('get_products');
      
      // auth関数は呼ばれるべきではない（publicAPIは認証不要）
      expect(auth).not.toHaveBeenCalled();
    });
  });

  describe('batchOperation template', () => {
    let mockItemContract: any;

    beforeEach(() => {
      mockItemContract = {
        requires: [vi.fn().mockResolvedValue(true)],
        ensures: [vi.fn().mockResolvedValue(true)],
        layer: 'business'
      };
    });

    it('should return correct contract options', () => {
      const contract = ContractTemplates.batchOperation(mockItemContract);

      expect(contract.layer).toBe('action');
      expect(contract.requires).toHaveLength(2);
      expect(contract.ensures).toHaveLength(1);
    });

    it('should require admin authentication', () => {
      ContractTemplates.batchOperation(mockItemContract);
      
      expect(auth).toHaveBeenCalledWith('admin');
    });

    it('should include audit logging for batch operations', () => {
      ContractTemplates.batchOperation(mockItemContract);
      
      expect(auditLog).toHaveBeenCalledWith('batch_operation');
    });

    describe('batch validation function', () => {
      let batchValidator: any;

      beforeEach(() => {
        const contract = ContractTemplates.batchOperation(mockItemContract);
        batchValidator = contract.requires![1]; // 配列検証関数
      });

      it('should accept valid arrays within size limit', () => {
        const validInputs = [
          [],
          [1, 2, 3],
          Array(100).fill('item'),
          Array(1000).fill('item') // 境界値
        ];

        for (const input of validInputs) {
          const result = batchValidator(input);
          expect(result).toBe(true);
        }
      });

      it('should reject non-array inputs', () => {
        const invalidInputs = [
          'string',
          123,
          { key: 'value' },
          null,
          undefined,
          true
        ];

        for (const input of invalidInputs) {
          expect(() => batchValidator(input)).toThrow(ContractError);
          expect(() => batchValidator(input)).toThrow('Input must be an array');
          
          try {
            batchValidator(input);
          } catch (error) {
            expect(error).toBeInstanceOf(ContractError);
            expect((error as ContractError).code).toBe('INVALID_BATCH_INPUT');
            expect((error as ContractError).category).toBe(ErrorCategory.VALIDATION);
          }
        }
      });

      it('should reject arrays exceeding size limit', () => {
        const oversizedInputs = [
          Array(1001).fill('item'),
          Array(5000).fill('item'),
          Array(10000).fill('item')
        ];

        for (const input of oversizedInputs) {
          expect(() => batchValidator(input)).toThrow(ContractError);
          expect(() => batchValidator(input)).toThrow('Batch size must be ≤ 1000 items');
          
          try {
            batchValidator(input);
          } catch (error) {
            expect(error).toBeInstanceOf(ContractError);
            expect((error as ContractError).code).toBe('BATCH_TOO_LARGE');
            expect((error as ContractError).category).toBe(ErrorCategory.VALIDATION);
          }
        }
      });

      it('should handle boundary cases correctly', () => {
        // 境界値テスト
        const boundaryInputs = [
          Array(999).fill('item'), // 1個少ない
          Array(1000).fill('item'), // ちょうど境界
        ];

        for (const input of boundaryInputs) {
          const result = batchValidator(input);
          expect(result).toBe(true);
        }

        // 境界を超えるケース
        const oversizedInput = Array(1001).fill('item');
        expect(() => batchValidator(oversizedInput)).toThrow('Batch size must be ≤ 1000 items');
      });

      it('should handle arrays with different data types', () => {
        const mixedArrays = [
          ['string', 123, true, null],
          [{ a: 1 }, { b: 2 }],
          [[], [1, 2], [{ nested: true }]],
          Array(100).fill(undefined)
        ];

        for (const input of mixedArrays) {
          const result = batchValidator(input);
          expect(result).toBe(true);
        }
      });
    });
  });

  describe('template integration', () => {
    it('should allow combining templates for complex operations', () => {
      const userContract = ContractTemplates.userCRUD('admin');
      const adminContract = ContractTemplates.adminOnly('user_management');
      
      // テンプレートが独立して動作することを確認
      expect(userContract.layer).toBe('action');
      expect(adminContract.layer).toBe('action');
      
      // 両方でauth('admin')が呼ばれることを確認
      expect(auth).toHaveBeenCalledWith('admin');
    });

    it('should handle template reusability', () => {
      // 同じテンプレートを複数回使用
      const contract1 = ContractTemplates.publicAPI('endpoint1');
      const contract2 = ContractTemplates.publicAPI('endpoint2');
      
      expect(contract1.layer).toBe('presentation');
      expect(contract2.layer).toBe('presentation');
      
      // それぞれ異なる設定で呼ばれることを確認
      expect(rateLimit).toHaveBeenCalledWith('public_endpoint1', 100);
      expect(rateLimit).toHaveBeenCalledWith('public_endpoint2', 100);
    });

    it('should work with empty or minimal parameters', () => {
      const contracts = [
        ContractTemplates.userCRUD(),
        ContractTemplates.adminOnly(''),
        ContractTemplates.publicAPI(''),
        ContractTemplates.batchOperation({ requires: [], ensures: [], layer: 'business' })
      ];

      contracts.forEach(contract => {
        expect(contract).toBeDefined();
        expect(contract.layer).toBeDefined();
        expect(contract.requires).toBeDefined();
        expect(contract.ensures).toBeDefined();
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle special characters in operation names gracefully', () => {
      const specialNames = [
        'operation-with-dashes',
        'operation_with_underscores',
        'operation.with.dots',
        'operation:with:colons',
        'operation with spaces',
        'operation/with/slashes'
      ];

      specialNames.forEach(name => {
        expect(() => {
          ContractTemplates.adminOnly(name);
          ContractTemplates.publicAPI(name);
        }).not.toThrow();
      });
    });

    it('should handle very long operation names', () => {
      const longName = 'a'.repeat(1000);
      
      expect(() => {
        ContractTemplates.adminOnly(longName);
        ContractTemplates.publicAPI(longName);
      }).not.toThrow();
    });

    it('should handle unicode characters in operation names', () => {
      const unicodeNames = [
        'operation_ユーザー管理',
        'operación_española',
        'opération_française',
        'операция_русская'
      ];

      unicodeNames.forEach(name => {
        expect(() => {
          ContractTemplates.adminOnly(name);
          ContractTemplates.publicAPI(name);
        }).not.toThrow();
      });
    });
  });

  describe('performance considerations', () => {
    it('should create templates efficiently for multiple calls', () => {
      const startTime = Date.now();
      
      // 多数のテンプレートを作成
      for (let i = 0; i < 1000; i++) {
        ContractTemplates.userCRUD('user');
        ContractTemplates.adminOnly(`operation_${i}`);
        ContractTemplates.publicAPI(`api_${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 1000回の呼び出しが1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000);
    });

    it('should not have memory leaks with repeated template creation', () => {
      // メモリリークがないことを簡単にテスト
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 100; i++) {
        ContractTemplates.batchOperation({
          requires: [vi.fn()],
          ensures: [vi.fn()],
          layer: 'business'
        });
      }
      
      // ガベージコレクションを強制実行（テスト環境でのみ）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // メモリ増加が過度でないことを確認（10MB以下）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});