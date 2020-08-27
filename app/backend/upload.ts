// upload.js
import { sep, basename } from 'path';
import fs from 'fs';
import {
  createArDriveTransaction,
  sendArDriveFee,
  getTransactionStatus,
} from './arweave';
import {
  asyncForEach,
  getWinston,
  formatBytes,
  gatewayURL,
  sleep,
  extToMime,
} from './common';
import { encryptFile, checksumFile, encryptTag } from './crypto';
import {
  getByFileName_fromCompleted,
  getFilesToUpload_fromQueue,
  remove_fromQueue,
  getAllUploaded_fromQueue,
  completeFile,
} from './db';

// ArDrive Version Tag
// const VERSION = '0.1.1';

// Tags and Uploads a single file to your ArDrive
async function uploadArDriveFile(
  user: {
    sync_folder_path: string;
    password: any;
    jwk: string;
    owner: string;
  },
  filePath: string,
  arDrivePath: any,
  modifiedDate: any
) {
  try {
    let arDrivePublic;
    let arPrice;
    let stats;
    let encryptedStats;
    const fileName = basename(filePath);
    const fileHash = await checksumFile(filePath);
    const contentType = extToMime(filePath);

    if (
      filePath.indexOf(user.sync_folder_path.concat(sep, 'Public', sep)) !== -1
    ) {
      // Public by choice, do not encrypt
      arDrivePublic = '1';
      arPrice = await createArDriveTransaction(
        user,
        filePath,
        fileName,
        fileHash,
        contentType,
        arDrivePath,
        modifiedDate,
        arDrivePublic
      );
    } else {
      // private by default, encrypt file
      arDrivePublic = '0';
      const encryptedFilePath = filePath.concat('.enc');
      await encryptFile(filePath, user.password, user.jwk);
      await sleep(250);
      stats = fs.statSync(filePath);
      encryptedStats = fs.statSync(encryptedFilePath);
      if (encryptedStats.size > stats.size) {
        const encryptedFileName = await encryptTag(
          fileName,
          user.password,
          user.jwk
        );
        const encryptedFileHash = await encryptTag(
          fileHash,
          user.password,
          user.jwk
        );
        const encryptedContentType = await encryptTag(
          contentType,
          user.password,
          user.jwk
        );
        const encryptedArDrivePath = await encryptTag(
          arDrivePath,
          user.password,
          user.jwk
        );
        const encryptedModifiedDate = await encryptTag(
          modifiedDate,
          user.password,
          user.jwk
        );
        arPrice = await createArDriveTransaction(
          user,
          encryptedFilePath,
          JSON.stringify(encryptedFileName),
          JSON.stringify(encryptedFileHash),
          JSON.stringify(encryptedContentType),
          JSON.stringify(encryptedArDrivePath),
          JSON.stringify(encryptedModifiedDate),
          arDrivePublic
        );
        // Delete the .enc file since it has been uploaded
        fs.unlinkSync(encryptedFilePath);
        // Send the ArDrive fee to ARDRIVE Profit Sharing Comunity smart contract
        await sendArDriveFee(user, arPrice.toFixed(6));
      } else {
        // Issue with encrypting - delete the encrypted file and try again
        console.log('ERROR Encryption has failed... retrying');
        fs.unlinkSync(encryptedFilePath);
        await uploadArDriveFile(user, filePath, arDrivePath, modifiedDate);
      }
    }
    return 'Uploaded';
  } catch (err) {
    console.log(err);
    return 'Error uploading file';
  }
}

// Gets the price of latest upload batch
export const getPriceOfNextUploadBatch = async () => {
  let totalWinston = 0;
  let totalSize = 0;
  let winston = 0;
  const filesToUpload = await getFilesToUpload_fromQueue();
  if (Object.keys(filesToUpload).length > 0) {
    await asyncForEach(
      filesToUpload,
      async (fileToUpload: { file_size: string | number }) => {
        totalSize += +fileToUpload.file_size;
        winston = await getWinston(fileToUpload.file_size);
        totalWinston += +winston;
      }
    );
    const totalArweavePrice = totalWinston * 0.000000000001;
    let arDriveFee = +totalArweavePrice.toFixed(9) * 0.15;
    if (arDriveFee < 0.00001) {
      arDriveFee = 0.00001;
    }
    const totalArDrivePrice = +totalArweavePrice.toFixed(9) + arDriveFee;
    return {
      totalArDrivePrice,
      totalSize: formatBytes(totalSize),
      totalNumberOfFiles: Object.keys(filesToUpload).length,
    };
  }
  return 0;
};

// Uploads all queued files
export const uploadArDriveFiles = async (user: any, readyToUpload: any) => {
  try {
    let filesUploaded = 0;
    console.log('---Uploading All Queued Files---');
    const filesToUpload = await getFilesToUpload_fromQueue();

    if (Object.keys(filesToUpload).length > 0 && readyToUpload === 'Y') {
      // Ready to upload
      await asyncForEach(
        filesToUpload,
        async (fileToUpload: {
          file_size: string;
          file_path: any;
          file_name: string;
          ardrive_path: any;
          file_hash: any;
          file_modified_date: any;
        }) => {
          if (fileToUpload.file_size === '0') {
            console.log(
              '%s has a file size of 0 and cannot be uploaded to the Permaweb',
              fileToUpload.file_path
            );
            await remove_fromQueue(fileToUpload.file_path);
          } else if (
            await getByFileName_fromCompleted(fileToUpload.file_name)
          ) {
            console.log(
              '%s was queued, but has been previously uploaded to the Permaweb',
              fileToUpload.file_path
            );
            await remove_fromQueue(fileToUpload.file_path);
          } else {
            await uploadArDriveFile(
              user,
              fileToUpload.file_path,
              fileToUpload.ardrive_path,
              fileToUpload.file_modified_date
            );
            filesUploaded += 1;
          }
        }
      );
    }
    if (filesUploaded < 0) {
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
