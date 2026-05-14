export type ApiEnvelope<TData> = {
  data: TData;
  requestId?: string;
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
};

export const ok = <TData>(data: TData): ApiEnvelope<TData> => ({ data });

export const apiError = (code: string, message: string): ApiErrorEnvelope => ({
  error: { code, message },
});

export const notImplemented = (moduleName: string): ApiErrorEnvelope => ({
  error: {
    code: 'NOT_IMPLEMENTED',
    message: `${moduleName} is not implemented in the current stage.`,
  },
});
