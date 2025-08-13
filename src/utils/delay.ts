/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to wait.
 * @returns A Promise that resolves after the specified delay.
 */
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
