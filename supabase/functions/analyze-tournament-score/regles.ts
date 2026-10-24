// Règles d'analyze-tournament-score, sans Deno ni réseau : testées par Jest
// (src/__tests__/analyzeTournamentScoreRegles.test.ts), importées par index.ts
// qui leur fournit la vérification du jeton (clé serveur).
//
// Fonction désactivée (#594) : l'analyse enverrait à Anthropic le pseudo, le
// niveau et l'ELO d'un athlète, flux déclaré nulle part (/privacy, App Privacy,
// Sécurité des données). L'appelant reste authentifié, puis 410 avant tout
// appel externe. Le code d'analyse reste dans index.ts, jamais appelé.

/** Ce que la fonction lit, fourni par index.ts (clé serveur). */
export interface Acces {
  /** Identifiant de l'utilisateur du jeton, ou null s'il est invalide. */
  utilisateur(jwt: string): Promise<string | null>;
}

export type Reponse = { status: number; body: { error: string } };

export async function traiterAppel(authorization: string | null, acces: Acces): Promise<Reponse> {
  if (!authorization) return { status: 401, body: { error: 'Missing Authorization header' } };
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return { status: 401, body: { error: 'Empty token' } };
  if (!(await acces.utilisateur(jwt))) return { status: 401, body: { error: 'Invalid token' } };
  return { status: 410, body: { error: 'FEATURE_DISABLED' } };
}
