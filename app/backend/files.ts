// files.js
import { sep, extname, basename, dirname } from 'path';
import fs from 'fs';
import { extToMime, appName, appVersion } from './common';
import { checksumFile } from './crypto';
import {
  addFileToSyncTable,
  getFolderFromSyncTable,
  getByFilePathAndHashFromSyncTable,
  getByFilePathFromSyncTable,
  getByFileHashAndModifiedDateAndArDrivePathFromSyncTable,
  getByFileHashAndModifiedDateAndFileNameFromSyncTable,
} from './db';

const chokidar = require('chokidar');
const uuidv4 = require('uuid/v4');

const queueFile = async (
  filePath: string,
  syncFolderPath: string,
  arDriveId: string
) => {
  let stats = null;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    console.log('File not ready yet %s', filePath);
    return;
  }

  let extension = extname(filePath);
  const fileName = basename(filePath);
  extension = extension.toLowerCase();

  // Skip if file is encrypted or size is 0
  if (extension !== '.enc' && stats.size !== 0 && !fileName.startsWith('~$')) {
    const fileHash = await checksumFile(filePath);
    const exactFileMatch = {
      filePath,
      fileHash,
    };

    // Check if the exact file already exists in the same location
    const exactMatch = await getByFilePathAndHashFromSyncTable(exactFileMatch);

    if (exactMatch) {
      // This file's version already exists.  Do nothing
      return;
    }

    // Check if the file has been renamed by looking at its path, modifiedDate and hash
    const parentFolderPath = dirname(filePath);
    let arDrivePath = filePath.replace(syncFolderPath, '');
    arDrivePath = arDrivePath.replace(fileName, '');
    const fileModifiedDate = stats.mtimeMs;
    const fileRename = {
      fileHash,
      fileModifiedDate,
      arDrivePath,
    };
    const renamedFile = await getByFileHashAndModifiedDateAndArDrivePathFromSyncTable(
      fileRename
    );

    if (renamedFile) {
      // The file has been renamed.  Submit as Metadata.
      console.log('%s was just renamed', filePath);
      renamedFile.unixTime = Math.round(new Date().getTime() / 1000);
      renamedFile.dataTx = 'LINK';
      renamedFile.metaDataTx = '1';
      renamedFile.fileName = fileName;
      renamedFile.filePath = filePath;
      renamedFile.syncStatus = '1'; // Sync status of 1 = metadatatx only
      addFileToSyncTable(renamedFile);
      return;
    }

    // Check if this is a new version of an existing file path
    const newFileVersion = await getByFilePathFromSyncTable(filePath);
    if (newFileVersion) {
      // Add new version of existing file
      newFileVersion.unixTime = Math.round(new Date().getTime() / 1000);
      newFileVersion.fileVersion += 1;
      newFileVersion.metaDataTx = '1';
      newFileVersion.dataTx = '1';
      newFileVersion.fileModifiedDate = fileModifiedDate;
      newFileVersion.fileHash = fileHash;
      newFileVersion.fileSize = stats.size;
      newFileVersion.syncStatus = '2'; // Sync status of 2 = data+metadata tx needed
      console.log(
        '%s updating file version to %s',
        filePath,
        newFileVersion.fileVersion
      );
      addFileToSyncTable(newFileVersion);
      return;
    }

    // Check if the file has been moved, or if there is another identical copy somewhere in your ArDrive.
    const parentFolderId = await getFolderFromSyncTable(parentFolderPath);
    const fileMove = {
      fileHash,
      fileModifiedDate,
      fileName,
    };

    const movedFile = await getByFileHashAndModifiedDateAndFileNameFromSyncTable(
      fileMove
    );
    if (movedFile) {
      movedFile.unixTime = Math.round(new Date().getTime() / 1000);
      movedFile.dataTx = 'LINK';
      movedFile.metaDataTx = '1';
      movedFile.fileName = fileName;
      movedFile.filePath = filePath;
      movedFile.arDrivePath = arDrivePath;
      movedFile.parentFolderId = parentFolderId.fileId;
      movedFile.syncStatus = '1'; // Sync status of 1 = metadatatx only
      addFileToSyncTable(movedFile);
      console.log('%s has been moved', filePath);
      return;
    }

    // No match, so queue a new file
    console.log('%s queueing new file', filePath);
    let isPublic = '0';
    if (filePath.indexOf(syncFolderPath.concat('\\Public\\')) !== -1) {
      // Public by choice, do not encrypt
      isPublic = '1';
    }
    const unixTime = Math.round(new Date().getTime() / 1000);
    const contentType = extToMime(filePath);
    const fileId = uuidv4();
    const fileSize = stats.size;
    const newFileToQueue = {
      appName,
      appVersion,
      unixTime,
      contentType,
      entityType: 'file',
      arDriveId,
      parentFolderId: parentFolderId.fileId,
      fileId,
      filePath,
      arDrivePath,
      fileName,
      fileHash,
      fileSize,
      fileModifiedDate,
      fileVersion: 0,
      isPublic,
      isLocal: '1',
      metaDataTxId: '1',
      dataTxId: '1',
      syncStatus: '2', // Sync status of 2 = data+metadata tx needed
    };
    addFileToSyncTable(newFileToQueue);
  }
};

