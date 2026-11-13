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

const platforms = ['youtube', 'peertube'] as const;
const youtube = 'https://www.youtube.com/watch?v=exemple';
const peertube = 'https://peertube.exemple.fr/w/exemple';
const missing = (platform: string) => todo(`Adresse de la vidéo sur ${platform}`, '[lien à venir]');

describe('vidéos d’un tutoriel', () => {
  it('adresses inconnues : aucune ligne, « Bientôt »', () => {
    const tutorial = { videos: { youtube: missing('YouTube'), peertube: missing('PeerTube') } };
    assert.deepEqual(onlineVideos(tutorial, platforms), []);
    assert.equal(isComingSoon(tutorial, platforms), true);
  });

  it('une seule adresse connue : un seul lien, sans « Bientôt »', () => {
    const tutorial = { videos: { youtube: missing('YouTube'), peertube } };
    assert.deepEqual(onlineVideos(tutorial, platforms), [{ platform: 'peertube', url: peertube }]);
    assert.equal(isComingSoon(tutorial, platforms), false);
  });

  it('deux adresses connues : dans l’ordre des plateformes donné', () => {
    const tutorial = { videos: { peertube, youtube } };
    assert.deepEqual(onlineVideos(tutorial, platforms), [
      { platform: 'youtube', url: youtube },
      { platform: 'peertube', url: peertube },
    ]);
    assert.deepEqual(
      onlineVideos(tutorial, ['peertube', 'youtube']).map((video) => video.platform),
      ['peertube', 'youtube'],
    );
  });

  it('sans vidéos du tout : « Bientôt »', () => {
    assert.deepEqual(onlineVideos({}, platforms), []);
    assert.equal(isComingSoon({}, platforms), true);
  });

  it('tutoriel annoncé (soon: true) : « Bientôt », même avec une adresse', () => {
    assert.equal(isComingSoon({ soon: true, videos: { youtube, peertube } }, platforms), true);
  });
});
