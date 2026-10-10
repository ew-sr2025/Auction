import { useState } from 'react';
import { assetUrl } from '../config.js';

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="trash-lid" d="M3.5 7h17M9 7V4h6v3" />
      <path d="m6 7 1 14h10l1-14M10 11v6m4-6v6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" />
    </svg>
  );
}

export function ImageEditor({
  images = [],
  removedImages = [],
  onToggleImage,
  files = [],
  onFilesChange,
  max = 5,
  single = false,
  title,
}) {
  const [confirming, setConfirming] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  const keptCount = images.filter((image) => !removedImages.includes(image)).length;
  const available = Math.max(0, max - keptCount - files.length);
  const canChoose = single || available > 0;
  const heading = title || (single ? 'Profil rasmi' : 'Mahsulot rasmlari');

  const addFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    setLimitMessage(!single && selected.length > available
      ? `Hozir yana faqat ${available} ta rasm qo‘shish mumkin.`
      : '');
    const nextFiles = single ? selected.slice(0, 1) : [...files, ...selected.slice(0, available)];
    onFilesChange(nextFiles);
    event.target.value = '';
  };

  const removeFile = (index) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  return (
    <section className={`image-editor ${single ? 'single' : ''}`} aria-label={heading}>
      <div className="image-editor-heading">
        <div>
          <strong>{heading}</strong>
          <span className="muted small">
            {single ? 'Rasmni almashtirish yoki olib tashlash mumkin' : `${keptCount + files.length}/${max} ta rasm tanlandi`}
          </span>
        </div>
      </div>

      {(images.length > 0 || files.length > 0) && (
        <div className={`image-editor-grid ${single ? 'avatar-grid' : ''}`}>
          {images.map((image) => {
            const isRemoved = removedImages.includes(image);
            const isConfirming = confirming === image;
            return (
              <article className={`image-editor-card ${isRemoved ? 'marked-remove' : ''}`} key={image}>
                <img src={assetUrl(image)} alt="" />
                {isRemoved ? (
                  <div className="image-remove-status">
                    <span>Olib tashlanadi</span>
                    <button type="button" className="image-restore" onClick={() => onToggleImage(image)}>
                      Qaytarish
                    </button>
                  </div>
                ) : isConfirming ? (
                  <div className="image-confirm">
                    <span>Rasmni olib tashlaysizmi?</span>
                    <div>
                      <button
                        type="button"
                        className="image-confirm-delete"
                        onClick={() => {
                          onToggleImage(image);
                          setConfirming('');
                        }}
                      >
                        Ha, o‘chirish
                      </button>
                      <button type="button" className="image-confirm-cancel" onClick={() => setConfirming('')}>
                        Bekor
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="image-delete-trigger"
                    aria-label="Rasmni o‘chirish"
                    title="Rasmni o‘chirish"
                    onClick={() => setConfirming(image)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </article>
            );
          })}
          {files.map((file, index) => (
            <article className="image-editor-card image-pending" key={`${file.name}-${file.lastModified}-${index}`}>
              {confirming === `file-${index}` ? (
                <div className="image-confirm">
                  <span>Tanlangan rasmni olib tashlaysizmi?</span>
                  <div>
                    <button
                      type="button"
                      className="image-confirm-delete"
                      onClick={() => {
                        removeFile(index);
                        setConfirming('');
                      }}
                    >
                      Ha, olib tashlash
                    </button>
                    <button type="button" className="image-confirm-cancel" onClick={() => setConfirming('')}>
                      Bekor
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="image-file-preview"><UploadIcon /></div>
                  <div className="image-file-info">
                    <span title={file.name}>{file.name}</span>
                    <small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small>
                  </div>
                  <button
                    type="button"
                    className="image-delete-trigger"
                    aria-label="Tanlangan rasmni olib tashlash"
                    title="Tanlangan rasmni olib tashlash"
                    onClick={() => setConfirming(`file-${index}`)}
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
      )}

      <label className={`image-upload-tile ${!canChoose ? 'disabled' : ''}`}>
        <input
          type="file"
          accept="image/*"
          multiple={!single}
          disabled={!canChoose}
          onChange={addFiles}
          aria-label={single ? 'Profil rasmi tanlash' : 'Mahsulot rasmlarini tanlash'}
        />
        <span className="image-upload-icon"><UploadIcon /></span>
        <span className="image-upload-copy">
          <strong>{single ? 'Rasm tanlash' : 'Rasmlar qo‘shish'}</strong>
          <small>{single ? 'JPG, PNG, WEBP · 5 MB gacha' : `JPG, PNG, WEBP · har biri 5 MB gacha${available === 0 ? ' · limit to‘ldi' : ''}`}</small>
        </span>
        <span className="image-upload-action">{single ? 'Tanlash' : 'Ko‘rib chiqish'}</span>
      </label>
      {limitMessage && <span className="image-editor-limit" role="status">{limitMessage}</span>}
    </section>
  );
}
