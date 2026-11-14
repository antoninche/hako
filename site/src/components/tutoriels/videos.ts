/**
 * Vidéos en ligne d'un tutoriel (voir TutorialCard.astro).
 *
 * Seules les vidéos dont l'adresse est connue s'affichent : une adresse
 * encore inconnue (todo(…) dans src/content/tutoriels.ts) ne donne aucune
 * ligne sur la carte, et reste listée dans TODO.md. Un tutoriel sans aucune
 * vidéo en ligne porte l'étiquette « Bientôt ».
 */
import type { Platform, Tutorial } from '../../content/tutoriels.ts';
import { isTodo } from '../../lib/todo.ts';

export interface OnlineVideo {
  readonly platform: Platform;
  readonly url: string;
}

/** Vidéos dont l'adresse est connue, dans l'ordre des plateformes donné. */
export function onlineVideos(
  tutorial: Pick<Tutorial, 'videos'>,
  platforms: readonly Platform[],
): OnlineVideo[] {
  return platforms.flatMap((platform) => {
    const url = tutorial.videos?.[platform];
    return url === undefined || isTodo(url) ? [] : [{ platform, url }];
  });
}

/** « Bientôt » : tutoriel annoncé pas encore prêt, ou aucune vidéo en ligne. */
export function isComingSoon(
  tutorial: Pick<Tutorial, 'videos' | 'soon'>,
  platforms: readonly Platform[],
): boolean {
  return tutorial.soon === true || onlineVideos(tutorial, platforms).length === 0;
}
