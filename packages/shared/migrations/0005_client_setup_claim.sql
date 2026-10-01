CREATE TABLE "client_setup_claim" (
	"key" text PRIMARY KEY NOT NULL,
	"claimId" text NOT NULL,
	"claimedAt" timestamp with time zone DEFAULT now() NOT NULL
);
