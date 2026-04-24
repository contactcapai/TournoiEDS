-- CreateTable
CREATE TABLE "Day" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'qualification',
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "dayId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyPlayer" (
    "id" SERIAL NOT NULL,
    "lobbyId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "placement" INTEGER,
    "points" INTEGER,

    CONSTRAINT "LobbyPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Day_number_type_key" ON "Day"("number", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Round_dayId_number_key" ON "Round"("dayId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_roundId_number_key" ON "Lobby"("roundId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyPlayer_lobbyId_playerId_key" ON "LobbyPlayer"("lobbyId", "playerId");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyPlayer" ADD CONSTRAINT "LobbyPlayer_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyPlayer" ADD CONSTRAINT "LobbyPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
