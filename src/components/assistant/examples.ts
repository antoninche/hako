/**
 * Comptes d'exemple montrés sans JavaScript, à la construction du site : les
 * prénoms d'exemple de la démonstration (Hélène, Marc, Léa), leurs
 * identifiants et les mots de passe d'exemple (src/data/assistant.ts), tels
 * que la HAKO simulée les remettrait. Avec JavaScript, le script de la page
 * les retire au démarrage : chacun voit ensuite les comptes des prénoms
 * qu'il a tapés.
 *
 * Ce module ne sert qu'à la construction des pages : le script du
 * navigateur ne l'importe jamais.
 */
import { EXAMPLE_FIRST_NAMES, EXAMPLE_PASSWORDS, LOGIN_DOMAIN } from '../../data/assistant';
import type { Account } from '../../lib/assistant/box-access.ts';
import { assignLogins } from '../../lib/assistant/household.ts';

const logins = assignLogins(EXAMPLE_FIRST_NAMES, LOGIN_DOMAIN);

export const exampleAccounts: readonly Account[] = EXAMPLE_FIRST_NAMES.map((firstName, index) => ({
  firstName,
  login: logins[index] ?? '',
  owner: index === 0,
  password: EXAMPLE_PASSWORDS[index] ?? '',
}));
