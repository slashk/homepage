import { useTranslation } from "next-i18next";
import { FaChartLine } from "react-icons/fa6";
import useSWR from "swr";

import Container from "../widget/container";
import Error from "../widget/error";
import PrimaryText from "../widget/primary_text";
import Raw from "../widget/raw";
import WidgetIcon from "../widget/widget_icon";

export default function Widget({ options }) {
  const { t, i18n } = useTranslation();

  const { data, error } = useSWR(
    `/api/widgets/rsu?${new URLSearchParams({ lang: i18n.language, ...options }).toString()}`,
  );

  if (error || data?.error) {
    return <Error options={options} />;
  }

  if (!data) {
    return (
      <Container>
        <WidgetIcon icon={FaChartLine} />
        <PrimaryText>{t("rsu.loading")}...</PrimaryText>
      </Container>
    );
  }

  if (data.totalValue === null) {
    return <Error options={options} />;
  }

  return (
    <Container options={options} additionalClassNames="information-widget-rsu">
      <Raw>
        <div className="flex items-center w-full h-full">
          <FaChartLine className="flex-none w-5 h-5 text-theme-800 dark:text-theme-200 mr-2" />
          <span className="text-theme-800 dark:text-theme-200 text-sm mr-2">{data.symbol}</span>
          <span className="text-theme-800/70 dark:text-theme-200/70 text-sm">
            {t("common.number", { value: data.totalValue, style: "currency", currency: "USD" })}
          </span>
        </div>
      </Raw>
    </Container>
  );
}
