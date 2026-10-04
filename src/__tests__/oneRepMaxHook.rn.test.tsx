/**
 * R1 — les écrans (texte des WOD, grille) lisent le 1RM par useMyRecords :
 * le hook doit passer par le record exact du libellé (Bench Press, Strict Press).
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useMyRecords } from '../hooks/useMyOneRepMax';

jest.mock('../services/myProfile', () => ({
  fetchMyPersonalRecords: jest.fn(async () => ({
    'weightlifting_Bench Press': '100', 'weightlifting_Strict Press': '60', 'weightlifting_Push Press': '80',
  })),
}));

it('useMyRecords().oneRepMaxFor lit le record exact du libellé', async () => {
  let oneRepMaxFor: (name: string) => number | null = () => null;
  const Probe = () => { oneRepMaxFor = useMyRecords().oneRepMaxFor; return null; };
  await act(async () => { TestRenderer.create(<Probe />); });
  expect(oneRepMaxFor('Bench Press')).toBe(100);
  expect(oneRepMaxFor('Strict Press')).toBe(60);
  expect(oneRepMaxFor('Push Press')).toBe(80);
});
