import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useContact,
  useDeleteContact,
  useUpdateContact,
} from "@/queries/useContacts";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import ContactTagSelect from "@/components/ContactTagSelect";
import { Plus, X } from "lucide-react";
import { useMemo } from "react";
import type {
  ContactExtra,
  ContactWithAddressesUpdate,
  InstagramContactAddressExtra,
} from "@/supabase/client";
import {
  isValidPhoneNumber,
  formatPhoneNumber,
  nameInitials,
} from "@/utils/FormatUtils";
import Avatar from "@/components/Avatar";
import FieldError from "@/components/FieldError";

type ContactFormValues = ContactWithAddressesUpdate;

export const Route = createFileRoute("/_auth/contacts/$contactId")({
  component: ContactDetail,
});

function ContactDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { contactId } = Route.useParams();
  const { data: contact } = useContact(contactId);
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();

  // Track original addresses (these will be readonly)
  const originalAddresses = useMemo(
    () => new Set(contact?.addresses.map((a) => a.address) ?? []),
    [contact],
  );

  // Instagram profile details (avatar, @username) are read live from the
  // linked address, which the webhook keeps fresh — they are not copied onto
  // the contact record.
  const igExtra = contact?.addresses.find((a) => a.service === "instagram")
    ?.extra as InstagramContactAddressExtra | null | undefined;

  // Custom questions captured by a Meta Instant Form, kept as question ->
  // answer on the contact's `extra`. The full submission lives on the `leads`
  // row; this is the flattened view worth showing next to the contact.
  const leadFields = useMemo(
    () =>
      Object.entries(
        (contact?.extra as ContactExtra | null)?.lead_fields ?? {},
      ),
    [contact],
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { isDirty, isValid, errors },
  } = useForm<ContactFormValues>({
    mode: "onTouched",
    values: contact,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses",
  });

  return (
    contact && (
      <>
        <SectionHeader
          title={contact.name || t("No name")}
          onDelete={() => {
            deleteContact.mutate(contactId, {
              onSuccess: () =>
                navigate({ to: "..", hash: (prevHash) => prevHash! }),
            });
          }}
          deleteLoading={deleteContact.isPending}
        />

        <SectionBody>
          {igExtra && (igExtra.profile_picture_url || igExtra.username) && (
            <div className="flex flex-col items-center gap-2 mb-6">
              <Avatar
                src={igExtra.profile_picture_url}
                fallback={nameInitials(contact.name || igExtra.username || "?")}
                size={72}
                className="bg-accent text-accent-foreground border border-border text-[24px]"
              />
              {igExtra.username && (
                <div className="text-[14px] text-muted-foreground">
                  @{igExtra.username}
                </div>
              )}
            </div>
          )}

          <form
            id="contact-form"
            onSubmit={handleSubmit((data) => updateContact.mutate(data))}
          >
            <label>
              <div className="label">{t("Name")}</div>
              <input
                type="text"
                className="text"
                placeholder={t("Contact name")}
                {...register("name")}
              />
            </label>

            <label>
              <div className="label">{t("Last name")}</div>
              <input
                type="text"
                className="text"
                placeholder={t("Contact last name")}
                {...register("surname")}
              />
            </label>

            <label>
              <div className="label">{t("Email")}</div>
              <input
                type="email"
                className="text"
                placeholder={t("email@example.com")}
                {...register("email")}
              />
            </label>

            {/* Shared with the AI agent, in both directions: what is typed
                here reaches the agent's prompt on every message, and the agent
                appends its own dated lines through `update_contact`. Kept
                inline rather than behind a TextAreaField nav row — the point of
                the field is that you see what the agent learned on open. */}
            <label>
              <div className="label">{t("Notes")}</div>
              <textarea
                className="text"
                rows={3}
                placeholder={t("Anything worth knowing about this contact")}
                {...register("notes")}
              />
            </label>

            <label>
              <div className="label">{t("Source")}</div>
              <input
                type="text"
                className="text"
                value={contact.source}
                readOnly
              />
            </label>

            <div>
              <div className="label">{t("Tags")}</div>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <ContactTagSelect
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>

            {fields.map((field, idx) => {
              const isExisting = originalAddresses.has(field.address ?? "");
              const extra = field.extra as
                | { synced?: { action?: string }; username?: string }
                | undefined;
              const syncedSuffix =
                extra?.synced?.action === "add" ? " (" + t("Synced") + ")" : "";

              // Instagram addresses are internal IG-scoped ids (igsid), not
              // phone numbers. Show the @username (or the raw id) read-only
              // instead of running the id through the phone formatter, which
              // made it show up as a bogus "+1 05158…" phone number.
              if (field.service === "instagram") {
                return (
                  <label key={field.id}>
                    <div className="label">Instagram{syncedSuffix}</div>
                    <input
                      type="text"
                      className="text"
                      value={
                        extra?.username
                          ? `@${extra.username}`
                          : (field.address ?? "")
                      }
                      readOnly
                    />
                  </label>
                );
              }

              return (
                <label key={field.id}>
                  <div className="label">
                    {t("Phone")} {idx + 1}
                    {syncedSuffix}
                  </div>
                  <div className="flex items-center gap-2">
                    {isExisting ? (
                      <input
                        type="tel"
                        className="text"
                        value={formatPhoneNumber(field.address || "")}
                        readOnly
                      />
                    ) : (
                      <input
                        type="tel"
                        className={`text ${errors.addresses?.[idx]?.address ? "border-destructive" : ""}`}
                        placeholder={t("+54 9 11 1234 5678")}
                        {...register(`addresses.${idx}.address`, {
                          validate: (value) =>
                            !value ||
                            isValidPhoneNumber(value) ||
                            "Invalid number",
                        })}
                      />
                    )}
                    <button
                      type="button"
                      className="p-[8px] rounded-full hover:bg-muted transition-colors"
                      onClick={() => remove(idx)}
                      title={t("Delete")}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <FieldError error={errors.addresses?.[idx]?.address} />
                </label>
              );
            })}

            {/* Add phone number button */}
            <button
              type="button"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
              onClick={() => append({ address: "" })}
            >
              <Plus className="w-4 h-4" />
              {t("Add phone")}
            </button>

            {/* Answers to an Instant Form's custom questions. Name, email and
                phone already have their own fields above; only the
                advertiser's own questions land here. */}
            {leadFields.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="label">{t("Lead form answers")}</div>
                {leadFields.map(([question, answer]) => (
                  <label key={question}>
                    <div className="label">{question}</div>
                    <input
                      type="text"
                      className="text"
                      value={answer}
                      readOnly
                    />
                  </label>
                ))}
              </div>
            )}
          </form>
        </SectionBody>

        <SectionFooter>
          <Button
            form="contact-form"
            type="submit"
            invalid={!isValid || !isDirty}
            loading={updateContact.isPending}
            className="primary"
          >
            {t("Update")}
          </Button>
        </SectionFooter>
      </>
    )
  );
}
