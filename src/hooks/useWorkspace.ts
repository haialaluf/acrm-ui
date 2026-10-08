import { useCurrentOrganization } from "@/queries/useOrganizations";
import { useTranslation } from "@/hooks/useTranslation";
import type { Currency } from "@/supabase/types/extra_types";

export const CURRENCIES: Currency[] = ["ILS", "SEK", "EUR", "USD"];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ILS: "₪",
  SEK: "kr",
  EUR: "€",
  USD: "$",
};

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function useWorkspace() {
  const { translate: t } = useTranslation();
  const { data: org } = useCurrentOrganization();
  const isTherapy = org?.extra?.workspace_type === "therapy";
  const clients = org?.extra?.people_term === "clients";
  const currency = org?.extra?.currency ?? "ILS";

  const terms = !isTherapy
    ? {
        people: t("Contacts"),
        person: t("Contact"),
        newPerson: t("New contact"),
        searchPeople: t("Search for a contact"),
      }
    : clients
      ? {
          people: t("Clients"),
          person: t("Client"),
          newPerson: t("New client"),
          searchPeople: t("Search clients"),
        }
      : {
          people: t("Patients"),
          person: t("Patient"),
          newPerson: t("New patient"),
          searchPeople: t("Search patients"),
        };

  return {
    isTherapy,
    terms,
    currency,
    money: (amount: number) => formatMoney(amount, currency),
  };
}
