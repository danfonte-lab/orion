export class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

type SessionExpiredHandler = () => Promise<void> | void;

let onSessionExpired: SessionExpiredHandler | null = null;
let sessionExpiryPromise: Promise<void> | null = null;

export function registerSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  onSessionExpired = handler;
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

export async function expireSession(): Promise<void> {
  if (sessionExpiryPromise) {
    return sessionExpiryPromise;
  }

  sessionExpiryPromise = Promise.resolve()
    .then(async () => {
      if (onSessionExpired) {
        await onSessionExpired();
      }
    })
    .finally(() => {
      sessionExpiryPromise = null;
    });

  return sessionExpiryPromise;
}
