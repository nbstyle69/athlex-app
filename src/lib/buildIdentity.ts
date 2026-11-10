import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import i18n from '../i18n';

/**
 * Version du binaire installé depuis le store.
 *
 * Sous OTA, `Constants.expoConfig.version` vient du manifeste de l'update
 * (la `version` de master), pas du binaire : 1.0.66 sur un iPhone en 1.0.67.
 * `Updates.runtimeVersion` est lu dans le binaire, et chaque build store fixe
 * le runtime de sa plateforme à sa propre version (procédure #523). Nul en
 * développement : repli sur la config.
 */
export function nativeVersion(): string | null {
  return Updates.runtimeVersion ?? Constants.expoConfig?.version ?? null;
}

/**
 * Identité du code réellement exécuté, affichée sur l'écran de connexion.
 *
 * « L'écran s'affiche » ne prouve pas qu'un update a été reçu : un lancement
 * sans réseau, un téléchargement interrompu ou un cache laissent l'ancien
 * bundle en place sans le dire. Ce que l'on compare, c'est cet identifiant et
 * celui du résumé de publication.
 */
export function versionLabel(): string {
  return `v${nativeVersion() ?? '?'}`;
}

// `updateId` est nul quand c'est le bundle embarqué dans le build natif qui
// tourne : c'est une information, pas une absence d'information.
export function updateSource(): string {
  const updateId = Updates.updateId;
  return updateId ? updateId.slice(0, 8) : i18n.t('auth.embeddedBundle');
}

/** Forme complète, révélée au toucher de la version sur l'écran de connexion. */
export function buildIdentity(): string {
  return `${versionLabel()} · ${updateSource()}`;
}

/** Texte du pied de l'écran de connexion : la version seule, l'identifiant au toucher. */
export function versionDisplay(revealed: boolean): string {
  return revealed ? buildIdentity() : versionLabel();
}
