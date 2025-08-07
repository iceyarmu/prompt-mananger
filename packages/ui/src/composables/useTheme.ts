import { ref, computed, watch, onMounted } from 'vue';

type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'app:theme';

export function useTheme() {
  const theme = ref<Theme>('auto');
  const systemTheme = ref<'light' | 'dark'>('light');
  
  // Computed property for the actual theme to use
  const currentTheme = computed(() => {
    if (theme.value === 'auto') {
      return systemTheme.value;
    }
    return theme.value as 'light' | 'dark';
  });
  
  // Load theme from localStorage
  const loadTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      theme.value = stored as Theme;
    }
  };
  
  // Save theme to localStorage
  const saveTheme = (newTheme: Theme) => {
    theme.value = newTheme;
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme();
  };
  
  // Apply theme to DOM
  const applyTheme = () => {
    const root = document.documentElement;
    const actualTheme = currentTheme.value;
    
    if (actualTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Set CSS variables for the theme
    root.setAttribute('data-theme', actualTheme);
  };
  
  // Detect system theme
  const detectSystemTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      systemTheme.value = 'dark';
    } else {
      systemTheme.value = 'light';
    }
  };
  
  // Watch for system theme changes
  const watchSystemTheme = () => {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        systemTheme.value = e.matches ? 'dark' : 'light';
        if (theme.value === 'auto') {
          applyTheme();
        }
      });
    }
  };
  
  // Initialize on mount
  onMounted(() => {
    detectSystemTheme();
    loadTheme();
    applyTheme();
    watchSystemTheme();
  });
  
  // Watch for theme changes
  watch(currentTheme, () => {
    applyTheme();
  });
  
  return {
    theme,
    currentTheme,
    saveTheme,
    applyTheme
  };
}