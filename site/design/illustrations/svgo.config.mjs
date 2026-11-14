// Optimisation des illustrations : garde le viewBox, le titre et la description,
// retire width/height et préfixe les identifiants par le nom du fichier.
// Usage : npx svgo --config design/illustrations/svgo.config.mjs -r -f <dossier>
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    { name: 'preset-default', params: { overrides: { removeDesc: false } } },
    'removeDimensions',
    { name: 'prefixIds', params: { delim: '-', prefixClassNames: false } },
  ],
};
