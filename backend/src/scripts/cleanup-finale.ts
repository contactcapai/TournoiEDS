import 'dotenv/config';
import prisma from '../prisma/client';

async function main() {
  const finaleDay = await prisma.day.findFirst({
    where: { type: 'finale' },
    include: {
      rounds: {
        include: {
          lobbies: {
            include: { players: true },
          },
        },
      },
    },
  });

  if (!finaleDay) {
    console.log('Aucune Day type=finale trouvee. Rien a nettoyer.');
    return;
  }

  const roundIds = finaleDay.rounds.map((r) => r.id);
  const lobbyIds = finaleDay.rounds.flatMap((r) => r.lobbies.map((l) => l.id));
  const lobbyPlayerCount = finaleDay.rounds.reduce(
    (acc, r) => acc + r.lobbies.reduce((a, l) => a + l.players.length, 0),
    0
  );

  console.log('=== Day finale a supprimer ===');
  console.log(`  Day id=${finaleDay.id} number=${finaleDay.number} status=${finaleDay.status}`);
  console.log(`  ${roundIds.length} round(s), ${lobbyIds.length} lobby(s), ${lobbyPlayerCount} lobbyPlayer(s)`);
  console.log('');
  console.log('Suppression en cours (transaction atomique)...');

  await prisma.$transaction(async (tx) => {
    if (lobbyIds.length > 0) {
      await tx.lobbyPlayer.deleteMany({ where: { lobbyId: { in: lobbyIds } } });
      await tx.lobby.deleteMany({ where: { id: { in: lobbyIds } } });
    }
    if (roundIds.length > 0) {
      await tx.round.deleteMany({ where: { id: { in: roundIds } } });
    }
    await tx.day.delete({ where: { id: finaleDay.id } });
  });

  console.log('Day finale supprimee. Recliquez "Lancer la finale" dans l\'admin pour repartir propre.');
}

main()
  .catch((err) => {
    console.error('Erreur:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
