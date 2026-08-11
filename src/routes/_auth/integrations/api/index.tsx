import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import CopyButton from "@/components/CopyButton";
import Switch from "@/components/Switch";
import Spinner from "@/components/Spinner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import {
  API_LEADS_ADDRESS,
  apiLeadsEndpointUrl,
  useDisableApiLeads,
  useEnableApiLeads,
  useRecentApiLeads,
} from "@/queries/useApiLeads";

export const Route = createFileRoute("/_auth/integrations/api/")({
  component: ApiLeadsIntegration,
});

/**
 * The API Leads integration.
 *
 * A single page rather than the {index, new, $orgAddressId} trio the other
 * integrations use: there is nothing to pick and nothing to authorize, so the
 * connection is one row per organization and this is its whole surface. The
 * closest existing model is the media-preprocessing toggle page.
 */
function ApiLeadsIntegration() {
  const { translate: t } = useTranslation();
  const { data: agent } = useCurrentAgent();
  const { data: addresses, isLoading } = useOrganizationsAddresses();
  const { data: recentLeads } = useRecentApiLeads();
  const enable = useEnableApiLeads();
  const disable = useDisableApiLeads();

  const isOwner = agent?.extra?.role === "owner";
  const connection = addresses?.find(
    (address) => address.address === API_LEADS_ADDRESS,
  );
  const isConnected = connection?.status === "connected";
  const pending = enable.isPending || disable.isPending;
  const error = enable.error ?? disable.error;

  const endpointUrl = apiLeadsEndpointUrl();
  const curl = [
    `curl -X POST ${endpointUrl} \\`,
    `  -H "api-key: YOUR_API_KEY" \\`,
    `  -H "content-type: application/json" \\`,
    `  -d '{"name":"Dana","surname":"Levi",`,
    `       "email":"dana@example.com","phone":"+972501234567",`,
    `       "external_id":"ORDER-4417"}'`,
  ].join("\n");

  if (isLoading) {
    return (
      <>
        <SectionHeader title={t("API Leads")} />
        <SectionBody>
          <Spinner />
        </SectionBody>
      </>
    );
  }

  return (
    <>
      <SectionHeader title={t("API Leads")} />

      <SectionBody className="gap-4">
        <fieldset disabled={!isOwner} className="contents">
          <label className="flex items-center gap-[12px] cursor-pointer justify-between">
            <div className="flex flex-col gap-[2px]">
              <div className="text-foreground">{t("Status")}</div>
              <div className="text-sm text-muted-foreground">
                {isConnected
                  ? t("The endpoint is live and accepting leads")
                  : t("The endpoint rejects every request while off")}
              </div>
            </div>
            <Switch
              checked={isConnected}
              onCheckedChange={(checked) =>
                checked ? enable.mutate() : disable.mutate()
              }
              disabled={!isOwner || pending}
              className="mt-[4px]"
            />
          </label>
        </fieldset>

        {!isOwner && (
          <div className="text-sm text-muted-foreground">
            {t("Requires owner permissions")}
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive">{error.message}</div>
        )}

        <div className="instructions">
          <p>
            {t(
              "Send a POST request to this URL to create a contact. Any system that can make an HTTP request can use it — a website form, a landing page, Zapier, or your own app.",
            )}
          </p>
        </div>

        <label>
          <div className="label">{t("Endpoint URL")}</div>
          <div className="flex items-center gap-[4px]">
            <input
              type="text"
              className="text font-mono text-xs"
              value={endpointUrl}
              readOnly
            />
            <CopyButton value={endpointUrl} title={t("Copy URL")} />
          </div>
        </label>

        <div className="instructions">
          <p>
            {t(
              "Authenticate with an organization API key in the api-key header.",
            )}{" "}
            <Link to="/settings/api-keys" className="underline">
              {t("Manage API keys")}
            </Link>
          </p>
        </div>

        <label>
          <div className="label">{t("Example")}</div>
          <div className="flex items-start gap-[4px]">
            <pre className="text font-mono text-xs whitespace-pre overflow-x-auto">
              {curl}
            </pre>
            <CopyButton value={curl} title={t("Copy example")} />
          </div>
        </label>

        <div className="instructions">
          <p>
            {t(
              "Include at least an email or a phone number. A lead whose phone matches an existing contact updates that contact instead of creating a duplicate, and a phone number becomes messageable on WhatsApp straight away.",
            )}
          </p>
          <p>
            {t(
              "Send external_id to make retries safe: posting the same value twice creates one contact, not two. Any field we do not recognize is kept on the contact as a custom answer.",
            )}
          </p>
        </div>

        <label>
          <div className="label">{t("Recent leads")}</div>
          {recentLeads?.length ? (
            <div className="flex flex-col gap-[4px]">
              {recentLeads.map((lead) => (
                <div
                  key={lead.leadgen_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {lead.leadgen_id}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(lead.created_time).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {t("Nothing received yet")}
            </div>
          )}
        </label>
      </SectionBody>
    </>
  );
}
