<template>
  <div class="cutover-dashboard">
    <h2>System Cutover Dashboard</h2>
    
    <div class="dashboard-grid">
      <!-- Adoption Rate -->
      <div class="metric-card">
        <h3>Adoption Rate</h3>
        <div class="metric-value">{{ metrics.adoptionRate }}%</div>
        <div class="metric-chart">
          <div class="progress-bar">
            <div 
              class="progress-fill adoption" 
              :style="{ width: `${metrics.adoptionRate}%` }"
            ></div>
          </div>
        </div>
        <div class="metric-label">Users on New Platform</div>
      </div>
      
      <!-- Error Rates -->
      <div class="metric-card">
        <h3>Error Rates</h3>
        <div class="comparison-metrics">
          <div class="system-metric">
            <span class="system-label">Old System</span>
            <span class="metric-value" :class="{ good: metrics.errorRates.old < 0.01 }">
              {{ (metrics.errorRates.old * 100).toFixed(2) }}%
            </span>
          </div>
          <div class="system-metric">
            <span class="system-label">New System</span>
            <span class="metric-value" :class="{ 
              good: metrics.errorRates.new < 0.01,
              bad: metrics.errorRates.new > metrics.errorRates.old
            }">
              {{ (metrics.errorRates.new * 100).toFixed(2) }}%
            </span>
          </div>
        </div>
        <div class="metric-label">Error Rate Comparison</div>
      </div>
      
      <!-- Performance Metrics -->
      <div class="metric-card">
        <h3>Performance</h3>
        <div class="comparison-metrics">
          <div class="system-metric">
            <span class="system-label">Old System</span>
            <span class="metric-value">{{ formatTime(metrics.performanceMetrics.old) }}</span>
          </div>
          <div class="system-metric">
            <span class="system-label">New System</span>
            <span class="metric-value" :class="{ 
              good: metrics.performanceMetrics.new < metrics.performanceMetrics.old,
              bad: metrics.performanceMetrics.new > metrics.performanceMetrics.old * 1.2
            }">
              {{ formatTime(metrics.performanceMetrics.new) }}
            </span>
          </div>
        </div>
        <div class="improvement-indicator" v-if="performanceImprovement !== 0">
          <span :class="{ positive: performanceImprovement > 0, negative: performanceImprovement < 0 }">
            {{ performanceImprovement > 0 ? '↑' : '↓' }} 
            {{ Math.abs(performanceImprovement).toFixed(1) }}%
          </span>
        </div>
        <div class="metric-label">Load Time Comparison</div>
      </div>
      
      <!-- Switch Count -->
      <div class="metric-card">
        <h3>System Switches</h3>
        <div class="metric-value">{{ metrics.switchCount }}</div>
        <div class="metric-label">Total Switches</div>
        <div class="last-switch" v-if="metrics.lastSwitch">
          Last: {{ formatTimestamp(metrics.lastSwitch) }}
        </div>
      </div>
      
      <!-- Active Users -->
      <div class="metric-card wide">
        <h3>Active Users Distribution</h3>
        <div class="user-distribution">
          <div class="distribution-bar">
            <div 
              class="old-system-users" 
              :style="{ width: `${oldSystemPercentage}%` }"
              :title="`Old System: ${metrics.activeUsers.old} users`"
            >
              <span v-if="oldSystemPercentage > 20">{{ metrics.activeUsers.old }}</span>
            </div>
            <div 
              class="new-system-users" 
              :style="{ width: `${newSystemPercentage}%` }"
              :title="`New System: ${metrics.activeUsers.new} users`"
            >
              <span v-if="newSystemPercentage > 20">{{ metrics.activeUsers.new }}</span>
            </div>
          </div>
          <div class="distribution-legend">
            <div class="legend-item">
              <span class="legend-color old"></span>
              <span>Old System ({{ oldSystemPercentage.toFixed(1) }}%)</span>
            </div>
            <div class="legend-item">
              <span class="legend-color new"></span>
              <span>New System ({{ newSystemPercentage.toFixed(1) }}%)</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Real-time Status -->
      <div class="metric-card wide">
        <h3>Real-time Status</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-indicator" :class="systemHealth"></span>
            <span>System Health</span>
          </div>
          <div class="status-item">
            <span class="status-indicator" :class="rollbackStatus"></span>
            <span>Rollback Ready</span>
          </div>
          <div class="status-item">
            <span class="status-indicator" :class="alertStatus"></span>
            <span>Alert Status</span>
          </div>
        </div>
        <div class="last-updated">
          Last Updated: {{ formatTimestamp(metrics.lastUpdated) }}
        </div>
      </div>
    </div>
    
    <!-- Alerts Section -->
    <div class="alerts-section" v-if="alerts.length > 0">
      <h3>Active Alerts</h3>
      <div class="alert-list">
        <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="alert.severity">
          <span class="alert-icon">{{ getAlertIcon(alert.severity) }}</span>
          <span class="alert-message">{{ alert.message }}</span>
          <span class="alert-time">{{ formatTimestamp(alert.timestamp) }}</span>
        </div>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="dashboard-actions">
      <button @click="refreshMetrics" class="btn-refresh">
        <span :class="{ spinning: isRefreshing }">🔄</span> Refresh
      </button>
      <button @click="exportMetrics" class="btn-export">
        📊 Export Metrics
      </button>
      <button @click="toggleAutoRefresh" class="btn-auto">
        {{ autoRefresh ? '⏸️ Pause' : '▶️ Auto' }} Refresh
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MonitoringService } from '../services/MonitoringService';

