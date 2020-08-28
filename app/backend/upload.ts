// upload.js
import fs from 'fs';
import {
  createArDriveMetaDataTransaction,
  // sendArDriveFee,
  getTransactionStatus,
} from './arweave';
import { asyncForEach, getWinston, formatBytes, gatewayURL } from './common';
// import { encryptFile, checksumFile, encryptTag } from './crypto';
import {
  getByFileName_fromCompleted,
  getFilesToUploadFromSyncTable,
  remove_fromQueue,
  getAllUploaded_fromQueue,
  completeFile,
} from './db';

// Tags and Uploads a single file to your ArDrive

async function uploadArDriveFileMetaData(
  user: { sync_folder_path: string; password: any; jwk: string; owner: string },
  fileToUpload: {
    id: any;
    appName: string;
    appVersion: string;
    unixTime: string;
    contentType: string;
    entityType: string;
    arDriveId: string;
    parentFolderId: string;
    fileId: string;
    fileSize: string;
    filePath: any;
    fileName: string;
    arDrivePath: any;
    fileHash: any;
    fileModifiedDate: any;
    fileVersion: any;
    isPublic: any;
    syncStatus: any;
    dataTxId: any;
  }
) {
  try {
    // create primary metadata, used to tag this transaction
    const primaryFileMetaDataTags = {
      appName: fileToUpload.appName,
      appVersion: fileToUpload.appVersion,
      unixTime: fileToUpload.unixTime,
      contentType: fileToUpload.contentType,
      entityType: fileToUpload.entityType,
      arDriveId: fileToUpload.arDriveId,
      parentFolderId: fileToUpload.parentFolderId,
      fileId: fileToUpload.fileId,
    };
    // create secondary metadata, used to further ID the file (with encryption if necessary)
    const secondaryFileMetaDataTags = {
      name: fileToUpload.fileName,
      size: fileToUpload.fileSize,
      hash: fileToUpload.fileHash,
      path: fileToUpload.arDrivePath,
      modifiedDate: fileToUpload.fileModifiedDate,
      dataTxId: fileToUpload.dataTxId,
      fileVersion: fileToUpload.fileVersion,
    };
    // Convert to JSON string
    const secondaryFileMetaDataJSON = JSON.stringify(secondaryFileMetaDataTags);

    if (fileToUpload.isPublic === '1') {
      // Public file, do not encrypt
      await createArDriveMetaDataTransaction(
        user,
        primaryFileMetaDataTags,
        secondaryFileMetaDataJSON,
        fileToUpload.filePath,
        fileToUpload.id
      );
    } else {
      // Private file, so it must be encrypted
      const encryptedSecondaryFileMetaDataJSON = await encryptTag(
        secondaryFileMetaDataJSON,
        user.password,
        user.jwk
      );
      await createArDriveMetaDataTransaction(
        user,
        primaryFileMetaDataTags,
        JSON.stringify(encryptedSecondaryFileMetaDataJSON),
        fileToUpload.filePath,
        fileToUpload.id
      );
    }
    return 'Success';
  } catch (err) {
    console.log(err);
    return 'Error uploading file metadata';
  }
}

// Gets the price of latest upload batch
export const getPriceOfNextUploadBatch = async () => {
  let totalWinstonData = 0;
  let totalArweaveMetadataPrice = 0;
  let totalNumberOfFileUploads = 0;
  let totalNumberOfMetaDataFileUploads = 0;
  let totalSize = 0;
  let winston = 0;
  // Get all files with sync status of 1 or 2
  const filesToUpload = await getFilesToUploadFromSyncTable();
  if (Object.keys(filesToUpload).length > 0) {
    await asyncForEach(
      filesToUpload,
      async (fileToUpload: {
        filePath: string;
        syncStatus: string;
        fileSize: string | number;
      }) => {
        console.log('Getting size for %s', fileToUpload.filePath);
        if (fileToUpload.syncStatus === '1') {
          totalArweaveMetadataPrice += 0.0000005;
          totalNumberOfMetaDataFileUploads += 1;
        } else {
          totalSize += +fileToUpload.fileSize;
          winston = await getWinston(fileToUpload.fileSize);
          totalWinstonData += +winston + 0.0000005;
          totalNumberOfFileUploads += 1;
        }
      }
    );
    const totalArweaveDataPrice = totalWinstonData * 0.000000000001;
    let arDriveFee = +totalArweaveDataPrice.toFixed(9) * 0.15;
    if (arDriveFee < 0.00001) {
      arDriveFee = 0.00001;
    }
    const totalArDrivePrice =
      +totalArweaveDataPrice.toFixed(9) +
      arDriveFee +
      totalArweaveMetadataPrice;

    console.log(totalArweaveDataPrice.toFixed(9));
    console.log(totalArweaveMetadataPrice.toFixed(9));
    console.log(totalArDrivePrice);
    console.log(arDriveFee);

    return {
      totalArDrivePrice,
      totalSize: formatBytes(totalSize),
      totalNumberOfFileUploads,
      totalNumberOfMetaDataFileUploads,
    };
  }
  return 0;
};

