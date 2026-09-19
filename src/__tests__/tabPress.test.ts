/**
 * B4 (lot B) — mémoire de pile par onglet et double appui.
 *
 * La barre d'onglets ne navigue pas quand l'onglet est déjà actif (la pile
 * est conservée), et seul un double appui sur l'onglet actif ramène à sa
 * racine. Le navigateur ne porte plus de `tabPress` qui force la racine.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DOUBLE_TAP_MS, TAB_ROOTS, tabPressAction } from '../navigation/tabPress';

const navigateur = fs.readFileSync(path.join(__dirname, '..', 'navigation/index.tsx'), 'utf8');

describe('tabPressAction', () => {
  it("changer d'onglet : la barre bascule, la pile de l'onglet quitté reste intacte (aucune navigation vers la racine)", () => {
    const r = tabPressAction(null, 'Whiteboard', false, 1000);
    expect(r.action).toBe('switch');
    expect(r.last).toEqual({ name: 'Whiteboard', at: 1000 });
  });

  it("un appui sur l'onglet actif ne fait rien", () => {
    expect(tabPressAction(null, 'Home', true, 1000).action).toBe('none');
    expect(tabPressAction({ name: 'Home', at: 0 }, 'Home', true, 1000).action).toBe('none');
  });

  it("un double appui sur l'onglet actif ramène à sa racine, puis repart de zéro", () => {
    const first = tabPressAction(null, 'Home', true, 1000);
    const second = tabPressAction(first.last, 'Home', true, 1000 + DOUBLE_TAP_MS);
    expect(second).toEqual({ action: 'root', last: null });
    expect(tabPressAction(second.last, 'Home', true, 1000 + DOUBLE_TAP_MS + 10).action).toBe('none');
  });

  it("deux appuis trop espacés, ou sur deux onglets différents, ne comptent pas comme un double appui", () => {
    expect(tabPressAction({ name: 'Home', at: 1000 }, 'Home', true, 1000 + DOUBLE_TAP_MS + 1).action).toBe('none');
    const switched = tabPressAction({ name: 'Home', at: 1000 }, 'Whiteboard', false, 1100);
    expect(tabPressAction(switched.last, 'Home', true, 1150).action).toBe('none');
  });
});

describe('navigateur principal', () => {
  it('les cinq onglets partagent le même listener, aucun ne force sa racine à chaque appui', () => {
    expect(navigateur).not.toMatch(/tabPress: \(\) => navigation\.navigate\('(Home|Competitions|Explorer|Whiteboard|Reservation)'/);
    expect((navigateur.match(/listeners=\{tabListeners\}/g) ?? []).length).toBe(5);
    expect(navigateur).toContain("if (r.action === 'root') navigation.navigate(route.name, { screen: TAB_ROOTS[route.name as TabName] });");
  });

  it('chaque onglet connaît sa racine', () => {
    expect(TAB_ROOTS).toEqual({ Home: 'HomeList', Competitions: 'CompetitionList', Explorer: 'ExplorerMain', Whiteboard: 'WhiteboardMain', Reservation: 'ReservationMain' });
    for (const root of Object.values(TAB_ROOTS)) expect(navigateur).toContain(`name="${root}"`);
  });
});
