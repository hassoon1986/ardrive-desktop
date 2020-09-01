/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
// upload.js
import fs from 'fs';
import { sleep, asyncForEach, gatewayURL } from './common';
import { getTransactionMetaData, getAllMyDataFileTxs } from './arweave';
import { checksumFile, decryptFile, decryptFileMetaData } from './crypto';
import { promptForFileOverwrite } from '../../cli/src/prompts';
import {
  getAll_fromCompleted,
  updateCompletedStatus,
  setIncompleteFileToIgnore,
  addFileToSyncTable,
  getByMetaDataTxFromSyncTable,
  getByFilePathAndHashFromSyncTable,
  updateFileInSyncTable,
} from './db';

async function binArrayToJSON(binArray: any) {
  let str = '';
  for (let i = 0; i < binArray.length; i += 1) {
    str += String.fromCharCode(parseInt(binArray[i], 10));
  }
  return JSON.parse(str);
}

// Downloads a single file from ArDrive by transaction
async function downloadArDriveFile_byTx(
  user: { sync_folder_path: string; password: string; jwk: string },
  txid: string,
  file_name: any,
  isPublic: string,
  ardrive_path: any
) {
  try {
    const full_path = user.sync_folder_path.concat(ardrive_path, file_name);
    const folderPath = user.sync_folder_path.concat(ardrive_path);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      await sleep(1000);
    }
    const data = await getTransactionMetaData(txid);

    // console.log("FOUND PERMAFILE! %s is on the Permaweb, but not local.  Downloading...", full_path, data)
    if (isPublic === '1') {
      fs.writeFileSync(full_path, data);
      console.log('DOWNLOADED %s', full_path);
    } else {
      // Method with decryption
      fs.writeFileSync(full_path.concat('.enc'), data);
      // const stats = fs.statSync(full_path.concat('.enc'));
      await sleep(500);
      await decryptFile(full_path.concat('.enc'), user.password, user.jwk);
      await sleep(500);
      console.log('DOWNLOADED AND DECRYPTED %s', full_path);
    }
    return 'Success';
  } catch (err) {
    console.log(err);
    // console.log ("FOUND PERMAFILE %s but not ready to be downloaded yet", full_path)
    return 'Error downloading file';
  }
}

// Takes an ArDrive File Data Transaction and writes to the database.
async function getFileMetaDataFromTx(
  fileDataTx: any,
  user: {
    sync_folder_path: string;
    wallet_public_key: string;
    arDriveId: string;
    password: string;
    jwk: string;
  }
) {
  try {
    const newFileToDownload = {
      appName: '',
      appVersion: '',
      unixTime: '',
      contentType: '',
      entityType: '',
      arDriveId: '',
      parentFolderId: '',
      fileId: '',
      fileSize: '',
      filePath: '',
      fileName: '',
      arDrivePath: '',
      fileHash: '',
      fileModifiedDate: '',
      fileVersion: 0,
      isPublic: '',
      isLocal: 0,
      fileDataSyncStatus: 0,
      fileMetaDataSyncStatus: 0,
      permaWebLink: '',
      metaDataTxId: '',
      dataTxId: '',
    };

    const { node } = fileDataTx;
    const metaDataTxId = node.id;
    const isCompleted = await getByMetaDataTxFromSyncTable(metaDataTxId);
    if (isCompleted) {
      return 0;
    }
    const { tags } = node;
    const data = await getTransactionMetaData(metaDataTxId);
    let dataJSON = await binArrayToJSON(data);
    tags.forEach((tag: any) => {
      const key = tag.name;
      const { value } = tag;
      switch (key) {
        case 'App-Name':
          newFileToDownload.appName = value;
          break;
        case 'App-Version':
          newFileToDownload.appVersion = value;
          break;
        case 'Unix-Time':
          newFileToDownload.unixTime = value;
          break;
        case 'Content-Type':
          newFileToDownload.contentType = value;
          break;
        case 'Entity-Type':
          newFileToDownload.entityType = value;
          break;
        case 'Drive-Id':
          newFileToDownload.arDriveId = value;
          break;
        case 'File-Id':
          newFileToDownload.fileId = value;
          break;
        case 'Parent-Folder-Id':
          newFileToDownload.parentFolderId = value;
          break;
        default:
          break;
      }
    });

    if (Object.prototype.hasOwnProperty.call(dataJSON, 'iv')) {
      newFileToDownload.isPublic = '0';
      dataJSON = await decryptFileMetaData(
        dataJSON.iv,
        dataJSON.encryptedText,
        user.password,
        user.jwk
      );
    } else {
      newFileToDownload.isPublic = '1';
    }

    let filePath: string;
    let permaWebLink: string;
    if (newFileToDownload.entityType === 'file') {
      filePath = user.sync_folder_path.concat(dataJSON.path, dataJSON.name);
      permaWebLink = gatewayURL.concat(dataJSON.dataTxId);
    } else {
      filePath = user.sync_folder_path.concat(dataJSON.path);
      permaWebLink = gatewayURL.concat(metaDataTxId);
    }
    newFileToDownload.fileSize = dataJSON.size;
    newFileToDownload.filePath = filePath;
    newFileToDownload.fileName = dataJSON.name;
    newFileToDownload.arDrivePath = dataJSON.path;
    newFileToDownload.fileHash = dataJSON.hash;
    newFileToDownload.fileModifiedDate = dataJSON.modifiedDate;
    newFileToDownload.fileVersion = dataJSON.fileVersion;
    newFileToDownload.fileDataSyncStatus = 3;
    newFileToDownload.fileMetaDataSyncStatus = 3;
    newFileToDownload.permaWebLink = permaWebLink;
    newFileToDownload.metaDataTxId = metaDataTxId;
    newFileToDownload.dataTxId = dataJSON.dataTxId;

    const exactFileMatch = {
      filePath,
      fileHash: dataJSON.hash,
    };
    // Check if the exact file already exists in the same location
    const exactMatch = await getByFilePathAndHashFromSyncTable(exactFileMatch);
    if (exactMatch) {
      const fileToUpdate = {
        arDriveId: newFileToDownload.arDriveId,
        parentFolderId: newFileToDownload.parentFolderId,
        fileId: newFileToDownload.fileId,
        fileVersion: newFileToDownload.fileVersion,
        metaDataTxId: newFileToDownload.metaDataTxId,
        dataTxId: newFileToDownload.dataTxId,
        fileDataSyncStatus: '3',
        fileMetaDataSyncStatus: '3',
        permaWebLink,
        id: exactMatch.id,
      };
      await updateFileInSyncTable(fileToUpdate);
      console.log('%s is already local', filePath);
    } else {
      console.log('%s is unsynchronized', filePath);
      addFileToSyncTable(newFileToDownload);
    }
    return 'Success';
  } catch (err) {
    console.log(err);
    // console.log ("FOUND PERMAFILE %s but not ready to be downloaded yet", full_path)
    return 'Error downloading file';
  }
}

