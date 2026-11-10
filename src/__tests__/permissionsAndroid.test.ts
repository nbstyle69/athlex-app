/**
 * #588 : Google Play refuse READ_MEDIA_IMAGES / READ_MEDIA_VIDEO hors applis
 * de galerie. Le sélecteur d'image passe par le photo picker système et
 * l'enregistrement de vidéo n'écrit que : aucune lecture de la galerie.
 * expo-media-library et expo-image-picker en réajoutent dans le manifeste,
 * d'où la liste bloquée (tools:node="remove" au build).
 */
import fs from 'fs';
import path from 'path';

const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'app.json'), 'utf8')).expo;

const LECTURE_GALERIE = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_EXTERNAL_STORAGE',
];

describe('permissions Android (#588)', () => {
  it('liste figée des permissions déclarées', () => {
    expect(app.android.permissions).toEqual([
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    ]);
  });

  it('la lecture de la galerie est bloquée, même ajoutée par une bibliothèque', () => {
    expect([...app.android.blockedPermissions].sort()).toEqual([...LECTURE_GALERIE].sort());
  });

  it('expo-media-library ne réajoute aucune permission granulaire', () => {
    const entry = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-media-library');
    expect(entry[1].granularPermissions).toEqual([]);
    expect(entry[1].isAccessMediaLocationEnabled).toBeFalsy();
  });
});
