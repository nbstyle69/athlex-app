import { CATALOG_SNAPSHOT } from '../../packages/wod-engine/src/catalog/snapshot';
import { equipmentOptions } from '../screens/wod/wodGeneratorOptions';
import { EQUIPMENT_LABELS_FR } from '../utils/wod/equipmentLabels';
import { searchExclusions } from '../utils/wod/exclusionSearch';

const equipment = Object.keys(EQUIPMENT_LABELS_FR);
const search = (query: string, excluded: string[] = [], musculation = false) =>
  searchExclusions(CATALOG_SNAPSHOT, equipment, query, excluded, musculation);

describe('C1 — recherche sur les libellés affichés', () => {
  it.each(Object.entries(EQUIPMENT_LABELS_FR))('%s est retrouvé par un mot de « %s »', (id, label) => {
    const word = label.split(/[\s-]+/).sort((a, b) => b.length - a.length)[0]
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    expect(search(word)).toContainEqual({ id, name: label, kind: 'equipment' });
  });

  it('corde trouve la corde à sauter proposée en Functional', () => {
    expect(searchExclusions(CATALOG_SNAPSHOT, equipmentOptions(CATALOG_SNAPSHOT), ' CORDE ', [], false))
      .toContainEqual({ id: 'jump_rope', name: 'Corde à sauter', kind: 'equipment' });
  });

  it.each(['elastique', 'ÉLASTIQUE', 'E\u0301LASTIQUE'])('normalise accents, casse et accents décomposés : %s', (q) => {
    expect(search(q)).toContainEqual({ id: 'band', name: 'Élastique', kind: 'equipment' });
  });

  it('retrouve aussi un mouvement français sans accent et respecte le filtre Musculation', () => {
    const movement = CATALOG_SNAPSHOT.movements.find((m) => m.active && m.muscu && /é/.test(m.name));
    expect(movement).toBeDefined();
    const label = movement!.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    expect(search(label, [], true)).toContainEqual({ id: movement!.id, name: movement!.name, kind: 'movement' });
    expect(search('burpee', [], true).filter((h) => h.kind === 'movement')
      .every((h) => !!CATALOG_SNAPSHOT.movements.find((m) => m.id === h.id)?.muscu)).toBe(true);
  });

  it('ignore les éléments déjà exclus, le matériel hors sélection et les recherches vides', () => {
    expect(search('corde', ['jump_rope'])).not.toContainEqual(expect.objectContaining({ id: 'jump_rope' }));
    expect(searchExclusions(CATALOG_SNAPSHOT, ['barbell'], 'corde', [], false)
      .filter((h) => h.kind === 'equipment')).toEqual([]);
    expect(search(' ')).toEqual([]);
    expect(search('a')).toEqual([]);
  });
});
