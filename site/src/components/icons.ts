/**
 * Icônes d'interface dessinées pour HAKO : un trait fin et régulier (grille
 * de 24, trait de 1,5, extrémités arrondies), chacune décrite par ses tracés.
 * Utilisées par <Icon> et montrées toutes par la charte graphique (/charte/),
 * qui lit cette liste : elle ne peut pas se décaler du code.
 */
export const uiIcons = {
  menu: ['M4 9h16', 'M4 15h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  mail: [
    'M4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5Z',
    'M3.5 7l8.5 6 8.5-6',
  ],
  'map-pin': [
    'M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11Z',
    'M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  ],
  'arrow-right': ['M4 12h16', 'm14 6 6 6-6 6'],
  external: [
    'M14 4h6v6',
    'M20 4l-9 9',
    'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10',
  ],
  phone: [
    'M6.6 3.75h2.1a1 1 0 0 1 .95.68l1.05 3.15a1 1 0 0 1-.3 1.07l-1.6 1.35a11.5 11.5 0 0 0 5.2 5.2l1.35-1.6a1 1 0 0 1 1.07-.3l3.15 1.05a1 1 0 0 1 .68.95v2.1a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.6 5.95a2 2 0 0 1 2-2.2Z',
  ],
  box: ['M12 3.25 20 7.6v8.8L12 20.75 4 16.4V7.6l8-4.35Z', 'M4.4 7.8 12 12l7.6-4.2', 'M12 12v8.5'],
  video: [
    'M3.75 7.5A1.5 1.5 0 0 1 5.25 6h8.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8.5a1.5 1.5 0 0 1-1.5-1.5v-9Z',
    'm15.25 10.25 5-2.75v9l-5-2.75',
  ],
  clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 7.5V12l3 2'],
  // Guide d'installation (/installer/).
  'arrow-left': ['M20 12H4', 'm10 6-6 6 6 6'],
  check: ['M5 12.5 9.5 17 19 7.5'],
  info: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 11v5.25', 'M12 7.75v.01'],
  question: [
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.29c-.6.26-1 .86-1 1.52v.44',
    'M12 16.75v.01',
  ],
  // Fiche d'un câble réseau (Ethernet), vue de dessus, avec son câble.
  cable: [
    'M7.5 3h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
    'M10.5 3v3M13.5 3v3',
    'M9.5 13v3.5h5V13',
    'M12 16.5V21',
  ],
  // Fiche électrique, vue de face : deux broches, un corps arrondi et son câble.
  plug: ['M9 3.5v4', 'M15 3.5v4', 'M7 7.5h10V11a5 5 0 0 1-10 0V7.5Z', 'M12 16v4.5'],
  wifi: [
    'M3.51 9.01a12 12 0 0 1 16.98 0',
    'M6.34 11.84a8 8 0 0 1 11.32 0',
    'M9.17 14.67a4 4 0 0 1 5.66 0',
    'M12 17.5v.01',
  ],
  smartphone: [
    'M8 2.75h8a2 2 0 0 1 2 2v14.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2Z',
    'M10.75 18h2.5',
  ],
  laptop: [
    'M5 5.75A1.75 1.75 0 0 1 6.75 4h10.5A1.75 1.75 0 0 1 19 5.75V15H5V5.75Z',
    'M3.5 15h17l1 3.25a1 1 0 0 1-.96 1.25H3.46a1 1 0 0 1-.96-1.25L3.5 15Z',
  ],
  printer: [
    'M7 9V3.75h10V9',
    'M7 17.5H5.5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H17',
    'M7 14h10v6.25H7Z',
    'M16.5 11.75v.01',
  ],
} as const satisfies Record<string, readonly string[]>;

export type UiIconName = keyof typeof uiIcons;
