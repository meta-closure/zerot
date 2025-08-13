import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { validates, returns } from './validation';
import { ContractError, ErrorCategory } from '../core/errors';

describe('validates function', () => {
  describe('基本的なバリデーション', () => {
    it('有効な入力を正常に処理する', () => {
      const schema = z.string();
      const validator = validates(schema);
      
      const result = validator('test string');
      expect(result).toBe('test string');
    });

    it('無効な入力に対してContractErrorを投げる', () => {
      const schema = z.string();
      const validator = validates(schema);
      
      expect(() => validator(123)).toThrow(ContractError);
    });

    it('ContractErrorに適切なメタデータが含まれる', () => {
      const schema = z.string();
      const validator = validates(schema);
      
      try {
        validator(123);
        expect.fail('Expected ContractError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe('VALIDATION_FAILED');
        expect((error as ContractError).category).toBe(ErrorCategory.VALIDATION);
        expect((error as ContractError).details?.issues).toBeDefined();
      }
    });

    it('バリデータとしてマークされている', () => {
      const schema = z.string();
      const validator = validates(schema);
      
      expect((validator as any).isValidator).toBe(true);
    });
  });

  describe('複雑なスキーマのテスト', () => {
    it('オブジェクトスキーマを正常に処理する', () => {
      const UserSchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0)
      });
      
      const validator = validates(UserSchema);
      const validUser = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };
      
      const result = validator(validUser);
      expect(result).toEqual(validUser);
    });

    it('ネストされたオブジェクトスキーマを処理する', () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
        zipCode: z.string()
      });
      
      const UserSchema = z.object({
        name: z.string(),
        address: AddressSchema
      });
      
      const validator = validates(UserSchema);
      const validInput = {
        name: 'Jane Doe',
        address: {
          street: '123 Main St',
          city: 'Tokyo',
          zipCode: '123-4567'
        }
      };
      
      const result = validator(validInput);
      expect(result).toEqual(validInput);
    });

    it('配列スキーマを処理する', () => {
      const schema = z.array(z.string());
      const validator = validates(schema);
      
      const result = validator(['apple', 'banana', 'cherry']);
      expect(result).toEqual(['apple', 'banana', 'cherry']);
    });
  });

  describe('バリデーションエラーメッセージ', () => {
    it('詳細なエラーメッセージを提供する', () => {
      const UserSchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0)
      });
      
      const validator = validates(UserSchema);
      
      try {
        validator({
          name: 123,
          email: 'invalid-email',
          age: -5
        });
        expect.fail('Expected ContractError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toContain('Input validation failed:');
        expect((error as ContractError).message).toContain('name:');
        expect((error as ContractError).message).toContain('email:');
        expect((error as ContractError).message).toContain('age:');
      }
    });

    it('パスが含まれたエラーメッセージを生成する', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string()
          })
        })
      });
      
      const validator = validates(schema);
      
      try {
        validator({
          user: {
            profile: {
              name: 123
            }
          }
        });
        expect.fail('Expected ContractError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toContain('user.profile.name:');
      }
    });
  });

  describe('トランスフォーマー', () => {
    it('トランスフォーマーが適用される', () => {
      const schema = z.string();
      const transformer = (input: string) => input.toUpperCase();
      const validator = validates(schema, transformer);
      
      const result = validator('hello world');
      expect(result).toBe('HELLO WORLD');
    });

    it('複雑なトランスフォーマーが適用される', () => {
      const UserSchema = z.object({
        firstName: z.string(),
        lastName: z.string()
      });
      
      const transformer = (input: z.infer<typeof UserSchema>) => ({
        ...input,
        fullName: `${input.firstName} ${input.lastName}`
      });
      
      const validator = validates(UserSchema, transformer);
      const result = validator({ firstName: 'John', lastName: 'Doe' });
      
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe'
      });
    });

    it('トランスフォーマーでバリデーション後の値を変更する', () => {
      const schema = z.number();
      const transformer = (input: number) => input * 2;
      const validator = validates(schema, transformer);
      
      const result = validator(5);
      expect(result).toBe(10);
    });
  });

  describe('エラーハンドリング', () => {
    it('ZodError以外のエラーはそのまま再スローする', () => {
      const schema = z.string();
      const transformer = () => {
        throw new Error('Custom error');
      };
      const validator = validates(schema, transformer);
      
      expect(() => validator('valid')).toThrow('Custom error');
    });
  });
});

