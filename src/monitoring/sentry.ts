import * as Sentry from "@sentry/react-native";

type ErrorContext = {
  scope: string;
  action: string;
  extras?: Record<string, unknown>;
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  const message = typeof error === "string" ? error : "Unknown error";
  return new Error(message);
}

export function captureException(error: unknown, context: ErrorContext): void {
  const normalized = normalizeError(error);

  Sentry.withScope((scope) => {
    scope.setTag("scope", context.scope);
    scope.setTag("action", context.action);

    if (context.extras) {
      for (const [key, value] of Object.entries(context.extras)) {
        scope.setExtra(key, value);
      }
    }

    Sentry.captureException(normalized);
  });
}
