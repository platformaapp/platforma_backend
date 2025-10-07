import { swaggerConfig } from './swagger.config';

export function getSwaggerConfig() {
  const baseConfig = { ...swaggerConfig };
  return baseConfig;
}
