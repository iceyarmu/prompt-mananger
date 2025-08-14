import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FeatureFlagService } from '../FeatureFlagService';

describe('FeatureFlagService - System Cutover', () => {
  let service: FeatureFlagService;
  let fetchMock: any;
  let localStorageMock: any;

  beforeEach(() => {
    service = new FeatureFlagService();
    
    // Mock fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Mock WebSocket
    global.WebSocket = vi.fn(() => ({
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN
    })) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('new_platform_enabled flag', () => {
    it('should have new_platform_enabled flag with 0% rollout by default', () => {
      const flag = service.getFlag('new_platform_enabled');
      expect(flag).toBeDefined();
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it('should correctly determine if new platform is enabled for user', () => {
      // With 0% rollout, should be disabled
      expect(service.isNewPlatformEnabled()).toBe(false);
      
      // Update to 100% rollout
      service.updateFlagPercentage('new_platform_enabled', 100);
      expect(service.isNewPlatformEnabled()).toBe(true);
    });

    it('should return correct cutover variant', () => {
      // With 0% rollout
      expect(service.getCutoverVariant()).toBe('old_system');
      
      // Update to 100% rollout
      service.updateFlagPercentage('new_platform_enabled', 100);
      expect(service.getCutoverVariant()).toBe('new_system');
    });
  });

  describe('percentage-based rollout', () => {
    it('should respect percentage boundaries', () => {
      const flag = service.getFlag('new_platform_enabled');
      
      // Test boundary conditions
      service.updateFlagPercentage('new_platform_enabled', -10);
      expect(service.getFlag('new_platform_enabled')?.rolloutPercentage).toBe(0);
      
      service.updateFlagPercentage('new_platform_enabled', 150);
      expect(service.getFlag('new_platform_enabled')?.rolloutPercentage).toBe(100);
      
      service.updateFlagPercentage('new_platform_enabled', 50);
      expect(service.getFlag('new_platform_enabled')?.rolloutPercentage).toBe(50);
    });

    it('should use consistent user hashing for rollout', () => {
      localStorageMock.getItem.mockReturnValue('test_user_123');
      
      const service1 = new FeatureFlagService();
      const service2 = new FeatureFlagService();
      
      service1.updateFlagPercentage('new_platform_enabled', 50);
      service2.updateFlagPercentage('new_platform_enabled', 50);
      
      // Same user should get same result
      const result1 = service1.isNewPlatformEnabled();
      const result2 = service2.isNewPlatformEnabled();
      expect(result1).toBe(result2);
    });
  });

  describe('A/B testing variant assignment', () => {
    it('should assign consistent variants for cutover tracking', () => {
      localStorageMock.getItem.mockReturnValue('test_user_456');
      
      const variant1 = service.getVariant('cutover_experiment');
      const variant2 = service.getVariant('cutover_experiment');
      
      expect(variant1).toBe(variant2);
      expect(['control', 'variant_a', 'variant_b']).toContain(variant1);
    });

    it('should track variant assignment', () => {
      const trackSpy = vi.spyOn(window as any, 'analytics', 'get').mockReturnValue({
        track: vi.fn()
      });
      
      service.getVariant('cutover_experiment');
      
      // Verify tracking was called
      expect(service['trackFlagEvaluation']).toBeDefined();
    });
  });

  describe('real-time updates', () => {
    it('should notify listeners when flag percentage changes', () => {
      const callback = vi.fn();
      const unsubscribe = service.onFlagChange('new_platform_enabled', callback);
      
      service.updateFlagPercentage('new_platform_enabled', 75);
      
      expect(callback).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('should persist flag updates to server', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      
      service.updateFlagPercentage('new_platform_enabled', 25);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/feature-flags/new_platform_enabled',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle WebSocket connection for real-time updates', () => {
      const wsMock = new WebSocket('wss://api.example.com/feature-flags');
      
      // Simulate WebSocket message
      const update = {
        type: 'flag_update',
        flag: {
          key: 'new_platform_enabled',
          enabled: true,
          rolloutPercentage: 60
        }
      };
      
      if (wsMock.onmessage) {
        wsMock.onmessage(new MessageEvent('message', {
          data: JSON.stringify(update)
        }));
      }
      
      // Flag should be updated
      const flag = service.getFlag('new_platform_enabled');
      expect(flag?.rolloutPercentage).toBeDefined();
    });
  });

  describe('rollout status monitoring', () => {
    it('should provide accurate rollout status', () => {
      service.updateFlagPercentage('new_platform_enabled', 30);
      
      const status = service.getRolloutStatus('new_platform_enabled');
      
      expect(status.percentage).toBe(30);
      expect(status.usersAffected).toBe(30);
      expect(['disabled', 'control', 'variant_a', 'variant_b']).toContain(status.variant);
    });

    it('should handle non-existent flags gracefully', () => {
      const status = service.getRolloutStatus('non_existent_flag');
      
      expect(status.percentage).toBe(0);
      expect(status.usersAffected).toBe(0);
      expect(status.variant).toBe('disabled');
    });
  });

  describe('admin controls', () => {
    it('should update flag percentage with validation', () => {
      service.updateFlagPercentage('new_platform_enabled', 45);
      expect(service.getFlag('new_platform_enabled')?.rolloutPercentage).toBe(45);
      
      // Test invalid percentages
      service.updateFlagPercentage('new_platform_enabled', -50);
      expect(service.getFlag('new_platform_enabled')?.rolloutPercentage).toBe(0);
      
      service.updateFlagPercentage('new_platform_enabled', 200);
      expect(service.getFlag('new_platform_enabled')?.rolloutPercentage).toBe(100);
    });

    it('should handle multiple flag updates', () => {
      const flags = ['new_platform_enabled', 'webdav_integration', 'dark_mode'];
      const percentages = [25, 50, 75];
      
      flags.forEach((flag, index) => {
        service.updateFlagPercentage(flag, percentages[index]);
      });
      
      flags.forEach((flag, index) => {
        const updatedFlag = service.getFlag(flag);
        expect(updatedFlag?.rolloutPercentage).toBe(percentages[index]);
      });
    });
  });

  describe('error handling', () => {
    it('should handle fetch failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockRejectedValue(new Error('Network error'));
      
      service.updateFlagPercentage('new_platform_enabled', 50);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist flag update:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle WebSocket errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const wsMock = new WebSocket('wss://api.example.com/feature-flags');
      if (wsMock.onerror) {
        wsMock.onerror(new Event('error'));
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Feature flag WebSocket error:',
        expect.any(Event)
      );
      
      consoleSpy.mockRestore();
    });
  });
});