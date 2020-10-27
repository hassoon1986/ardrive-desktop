import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { appActions, authActions } from "app/redux/actions";
import { appSelectors } from "app/redux/selectors";

import {
  UsernamePrompt,
  PasswordPrompt,
  ContinueButton,
  CreateNewButton,
  ImportExistingButton,
  SelectSyncFolderButton,
  LetsGoButton,
  InputCaption,
  PageHeader,
  Red,
  Bold,
  Description,
} from "./CreateUser.styled";
import { WelcomeContainer } from "app/components";

const walletPathName = "wallet_path";
const syncFolderPathName = "sync_folder_path";

const FirstStep: React.FC<{
  onContinue(username: string, password: string): void;
}> = ({ onContinue }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [secondPassword, setSecondPassword] = useState("");

  const setField = useCallback((setFunction: any) => {
    return (event: any) => {
      setFunction(event.currentTarget.value);
    };
  }, []);

  const continueHandler = useCallback(() => {
    const passwordEquals =
      password != null && secondPassword != null && password === secondPassword;
    if (username && passwordEquals) {
      onContinue(username, password);
    }
  }, [password, secondPassword, username, onContinue]);

  return (
    <>
      <PageHeader>
        <Trans
          i18nKey="pages.create_user.lets_get_aquainted"
          components={[<Red />]}
        />
      </PageHeader>
      <InputCaption>{t("pages.create_user.enter_your_login")}</InputCaption>
      <UsernamePrompt
        placeholder={t("pages.create_user.username")}
        onChange={setField(setUsername)}
      />
      <InputCaption>{t("pages.create_user.enter_your_password")}</InputCaption>
      <PasswordPrompt
        placeholder={t("pages.create_user.password")}
        onChange={setField(setPassword)}
      />
      <InputCaption>
        {t("pages.create_user.reenter_your_password")}
      </InputCaption>
      <PasswordPrompt
        placeholder={t("pages.create_user.password")}
        onChange={setField(setSecondPassword)}
      />
      <ContinueButton onClick={continueHandler}>
        {t("pages.create_user.continue")}
      </ContinueButton>
    </>
  );
};

const SecondStep: React.FC<{
  onContinue(): void;
}> = ({ onContinue }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const walletPath = useSelector(
    appSelectors.getOpenedFilePath(walletPathName)
  );

  const openFile = useCallback(async () => {
    dispatch(appActions.openFile(walletPathName));
  }, [dispatch]);

  useEffect(() => {
    if (walletPath) {
      onContinue();
    }
  }, [walletPath, onContinue]);

  return (
    <>
      <PageHeader>
        <Trans
          i18nKey="pages.create_user.choose_your_wallet"
          components={[<Bold />]}
        />
      </PageHeader>
      <Description>
        <Trans
          i18nKey="pages.create_user.wallet_description"
          components={[<Bold />, <Red />]}
        />
      </Description>
      <CreateNewButton>{t("pages.create_user.create_new")}</CreateNewButton>
      <ImportExistingButton onClick={openFile}>
        {t("pages.create_user.import_existing")}
      </ImportExistingButton>
    </>
  );
};

const ThirdStep: React.FC<{
  onContinue(): void;
}> = ({ onContinue }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const syncFolderPath = useSelector(
    appSelectors.getOpenedFolderPath(syncFolderPathName)
  );

  const openFile = useCallback(async () => {
    dispatch(appActions.openFolder(syncFolderPathName));
  }, [dispatch]);

  const letsGo = useCallback(() => {
    if (syncFolderPath) {
      onContinue();
    }
  }, [syncFolderPath, onContinue]);

  return (
    <>
      <PageHeader>
        <Trans i18nKey="pages.create_user.your_path" components={[<Red />]} />
      </PageHeader>
      <Description>
        <Trans
          i18nKey="pages.create_user.path_description"
          components={[<Bold />]}
        />
      </Description>
      <SelectSyncFolderButton onClick={openFile}>
        {syncFolderPath || t("pages.create_user.select_sync_folder")}
      </SelectSyncFolderButton>
      <LetsGoButton onClick={letsGo}>
        {t("pages.create_user.lets_go")}
      </LetsGoButton>
    </>
  );
};

export default () => {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();

  const firstStepCompleted = useCallback(
    (username: string, password: string) => {
      setUsername(username);
      setPassword(password);
      setStep((prev) => prev + 1);
    },
    []
  );

  const goNextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const walletPath = useSelector(
    appSelectors.getOpenedFilePath(walletPathName)
  );
  const syncFolderPath = useSelector(
    appSelectors.getOpenedFolderPath(syncFolderPathName)
  );

  const completeRegistration = useCallback(() => {
    if (username && password && walletPath && syncFolderPath) {
      dispatch(
        authActions.createUser(username, password, syncFolderPath, walletPath)
      );
    }
  }, [dispatch, username, password, walletPath, syncFolderPath]);

  const CurrentStep = useMemo(() => {
    switch (step) {
      case 0:
        return () => <FirstStep onContinue={firstStepCompleted} />;
      case 1:
        return () => <SecondStep onContinue={goNextStep} />;
      case 2:
        return () => <ThirdStep onContinue={completeRegistration} />;
      default:
        return React.Fragment;
    }
  }, [step, goNextStep, completeRegistration, firstStepCompleted]);

  return (
    <WelcomeContainer>
      <CurrentStep />
    </WelcomeContainer>
  );
};