const monitoringService = new MonitoringService();

// State
const metrics = ref({
  adoptionRate: 0,
  errorRates: { old: 0, new: 0 },
  performanceMetrics: { old: 0, new: 0 },
  switchCount: 0,
  activeUsers: { old: 0, new: 0 },
  lastSwitch: 0,
  lastUpdated: Date.now()
});

const alerts = ref<Array<{
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
}>>([]);

const isRefreshing = ref(false);
const autoRefresh = ref(true);
let refreshInterval: number | null = null;

// Computed
const performanceImprovement = computed(() => {
  const old = metrics.value.performanceMetrics.old;
  const newPerf = metrics.value.performanceMetrics.new;
  if (old === 0) return 0;
  return ((old - newPerf) / old) * 100;
});

const oldSystemPercentage = computed(() => {
  const total = metrics.value.activeUsers.old + metrics.value.activeUsers.new;
  if (total === 0) return 50;
  return (metrics.value.activeUsers.old / total) * 100;
});

const newSystemPercentage = computed(() => {
  const total = metrics.value.activeUsers.old + metrics.value.activeUsers.new;
  if (total === 0) return 50;
  return (metrics.value.activeUsers.new / total) * 100;
});

const systemHealth = computed(() => {
  const errorRate = Math.max(metrics.value.errorRates.old, metrics.value.errorRates.new);
  if (errorRate > 0.05) return 'critical';
  if (errorRate > 0.01) return 'warning';
  return 'good';
});

const rollbackStatus = computed(() => 'good'); // Always ready in this implementation

const alertStatus = computed(() => {
  if (alerts.value.some(a => a.severity === 'critical')) return 'critical';
  if (alerts.value.some(a => a.severity === 'warning')) return 'warning';
  return 'good';
});

// Methods
function refreshMetrics() {
  isRefreshing.value = true;
  
  // Get metrics from monitoring service
  const cutoverMetrics = monitoringService.getCutoverMetrics();
  
  // Update metrics from dashboard
  const dashboard = cutoverMetrics.dashboard || {};
  metrics.value = {
    adoptionRate: dashboard.adoptionRate || 0,
    errorRates: dashboard.errorRates || { old: 0, new: 0 },
    performanceMetrics: dashboard.performanceMetrics || { old: 0, new: 0 },
    switchCount: dashboard.switchCount || cutoverMetrics.switchCount || 0,
    activeUsers: dashboard.activeUsers || { old: 50, new: 50 },
    lastSwitch: cutoverMetrics.lastSwitch || 0,
    lastUpdated: dashboard.lastUpdated || Date.now()
  };
  
  // Simulate getting active users (in real app, this would come from backend)
  const totalUsers = 100;
  const newUsers = Math.floor((metrics.value.adoptionRate / 100) * totalUsers);
  metrics.value.activeUsers = {
    old: totalUsers - newUsers,
    new: newUsers
  };
  
  // Check for alerts
  checkForAlerts();
  
  setTimeout(() => {
    isRefreshing.value = false;
  }, 500);
}

