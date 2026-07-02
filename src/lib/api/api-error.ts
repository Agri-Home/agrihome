import { NextResponse } from "next/server";

export const API_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA: "UNSUPPORTED_MEDIA",
  RATE_LIMITED: "RATE_LIMITED",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  CV_UNAVAILABLE: "CV_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export const apiErrorResponse = (
  code: ApiErrorCode,
  message: string,
  status: number,
  init?: ResponseInit
) =>
  NextResponse.json(
    {
      error: { code, message }
    } satisfies ApiErrorBody,
    { status, ...init }
  );

export class DatabaseUnavailableError extends Error {
  readonly code = API_ERROR_CODES.DATABASE_UNAVAILABLE;

  constructor(message = "Database is unavailable") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export class CvUnavailableError extends Error {
  readonly code = API_ERROR_CODES.CV_UNAVAILABLE;

  constructor(message = "Computer vision service is unavailable") {
    super(message);
    this.name = "CvUnavailableError";
  }
}

const normalizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const isDatabaseUnavailableError = (error: unknown): boolean => {
  if (error instanceof DatabaseUnavailableError) {
    return true;
  }

  const message = normalizeErrorMessage(error).toLowerCase();

  return (
    message.includes("postgresql is required") ||
    message.includes("postgresql pool could not be created") ||
    message.includes("database is unavailable") ||
    message.includes("connection terminated") ||
    message.includes("econnrefused") ||
    message.includes("password authentication failed") ||
    message.includes("timeout expired")
  );
};

export const isCvUnavailableError = (error: unknown): boolean => {
  if (error instanceof CvUnavailableError) {
    return true;
  }

  const message = normalizeErrorMessage(error);

  return (
    message.includes("CV_SPECIES_INFERENCE_URL is required") ||
    message.includes("Species classifier request failed") ||
    message.includes("Species classifier HTTP") ||
    message.includes("Species classifier returned")
  );
};

const isNotFoundMessage = (message: string) =>
  /\bnot found\b/i.test(message) || message === "Plant not found" || message === "Tray not found";

const isValidationMessage = (message: string) =>
  message.includes("required") ||
  message.includes("Invalid") ||
  message.includes("Provide at least one") ||
  message.includes("Provide both") ||
  message.includes("Use JPEG") ||
  message.includes("Expected JSON") ||
  message.includes("Missing ") ||
  message.includes("Invalid multipart") ||
  message.includes("Could not read") ||
  message.includes("too large") ||
  message.includes("Unsupported image") ||
  message.includes("Service uploads require");

export const mapErrorToApiResponse = (
  error: unknown,
  fallbackMessage = "Internal server error"
): Response => {
  if (error instanceof Response) {
    return error;
  }

  const message = normalizeErrorMessage(error) || fallbackMessage;

  if (isDatabaseUnavailableError(error)) {
    return apiErrorResponse(
      API_ERROR_CODES.DATABASE_UNAVAILABLE,
      message,
      503
    );
  }

  if (isCvUnavailableError(error)) {
    return apiErrorResponse(API_ERROR_CODES.CV_UNAVAILABLE, message, 503);
  }

  if (isNotFoundMessage(message)) {
    return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, message, 404);
  }

  if (message.includes("Unsupported image")) {
    return apiErrorResponse(API_ERROR_CODES.UNSUPPORTED_MEDIA, message, 415);
  }

  if (message.includes("too large")) {
    return apiErrorResponse(API_ERROR_CODES.PAYLOAD_TOO_LARGE, message, 413);
  }

  if (isValidationMessage(message)) {
    return apiErrorResponse(API_ERROR_CODES.BAD_REQUEST, message, 400);
  }

  return apiErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, message, 500);
};
