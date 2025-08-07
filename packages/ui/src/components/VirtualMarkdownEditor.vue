<template>
  <div class="virtual-markdown-editor" ref="containerRef">
    <!-- Virtual scrolling container -->
    <div 
      class="virtual-scroll-container"
      ref="scrollContainerRef"
      @scroll="handleScroll"
      :style="{ height: `${containerHeight}px` }"
    >
      <!-- Virtual spacer to maintain scroll height -->
      <div 
        class="virtual-spacer"
        :style="{ height: `${totalHeight}px` }"
      ></div>
      
      <!-- Visible lines container -->
      <div 
        class="visible-lines"
        :style="{ 
          transform: `translateY(${offsetY}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0
        }"
      >
        <div
          v-for="(line, index) in visibleLines"
          :key="startIndex + index"
          class="line-wrapper"
          :data-line-number="startIndex + index + 1"
        >
          <!-- Line number gutter -->
          <div class="line-number">{{ startIndex + index + 1 }}</div>
          
          <!-- Line content with syntax highlighting -->
          <div 
            class="line-content"
            v-html="line.highlighted || line.text"
          ></div>
        </div>
      </div>
    </div>
    
    <!-- Performance metrics overlay (dev mode only) -->
    <div v-if="showMetrics" class="performance-metrics">
      <div>Lines: {{ visibleLines.length }} / {{ lines.length }}</div>
      <div>Scroll: {{ Math.round(scrollTop) }}px</div>
      <div>FPS: {{ fps }}</div>
      <div>Memory: {{ memoryUsage }}MB</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { getHighlightService } from '../services/highlightService';
import { debounce, throttle } from 'lodash-es';

interface Line {
  text: string;
  highlighted?: string;
  height?: number;
}

const props = defineProps<{
  content: string;
  language?: string;
  lineHeight?: number;
  overscan?: number;
  enableHighlighting?: boolean;
  showMetrics?: boolean;
}>();

const emit = defineEmits<{
  'update:content': [value: string];
  'scroll': [event: { scrollTop: number; scrollHeight: number }];
}>();

// Configuration
const LINE_HEIGHT = props.lineHeight || 20;
const OVERSCAN = props.overscan || 5;
const CHUNK_SIZE = 100; // Process lines in chunks

// Refs
const containerRef = ref<HTMLElement>();
const scrollContainerRef = ref<HTMLElement>();
const containerHeight = ref(600);
const scrollTop = ref(0);
const startIndex = ref(0);
const endIndex = ref(0);
const offsetY = ref(0);

// Performance metrics
const fps = ref(60);
const memoryUsage = ref(0);
let frameCount = 0;
let lastFrameTime = performance.now();
let metricsInterval: number | null = null;

// Highlight service
const highlightService = props.enableHighlighting ? getHighlightService() : null;

// Parse content into lines
const lines = computed<Line[]>(() => {
  const contentLines = props.content.split('\n');
  return contentLines.map(text => ({ text, height: LINE_HEIGHT }));
});

// Calculate total height
const totalHeight = computed(() => {
  return lines.value.length * LINE_HEIGHT;
});

// Calculate visible lines
const visibleLines = computed(() => {
  return lines.value.slice(startIndex.value, endIndex.value);
});

// Throttled scroll handler
const handleScroll = throttle((event?: Event) => {
  const container = scrollContainerRef.value;
  if (!container) return;
  
  scrollTop.value = container.scrollTop;
  
  // Calculate visible range
  const visibleStart = Math.floor(scrollTop.value / LINE_HEIGHT);
  const visibleEnd = Math.ceil((scrollTop.value + containerHeight.value) / LINE_HEIGHT);
  
  // Apply overscan
  startIndex.value = Math.max(0, visibleStart - OVERSCAN);
  endIndex.value = Math.min(lines.value.length, visibleEnd + OVERSCAN);
  
  // Calculate offset for visible lines
  offsetY.value = startIndex.value * LINE_HEIGHT;
  
  // Emit scroll event
  emit('scroll', {
    scrollTop: scrollTop.value,
    scrollHeight: totalHeight.value
  });
  
  // Update FPS counter
  frameCount++;
  
  // Request highlighting for visible lines
  if (props.enableHighlighting) {
    requestHighlighting();
  }
}, 16); // ~60fps

// Debounced highlighting
const requestHighlighting = debounce(async () => {
  if (!highlightService) return;
  
  const linesToHighlight = visibleLines.value.filter(line => !line.highlighted);
  
  // Process in chunks to avoid blocking
  for (let i = 0; i < linesToHighlight.length; i += CHUNK_SIZE) {
    const chunk = linesToHighlight.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(
      chunk.map(async (line) => {
        try {
          const result = await highlightService.highlight(line.text, props.language);
          line.highlighted = result.html;
        } catch (error) {
          console.error('Highlighting error:', error);
          line.highlighted = line.text; // Fallback to plain text
        }
      })
    );
    
    // Yield to main thread
    await nextTick();
  }
}, 100);

// Update container height on resize
const updateContainerHeight = () => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight;
    handleScroll();
  }
};

// Lazy load more content as user scrolls
const lazyLoadContent = async () => {
  // This is a placeholder for lazy loading implementation
  // In a real implementation, you would load more content from the server
  // as the user scrolls near the bottom
  const scrollPercentage = scrollTop.value / totalHeight.value;
  
  if (scrollPercentage > 0.8) {
    // Load more content
    console.log('Loading more content...');
  }
};

// Performance monitoring
const startPerformanceMonitoring = () => {
  if (!props.showMetrics) return;
  
  metricsInterval = window.setInterval(() => {
    // Calculate FPS
    const now = performance.now();
    const delta = now - lastFrameTime;
    fps.value = Math.round(1000 / (delta / frameCount));
    frameCount = 0;
    lastFrameTime = now;
    
    // Get memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage.value = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    }
  }, 1000);
};

const stopPerformanceMonitoring = () => {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
};

// Watch for content changes
watch(() => props.content, () => {
  // Reset scroll position on major content change
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = 0;
  }
  handleScroll();
});

// Lifecycle
onMounted(() => {
  updateContainerHeight();
  handleScroll();
  
  // Add resize observer
  const resizeObserver = new ResizeObserver(updateContainerHeight);
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
  
  // Start performance monitoring
  startPerformanceMonitoring();
  
  // Cleanup on unmount
  onUnmounted(() => {
    resizeObserver.disconnect();
    stopPerformanceMonitoring();
    
    // Clean up highlight service if needed
    if (props.enableHighlighting && highlightService) {
      // Service cleanup is handled globally
    }
  });
});
</script>

<style scoped>
.virtual-markdown-editor {
  position: relative;
  width: 100%;
  height: 100%;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 20px;
}

.virtual-scroll-container {
  position: relative;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.virtual-spacer {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  pointer-events: none;
}

.visible-lines {
  position: absolute;
  width: 100%;
}

.line-wrapper {
  display: flex;
  height: 20px;
  line-height: 20px;
  white-space: pre;
}

.line-number {
  flex-shrink: 0;
  width: 50px;
  padding-right: 10px;
  text-align: right;
  color: #6e7681;
  user-select: none;
  background: #f6f8fa;
  border-right: 1px solid #d1d9e0;
}

.dark .line-number {
  background: #161b22;
  border-right-color: #30363d;
  color: #8b949e;
}

.line-content {
  flex: 1;
  padding-left: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Syntax highlighting styles */
.line-content :deep(.hljs-keyword) {
  color: #d73a49;
}

.line-content :deep(.hljs-string) {
  color: #032f62;
}

.line-content :deep(.hljs-comment) {
  color: #6a737d;
}

.line-content :deep(.hljs-function) {
  color: #6f42c1;
}

.line-content :deep(.hljs-number) {
  color: #005cc5;
}

/* Dark theme syntax highlighting */
.dark .line-content :deep(.hljs-keyword) {
  color: #ff7b72;
}

.dark .line-content :deep(.hljs-string) {
  color: #a5d6ff;
}

.dark .line-content :deep(.hljs-comment) {
  color: #8b949e;
}

.dark .line-content :deep(.hljs-function) {
  color: #d2a8ff;
}

.dark .line-content :deep(.hljs-number) {
  color: #79c0ff;
}

/* Performance metrics overlay */
.performance-metrics {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #0f0;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 1000;
}

.performance-metrics div {
  margin: 2px 0;
}

/* Smooth scrolling */
.virtual-scroll-container {
  scroll-behavior: smooth;
}

/* Custom scrollbar */
.virtual-scroll-container::-webkit-scrollbar {
  width: 12px;
}

.virtual-scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.dark .virtual-scroll-container::-webkit-scrollbar-track {
  background: #30363d;
}

.virtual-scroll-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 6px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>