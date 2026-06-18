// Déclaration ambiante pour les CSS Modules de @repo/ui.
// Les apps consommatrices (vitrine/Next) transpilent ce package (transpilePackages)
// et fournissent leur propre typage CSS Modules, mais cette déclaration permet
// au package d'être cohérent côté IDE/TS sans tsconfig dédié.
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
