import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../lib/api/client';
import { AppApiError } from '../lib/api/types';

describe('ApiClient Error Taxonomy and Mapping', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('http://localhost:8000/api/v1');
    vi.restoreAllMocks();
  });

  it('maps 401 response to AUTHENTICATION_ERROR', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Token expired' }), { status: 401 })
    );

    try {
      await client.get('/test');
      expect.fail('Should have thrown AppApiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppApiError);
      const apiErr = err as AppApiError;
      expect(apiErr.code).toBe('AUTHENTICATION_ERROR');
      expect(apiErr.status).toBe(401);
    }
  });

  it('maps 403 response to AUTHORIZATION_ERROR', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    try {
      await client.get('/test');
      expect.fail('Should have thrown AppApiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppApiError);
      const apiErr = err as AppApiError;
      expect(apiErr.code).toBe('AUTHORIZATION_ERROR');
      expect(apiErr.status).toBe(403);
    }
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await client.get('/test');
      expect.fail('Should have thrown AppApiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppApiError);
      const apiErr = err as AppApiError;
      expect(apiErr.code).toBe('NETWORK_ERROR');
    }
  });
});