// Uploads all queued files
export const uploadArDriveFiles = async (user: any, readyToUpload: any) => {
  try {
    let filesUploaded = 0;
    console.log('---Uploading All Queued Files---');
    const filesToUpload = await getFilesToUploadFromSyncTable();
    if (Object.keys(filesToUpload).length > 0 && readyToUpload === 'Y') {
      // Ready to upload
      await asyncForEach(
        filesToUpload,
        async (fileToUpload: {
          id: any;
          appName: string;
          appVersion: string;
          unixTime: string;
          contentType: string;
          entityType: string;
          arDriveId: string;
          parentFolderId: string;
          fileId: string;
          fileSize: string;
          filePath: any;
          fileName: string;
          arDrivePath: any;
          fileHash: any;
          fileModifiedDate: any;
          fileVersion: any;
          isPublic: any;
          syncStatus: any;
          dataTxId: any;
        }) => {
          if (fileToUpload.syncStatus === '1') {
            // metadata transaction only
            await uploadArDriveFileMetaData(user, fileToUpload);
            console.log('Metadata uploaded!');
          } else if (fileToUpload.syncStatus === '2') {
            await uploadArDriveFileMetaData(user, fileToUpload);
            console.log('Metadata and file uploaded');
          }
          filesUploaded += 1;
        }
      );
    }
    if (filesUploaded > 0) {
      console.log('Uploaded %s files to your ArDrive!', filesUploaded);
    }
    return 'SUCCESS';
  } catch (err) {
    console.log(err);
    return 'ERROR processing files';
  }
};

// Scans through the queue & checks if a file has been mined, and if it has moves to Completed Table. If a file is not on the permaweb it will be uploaded
export const checkUploadStatus = async () => {
  try {
    console.log('---Checking Upload Status---');
    const unsyncedFiles = await getAllUploaded_fromQueue();

    await asyncForEach(
      unsyncedFiles,
      async (unsyncedFile: {
        tx_id: string;
        file_path: string;
        owner: any;
        file_name: string;
        file_hash: any;
        file_modified_date: any;
        ardrive_path: any;
        ardrive_version: string;
        isPublic: any;
        file_size: string;
      }) => {
        // Is the file uploaded on the web?
        const status = await getTransactionStatus(unsyncedFile.tx_id);
        if (status === 200) {
          console.log(
            'SUCCESS! %s was uploaded with TX of %s',
            unsyncedFile.file_path,
            unsyncedFile.tx_id
          );
          console.log(
            '...you can access the file here %s',
            gatewayURL.concat(unsyncedFile.tx_id)
          );
          const fileToComplete = {
            owner: unsyncedFile.owner,
            file_name: unsyncedFile.file_name,
            file_hash: unsyncedFile.file_hash,
            file_modified_date: unsyncedFile.file_modified_date,
            ardrive_path: unsyncedFile.ardrive_path,
            ardrive_version: unsyncedFile.ardrive_version,
            permaweb_link: gatewayURL.concat(unsyncedFile.tx_id),
            tx_id: unsyncedFile.tx_id,
            prev_tx_id: unsyncedFile.tx_id,
            isLocal: '1',
            isPublic: unsyncedFile.isPublic,
          };
          await completeFile(fileToComplete);
          await remove_fromQueue(unsyncedFile.file_path);
        } else if (status === 202) {
          console.log(
            '%s is still being uploaded to the PermaWeb (TX_PENDING)',
            unsyncedFile.file_path
          );
        } else if (status === 410) {
          console.log(
            '%s failed to be uploaded (TX_FAILED)',
            unsyncedFile.file_path
          );
          await remove_fromQueue(unsyncedFile.file_path);
        } else if (unsyncedFile.file_size === '0') {
          console.log(
            '%s has a file size of 0 and cannot be uploaded to the Permaweb',
            unsyncedFile.file_path
          );
          await remove_fromQueue(unsyncedFile.file_path);
        } else if (await getByFileName_fromCompleted(unsyncedFile.file_name)) {
          console.log(
            '%s was queued, but has been previously uploaded to the Permaweb',
            unsyncedFile.file_path
          );
          await remove_fromQueue(unsyncedFile.file_path);
        } else {
          // CHECK IF FILE EXISTS AND IF NOT REMOVE FROM QUEUE
          fs.access(unsyncedFile.file_path, async (err) => {
            if (err) {
              console.log(
                '%s was not found locally anymore.  Removing from the queue',
                unsyncedFile.file_path
              );
              await remove_fromQueue(unsyncedFile.file_path);
            }
          });
        }
      }
    );
    return 'Success checking upload status';
  } catch (err) {
    console.log(err);
    return 'Error checking upload status';
  }
};
