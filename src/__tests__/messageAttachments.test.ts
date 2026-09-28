import fs from 'fs';
import path from 'path';
import {
  messageAttachmentPath,
  uploadMessageAttachment,
  MESSAGE_ATTACHMENTS_BUCKET,
} from '../lib/messageAttachments';
import { resolveStorageUrls, clearSignedUrlCache } from '../lib/storageUrl';

const GROUPE = '00000000-0000-4000-99ec-0000000000a1';
const UID = '00000000-0000-4000-a9ec-000000000003';
const PROJ = 'https://lkwdlqlbrbxaiydkoxfp.supabase.co';

// Faux client de stockage : garde les dépôts, échoue sur demande.
function faux(erreur: unknown = null) {
  const depots: Array<{ bucket: string; path: string; opts: unknown }> = [];
  return {
    depots,
    from: (bucket: string) => ({
      upload: async (p: string, _body: ArrayBuffer, opts: unknown) => {
        depots.push({ bucket, path: p, opts });
        return { error: erreur };
      },
    }),
  };
}

beforeEach(() => clearSignedUrlCache());

describe('dépôt d’une pièce jointe', () => {
  it('le chemin est <groupe>/<uid>_… (ce que la règle de dépôt exige)', () => {
    expect(messageAttachmentPath(GROUPE, UID, 'jpg', 1712345, 'ab12')).toBe(`${GROUPE}/${UID}_1712345_ab12.jpg`);
  });

  it('enregistre le chemin déposé, pas une URL publique', async () => {
    const s = faux();
    const { path: p, error } = await uploadMessageAttachment(s, GROUPE, UID, 'png', new ArrayBuffer(1), 'image/png');
    expect(error).toBeNull();
    expect(s.depots).toHaveLength(1);
    expect(s.depots[0].bucket).toBe(MESSAGE_ATTACHMENTS_BUCKET);
    expect(s.depots[0].opts).toEqual({ contentType: 'image/png', upsert: false });
    expect(p).toBe(s.depots[0].path);
    expect(p).toMatch(new RegExp(`^${GROUPE}/${UID}_\\d+_[a-z0-9]+\\.png$`));
    expect(p).not.toMatch(/^https?:/);
  });

  it('un dépôt refusé ne rend aucun chemin', async () => {
    const { path: p, error } = await uploadMessageAttachment(faux({ message: 'refusé' }), GROUPE, UID, 'png', new ArrayBuffer(1), 'image/png');
    expect(p).toBeNull();
    expect(error).toEqual({ message: 'refusé' });
  });

  it('MessagesScreen n’appelle plus getPublicUrl', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'screens/messages/MessagesScreen.tsx'), 'utf8');
    expect(src).not.toContain('getPublicUrl');
    expect(src).toContain('uploadMessageAttachment(');
  });
});

describe('affichage : ancien message en URL publique, nouveau en chemin, GIF externe', () => {
  it('signe les deux formes du stockage et laisse le GIF tel quel', async () => {
    const chemin = `${GROUPE}/${UID}_1_a.png`;
    const signer = jest.fn(async (_b: string, p: string) => `${PROJ}/storage/v1/object/sign/${MESSAGE_ATTACHMENTS_BUCKET}/${p}?token=t`);
    const [ancien, nouveau, gif] = await resolveStorageUrls(
      [
        `${PROJ}/storage/v1/object/public/${MESSAGE_ATTACHMENTS_BUCKET}/${UID}_legacy.png`,
        chemin,
        'https://media.giphy.com/media/xyz/giphy.gif',
      ],
      MESSAGE_ATTACHMENTS_BUCKET,
      { signer },
    );
    expect(ancien).toBe(`${PROJ}/storage/v1/object/sign/${MESSAGE_ATTACHMENTS_BUCKET}/${UID}_legacy.png?token=t`);
    expect(nouveau).toBe(`${PROJ}/storage/v1/object/sign/${MESSAGE_ATTACHMENTS_BUCKET}/${chemin}?token=t`);
    expect(gif).toBe('https://media.giphy.com/media/xyz/giphy.gif');
    expect(signer).toHaveBeenCalledTimes(2);
  });
});
