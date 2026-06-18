// Schéma Drizzle de la vitrine — volontairement vide (Story 1.7, Garde-fou n°3).
// Ne rien ajouter ici sans story dédiée : les tables arrivent une par une, chacune avec
// sa migration `.sql` (3.1 event/bar, 4.1 partner, 4.4 photo, 5.1 solicitation).
// Schéma vide => `drizzle-kit generate` rapporte « no schema changes » : c'est attendu,
// ne pas créer de table-sonde pour forcer un `.sql`.

export {};
