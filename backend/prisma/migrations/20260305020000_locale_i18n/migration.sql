-- Create locale enum type
CREATE TYPE "locale" AS ENUM ('fr', 'en', 'ar');

-- Add preferred locale per user
ALTER TABLE "User"
ADD COLUMN "preferredLocale" "locale";

-- Add organization default locale
ALTER TABLE "OrgSettings"
ADD COLUMN "defaultLocale" "locale" NOT NULL DEFAULT 'fr';
