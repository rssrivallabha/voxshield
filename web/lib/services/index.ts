import { envConfig } from '../config/env';
import { IVoxShieldService } from './types';
import { MockVoxShieldService } from './mockService';
import { ApiVoxShieldService } from './apiService';

export function createVoxShieldService(): IVoxShieldService {
  return envConfig.useMockApi ? new MockVoxShieldService() : new ApiVoxShieldService();
}

export const voxShieldService = createVoxShieldService();
