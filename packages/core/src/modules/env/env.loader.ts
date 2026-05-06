import { config } from 'dotenv';

export const loadEnvFiles = (paths: string[]): void => {
  for (const path of paths) {
    config({ path, override: true });
  }
};
