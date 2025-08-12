// 契約エラークラス
export class ContractError extends Error {
  constructor(public type: string, message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export class ContractViolationError extends Error {
  constructor(
    public contractName: string,
    public layer: string,
    public originalError: any
  ) {
    super(
      `Contract violation in ${layer}.${contractName}: ${originalError.message}`
    );
    this.name = "ContractViolationError";
  }

  getAppropriateResponse() {
    switch (this.layer) {
      case "presentation":
        return { redirect: "/login", error: "Authentication required" };
      case "action":
        return { success: false, error: this.originalError.message };
      case "business":
        return { success: false, error: "Permission denied" };
      case "data":
        return { success: false, error: "Operation failed" };
      default:
        return { success: false, error: "An error occurred" };
    }
  }
}