const queueFolder = async (
  folderPath: string,
  syncFolderPath: string,
  arDriveId: string
) => {
  let isPublic = '0';
  let parentFolderId = null;
  let stats = null;

  const isQueuedOrCompleted = await getFolderFromSyncTable(folderPath);

  if (isQueuedOrCompleted) {
    // The folder is already in the queue and ready to be processed.
  } else {
    console.log('%s queueing folder', folderPath);
    try {
      stats = fs.statSync(folderPath);
    } catch (err) {
      console.log('Folder not ready yet %s', folderPath);
      return;
    }

    if (folderPath.indexOf(syncFolderPath.concat('\\Public\\')) !== -1) {
      // Public by choice, do not encrypt
      isPublic = '1';
    }

    const unixTime = Math.round(new Date().getTime() / 1000);
    const contentType = 'application/json';
    const fileId = uuidv4();
    const fileName = folderPath.split(sep).pop();
    const fileModifiedDate = stats.mtimeMs;
    const arDrivePath = folderPath.replace(syncFolderPath, '');

    if (folderPath === syncFolderPath) {
      parentFolderId = uuidv4(); // This will act as the root parent Folder ID
    } else {
      const parentFolderPath = dirname(folderPath);
      parentFolderId = await getFolderFromSyncTable(parentFolderPath);
      parentFolderId = parentFolderId.fileId;
    }

    const folderToQueue = {
      appName,
      appVersion,
      unixTime,
      contentType,
      entityType: 'folder',
      arDriveId,
      parentFolderId,
      fileId,
      filePath: folderPath,
      arDrivePath,
      fileName,
      fileHash: '0',
      fileSize: '0',
      fileModifiedDate,
      fileVersion: '0',
      isPublic,
      isLocal: '1',
      metaDataTxId: '1',
      dataTxId: '0',
      syncStatus: '1', // Sync status of 1 = metadatatx only
    };
    addFileToSyncTable(folderToQueue);
  }
};

const watchFolder = (syncFolderPath: string, arDriveId: string) => {
  const log = console.log.bind(console);
  const watcher = chokidar.watch(syncFolderPath, {
    persistent: true,
    ignoreInitial: false,
    usePolling: true,
    interval: 7500,
    ignored: '*.enc',
    awaitWriteFinish: {
      stabilityThreshold: 5000,
      pollInterval: 5000,
    },
  });
  watcher
    .on('add', async (path: any) => queueFile(path, syncFolderPath, arDriveId))
    .on('change', (path: any) => queueFile(path, syncFolderPath, arDriveId))
    .on('unlink', (path: any) => log(`File ${path} has been removed`))
    .on('addDir', async (path: any) =>
      queueFolder(path, syncFolderPath, arDriveId)
    )
    .on('unlinkDir', (path: any) => log(`Directory ${path} has been removed`))
    .on('error', (error: any) => log(`Watcher error: ${error}`))
    .on('ready', () => log('Initial scan complete. Ready for changes'));
  return 'Watched';
};

export { watchFolder };
