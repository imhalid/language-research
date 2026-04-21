export const now = (): string => new Date().toISOString();

export const withTimestamps = <T>(data: T): T & { createdAt: string; updatedAt: string } => ({
  ...data,
  createdAt: now(),
  updatedAt: now()
});

export const withUpdatedAt = <T>(data: T): T & { updatedAt: string } => ({
  ...data,
  updatedAt: now()
});
