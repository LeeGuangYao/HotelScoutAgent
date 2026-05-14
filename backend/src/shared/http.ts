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

export const notImplemented = (moduleName: string): ApiErrorEnvelope => ({
  error: {
    code: 'NOT_IMPLEMENTED',
    message: `${moduleName} is a stage-4 skeleton and will be implemented in a later stage.`,
  },
});
