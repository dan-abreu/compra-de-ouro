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

type PrismaLikeError = {
  code?: string;
  message?: string;
  meta?: {
    column?: string;
    table?: string;
    database_error?: string;
    constraint?: string | string[];
  };
};

export const isPrismaMissingColumnError = (error: unknown): boolean => {
  const prismaError = error as PrismaLikeError | undefined;
  return prismaError?.code === "P2022";
};

export const isPrismaSchemaOutOfSyncError = (error: unknown): boolean => {
  const prismaError = error as PrismaLikeError | undefined;
  if (!prismaError?.code) {
    return false;
  }

  if (prismaError.code === "P2021" || prismaError.code === "P2022") {
    return true;
  }

  if (prismaError.code === "P2010") {
    const dbError = String(prismaError.meta?.database_error ?? "").toLowerCase();
    const message = String(prismaError.message ?? "").toLowerCase();
    return (
      dbError.includes("does not exist") ||
      dbError.includes("undefined table") ||
      dbError.includes("undefined column") ||
      message.includes("does not exist") ||
      message.includes("undefined table") ||
      message.includes("undefined column")
    );
  }

  if (prismaError.code === "P2011") {
    const constraints = Array.isArray(prismaError.meta?.constraint)
      ? prismaError.meta?.constraint
      : prismaError.meta?.constraint
        ? [prismaError.meta.constraint]
        : [];

    return constraints.some((constraint) =>
      constraint.toLowerCase().includes("opengoldacquisitioncostinbase")
    );
  }

  return false;
};

export const mapInfrastructureError = (error: unknown): DomainError | null => {
  const prismaError = error as PrismaLikeError | undefined;

  if (isPrismaSchemaOutOfSyncError(error)) {
    const column = prismaError?.meta?.column;
    return new DomainError(
      "Banco de dados fora de sincronia com a versao do sistema. Execute as migrations pendentes.",
      503,
      {
        code: "DB_SCHEMA_OUT_OF_SYNC",
        fieldErrors: column ? { database: `Coluna ausente: ${column}` } : {}
      }
    );
  }

  return null;
};
