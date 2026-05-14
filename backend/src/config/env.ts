export type BackendConfig = {
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
};

export const loadConfig = (): BackendConfig => ({
  host: process.env.HOST ?? '0.0.0.0',
  port: Number.parseInt(process.env.PORT ?? '3100', 10),
  logLevel: (process.env.LOG_LEVEL ?? 'info') as BackendConfig['logLevel'],
});