// Gets all of the files from your ArDrive (via ARQL) and loads them into the database.
export const getMyArDriveFiles = async (user: {
  sync_folder_path: string;
  wallet_public_key: string;
  arDriveId: string;
  password: string;
  jwk: string;
}) => {
  // console.log ("FOUND PERMAFILE %s but not ready to be downloaded yet", full_path)
  console.log('---Getting all your ArDrive files---');
  const txids = await getAllMyDataFileTxs(
    user.wallet_public_key,
    user.arDriveId
  );
  await asyncForEach(txids, async (txid: string) => {
    const fileToQueueForDowload = await getFileMetaDataFromTx(txid, user);
  });
};

// Downloads all ardrive files that are not local
export const downloadMyArDriveFiles = async (user: {
  sync_folder_path: string;
  password: string;
  jwk: string;
}) => {
  try {
    console.log('---Downloading any unsynced files---');
    const incompleteFiles = await getAll_fromCompleted();

    await asyncForEach(
      incompleteFiles,
      async (incompleteFile: {
        ardrive_path: any;
        file_name: string;
        tx_id: string;
        isPublic: string;
        file_hash: string;
      }) => {
        const full_path = user.sync_folder_path.concat(
          incompleteFile.ardrive_path,
          incompleteFile.file_name
        );
        if (!fs.existsSync(full_path)) {
          // TODO track these individual awaits - don't catch whole thing!
          await downloadArDriveFile_byTx(
            user,
            incompleteFile.tx_id,
            incompleteFile.file_name,
            incompleteFile.isPublic,
            incompleteFile.ardrive_path
          );
          if (incompleteFile.isPublic === '0') {
            fs.unlinkSync(full_path.concat('.enc'));
          }
        } else {
          // console.log("%s is on the Permaweb, but is already downloaded with matching file name", full_path)
          const localFileHash = await checksumFile(full_path);
          if (incompleteFile.file_hash === localFileHash) {
            // console.log("IGNORED! %s is on the Permaweb, but is already downloaded (matching file name and hash)", full_path)
            await updateCompletedStatus(incompleteFile.tx_id);
          } else {
            // There is a conflict.  Prompt the user to resolve
            const conflictResolution = await promptForFileOverwrite(full_path);
            switch (conflictResolution) {
              case 'R': {
                // Rename by adding - copy at the end.
                let newFileName:
                  | string[]
                  | string = incompleteFile.file_name.split('.');
                newFileName = newFileName[0].concat(' - Copy.', newFileName[1]);
                const new_full_path = user.sync_folder_path.concat(
                  incompleteFile.ardrive_path,
                  newFileName
                );
                console.log(
                  '   ...renaming existing file to : %s',
                  new_full_path
                );
                fs.renameSync(full_path, new_full_path);

                await downloadArDriveFile_byTx(
                  user,
                  incompleteFile.tx_id,
                  incompleteFile.file_name,
                  incompleteFile.isPublic,
                  incompleteFile.ardrive_path
                );
                fs.unlinkSync(full_path.concat('.enc'));
                break;
              }
              case 'O': // Overwrite existing file
                console.log('   ...file being overwritten');
                await downloadArDriveFile_byTx(
                  user,
                  incompleteFile.tx_id,
                  incompleteFile.file_name,
                  incompleteFile.isPublic,
                  incompleteFile.ardrive_path
                );
                fs.unlinkSync(full_path.concat('.enc'));
                break;
              case 'I':
                console.log('   ...excluding file from future downloads');
                setIncompleteFileToIgnore(incompleteFile.tx_id);
                break;
              default:
                // Skipping this time
                break;
            }
          }
        }
      }
    );
    return 'Downloaded all ArDrive files';
  } catch (err) {
    console.log(err);
    return 'Error downloading all ArDrive files';
  }
};
