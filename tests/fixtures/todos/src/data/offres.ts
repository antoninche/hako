// Jeu d'essai pour scripts/todos.mjs : chaque cas est commenté.
import { todo } from '../../../../../src/lib/todo';

// todo('Dans un commentaire de ligne', '[ignoré]')
/*
 * todo('Dans un commentaire de bloc', '[ignoré]')
 */
export const offre = {
  nom: 'Hako Home',
  prix: 600,
  tva: todo('Prix TTC ou HT', '[TTC ?]'),
  duree: todo(
    "Durée des mises à jour de sécurité",
    '[durée]',
  ),
  apostrophe: todo('Nom de l\'interlocuteur', "[nom]"),
  gabarit: todo(`Tarif d'une intervention`, `[tarif]`),
  phrase: 'Appelez todo("dans une chaîne", "[ignoré]") pour signaler un manque.',
  option2To: null, // TODO: prix de l'option 2 To
  option4To: null, // TODO : prix de l'option 4 To
  remise: null,
  acompte: 30, // TODO: ce commentaire ne suit pas une valeur null
};

const variable = 'Ce qui manque';
// Appel non analysable (premier argument calculé) : signalé, non compté.
export const calcule = todo(variable, '[calculé]');
