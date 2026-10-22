import React, { useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  language?: string;
  onChange: (newValue: string) => void;
  onSave?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language = 'typescript',
  onChange,
  onSave,
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Custom Save Action (Ctrl+S / Cmd+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Configure editor layout & font
    editor.updateOptions({
      fontSize: 13,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      renderLineHighlight: 'all',
    });
  };

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
      <Editor
        height="100%"
        width="100%"
        theme="vs-dark"
        language={language}
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorMount}
        options={{
          padding: { top: 12 },
        }}
      />
    </div>
  );
};
