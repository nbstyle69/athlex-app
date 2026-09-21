/**
 * Lot B — écran du générateur (B1, B2, B3). Les écrans ne s'importent pas ici
 * (React Native) : on lit leur source pour les points de structure, et la table
 * de libellés est confrontée au catalogue réel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG_SNAPSHOT } from '../../packages/wod-engine/src/catalog/snapshot';
import { EQUIPMENT_LABELS_FR, equipmentLabel } from '../utils/wod/equipmentLabels';

const generateur = fs.readFileSync(path.join(__dirname, '..', 'screens/wod/WodGeneratorScreen.tsx'), 'utf8');
const contextCard = fs.readFileSync(path.join(__dirname, '..', 'components/wod/SessionContextCard.tsx'), 'utf8');

describe('B1 — titre et discipline', () => {
  it('deux lignes centrées, la discipline toujours nommée, Functional compris', () => {
    expect(generateur).toContain("<Text style={S.headerTitle}>Générateur de WOD</Text>");
    expect(generateur).toMatch(/isMuscu \? 'Musculation' : sport === 'hybrid' \? 'Hybrid' : 'Functional'/);
    expect(generateur).toMatch(/headerTitle: \{[^}]*textAlign: 'center'/);
    expect(generateur).toMatch(/headerDiscipline: \{[^}]*textAlign: 'center'/);
  });
});

describe('B2 — encart Classe du jour', () => {
  it('padding intérieur 16, hauteur libre, aucune ligne tronquée', () => {
    expect(contextCard).toMatch(/content: \{ padding: 16/);
    expect(contextCard).not.toMatch(/(?:card|content): \{[^}]*height/);
    expect(contextCard).not.toContain('numberOfLines');
  });
});

describe('B3 — matériel en français, recherche visible au-dessus du clavier', () => {
  it('chaque identifiant de matériel du catalogue a un libellé français', () => {
    const ids = new Set(CATALOG_SNAPSHOT.movements.flatMap((m) => m.equipment));
    const manquants = [...ids].filter((id) => !EQUIPMENT_LABELS_FR[id]);
    expect(manquants).toEqual([]);
    expect(equipmentLabel('band')).toBe('Élastique');
    expect(equipmentLabel('jump_rope')).toBe('Corde à sauter');
    expect(equipmentLabel('inconnu')).toBe('inconnu');
  });

  it("la puce affiche le libellé, la valeur interne reste l'identifiant", () => {
    expect(generateur).toContain('{equipmentLabel(e)}');
    expect(generateur).toContain('onPress={() => toggleExclude(e)}');
  });

  it('le champ de recherche vit sous un KeyboardAvoidingView', () => {
    expect(generateur).toMatch(/<KeyboardAvoidingView style=\{\{ flex: 1 \}\} behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}>/);
    expect(generateur).toContain('keyboardShouldPersistTaps="handled"');
  });
});
