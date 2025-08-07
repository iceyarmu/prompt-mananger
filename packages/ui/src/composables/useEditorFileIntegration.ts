import { watch } from 'vue';
import { useFileTreeStore } from './useFileTreeStore';
import { useMarkdownEditor } from './useMarkdownEditor';
import { useEditorStore } from './editorStore';

export function useEditorFileIntegration() {
  const fileTreeStore = useFileTreeStore();
  const editorStore = useEditorStore();
  const markdownEditor = useMarkdownEditor();
  
  // Watch for file tree selection changes
  watch(
    () => fileTreeStore.selectedNode,
    async (newNode, oldNode) => {
      // Save current file if it has changes
      if (oldNode && markdownEditor.hasUnsavedChanges.value) {
        const shouldSave = await markdownEditor.confirmUnsavedChanges();
        if (shouldSave) {
          await markdownEditor.saveFile();
        }
      }
      
      // Load new file
      if (newNode && newNode.type === 'file') {
        await markdownEditor.loadFile({
          name: newNode.name,
          path: newNode.path,
          type: 'file',
          size: newNode.metadata?.size,
          modified: newNode.metadata?.modified,
          permissions: newNode.metadata?.permissions
        });
        
        // Update editor store
        editorStore.setCurrentFile({
          name: newNode.name,
          path: newNode.path,
          type: 'file',
          size: newNode.metadata?.size,
          modified: newNode.metadata?.modified,
          permissions: newNode.metadata?.permissions
        });
      }
    }
  );
  
  // Sync modified state with file tree
  watch(
    () => markdownEditor.hasUnsavedChanges.value,
    (hasChanges) => {
      if (markdownEditor.currentFile.value) {
        if (hasChanges) {
          editorStore.modifiedFiles.add(markdownEditor.currentFile.value.path);
        } else {
          editorStore.modifiedFiles.delete(markdownEditor.currentFile.value.path);
        }
        
        // Update file tree to show modified indicator
        fileTreeStore.setNodeModified(markdownEditor.currentFile.value.path, hasChanges);
      }
    }
  );
  
  return {
    fileTreeStore,
    editorStore,
    markdownEditor
  };
}