import { useEffect, useRef, useState } from 'react';
import {
  ClipboardPaste,
  FolderOpen,
  Link2,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  filesFromDrop,
  filesFromInput,
  type ImportFile,
} from '../../lib/import';
import { isCloudMode } from '../../contexts/AuthContext';

export function ImportPanel({
  busy,
  onFiles,
  onPaste,
  onUrl,
}: {
  busy: boolean;
  onFiles: (files: ImportFile[]) => void;
  onPaste: () => void;
  onUrl: () => void;
}) {
  const markdownInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
    folderInput.current?.setAttribute('directory', '');
  }, []);

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    try {
      const files = await filesFromDrop(event.dataTransfer);
      if (files.length > 0) onFiles(files);
    } catch {
      // El error se muestra en la biblioteca.
    }
  };

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
      role="group"
      aria-label="Importar deck"
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <input
        ref={markdownInput}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        hidden
        onChange={(event) => {
          if (event.currentTarget.files?.length) {
            onFiles(filesFromInput(event.currentTarget.files));
          }
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.currentTarget.files?.length) {
            onFiles(filesFromInput(event.currentTarget.files));
          }
          event.currentTarget.value = '';
        }}
      />

      <span className="dropzone__eyebrow">
        {busy ? (
          <Loader2 className="spin" size={15} aria-hidden="true" />
        ) : (
          <Upload size={15} aria-hidden="true" />
        )}
        Importar deck
      </span>
      <h2 className="dropzone__title">
        {busy ? 'Preparando tu deck…' : 'Arrastra tu deck aquí'}
      </h2>
      <p className="dropzone__text">
        Markdown con frontmatter. Las imágenes pueden ser URLs <code>https://</code>{' '}
        directas o una carpeta local junto al archivo.
      </p>
      <div className="dropzone__formats" aria-label="Formatos admitidos">
        <span>.md</span>
        <span>.markdown</span>
        <span>.txt</span>
        <span>imágenes locales</span>
      </div>

      <div className="dropzone__actions">
        <button
          type="button"
          className="button button--solid"
          onClick={() => markdownInput.current?.click()}
          disabled={busy}
        >
          <Upload size={16} aria-hidden="true" />
          Abrir Markdown
        </button>
        <button
          type="button"
          className="button button--outline"
          onClick={() => folderInput.current?.click()}
          disabled={busy}
        >
          <FolderOpen size={16} aria-hidden="true" />
          Importar carpeta
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onPaste}
          disabled={busy}
        >
          <ClipboardPaste size={16} aria-hidden="true" />
          Pegar
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onUrl}
          disabled={busy}
        >
          <Link2 size={16} aria-hidden="true" />
          Desde URL
        </button>
      </div>

      <p className="dropzone__hint">
        {isCloudMode
          ? 'Las imágenes web se enlazan y necesitan conexión; las locales se suben a tu biblioteca privada. El servidor valida el archivo antes de guardarlo.'
          : 'Las imágenes web se enlazan y necesitan conexión; las locales se guardan con el deck. Todo se procesa en tu navegador.'}
      </p>
    </div>
  );
}
