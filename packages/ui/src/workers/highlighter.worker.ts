import hljs from 'highlight.js';

// Worker message types
interface HighlightRequest {
  id: string;
  code: string;
  language?: string;
}

interface HighlightResponse {
  id: string;
  html: string;
  language?: string;
  error?: string;
}

// Handle highlighting requests
self.addEventListener('message', (event: MessageEvent<HighlightRequest>) => {
  const { id, code, language } = event.data;
  
  try {
    let result;
    
    if (language && hljs.getLanguage(language)) {
      // Highlight with specific language
      result = hljs.highlight(code, { language });
    } else {
      // Auto-detect language
      result = hljs.highlightAuto(code);
    }
    
    // Send back the highlighted HTML
    const response: HighlightResponse = {
      id,
      html: result.value,
      language: result.language
    };
    
    self.postMessage(response);
  } catch (error) {
    // Send error response
    const response: HighlightResponse = {
      id,
      html: code, // Return original code on error
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    self.postMessage(response);
  }
});

// Export type for main thread
export type { HighlightRequest, HighlightResponse };