// Dépôt d'une pièce jointe de message dans le stockage privé `message-attachments`.
//
// Le chemin est `<group_id>/<uid>_<ts>_<aléa>.<ext>` : la règle de dépôt exige
// un groupe dont l'expéditeur est membre et un nom préfixé par son uid, et la
// règle de lecture ouvre le fichier à qui lit les messages de ce groupe
// (migration 20270137).
//
// On enregistre ce CHEMIN dans `group_messages.attachment_url`, plus l'URL
// publique : le stockage est privé, une URL publique ne sert plus rien.
// L'affichage passe par `resolveStorageUrls`, qui signe un chemin comme une
// ancienne URL publique (voir storageUrl.ts).

export const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments';

type StorageClient = {
  from(bucket: string): {
    upload(
      path: string,
      body: ArrayBuffer,
      opts: { contentType: string; upsert: boolean },
    ): Promise<{ error: unknown }>;
  };
};

export function messageAttachmentPath(
  groupId: string,
  userId: string,
  ext: string,
  now: number = Date.now(),
  rand: string = Math.random().toString(36).slice(2),
): string {
  return `${groupId}/${userId}_${now}_${rand}.${ext}`;
}

/** Dépose le fichier et rend le chemin à enregistrer, ou l'erreur du stockage. */
export async function uploadMessageAttachment(
  storage: StorageClient,
  groupId: string,
  userId: string,
  ext: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<{ path: string | null; error: unknown }> {
  const path = messageAttachmentPath(groupId, userId, ext);
  const { error } = await storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  return error ? { path: null, error } : { path, error: null };
}
