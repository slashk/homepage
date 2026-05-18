import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "quote", { symbol: widget.symbol });

  if (error || data?.error) {
    return (
      <Container service={service}>
        <Block label={t("widget.api_error")} />
      </Container>
    );
  }

  if (!data) {
    return (
      <Container service={service}>
        <Block label={t("rsu.loading")} />
      </Container>
    );
  }

  if (data.c === null) {
    return (
      <Container service={service}>
        <Block label={t("widget.api_error")} />
      </Container>
    );
  }

  const totalValue = data.c * Number(widget.shares);

  return (
    <Container service={service}>
      <Block
        label={t("rsu.totalValue")}
        value={t("common.number", { value: totalValue, style: "currency", currency: "USD" })}
      />
    </Container>
  );
}
