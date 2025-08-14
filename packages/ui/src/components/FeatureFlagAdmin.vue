<template>
  <div class="feature-flag-admin">
    <h2>Feature Flag Administration</h2>
    
    <div class="cutover-controls">
      <h3>System Cutover Control</h3>
      <div class="flag-control">
        <label for="platform-rollout">New Platform Rollout</label>
        <div class="rollout-controls">
          <input 
            id="platform-rollout"
            type="range" 
            min="0" 
            max="100" 
            v-model.number="platformRollout"
            @input="updatePlatformRollout"
          />
          <span class="percentage">{{ platformRollout }}%</span>
        </div>
        <div class="rollout-info">
          <p>Current Status: {{ cutoverStatus.variant }}</p>
          <p>Users Affected: ~{{ cutoverStatus.usersAffected }}%</p>
        </div>
      </div>
      
      <div class="quick-actions">
        <button @click="setRollout(0)" class="btn-danger">Disable (0%)</button>
        <button @click="setRollout(10)" class="btn-warning">Canary (10%)</button>
        <button @click="setRollout(50)" class="btn-info">Half (50%)</button>
        <button @click="setRollout(100)" class="btn-success">Full (100%)</button>
      </div>
      
      <div class="user-segments">
        <h4>User Segments</h4>
        <label>
          <input type="checkbox" v-model="betaUsersOnly" @change="updateSegments" />
          Beta Users Only
        </label>
        <label>
          <input type="checkbox" v-model="internalUsersOnly" @change="updateSegments" />
          Internal Users Only
        </label>
      </div>
    </div>
    
    <div class="other-flags">
      <h3>Other Feature Flags</h3>
      <div v-for="flag in otherFlags" :key="flag.key" class="flag-item">
        <div class="flag-header">
          <span class="flag-name">{{ flag.key }}</span>
          <span class="flag-status" :class="{ enabled: flag.enabled }">
            {{ flag.enabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
        <div class="flag-rollout">
          <input 
            type="range" 
            min="0" 
            max="100" 
            :value="flag.rolloutPercentage"
            @input="updateFlag(flag.key, $event.target.value)"
          />
          <span class="percentage">{{ flag.rolloutPercentage }}%</span>
        </div>
      </div>
    </div>
    
    <div class="real-time-status">
      <h3>Real-Time Connection</h3>
      <div class="connection-status" :class="connectionStatus">
        <span class="status-dot"></span>
        {{ connectionStatusText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useFeatureFlags } from '../services/FeatureFlagService';

const featureFlags = useFeatureFlags();

const platformRollout = ref(0);
const betaUsersOnly = ref(false);
const internalUsersOnly = ref(false);
const otherFlags = ref([]);
const connectionStatus = ref('disconnected');
const cutoverStatus = ref({ percentage: 0, usersAffected: 0, variant: 'old_system' });

const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting...';
    case 'disconnected': return 'Disconnected';
    default: return 'Unknown';
  }
});

let ws = null;
let unsubscribe = null;

onMounted(() => {
  loadFlags();
  setupWebSocket();
  
  // Listen for platform flag changes
  unsubscribe = featureFlags.onFlagChange('new_platform_enabled', (enabled) => {
    updateStatus();
  });
  
  updateStatus();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
  if (unsubscribe) {
    unsubscribe();
  }
});

function loadFlags() {
  // Load current flag states
  fetch('/api/feature-flags')
    .then(res => res.json())
    .then(flags => {
      const platform = flags.find(f => f.key === 'new_platform_enabled');
      if (platform) {
        platformRollout.value = platform.rolloutPercentage;
        betaUsersOnly.value = platform.targetGroups?.includes('beta_users') || false;
        internalUsersOnly.value = platform.targetGroups?.includes('internal_users') || false;
      }
      
      otherFlags.value = flags.filter(f => f.key !== 'new_platform_enabled');
    })
    .catch(err => {
      console.error('Failed to load flags:', err);
      // Use default values
      const status = featureFlags.getRolloutStatus('new_platform_enabled');
      platformRollout.value = status.percentage;
    });
}

