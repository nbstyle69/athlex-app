// Module ESM natif, non transformé par Jest : un téléphone en français par défaut.
// Un test qui a besoin d'une autre langue le remplace par jest.mock.
module.exports = {
  getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-FR' }],
};
