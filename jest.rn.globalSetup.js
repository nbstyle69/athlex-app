// Suite RN : fuseau fixé à UTC (celui de la CI et des instantanés), quel que soit le poste.
module.exports = async () => {
  process.env.TZ = 'UTC';
};
