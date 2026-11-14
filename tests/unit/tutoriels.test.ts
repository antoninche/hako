/**
 * Vidéos des tutoriels (src/components/tutoriels/videos.ts) : seules les
 * adresses connues donnent un lien ; sans aucune vidéo en ligne, la carte
 * porte l'étiquette « Bientôt ».
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isComingSoon, onlineVideos } from '../../src/components/tutoriels/videos.ts';
import { todo } from '../../src/lib/todo.ts';

const platforms = ['youtube'] as const;
const youtube = 'https://www.youtube.com/watch?v=exemple';
const missing = todo('Adresse de la vidéo sur YouTube', '[lien à venir]');

describe('vidéos d’un tutoriel', () => {
  it('adresse inconnue : aucune ligne, « Bientôt »', () => {
    const tutorial = { videos: { youtube: missing } };
    assert.deepEqual(onlineVideos(tutorial, platforms), []);
    assert.equal(isComingSoon(tutorial, platforms), true);
  });

  it('adresse connue : un lien, sans « Bientôt »', () => {
    const tutorial = { videos: { youtube } };
    assert.deepEqual(onlineVideos(tutorial, platforms), [{ platform: 'youtube', url: youtube }]);
    assert.equal(isComingSoon(tutorial, platforms), false);
  });

  it('sans vidéos du tout : « Bientôt »', () => {
    assert.deepEqual(onlineVideos({}, platforms), []);
    assert.equal(isComingSoon({}, platforms), true);
  });

  it('tutoriel annoncé (soon: true) : « Bientôt », même avec une adresse', () => {
    assert.equal(isComingSoon({ soon: true, videos: { youtube } }, platforms), true);
  });
});
