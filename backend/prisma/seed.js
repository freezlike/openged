const { createHash } = require('crypto');
const { mkdir, writeFile } = require('fs/promises');
const { dirname, join } = require('path');

const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let s3Client;

function getSeedBuffer(title) {
  return Buffer.from(`OpenGED seeded file: ${title}\nGenerated at ${new Date().toISOString()}\n`, 'utf8');
}

async function persistSeedObject(objectKey, mimeType, content) {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (provider === 's3') {
    if (!s3Client) {
      s3Client = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || '',
          secretAccessKey: process.env.S3_SECRET_KEY || '',
        },
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') !== 'false',
      });
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET || 'openged',
        Key: objectKey,
        Body: content,
        ContentType: mimeType,
      }),
    );

    return 'S3';
  }

  const root = process.env.LOCAL_STORAGE_ROOT || './storage';
  const absolutePath = join(root, objectKey);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);

  return 'LOCAL';
}

async function upsertRole(role) {
  return prisma.role.upsert({
    where: { code: role.code },
    update: { name: role.name },
    create: role,
  });
}

async function upsertLocalUser({ email, password, roleCodes }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      status: 'ACTIVE',
      authSource: 'LOCAL',
    },
    create: {
      email,
      passwordHash,
      status: 'ACTIVE',
      authSource: 'LOCAL',
    },
  });

  for (const roleCode of roleCodes) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      continue;
    }

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  return user;
}

async function ensureTaxonomy(name, values) {
  const taxonomy = await prisma.taxonomy.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  for (const value of values) {
    await prisma.taxonomyValue.upsert({
      where: {
        taxonomyId_label: {
          taxonomyId: taxonomy.id,
          label: value,
        },
      },
      update: {},
      create: {
        taxonomyId: taxonomy.id,
        label: value,
      },
    });
  }
}

async function ensureLibraryField(libraryId, params) {
  return prisma.fieldDef.upsert({
    where: {
      libraryId_name: {
        libraryId,
        name: params.name,
      },
    },
    update: {
      dataType: params.dataType,
      required: params.required,
      validation: params.validation,
    },
    create: {
      libraryId,
      name: params.name,
      dataType: params.dataType,
      required: params.required,
      validation: params.validation,
    },
  });
}

async function ensureDocument(params) {
  const content = getSeedBuffer(params.title);
  const storageProvider = await persistSeedObject(params.objectKey, params.mimeType, content);
  const sha256 = createHash('sha256').update(content).digest('hex');

  const fileObject = await prisma.fileObject.upsert({
    where: { objectKey: params.objectKey },
    update: {
      storageProvider,
      mimeType: params.mimeType,
      size: BigInt(content.length),
      sha256,
    },
    create: {
      storageProvider,
      objectKey: params.objectKey,
      mimeType: params.mimeType,
      size: BigInt(content.length),
      sha256,
    },
  });

  const existing = await prisma.document.findFirst({
    where: {
      libraryId: params.libraryId,
      folderId: params.folderId,
      title: params.title,
    },
  });

  const document = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: {
          status: params.status,
          contentTypeId: params.contentTypeId,
        },
      })
    : await prisma.document.create({
        data: {
          libraryId: params.libraryId,
          folderId: params.folderId,
          title: params.title,
          status: params.status,
          createdBy: params.createdBy,
          contentTypeId: params.contentTypeId,
        },
      });

  const version = await prisma.documentVersion.upsert({
    where: {
      documentId_versionMajor_versionMinor: {
        documentId: document.id,
        versionMajor: 1,
        versionMinor: 0,
      },
    },
    update: {
      fileId: fileObject.id,
      comment: params.comment,
    },
    create: {
      documentId: document.id,
      versionMajor: 1,
      versionMinor: 0,
      versionType: 'MAJOR',
      fileId: fileObject.id,
      createdBy: params.createdBy,
      comment: params.comment,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: {
      currentVersionId: version.id,
    },
  });

  await prisma.documentMetadata.upsert({
    where: {
      documentId_fieldId: {
        documentId: document.id,
        fieldId: params.confidentialityFieldId,
      },
    },
    update: {
      value: params.confidentiality,
    },
    create: {
      documentId: document.id,
      fieldId: params.confidentialityFieldId,
      value: params.confidentiality,
    },
  });

  if (params.domainFieldId && params.domain) {
    await prisma.documentMetadata.upsert({
      where: {
        documentId_fieldId: {
          documentId: document.id,
          fieldId: params.domainFieldId,
        },
      },
      update: {
        value: params.domain,
      },
      create: {
        documentId: document.id,
        fieldId: params.domainFieldId,
        value: params.domain,
      },
    });
  }

  return document;
}

