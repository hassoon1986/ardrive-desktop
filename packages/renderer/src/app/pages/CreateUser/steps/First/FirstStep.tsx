import React, { useCallback, useState } from "react";

import { AppTextLogo, RoundedButton } from "app/components";

import { CreateUserFormContainer } from "./FirstStep.styled";
import { useTranslationAt } from "app/utils/hooks";
import { ArdriveInput } from "app/components/inputs/ArdriveInput";
import { ArdriveHeader } from "app/components/typography/Headers.styled";

const translationsPath = "pages.create_user.steps.first";

const FirstStep: React.FC<{
  onContinue(username: string, password: string): void;
}> = ({ onContinue }) => {
  const { t } = useTranslationAt(translationsPath);
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
      <ArdriveHeader>{t("create_account")}</ArdriveHeader>
      <AppTextLogo />
      <CreateUserFormContainer>
        <ArdriveInput
          placeholder={t("username")}
          onChange={setField(setUsername)}
        />
        <ArdriveInput
          type="password"
          placeholder={t("password")}
          onChange={setField(setPassword)}
        />
        <ArdriveInput
          type="password"
          placeholder={t("confirm_password")}
          onChange={setField(setSecondPassword)}
        />
        <RoundedButton onClick={continueHandler}>{t("continue")}</RoundedButton>
      </CreateUserFormContainer>
    </>
  );
};

export default FirstStep;
