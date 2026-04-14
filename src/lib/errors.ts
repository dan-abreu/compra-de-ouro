export type FieldErrorMap = Record<string, string>;

export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fieldErrors?: FieldErrorMap;

  constructor(message: string, statusCode = 400, options?: { code?: string; fieldErrors?: FieldErrorMap }) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code ?? "DOMAIN_ERROR";
    this.fieldErrors = options?.fieldErrors;
  }
}
