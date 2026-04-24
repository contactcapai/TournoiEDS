-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "discordPseudo" TEXT NOT NULL,
    "riotPseudo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inscrit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_discordPseudo_key" ON "Player"("discordPseudo");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
