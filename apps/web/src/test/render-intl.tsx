import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import vi from "../../messages/vi.json";

/** Render component trong NextIntlClientProvider (locale vi — source of truth). */
export function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="vi" messages={vi} timeZone="Asia/Ho_Chi_Minh">
      {ui}
    </NextIntlClientProvider>,
  );
}
