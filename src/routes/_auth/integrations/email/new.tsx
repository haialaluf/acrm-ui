import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { useConnectEmailDomain } from "@/queries/useEmailDomain";
import { useForm } from "react-hook-form";

export const Route = createFileRoute("/_auth/integrations/email/new")({
  component: EmailNew,
});

type FormValues = {
  domain: string;
};

function EmailNew() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const connect = useConnectEmailDomain();
  const { data: currentAgent } = useCurrentAgent();
  const isOwner = currentAgent?.extra?.role === "owner";

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { domain: "" },
  });

  // The server normalizes and validates the domain and reports the real reason
  // — already claimed, malformed, SES rejected it — so show its message rather
  // than duplicating the rules here.
  const error = connect.error?.message;

  return (
    <>
      <SectionHeader title={t("Connect domain")} />

      <SectionBody>
        <form
          id="connect-email-domain-form"
          onSubmit={handleSubmit((data) =>
            connect.mutate(
              { domain: data.domain },
              {
                onSuccess: (address) =>
                  navigate({
                    to: "/integrations/email/$orgAddressId",
                    params: { orgAddressId: address.address },
                    hash: (prevHash) => prevHash!,
                  }),
              },
            ),
          )}
        >
          <fieldset disabled={!isOwner} className="contents">
            <label>
              <div className="label">{t("Domain")}</div>
              <input
                type="text"
                className="text"
                placeholder="acme.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...register("domain", { required: true })}
              />
            </label>
          </fieldset>

          <div className="instructions">
            <p>
              {t(
                "Connect a domain you own to send email from your own address instead of a generic one.",
              )}
            </p>
            <ul>
              <li>
                {t(
                  "You will need access to your domain's DNS settings, at your registrar or hosting provider.",
                )}
              </li>
              <li>
                {t(
                  "We will show you the records to add. Verification usually takes a few minutes, but can take up to 72 hours.",
                )}
              </li>
              <li>
                {t(
                  "Enter the domain only, without www or an email address — for example acme.com.",
                )}
              </li>
            </ul>
            {error && <p className="text-destructive font-medium">{error}</p>}
          </div>
        </form>
      </SectionBody>

      <SectionFooter>
        <Button
          form="connect-email-domain-form"
          type="submit"
          disabled={!isOwner}
          loading={connect.isPending}
          disabledReason={t("Requires owner permissions")}
          className="primary w-full"
        >
          {t("Connect")}
        </Button>
      </SectionFooter>
    </>
  );
}
