export type LoggerContext = Record<string, string | number | boolean | undefined>;

export interface AppLogger {
  info(message: string, context?: LoggerContext): void;
  warn(message: string, context?: LoggerContext): void;
  error(message: string, context?: LoggerContext): void;
}

export const createLoggerPlaceholder = (): AppLogger => ({
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
});
