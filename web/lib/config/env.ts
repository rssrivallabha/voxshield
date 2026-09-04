export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  useMockApi: boolean;
  environment: 'development' | 'production' | 'test';
}

export function getAppConfig(): AppConfig {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  const defaultApiUrl = 'http://localhost:8000/api/v1';
  const defaultWsUrl = 'ws://localhost:8000/api/v1/ws';

  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || defaultApiUrl,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl,
    useMockApi: process.env.NEXT_PUBLIC_USE_MOCK_API
      ? process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'
      : !isProd,
    environment: isTest ? 'test' : isProd ? 'production' : 'development',
  };
}

export const envConfig = getAppConfig();
