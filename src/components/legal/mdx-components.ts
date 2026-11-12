/**
 * Composants utilisables dans les textes MDX de src/content/faq/ et de
 * src/content/legal/, sans import dans les fichiers. La page FAQ et le
 * gabarit des pages légales passent cette liste au contenu :
 * <Content components={mdxComponents} />.
 *
 * - <Todo what="ce qui manque">[texte provisoire]</Todo> : information manquante ;
 * - <Price of="home" /> : prix tiré de src/data/tarifs.ts (voir faq/Price.astro) ;
 * - <Detail of="email" /> : information tirée des données (voir faq/Detail.astro) ;
 * - <Callout label="…"> … </Callout> : encadré (calcul, avertissement) ;
 * - <Checklist> … </Checklist> : liste de constats précédés d'une coche ;
 * - <Credits /> : auteurs et licences des polices et des icônes (mentions légales).
 */
import Callout from './Callout.astro';
import Checklist from './Checklist.astro';
import Credits from './Credits.astro';
import MdxTodo from './MdxTodo.astro';
import Detail from '../faq/Detail.astro';
import Price from '../faq/Price.astro';

export const mdxComponents = { Todo: MdxTodo, Price, Detail, Callout, Checklist, Credits };
