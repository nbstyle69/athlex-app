// Les tests tournent dans le fuseau des utilisateurs (Europe/Paris), pas en UTC :
// c'est à minuit local, la veille en UTC, qu'un `toISOString()` fait glisser une date.
module.exports = async () => {
  process.env.TZ = 'Europe/Paris';
};