describe('returns function', () => {
  describe('基本的な出力バリデーション', () => {
    it('有効な出力に対してtrueを返す', () => {
      const schema = z.string();
      const condition = returns(schema);
      
      const result = condition('valid output', null, null);
      expect(result).toBe(true);
    });

    it('無効な出力に対してContractErrorを返す', () => {
      const schema = z.string();
      const condition = returns(schema);
      
      const result = condition(123 as any, null, null);
      expect(result).toBeInstanceOf(ContractError);
    });

    it('返されるContractErrorに適切なメタデータが含まれる', () => {
      const schema = z.string();
      const condition = returns(schema);
      
      const result = condition(123 as any, null, null) as ContractError;
      expect(result).toBeInstanceOf(ContractError);
      expect(result.code).toBe('OUTPUT_VALIDATION_FAILED');
      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.message).toContain('Output does not match expected schema:');
    });
  });

  describe('複雑なスキーマのテスト', () => {
    it('オブジェクト出力を検証する', () => {
      const UserOutputSchema = z.object({
        id: z.string(), // number から string に変更
        name: z.string(),
        email: z.string().email()
      });
      
      const condition = returns(UserOutputSchema);
      const validOutput = {
        id: '123', // number から string に変更
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      const result = condition(validOutput, null, null);
      expect(result).toBe(true);
    });

    it('部分的に無効なオブジェクト出力を検証する', () => {
      const UserOutputSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email()
      });
      
      const condition = returns(UserOutputSchema);
      const invalidOutput = {
        id: 'invalid_id', // Changed to string to match schema
        name: 'John Doe',
        email: 'invalid-email'
      };
      
      const result = condition(invalidOutput, null, null);
      expect(result).toBeInstanceOf(ContractError);
    });

    it('配列出力を検証する', () => {
      const schema = z.array(z.object({
        id: z.number(),
        name: z.string()
      }));
      
      const condition = returns(schema);
      const validOutput = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      
      const result = condition(validOutput, null, null);
      expect(result).toBe(true);
    });
  });

  describe('コンテキストパラメータ', () => {
    it('入力とコンテキストパラメータを受け取る', () => {
      const schema = z.string();
      const condition = returns(schema);
      
      const mockInput = { userId: '123' };
      const mockContext = { user: { id: '123' } };
      
      const result = condition('valid output', mockInput, mockContext);
      expect(result).toBe(true);
    });
  });

  describe('エラー詳細', () => {
    it('元のエラーメッセージを保持する', () => {
      const schema = z.object({
        required: z.string()
      });
      
      const condition = returns(schema);
      
      // 無効な値でテスト（requiredプロパティが欠けている）
      const invalidResult = condition({} as any, null, null) as ContractError;
      
      expect(invalidResult).toBeInstanceOf(ContractError);
      expect(invalidResult.details?.originalErrorMessage).toBeDefined();
      expect(invalidResult.details?.originalErrorStack).toBeDefined();
    });

    it('非Errorオブジェクトも適切に処理する', () => {
      // Zodが特殊なエラーを投げることをシミュレート
      const mockSchema = {
        parse: () => {
          throw 'String error';
        }
      } as any;
      
      const condition = returns(mockSchema);
      const result = condition('anything', null, null) as ContractError;
      
      expect(result).toBeInstanceOf(ContractError);
      expect(result.details?.originalErrorMessage).toBe('String error');
      expect(result.details?.originalErrorStack).toBeUndefined();
    });
  });
});

describe('統合テスト', () => {
  it('validates と returns を組み合わせて使用する', () => {
    const InputSchema = z.object({
      name: z.string(),
      age: z.number()
    });
    
    const OutputSchema = z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
      processed: z.boolean()
    });
    
    const inputValidator = validates(InputSchema);
    const outputValidator = returns(OutputSchema);
    
    // 有効な入力
    const validInput = { name: 'John', age: 25 };
    const processedInput = inputValidator(validInput);
    expect(processedInput).toEqual(validInput);
    
    // 有効な出力
    const validOutput = {
      id: '123',
      name: 'John',
      age: 25,
      processed: true
    };
    
    const outputResult = outputValidator(validOutput, processedInput, null);
    expect(outputResult).toBe(true);
  });

  it('型安全性を保証する', () => {
    const UserSchema = z.object({
      name: z.string(),
      email: z.string().email()
    });
    
    type User = z.infer<typeof UserSchema>;
    
    const validator = validates(UserSchema);
    const condition = returns(UserSchema);
    
    // TypeScriptの型チェックでこれらが正しい型を持つことを確認
    const validatedUser: User = validator({ name: 'John', email: 'john@example.com' });
    const isValid = condition(validatedUser, null, null); // 型アノテーションを削除
    
    expect(validatedUser.name).toBe('John');
    expect(isValid).toBe(true);
  });
});
