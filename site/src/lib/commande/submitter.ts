/**
 * Envoi d'une demande de commande.
 *
 * Le formulaire ne connaît que l'interface OrderSubmitter. Aujourd'hui, seul
 * DemoSubmitter existe : il ne transmet rien. Pour brancher un vrai service
 * plus tard, il suffira d'écrire une autre implémentation et de la passer au
 * formulaire (voir docs/commande.md).
 */
import type { OrderRequest } from './types.ts';

/** Résultat d'un envoi réussi. */
export type SubmitResult =
  /** Démonstration : rien n'a été transmis. */
  | { readonly status: 'demo' }
  /** Demande reçue par le service, avec sa référence. */
  | { readonly status: 'received'; readonly reference: string };

export interface OrderSubmitter {
  /** « demo » : rien ne quitte le navigateur ; « live » : la demande est transmise. */
  readonly mode: 'demo' | 'live';
  /**
   * Transmet la demande. La promesse est rejetée si l'envoi échoue : le
   * formulaire affiche alors un message et garde ce qui a été saisi.
   */
  submit(order: OrderRequest): Promise<SubmitResult>;
}

/**
 * Mode démonstration : aucune requête réseau, aucun stockage (ni cookie, ni
 * localStorage, ni sessionStorage). La demande n'est ni copiée ni conservée :
 * elle disparaît avec la page.
 */
export class DemoSubmitter implements OrderSubmitter {
  readonly mode = 'demo';

  submit(): Promise<SubmitResult> {
    return Promise.resolve({ status: 'demo' });
  }
}
