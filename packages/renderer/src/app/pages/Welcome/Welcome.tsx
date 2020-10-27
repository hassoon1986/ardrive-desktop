import React, { useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useHistory } from "react-router-dom";

import { RoundedButton, WelcomeContainer, AppTextLogo } from "app/components";

import { WelcomeText, DesciptionText, Red } from "./Welcome.styled";

export default () => {
  const { t } = useTranslation();
  const history = useHistory();

  const jumpIn = useCallback(() => {
    history.push("/how-it-work");
  }, [history]);

  return (
    <WelcomeContainer>
      <WelcomeText>{t("pages.welcome.welcome_to")}</WelcomeText>
      <AppTextLogo />
      <DesciptionText>
        <Trans i18nKey="pages.welcome.description" components={[<Red />]} />
      </DesciptionText>
      <RoundedButton onClick={jumpIn}>
        {t("pages.welcome.jump_in")}
      </RoundedButton>
    </WelcomeContainer>
  );
};
