/**
 * Porte de mise à jour forcée : version du binaire installé et lien App Store (#523).
 *
 * Sous OTA, `Constants.expoConfig.version` est celle du manifeste de l'update
 * (la `version` de master, 1.0.66), pas celle du binaire. Comparée à
 * `app_config.min_version`, elle bloquerait un iPhone en 1.0.67 dès que le
 * minimum passe à 1.0.67, même après la mise à jour depuis le store. La porte
 * compare donc `Updates.runtimeVersion`, lu dans le binaire.
 */
import React from 'react';
import { Linking, Platform, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import '../i18n';
import ForceUpdateGate from '../components/ForceUpdateGate';

const mock = { runtimeVersion: null as string | null, manifestVersion: '1.0.66', minVersion: '0.0.0' };

jest.mock('expo-updates', () => ({
  get runtimeVersion() { return mock.runtimeVersion; },
  updateId: null,
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { get expoConfig() { return { version: mock.manifestVersion }; } },
}));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { value: mock.minVersion } }) }) }) }),
  },
}));

async function porte(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<ForceUpdateGate><Text>APP</Text></ForceUpdateGate>);
  });
  return r;
}
const textes = (r: ReactTestRenderer) => r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
const bloquee = (r: ReactTestRenderer) => !textes(r).includes('APP');

describe('porte de mise à jour forcée : version du binaire installé', () => {
  it('bloque si la version native est inférieure à min_version, et affiche cette version', async () => {
    Object.assign(mock, { runtimeVersion: '1.0.67', manifestVersion: '1.0.66', minVersion: '1.0.68' });
    const r = await porte();
    expect(bloquee(r)).toBe(true);
    expect(textes(r).some((t) => t.includes('1.0.67'))).toBe(true);
  });

  it('laisse passer si la version native égale min_version', async () => {
    Object.assign(mock, { runtimeVersion: '1.0.68', manifestVersion: '1.0.66', minVersion: '1.0.68' });
    expect(bloquee(await porte())).toBe(false);
  });

  it('manifeste OTA en 1.0.66 et binaire en 1.0.67 : laisse passer un minimum à 1.0.67', async () => {
    Object.assign(mock, { runtimeVersion: '1.0.67', manifestVersion: '1.0.66', minVersion: '1.0.67' });
    expect(bloquee(await porte())).toBe(false);
  });

  it('sans runtime (développement), repli sur la version de la config', async () => {
    Object.assign(mock, { runtimeVersion: null, manifestVersion: '1.0.67', minVersion: '1.0.67' });
    expect(bloquee(await porte())).toBe(false);
    Object.assign(mock, { runtimeVersion: null, manifestVersion: '1.0.66', minVersion: '1.0.67' });
    expect(bloquee(await porte())).toBe(true);
  });
});

describe('porte de mise à jour forcée : lien du store', () => {
  it("le bouton iOS ouvre la fiche App Store d'AthleX (id6762889282)", async () => {
    expect(Platform.OS).toBe('ios');
    Object.assign(mock, { runtimeVersion: '1.0.66', manifestVersion: '1.0.66', minVersion: '1.0.67' });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const r = await porte();
    act(() => { r.root.findByType(TouchableOpacity).props.onPress(); });
    expect(open).toHaveBeenCalledWith('https://apps.apple.com/app/id6762889282');
    open.mockRestore();
  });
});