async function main() {
  const roles = [
    { code: 'READER', name: 'Reader' },
    { code: 'CONTRIBUTOR', name: 'Contributor' },
    { code: 'EDITOR', name: 'Editor' },
    { code: 'VALIDATOR', name: 'Validator' },
    { code: 'SITE_ADMIN', name: 'Site Admin' },
    { code: 'GLOBAL_ADMIN', name: 'Global Admin' },
    { code: 'SUPER_ADMIN', name: 'Super Admin' },
  ];

  for (const role of roles) {
    await upsertRole(role);
  }

  await prisma.systemState.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      status: 'NOT_INSTALLED',
      installerLocked: false,
      authMode: 'LOCAL_ONLY',
      searchEnabled: false,
      ssoEnabled: false,
      emailEnabled: false,
    },
  });

  const workflowTemplate = await prisma.workflowTemplate.upsert({
    where: { name: 'Default Approval' },
    update: {},
    create: {
      name: 'Default Approval',
      states: ['Draft', 'Submitted', 'Validated', 'Published'],
      transitions: [
        { from: 'Draft', to: 'Submitted' },
        { from: 'Submitted', to: 'Validated' },
        { from: 'Validated', to: 'Published' },
        { from: 'Submitted', to: 'Draft', action: 'reject' },
      ],
    },
  });

  const adminUser = await upsertLocalUser({
    email: 'admin@example.com',
    password: 'ChangeMe123!',
    roleCodes: ['SUPER_ADMIN', 'GLOBAL_ADMIN', 'SITE_ADMIN', 'EDITOR', 'VALIDATOR'],
  });

  const editorUser = await upsertLocalUser({
    email: 'editor@example.com',
    password: 'ChangeMe123!',
    roleCodes: ['EDITOR', 'CONTRIBUTOR', 'READER'],
  });

  const validatorUser = await upsertLocalUser({
    email: 'validator@example.com',
    password: 'ChangeMe123!',
    roleCodes: ['VALIDATOR', 'READER'],
  });

  const readerUser = await upsertLocalUser({
    email: 'reader@example.com',
    password: 'ChangeMe123!',
    roleCodes: ['READER'],
  });

  const existingSystemState = await prisma.systemState.findUnique({ where: { id: 1 } });

  await prisma.systemState.upsert({
    where: { id: 1 },
    update: {
      status: 'INSTALLED',
      installerLocked: true,
      installedAt: existingSystemState?.installedAt ?? new Date(),
      installedBy: existingSystemState?.installedBy ?? adminUser.id,
      appVersion: existingSystemState?.appVersion ?? '1.0.0',
    },
    create: {
      id: 1,
      status: 'INSTALLED',
      installerLocked: true,
      installedAt: new Date(),
      installedBy: adminUser.id,
      appVersion: '1.0.0',
      authMode: 'LOCAL_ONLY',
      searchEnabled: false,
      ssoEnabled: false,
      emailEnabled: false,
    },
  });

  await prisma.orgSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      orgName: 'OpenGED Organization',
      timezone: 'UTC',
      language: 'en',
      technicalEmail: 'it@example.com',
    },
  });

  const existingGeneralSite = await prisma.site.findFirst({
    where: { name: 'General' },
    include: {
      libraries: {
        where: { name: 'Documents' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const site = existingGeneralSite
    ? await prisma.site.update({
        where: { id: existingGeneralSite.id },
        data: {
          description: existingGeneralSite.description ?? 'Default collaborative site',
          ownerId: existingGeneralSite.ownerId ?? adminUser.id,
        },
      })
    : await prisma.site.create({
        data: {
          name: 'General',
          description: 'Default collaborative site',
          ownerId: adminUser.id,
        },
      });

  const library = await prisma.library.upsert({
    where: {
      siteId_name: {
        siteId: site.id,
        name: 'Documents',
      },
    },
    update: {
      settings: {
        view: 'details',
      },
    },
    create: {
      siteId: site.id,
      name: 'Documents',
      settings: {
        view: 'details',
      },
    },
  });

  const contentTypes = ['Document', 'Procedure', 'Contract', 'Invoice'];
  const contentTypeMap = {};

  for (const name of contentTypes) {
    const contentType = await prisma.contentType.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    contentTypeMap[name] = contentType;
  }

  await ensureTaxonomy('Confidentiality', ['Public', 'Internal', 'Restricted']);
  await ensureTaxonomy('Domain', ['HR', 'Finance', 'Quality', 'IT']);

  const confidentialityField = await ensureLibraryField(library.id, {
    name: 'Confidentiality',
    dataType: 'LIST',
    required: true,
    validation: { allowed: ['Public', 'Internal', 'Restricted'] },
  });

  const domainField = await ensureLibraryField(library.id, {
    name: 'Domain',
    dataType: 'LIST',
    required: false,
    validation: { allowed: ['HR', 'Finance', 'Quality', 'IT'] },
  });

  const folders = [
    { name: 'HR', path: '/HR' },
    { name: 'Finance', path: '/Finance' },
    { name: 'Quality', path: '/Quality' },
    { name: 'IT', path: '/IT' },
  ];

  const folderByName = new Map();

  for (const folder of folders) {
    const savedFolder = await prisma.folder.upsert({
      where: {
        libraryId_path: {
          libraryId: library.id,
          path: folder.path,
        },
      },
      update: {
        name: folder.name,
      },
      create: {
        libraryId: library.id,
        name: folder.name,
        path: folder.path,
      },
    });

    folderByName.set(folder.name, savedFolder.id);
  }

  const demoDocs = [
    {
      title: 'Welcome to OpenGED.txt',
      folderName: null,
      status: 'PUBLISHED',
      contentType: 'Document',
      createdBy: adminUser.id,
      confidentiality: 'Internal',
      domain: 'IT',
      objectKey: 'seed/welcome-to-openged.txt',
      mimeType: 'text/plain',
      comment: 'Landing document at library root',
    },
    {
      title: 'Employee Handbook 2026.pdf',
      folderName: 'HR',
      status: 'PUBLISHED',
      contentType: 'Procedure',
      createdBy: adminUser.id,
      confidentiality: 'Internal',
      domain: 'HR',
      objectKey: 'seed/employee-handbook-2026.pdf',
      mimeType: 'application/pdf',
      comment: 'Initial publication',
    },
    {
      title: 'Quarterly Budget Q1.xlsx',
      folderName: 'Finance',
      status: 'PENDING_VALIDATION',
      contentType: 'Invoice',
      createdBy: editorUser.id,
      confidentiality: 'Restricted',
      domain: 'Finance',
      objectKey: 'seed/quarterly-budget-q1.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      comment: 'Waiting approval',
    },
    {
      title: 'ISO Process Checklist.docx',
      folderName: 'Quality',
      status: 'DRAFT',
      contentType: 'Document',
      createdBy: editorUser.id,
      confidentiality: 'Internal',
      domain: 'Quality',
      objectKey: 'seed/iso-process-checklist.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      comment: 'Draft version',
    },
    {
      title: 'IT Security Policy.txt',
      folderName: 'IT',
      status: 'PUBLISHED',
      contentType: 'Procedure',
      createdBy: adminUser.id,
      confidentiality: 'Public',
      domain: 'IT',
      objectKey: 'seed/it-security-policy.txt',
      mimeType: 'text/plain',
      comment: 'Published baseline',
    },
    {
      title: 'Supplier Master Contract.pdf',
      folderName: 'Finance',
      status: 'ARCHIVED',
      contentType: 'Contract',
      createdBy: adminUser.id,
      confidentiality: 'Restricted',
      domain: 'Finance',
      objectKey: 'seed/supplier-master-contract.pdf',
      mimeType: 'application/pdf',
      comment: 'Archived contract',
    },
  ];

  const createdDocs = [];

  for (const doc of demoDocs) {
    const createdDoc = await ensureDocument({
      libraryId: library.id,
      folderId: doc.folderName ? folderByName.get(doc.folderName) : null,
      title: doc.title,
      status: doc.status,
      contentTypeId: contentTypeMap[doc.contentType].id,
      createdBy: doc.createdBy,
      objectKey: doc.objectKey,
      mimeType: doc.mimeType,
      comment: doc.comment,
      confidentiality: doc.confidentiality,
      confidentialityFieldId: confidentialityField.id,
      domain: doc.domain,
      domainFieldId: domainField.id,
    });

    createdDocs.push(createdDoc);
  }

  const pendingDoc = createdDocs.find((doc) => doc.title === 'Quarterly Budget Q1.xlsx');

  if (pendingDoc) {
    const existingWorkflow = await prisma.workflowInstance.findFirst({
      where: {
        documentId: pendingDoc.id,
        endedAt: null,
      },
    });

    if (!existingWorkflow) {
      const workflow = await prisma.workflowInstance.create({
        data: {
          documentId: pendingDoc.id,
          state: 'Submitted',
          startedBy: editorUser.id,
        },
      });

      await prisma.workflowTask.create({
        data: {
          workflowId: workflow.id,
          assignedUserId: validatorUser.id,
          status: 'OPEN',
          comment: 'Please validate quarterly budget numbers',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  const existingSeedAudit = await prisma.auditLog.findFirst({
    where: {
      eventType: 'seed.completed',
      objectType: 'system',
      objectId: 'seed',
    },
  });

  if (!existingSeedAudit) {
    await prisma.auditLog.create({
      data: {
        actorId: adminUser.id,
        eventType: 'seed.completed',
        objectType: 'system',
        objectId: 'seed',
        details: {
          workflowTemplate: workflowTemplate.name,
          demoUsers: [adminUser.email, editorUser.email, validatorUser.email, readerUser.email],
        },
      },
    });
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
