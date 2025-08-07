import { ref, computed } from 'vue';
import { useWebDAVStore } from './useWebDAVStore';

export function useServices() {
  const webdavStore = useWebDAVStore();
  
  const services = computed(() => ({
    webdavService: webdavStore.webdavService
  }));
  
  return {
    services
  };
}