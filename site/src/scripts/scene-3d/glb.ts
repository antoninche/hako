/**
 * Chargement du modèle réel (public/models/hako.glb), seulement s'il existait
 * au moment de la construction du site. Ce module n'est téléchargé que dans
 * ce cas : sans modèle, ni GLTFLoader ni le décodeur meshopt ne sont chargés.
 *
 * Compatibilité CSP :
 * - les images intégrées au .glb sont décodées avec createImageBitmap, sans
 *   adresse blob: (GLTFLoader en crée une par défaut) ;
 * - le décodeur meshopt (WebAssembly) n'est téléchargé que si le fichier est
 *   compressé avec meshopt (npm run model:optimize -- --meshopt). Ce cas seul
 *   demande « 'wasm-unsafe-eval' » dans script-src ; la sortie par défaut
 *   (quantification seule) n'en a pas besoin. Voir docs/model-contract.md.
 */
import { Texture, type Object3D } from 'three';
import type { GLTFLoaderPlugin, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REQUIRED_NODES } from './contract';

interface ImageDef {
  bufferView?: number;
  mimeType?: string;
  uri?: string;
}

/** Remplace le chargement des images intégrées par un décodage direct. */
class InlineImagesWithoutBlobUrl implements GLTFLoaderPlugin {
  readonly name = 'hako_inline_images';

  constructor(parser: GLTFParser) {
    const original = parser.loadImageSource.bind(parser);
    const cache = new Map<number, Promise<Texture>>();
    parser.loadImageSource = async (sourceIndex, loader) => {
      const json = parser.json as { images?: ImageDef[] };
      const def = json.images?.[sourceIndex];
      if (!def || def.bufferView === undefined) return original(sourceIndex, loader);
      const cached = cache.get(sourceIndex);
      if (cached) return (await cached).clone();
      const bufferView = def.bufferView;
      const pending = (async () => {
        const buffer = (await parser.getDependency('bufferView', bufferView)) as ArrayBuffer;
        const blob = new Blob([buffer], { type: def.mimeType ?? 'image/png' });
        const bitmap = await createImageBitmap(blob, {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        });
        const texture = new Texture(bitmap);
        texture.userData.mimeType = def.mimeType;
        texture.needsUpdate = true;
        return texture;
      })();
      cache.set(sourceIndex, pending);
      return pending;
    };
  }
}

type MeshoptDecoderApi =
  typeof import('three/examples/jsm/libs/meshopt_decoder.module.js').MeshoptDecoder;

/**
 * Décodeur meshopt importé seulement quand un fichier en a besoin (produit
 * avec npm run model:optimize -- --meshopt) : il compile du WebAssembly dès
 * son import, ce que la CSP prévue (default-src 'self') interdit. GLTFLoader
 * n'utilise que `supported` et `decodeGltfBufferAsync`.
 */
const lazyMeshoptDecoder = {
  supported: true,
  async decodeGltfBufferAsync(...args: Parameters<MeshoptDecoderApi['decodeGltfBufferAsync']>) {
    const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
    return MeshoptDecoder.decodeGltfBufferAsync(...args);
  },
} as unknown as MeshoptDecoderApi;

export class MissingNodesError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`hako.glb : objets manquants (${missing.join(', ')}).`);
    this.name = 'MissingNodesError';
  }
}

/** Charge le modèle et vérifie qu'il contient tous les objets obligatoires du contrat. */
export async function loadGlbModel(url: string): Promise<Object3D> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(lazyMeshoptDecoder);
  loader.register((parser) => new InlineImagesWithoutBlobUrl(parser));
  const gltf = await loader.loadAsync(url);
  const missing = REQUIRED_NODES.filter((name) => !gltf.scene.getObjectByName(name));
  if (missing.length > 0) throw new MissingNodesError(missing);
  return gltf.scene;
}