function setupWebSocket() {
  connectionStatus.value = 'connecting';
  
  ws = new WebSocket('wss://api.example.com/feature-flags/admin');
  
  ws.onopen = () => {
    connectionStatus.value = 'connected';
    console.log('WebSocket connected for real-time updates');
  };
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    if (update.type === 'flag_update') {
      if (update.flag.key === 'new_platform_enabled') {
        platformRollout.value = update.flag.rolloutPercentage;
        updateStatus();
      } else {
        const flagIndex = otherFlags.value.findIndex(f => f.key === update.flag.key);
        if (flagIndex !== -1) {
          otherFlags.value[flagIndex] = update.flag;
        }
      }
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    connectionStatus.value = 'disconnected';
  };
  
  ws.onclose = () => {
    connectionStatus.value = 'disconnected';
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      if (connectionStatus.value === 'disconnected') {
        setupWebSocket();
      }
    }, 5000);
  };
}

function updatePlatformRollout() {
  featureFlags.updateFlagPercentage('new_platform_enabled', platformRollout.value);
  updateStatus();
  
  // Send via WebSocket for real-time propagation
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_flag',
      flag: {
        key: 'new_platform_enabled',
        rolloutPercentage: platformRollout.value
      }
    }));
  }
}

function setRollout(percentage: number) {
  platformRollout.value = percentage;
  updatePlatformRollout();
}

function updateFlag(flagKey: string, percentage: number) {
  featureFlags.updateFlagPercentage(flagKey, parseInt(percentage));
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'update_flag',
      flag: {
        key: flagKey,
        rolloutPercentage: parseInt(percentage)
      }
    }));
  }
}

function updateSegments() {
  const targetGroups = [];
  if (betaUsersOnly.value) targetGroups.push('beta_users');
  if (internalUsersOnly.value) targetGroups.push('internal_users');
  
  // Update flag with target groups
  fetch('/api/feature-flags/new_platform_enabled', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetGroups })
  });
}

function updateStatus() {
  cutoverStatus.value = featureFlags.getRolloutStatus('new_platform_enabled');
}
</script>

<style scoped>
.feature-flag-admin {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 20px;
  color: #333;
}

h3 {
  margin-top: 30px;
  margin-bottom: 15px;
  color: #555;
}

h4 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #666;
}

.cutover-controls {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.flag-control {
  margin-bottom: 20px;
}

.flag-control label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
}

.rollout-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.rollout-controls input[type="range"] {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
}

.rollout-controls input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
}

.percentage {
  min-width: 50px;
  font-weight: bold;
  color: #007bff;
}

.rollout-info {
  margin-top: 10px;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.rollout-info p {
  margin: 5px 0;
  color: #666;
}

.quick-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.quick-actions button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}

.quick-actions button:hover {
  opacity: 0.9;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-warning {
  background: #ffc107;
  color: #333;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.user-segments {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
}

.user-segments label {
  display: block;
  margin: 10px 0;
  cursor: pointer;
}

.user-segments input[type="checkbox"] {
  margin-right: 10px;
}

.other-flags {
  margin-top: 30px;
}

.flag-item {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
  margin-bottom: 10px;
}

.flag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.flag-name {
  font-weight: bold;
  color: #333;
}

.flag-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #dc3545;
  color: white;
}

.flag-status.enabled {
  background: #28a745;
}

.flag-rollout {
  display: flex;
  align-items: center;
  gap: 15px;
}

.flag-rollout input[type="range"] {
  flex: 1;
}

.real-time-status {
  margin-top: 30px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #dc3545;
}

.connection-status.connected .status-dot {
  background: #28a745;
  animation: pulse 2s infinite;
}

.connection-status.connecting .status-dot {
  background: #ffc107;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}
</style>