CREATE TABLE "tournament_entry_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"played_on" date NOT NULL,
	"state" "tournament_entry_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_entry_attendance_etat_du_jour" CHECK ("tournament_entry_attendance"."state" in ('present', 'absent'))
);
--> statement-breakpoint
ALTER TABLE "tournament_entry_attendance" ADD CONSTRAINT "tournament_entry_attendance_entry_id_tournament_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_attendance_unique" ON "tournament_entry_attendance" USING btree ("entry_id","played_on");