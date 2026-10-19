import { resolve } from 'path';
import { app } from 'electron';

export const getPath = (...relativePaths: string[]) =>
  resolve(app.getPath('userData'), ...relativePaths).replace(/\\/g, '/');
