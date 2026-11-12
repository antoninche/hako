/**
 * Collections de contenu : les textes longs du site, écrits en MDX (du
 * Markdown qui accepte aussi quelques composants, comme <Todo>).
 *
 * - faq : une question par fichier, dans src/content/faq/ ;
 * - legal : une page légale par fichier, dans src/content/legal/.
 *
 * Astro vérifie l'en-tête de chaque fichier (le bloc entre les deux lignes
 * « --- ») avec les schémas ci-dessous. Une faute de frappe arrête la
 * construction du site avec un message qui nomme le fichier en cause.
 *
 * Dans le texte, quelques composants s'utilisent sans import : <Todo>,
 * <Price>, <Detail>, <Callout>, <Checklist> et <Credits> (liste et exemples
 * dans src/components/legal/mdx-components.ts).
 *
 * Une information manquante s'écrit sur une seule ligne, dans sa phrase,
 * après un court texte : « Durée de la garantie : <Todo what="Durée de la
 * garantie de la box">[durée]</Todo> ». Écrit seul sur sa ligne, le texte
 * provisoire à la ligne suivante, le repère passe sous la phrase précédente
 * au lieu de la suivre (le HTML reste valide : voir legal/MdxTodo.astro).
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Rubriques de la FAQ. Chaque question en choisit une, écrite exactement
 * ainsi. Les rubriques s'affichent dans l'ordre de leur première question.
 * Pour en créer une, ajoutez son nom à cette liste.
 */
export const faqTopics = [
  'Vos données',
  'La box au quotidien',
  'Commande et accompagnement',
] as const;

const faq = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/faq' }),
  schema: z.strictObject({
    /** La question, telle qu'elle s'affiche. */
    question: z.string().trim().min(1),
    /** Place de la question dans la page : les plus petits nombres d'abord. */
    order: z.number().int().nonnegative(),
    /** Rubrique de la question, prise dans la liste faqTopics. */
    topic: z.enum(faqTopics),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/legal' }),
  schema: z.strictObject({
    /** Titre de la page (h1 et onglet du navigateur). */
    title: z.string().trim().min(1),
    /** Résumé pour les moteurs de recherche (150 caractères environ). */
    description: z.string().trim().min(1).max(160),
    /** Texte d'introduction, sous le titre. */
    intro: z.string().trim().min(1),
    /** true : un sommaire des intertitres (##) s'affiche en haut de la page. */
    toc: z.boolean().default(false),
  }),
});

export const collections = { faq, legal };
