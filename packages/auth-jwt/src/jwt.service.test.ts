import type { TestTargetResult } from '@zeltjs/testing';
import { createTestTarget } from '@zeltjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JwtConfig } from './jwt.config';
import { JwtService } from './jwt.service';

class TestJwtConfig extends JwtConfig {
  override get secret(): string {
    return 'test-secret-key-for-testing-only';
  }

  override get expiresIn(): string {
    return '1h';
  }
}

describe('JwtService', () => {
  let testTarget: TestTargetResult<JwtService>;
  let jwtService: JwtService;

  beforeEach(async () => {
    testTarget = await createTestTarget(JwtService, {
      configs: [TestJwtConfig],
    });
    jwtService = testTarget.target;
  });

  afterEach(async () => {
    await testTarget.shutdown();
  });

  describe('sign', () => {
    it('should generate a valid JWT token', async () => {
      const token = await jwtService.sign({ sub: 'user-123' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verify', () => {
    it('should verify and return payload for valid token', async () => {
      const token = await jwtService.sign({ sub: 'user-123', customClaim: 'value' });
      const payload = await jwtService.verify(token);

      expect(payload.sub).toBe('user-123');
      expect(payload['customClaim']).toBe('value');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('should throw error for invalid token', async () => {
      await expect(jwtService.verify('invalid-token')).rejects.toThrow();
    });

    it('should throw error for tampered token', async () => {
      const token = await jwtService.sign({ sub: 'user-123' });
      const tamperedToken = `${token.slice(0, -5)}xxxxx`;

      await expect(jwtService.verify(tamperedToken)).rejects.toThrow();
    });
  });

  describe('decode', () => {
    it('should decode token without verification', async () => {
      const token = await jwtService.sign({ sub: 'user-123' });
      const payload = jwtService.decode(token);

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-123');
    });

    it('should return null for invalid token', () => {
      const payload = jwtService.decode('not-a-valid-jwt');

      expect(payload).toBeNull();
    });
  });
});
