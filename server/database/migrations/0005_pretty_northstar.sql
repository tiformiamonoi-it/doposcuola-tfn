CREATE TYPE "public"."contact_request_status" AS ENUM('PENDING', 'READ', 'RESOLVED');--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"message" text NOT NULL,
	"status" "contact_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
