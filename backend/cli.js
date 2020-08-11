const prompt = require('prompt-sync')({ sigint: true });
const passwordPrompt = require('prompts');
const profile = require('./profile');
const arCommon = require('./common');
const arweave = require('./arweave');

// Get path to local wallet and return that wallet public and private key
const promptForLocalWallet = async () => {
  console.log(
    'Please enter the path of your existing Arweave Wallet JSON file eg. C:\\Source\\ardrive_test_key.json'
  );
  const existingWalletPath = prompt('Wallet Path: ');
  return arCommon.getLocalWallet(existingWalletPath);
};

// Get the ArDrive owner nickname
const promptForNickname = async () => {
  console.log('What is the nickname you would like to give to this wallet?');
  const owner = prompt('Please enter your nickname: ');
  return owner;
};

// Get the ArDrive Sync Folder path
const promptForSyncFolderPath = async () => {
  // Setup ArDrive Sync Folder
  console.log(
    'Please enter the path of your local ArDrive folder e.g D:\\ArDriveSync.  A new folder will be created if it does not exist'
  );
  const syncFolderPath = prompt('ArDrive Sync Folder Path: ');
  const validPath = await profile.setupArDriveSyncFolder(syncFolderPath);
  if (validPath === '0') {
    return promptForSyncFolderPath();
  }
  return syncFolderPath;
};

// Setup ArDrive Login Password
// Modify to check for password strength
const promptForNewLoginPassword = async () => {
  console.log(
    'Your ArDrive Login password will be used to unlock your ArDrive and start syncing.'
  );
  const newLoginPasswordResponse = await passwordPrompt({
    type: 'text',
    name: 'password',
    style: 'password',
    message: 'Please enter a strong ArDrive Login password: ',
  });
  return newLoginPasswordResponse;
};

// Setup ArDrive Data Protection Password
// TO DO Modify to check for password strength
const promptForDataProtectionKey = async () => {
  console.log(
    'Your ArDrive Data Protection password will be used to encrypt your data on the Permaweb.  Do NOT lose this!!!'
  );
  const dataProtectionKeyResponse = await passwordPrompt({
    type: 'text',
    name: 'password',
    style: 'password',
    message: 'Please enter a strong ArDrive Encryption password: ',
  });
  return dataProtectionKeyResponse;
};

// Get the users wallet or create a new one
const promptForWallet = async () => {
  // Create new or import Arweave wallet
  console.log('To use ArDrive, you must have an Arweave Wallet.');
  const existingWallet = prompt(
    'Do you have an existing Arweave Wallet (.json file) Y/N '
  );
  const { walletPrivateKey, walletPublicKey } =
    existingWallet === 'N'
      ? await arweave.createArDriveWallet()
      : await promptForLocalWallet();
  return { walletPrivateKey, walletPublicKey };
};

const promptForLoginPassword = async () => {
  const loginPasswordResponse = await passwordPrompt({
    type: 'text',
    name: 'password',
    style: 'password',
    message: 'Please enter your ArDrive Login password: ',
  });
  return loginPasswordResponse.password;
};

exports.setupAndGetUser = async () => {
  try {
    // Welcome message and info
    console.log(
      'We have not detected a profile.  To store your files permanently, you must first setup your ArDrive account.'
    );

    const owner = await promptForNickname();
    const syncFolderPath = await promptForSyncFolderPath();
    const newLoginPasswordResponse = await promptForNewLoginPassword();
    const dataProtectionKeyResponse = await promptForDataProtectionKey();
    const wallet = await promptForWallet();

    const user = await profile.setUser(
      owner,
      syncFolderPath,
      wallet.walletPrivateKey,
      wallet.walletPublicKey,
      newLoginPasswordResponse.password,
      dataProtectionKeyResponse.password
    );

    return user;
  } catch (err) {
    console.log(err);
    return null;
  }
};

exports.userLogin = async (walletPublicKey, owner) => {
  console.log('An ArDrive Wallet is present for: %s', owner);
  const loginPassword = await promptForLoginPassword();
  const user = await profile.getUser(walletPublicKey, loginPassword);
  return user;
};

exports.promptForArDriveUpload = async (price, size, amountOfFiles) => {
  console.log(
    'Uploading %s files (%s) to the Permaweb, totaling %s AR',
    amountOfFiles,
    size,
    price
  );
  const readyToUpload = prompt('Upload all unsynced files? Y/N ');
  return readyToUpload;
};
