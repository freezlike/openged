-- Create workflow definition table for graphical designer
CREATE TABLE "WorkflowDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definitionJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDef_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowDef_name_key" ON "WorkflowDef"("name");

-- Link workflow instances to designed definitions
ALTER TABLE "WorkflowInstance"
ADD COLUMN "workflowDefId" TEXT;

CREATE INDEX "WorkflowInstance_workflowDefId_idx" ON "WorkflowInstance"("workflowDefId");

ALTER TABLE "WorkflowInstance"
ADD CONSTRAINT "WorkflowInstance_workflowDefId_fkey"
FOREIGN KEY ("workflowDefId") REFERENCES "WorkflowDef"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
