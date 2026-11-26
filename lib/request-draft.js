const DRAFT_KEY = "indica_request_draft";
const PHOTO_STORE = "photos";

function readDraftMetadata() {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function transactPhotoStore(mode, operation) {
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("indica_request_drafts", 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(PHOTO_STORE, { autoIncrement: true });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, mode);
      const request = operation(tx.objectStore(PHOTO_STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function removePhoto(id) {
  if (id != null) void transactPhotoStore("readwrite", store => store.delete(id)).catch(() => {});
}

export async function loadRequestDraft() {
  const draft = readDraftMetadata();
  if (!draft) return null;
  const { photoId, photo: oldPhoto, ...fields } = draft;
  if (photoId == null && !oldPhoto) return fields;

  let photo;
  try {
    if (photoId != null) {
      photo = await transactPhotoStore("readonly", store => store.get(photoId));
    } else {
      photo = await (await fetch(oldPhoto)).blob();
    }
  } catch {
    // Keep the draft text available when the attachment cannot be recovered.
  }
  return photo ? { ...fields, photo } : { ...fields, photoUnavailable: true };
}

export async function saveRequestDraft(fields, photo) {
  const previousPhotoId = readDraftMetadata()?.photoId;
  const photoId = photo ? await transactPhotoStore("readwrite", store => store.add(photo)) : null;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...fields, photoId }));
  } catch (error) {
    removePhoto(photoId);
    throw error;
  }
  removePhoto(previousPhotoId);
}

export function clearRequestDraft() {
  const photoId = readDraftMetadata()?.photoId;
  sessionStorage.removeItem(DRAFT_KEY);
  removePhoto(photoId);
}