function checkForAlerts() {
  alerts.value = [];
  
  // Check error rates
  if (metrics.value.errorRates.new > 0.05) {
    alerts.value.push({
      id: 'high-error-new',
      severity: 'critical',
      message: `High error rate in new system: ${(metrics.value.errorRates.new * 100).toFixed(2)}%`,
      timestamp: Date.now()
    });
  }
  
  // Check performance degradation
  if (metrics.value.performanceMetrics.new > metrics.value.performanceMetrics.old * 1.5) {
    alerts.value.push({
      id: 'perf-degradation',
      severity: 'warning',
      message: 'New system performance degradation detected',
      timestamp: Date.now()
    });
  }
  
  // Check adoption stall
  if (metrics.value.adoptionRate > 0 && metrics.value.adoptionRate < 100 && metrics.value.switchCount === 0) {
    alerts.value.push({
      id: 'adoption-stall',
      severity: 'info',
      message: 'Adoption rate has stalled',
      timestamp: Date.now()
    });
  }
}

function exportMetrics() {
  const exportData = {
    metrics: metrics.value,
    alerts: alerts.value,
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cutover-metrics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value;
  if (autoRefresh.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function startAutoRefresh() {
  if (refreshInterval) return;
  refreshInterval = setInterval(() => {
    refreshMetrics();
  }, 30000); // Every 30 seconds
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function formatTime(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleString();
}

function getAlertIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '📌';
  }
}

// Lifecycle
onMounted(() => {
  refreshMetrics();
  if (autoRefresh.value) {
    startAutoRefresh();
  }
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.cutover-dashboard {
  padding: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

h2 {
  margin-bottom: 20px;
  color: #333;
}

h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #555;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metric-card.wide {
  grid-column: span 2;
}

.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin: 10px 0;
}

.metric-label {
  font-size: 14px;
  color: #666;
  margin-top: 10px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin: 15px 0;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.adoption {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.comparison-metrics {
  display: flex;
  justify-content: space-around;
  margin: 15px 0;
}

.system-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.system-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 5px;
}

.metric-value.good {
  color: #28a745;
}

.metric-value.bad {
  color: #dc3545;
}

.improvement-indicator {
  text-align: center;
  margin-top: 10px;
}

.improvement-indicator .positive {
  color: #28a745;
  font-weight: bold;
}

.improvement-indicator .negative {
  color: #dc3545;
  font-weight: bold;
}

.last-switch {
  font-size: 12px;
  color: #888;
  margin-top: 10px;
}

.user-distribution {
  margin: 15px 0;
}

.distribution-bar {
  display: flex;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;
}

.old-system-users {
  background: #6b7280;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.3s ease;
}

.new-system-users {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.3s ease;
}

.distribution-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.legend-color.old {
  background: #6b7280;
}

.legend-color.new {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin: 15px 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-indicator.good {
  background: #28a745;
  animation: pulse-good 2s infinite;
}

.status-indicator.warning {
  background: #ffc107;
  animation: pulse-warning 2s infinite;
}

.status-indicator.critical {
  background: #dc3545;
  animation: pulse-critical 1s infinite;
}

@keyframes pulse-good {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.last-updated {
  font-size: 12px;
  color: #888;
  margin-top: 15px;
}

.alerts-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
}

.alert-item.critical {
  background: #fee;
  border-left: 4px solid #dc3545;
}

.alert-item.warning {
  background: #fff8e1;
  border-left: 4px solid #ffc107;
}

.alert-item.info {
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
}

.alert-icon {
  font-size: 18px;
}

.alert-message {
  flex: 1;
}

.alert-time {
  font-size: 12px;
  color: #888;
}

.dashboard-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.dashboard-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-refresh {
  background: #007bff;
  color: white;
}

.btn-export {
  background: #28a745;
  color: white;
}

.btn-auto {
  background: #6c757d;
  color: white;
}

.dashboard-actions button:hover {
  opacity: 0.9;
}

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>