/* eslint-disable @typescript-eslint/naming-convention */
import sqlite3, { Database } from 'sqlite3';

// Use verbose mode in development
let sql3 = sqlite3;
if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  sql3 = sqlite3.verbose();
}

let db: Database | null;

const run = (sql: any, params: any[] = []) => {
  return new Promise((resolve, reject) => {
    if (db === null) {
      return reject(
        new Error(
          'DB not created yet - run setupDatabase() before using these methods.'
        )
      );
    }
    return db.run(sql, params, (err: string) => {
      if (err) {
        console.log(`Error running sql ${sql}`);
        console.log(err);
        reject(err);
      }
      resolve();
    });
  });
};

const get = (sql: any, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (db === null) {
      return reject(
        new Error(
          'DB not created yet - run setupDatabase() before using these methods.'
        )
      );
    }
    return db.get(sql, params, (err: any, result: any) => {
      if (err) {
        console.log(`Error running sql: ${sql}`);
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

const all = (sql: any, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    if (db === null) {
      return reject(
        new Error(
          'DB not created yet - run setupDatabase() before using these methods.'
        )
      );
    }
    return db.all(sql, params, (err: any, rows: any[]) => {
      if (err) {
        console.error(`Error running sql: ${sql}`);
        console.error(err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const createProfileTable = async () => {
  const sql = `CREATE TABLE IF NOT EXISTS Profile (
        id integer NOT NULL PRIMARY KEY,
        owner text NOT NULL UNIQUE,
        arDriveId NOT NULL UNIQUE,
        email text,
        data_protection_key text,
        wallet_private_key text,
        wallet_public_key text,
        sync_schedule text,
        sync_folder_path text
     );`;
  return run(sql);
};

const createSyncTable = () => {
  const sql = `CREATE TABLE IF NOT EXISTS Sync (
        id integer NOT NULL PRIMARY KEY,
        metaDataTxId text,
        dataTxId text,
        appName text DEFAULT ArDrive,
        appVersion text,
        unixTime integer,
        contentType text,
        entityType text,
        arDriveId text,
        parentFolderId text,
        fileId text,
        filePath text,
        arDrivePath text,
        fileName text,
        fileHash text,
        fileSize text,
        fileModifiedDate text,
        fileVersion integer DEFAULT 0,
        permawebLink text,
        fileDataSyncStatus text,
        fileMetaDataSyncStatus text,
        ignore INTEGER DEFAULT 0,
        isPublic text DEFAULT 0,
        isLocal text,
        isApproved text
     );`;
  return run(sql);
};

const createQueueTable = () => {
  const sql = `CREATE TABLE IF NOT EXISTS Queue (
          id integer NOT NULL PRIMARY KEY,
          tx_id text,
          owner text,
          file_path text NOT NULL UNIQUE,
          file_name text,
          file_hash text,
          file_size text,
          sync_status INTEGER DEFAULT 0,
          ignore INTEGER DEFAULT 0,
          isPublic text DEFAULT 0,
          file_modified_date text,
          ardrive_path text,
          ardrive_version text,
          keywords text,
          permaweb_link text,
          prev_tx_id text,
          block_hash text,
          file_version INTEGER DEFAULT 0
       );`;
  return run(sql);
};

const createCompletedTable = () => {
  const sql = `CREATE TABLE IF NOT EXISTS Completed (
          id integer NOT NULL PRIMARY KEY,
          tx_id text NOT NULL UNIQUE,
          isLocal text,
          file_name text,
          file_hash text,
          owner text,
          permaweb_link text,
          isPublic text DEFAULT 0,
          file_modified_date text,
          ardrive_path text,
          ardrive_version text,
          ignore INTEGER DEFAULT 0,
          keywords text,
          prev_tx_id text,
          block_hash text
       );`;
  return run(sql);
};

export const addFileToSyncTable = (file: {
  appName: any;
  appVersion: any;
  unixTime: any;
  contentType: any;
  entityType: any;
  arDriveId: any;
  parentFolderId: any;
  fileId: any;
  filePath: any;
  arDrivePath: any;
  fileName: any;
  fileHash: any;
  fileSize: any;
  fileModifiedDate: any;
  fileVersion: any;
  isPublic: any;
  isLocal: any;
  metaDataTxId: any;
  dataTxId: any;
  fileDataSyncStatus: any;
  fileMetaDataSyncStatus: any;
}) => {
  const {
    appName,
    appVersion,
    unixTime,
    contentType,
    entityType,
    arDriveId,
    parentFolderId,
    fileId,
    filePath,
    arDrivePath,
    fileName,
    fileHash,
    fileSize,
    fileModifiedDate,
    fileVersion,
    isPublic,
    isLocal,
    metaDataTxId,
    dataTxId,
    fileDataSyncStatus,
    fileMetaDataSyncStatus,
  } = file;
  return run(
    'REPLACE INTO Sync (appName, appVersion, unixTime, contentType, entityType, arDriveId, parentFolderId, fileId, filePath, arDrivePath, fileName, fileHash, fileSize, fileModifiedDate, fileVersion, isPublic, isLocal, metaDataTxId, dataTxId, fileDataSyncStatus, fileMetaDataSyncStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      appName,
      appVersion,
      unixTime,
      contentType,
      entityType,
      arDriveId,
      parentFolderId,
      fileId,
      filePath,
      arDrivePath,
      fileName,
      fileHash,
      fileSize,
      fileModifiedDate,
      fileVersion,
      isPublic,
      isLocal,
      metaDataTxId,
      dataTxId,
      fileDataSyncStatus,
      fileMetaDataSyncStatus,
    ]
  );
};

export const getFolderFromSyncTable = (folderPath: string) => {
  return get(
    `SELECT fileId FROM Sync WHERE filePath = ? AND entityType = 'folder'`,
    [folderPath]
  );
};

export const getByFilePathAndHashFromSyncTable = (file: {
  fileHash: string;
  filePath: string;
}) => {
  const { fileHash, filePath } = file;
  return get(`SELECT * FROM Sync WHERE fileHash = ? AND filePath = ?`, [
    fileHash,
    filePath,
  ]);
};

export const getByFileHashAndModifiedDateAndArDrivePathFromSyncTable = (file: {
  fileHash: string;
  fileModifiedDate: number;
  arDrivePath: string;
}) => {
  const { fileHash, fileModifiedDate, arDrivePath } = file;
  return get(
    `SELECT * FROM Sync WHERE fileHash = ? AND fileModifiedDate = ? AND arDrivePath = ?`,
    [fileHash, fileModifiedDate, arDrivePath]
  );
};

export const getByFileHashAndModifiedDateAndFileNameFromSyncTable = (file: {
  fileHash: string;
  fileModifiedDate: number;
  fileName: string;
}) => {
  const { fileHash, fileModifiedDate, fileName } = file;
  return get(
    `SELECT * FROM Sync WHERE fileHash = ? AND fileModifiedDate = ? AND fileName = ?`,
    [fileHash, fileModifiedDate, fileName]
  );
};

export const getByFilePathFromSyncTable = (filePath: string) => {
  return get(
    `SELECT * FROM Sync WHERE filePath = ? ORDER BY fileVersion DESC`,
    [filePath]
  );
};

export const getFilesToUploadFromSyncTable = () => {
  return all(
    'SELECT * FROM Sync WHERE fileDataSyncStatus = 1 OR fileMetaDataSyncStatus = 1 '
  );
};

export const getAllUploadedFilesFromSyncTable = () => {
  return all(
    'SELECT * FROM Sync WHERE fileDataSyncStatus = 2 OR fileMetaDataSyncStatus = 2 '
  );
};

export const updateFileMetaDataSyncStatus = (file: {
  fileMetaDataSyncStatus: any;
  metaDataTxId: any;
  id: any;
}) => {
  const { fileMetaDataSyncStatus, metaDataTxId, id } = file;
  return get(
    `UPDATE Sync SET fileMetaDataSyncStatus = ?, metaDataTxId = ? WHERE id = ?`,
    [fileMetaDataSyncStatus, metaDataTxId, id]
  );
};

export const updateFileDataSyncStatus = (file: {
  fileDataSyncStatus: any;
  dataTxId: any;
  id: any;
}) => {
  const { fileDataSyncStatus, dataTxId, id } = file;
  return get(
    `UPDATE Sync SET fileDataSyncStatus = ?, dataTxId = ? WHERE id = ?`,
    [fileDataSyncStatus, dataTxId, id]
  );
};

export const completeFileDataFromSyncTable = (file: {
  fileDataSyncStatus: any;
  permawebLink: any;
  id: any;
}) => {
  const { fileDataSyncStatus, permawebLink, id } = file;
  return get(
    `UPDATE Sync SET fileDataSyncStatus = ?, permawebLink = ? WHERE id = ?`,
    [fileDataSyncStatus, permawebLink, id]
  );
};

export const completeFileMetaDataFromSyncTable = (file: {
  fileMetaDataSyncStatus: any;
  id: any;
}) => {
  const { fileMetaDataSyncStatus, id } = file;
  return get(`UPDATE Sync SET fileMetaDataSyncStatus = ? WHERE id = ?`, [
    fileMetaDataSyncStatus,
    id,
  ]);
};

export const removeFromSyncTable = (id: string) => {
  return get(`DELETE FROM Sync WHERE id = ?`, [id]);
};

export const createArDriveProfile = (profile: {
  owner: any;
  arDriveId: any;
  email: any | null;
  data_protection_key: any;
  wallet_private_key: any;
  wallet_public_key: any;
  sync_schedule: any;
  sync_folder_path: any;
}) => {
  const {
    owner,
    arDriveId,
    email,
    data_protection_key,
    wallet_private_key,
    wallet_public_key,
    sync_schedule,
    sync_folder_path,
  } = profile;
  return run(
    'REPLACE INTO Profile (owner, arDriveId, email, data_protection_key, wallet_private_key, wallet_public_key, sync_schedule, sync_folder_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      owner,
      arDriveId,
      email,
      data_protection_key,
      wallet_private_key,
      wallet_public_key,
      sync_schedule,
      sync_folder_path,
    ]
  );
};

export const getByFileNameAndHash_fromCompleted = (file: {
  file_hash: string;
  file_name: string;
}) => {
  const { file_hash, file_name } = file;
  return get(`SELECT * FROM Completed WHERE file_hash = ? AND file_name = ?`, [
    file_hash,
    file_name,
  ]);
};

export const getByFileName_fromCompleted = (file_name: string) => {
  return get(`SELECT * FROM Completed WHERE file_name= ?`, [file_name]);
};

export const getByTx_fromCompleted = (tx_id: string) => {
  return get(`SELECT file_name FROM Completed WHERE tx_id = ?`, [tx_id]);
};

export const getAllIncomplete_fromCompleted = () => {
  return all('SELECT * FROM COMPLETED WHERE isLocal = 0 AND ignore = 0');
};

export const getAll_fromProfileWithWalletPublicKey = (
  wallet_public_key: string
) => {
  return get(`SELECT * FROM Profile WHERE wallet_public_key = ?`, [
    wallet_public_key,
  ]);
};

export const remove_fromQueue = (file_path: string) => {
  return get(`DELETE FROM Queue WHERE file_path = ?`, [file_path]);
};

export const updateQueueStatus = (file: {
  tx_id: any;
  isPublic: any;
  file_path: any;
}) => {
  const { tx_id, isPublic, file_path } = file;
  return run(`UPDATE Queue SET tx_id = ?, isPublic = ? WHERE file_path = ?`, [
    tx_id,
    isPublic,
    file_path,
  ]);
};

export const setIncompleteFileToIgnore = (tx_id: string) => {
  return get(`UPDATE Completed SET ignore = 1 WHERE tx_id = ?`, [tx_id]);
};

export const updateCompletedStatus = (tx_id: string) => {
  return get(`UPDATE Completed SET isLocal = 1 WHERE tx_id = ?`, [tx_id]);
};

export const setCompletedFileToDownload = (file_name: string) => {
  return get(`UPDATE Completed SET isLocal = 0 WHERE file_name = ?`, [
    file_name,
  ]);
};

export const setQueuedFileToPublic = (file_path: string) => {
  return get(`UPDATE Queue SET isPublic = 1 WHERE file_path = ?`, [file_path]);
};

export const getByFilePath_fromQueue = (file_path: string) => {
  return get(`SELECT * FROM Queue WHERE file_path = ?`, [file_path]);
};

export const getAllUploaded_fromQueue = () => {
  return all('SELECT * FROM Queue WHERE tx_id != 0');
};

export const getAll_fromProfile = (): Promise<any[]> => {
  return all('SELECT * FROM Profile');
};

export const getAll_fromCompleted = () => {
  return all('SELECT * FROM COMPLETED WHERE ignore = 0');
};

export const getFilesToUpload_fromQueue = () => {
  return all('SELECT * FROM Queue WHERE tx_id = 0 ');
};

const createOrOpenDb = (dbFilePath: string): Promise<Database> => {
  return new Promise((resolve, reject) => {
    const database: Database = new sql3.Database(dbFilePath, (err) => {
      if (err) {
        console.error('Could not connect to database: '.concat(err.message));
        return reject(err);
      }
      return resolve(database);
    });
  });
};

const createTablesInDB = async () => {
  await createProfileTable();
  await createQueueTable();
  await createCompletedTable();
  await createSyncTable();
};

// Main entrypoint for database. MUST call this before anything else can happen
export const setupDatabase = async (
  dbFilePath: string
): Promise<Error | null> => {
  try {
    db = await createOrOpenDb(dbFilePath);
    await createTablesInDB();
  } catch (err) {
    return err;
  }
  return null;
};
