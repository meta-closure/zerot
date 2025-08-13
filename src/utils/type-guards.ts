import { ContractCondition, ContractValidator, AuthContext } from "~/core/types";

/**
 * Type guard to check if a given object is a ContractValidator.
 * A ContractValidator is a function with an `isValidator` property set to `true`.
 *
 * @template TInput - The expected type of the input to the validator.
 * @template TContext - The expected type of the authentication context.
 * @param c - The object to check. It can be a ContractCondition or a ContractValidator.
 * @returns `true` if the object is a ContractValidator, `false` otherwise.
 */
export const isValidator = <TInput, TContext extends AuthContext>(
  c: ContractCondition<TInput, TContext> | ContractValidator<TInput, any>
): c is ContractValidator<TInput, any> => {
  return typeof c === 'function' && (c as any).isValidator === true;
};
