import { useState } from "react";
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
import ConfirmModal from "@/components/ConfirmModal";
import { Instagram, Merge, Plus, X } from "lucide-react";
import { useMemo } from "react";
import type {
  ContactExtra,
  ContactWithAddressesUpdate,
  InstagramContactAddressExtra,
} from "@/supabase/client";
import {
  isValidPhoneNumber,
  formatPhoneNumber,
  ltrIsolate,
  nameInitials,
  normalizePhoneNumber,
} from "@/utils/FormatUtils";
import Avatar from "@/components/Avatar";
import FieldError from "@/components/FieldError";
import EmailSuggestion from "@/components/EmailSuggestion";
import { validateEmailField } from "@/utils/emailValidation";
import { contactEmail } from "@/utils/ContactAddressUtils";
import {
  useAddressConflicts,
  type AddressConflict,
} from "@/hooks/useAddressConflicts";
import { fill } from "@/utils/fill";
import InstagramAddressPicker, {
  type InstagramAddressRow,
} from "@/components/contacts/InstagramAddressPicker";
import { useIntegrations } from "@/hooks/useIntegrations";
import LinkAddressToContactModal from "@/components/LinkAddressToContactModal";

// `email` is hand-added: contacts.email is dropped from the generated Row/
// Update types (it's unused — see 03-02_contacts.sql), but the form still
// carries it as a plain field, routed through the address pipeline by
// useUpdateContact rather than the contacts table update.
type ContactFormValues = ContactWithAddressesUpdate & { email?: string | null };

export const Route = createFileRoute("/_auth/contacts/$contactId")({
  component: ContactDetail,
});

/** The RPC-shaped address list for only the NEW rows this submit would add —
 * existing addresses are read-only in this form and can never collide. */
function buildNewAddresses(
  data: ContactFormValues,
  originalAddresses: Set<string>,
) {
  return [
    ...(data.addresses ?? [])
      .filter((a) => a.address && !originalAddresses.has(a.address))
      .map((a) => ({
        service: a.service ?? "whatsapp",
        address:
          a.service === "instagram"
            ? a.address!
            : normalizePhoneNumber(a.address!),
      })),
    ...(data.email?.trim() &&
    !originalAddresses.has(data.email.trim().toLowerCase())
      ? [{ service: "email", address: data.email.trim().toLowerCase() }]
      : []),
  ];
}

function ContactDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { contactId } = Route.useParams();
  const { data: contact } = useContact(contactId);
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();
  const { conflictsByAddress, checkOnBlur, findConflictBeforeSubmit } =
    useAddressConflicts(contactId);
  const [pendingConflict, setPendingConflict] = useState<{
    data: ContactFormValues;
    conflict: AddressConflict;
  } | null>(null);
  const [pickingInstagram, setPickingInstagram] = useState(false);
  const [merging, setMerging] = useState(false);
  const { connected } = useIntegrations();

  // Track original addresses (these will be readonly)
  const originalAddresses = useMemo(
    () => new Set(contact?.addresses.map((a) => a.address) ?? []),
    [contact],
  );

  // `upsert_contact` reconciles two contacts through a shared address, so the
  // merge needs one of this contact's own addresses to travel on. A contact
  // with none (an import that only carried a name) has nothing to merge with.
  const mergeAddress = contact?.addresses.at(0);

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

  // contact.email (the raw column) is unused; the address of the contact's
  // service='email' row is the real value. Its address row is also dropped
  // from the addresses list below — it is edited through the Email field
  // above, not the phone/instagram list, which only special-cases instagram
  // and would otherwise render it as a bogus "Phone" entry.
  const formValues = useMemo(
    () =>
      contact && {
        ...contact,
        email: contactEmail(contact) ?? null,
        addresses: contact.addresses.filter((a) => a.service !== "email"),
      },
    [contact],
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { isDirty, isValid, errors },
  } = useForm<ContactFormValues>({
    mode: "onTouched",
    values: formValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses",
  });

  // One Instagram account per contact: every read of "the contact's Instagram"
  // takes the first matching address row, so a second one would sit there
  // unreachable. Offer the picker only while there is none.
  const hasInstagram = fields.some((field) => field.service === "instagram");

  function pickInstagram(row: InstagramAddressRow) {
    setPickingInstagram(false);
    append({
      address: row.address,
      service: "instagram",
      // Carried so the row renders as @username right away — the picker read
      // it from the same `contacts_addresses` row the form is about to link.
      extra: row.extra,
    });
    // The same ownership pre-check the phone and email fields run on blur: an
    // igsid another contact already owns has to warn here, not at submit.
    void checkOnBlur("instagram", row.address);
  }

  function submit(data: ContactFormValues, strategy: "skip" | "merge") {
    updateContact.mutate(
      { ...data, strategy },
      { onSuccess: () => setPendingConflict(null) },
    );
  }

  async function onValidSubmit(data: ContactFormValues) {
    const conflict = await findConflictBeforeSubmit(
      buildNewAddresses(data, originalAddresses),
    );
    if (conflict) {
      setPendingConflict({ data, conflict });
      return;
    }
    submit(data, "skip");
  }

  const emailReg = register("email", {
    validate: validateEmailField,
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

          <form id="contact-form" onSubmit={handleSubmit(onValidSubmit)}>
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
                {...emailReg}
                onBlur={(e) => {
                  emailReg.onBlur(e);
                  const value = e.target.value.trim().toLowerCase();
                  if (
                    value &&
                    validateEmailField(value) === true &&
                    !originalAddresses.has(value)
                  ) {
                    checkOnBlur("email", value);
                  }
                }}
              />
              <FieldError error={errors.email} />
              <EmailSuggestion value={watch("email")} />
              {watch("email") &&
                conflictsByAddress[watch("email")!.trim().toLowerCase()] && (
                  <ConflictWarning
                    conflict={
                      conflictsByAddress[watch("email")!.trim().toLowerCase()]
                    }
                    t={t}
                  />
                )}
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
                const igConflict = isExisting
                  ? undefined
                  : conflictsByAddress[field.address ?? ""];

                return (
                  <label key={field.id}>
                    <div className="label">Instagram{syncedSuffix}</div>
                    <div className="flex items-center gap-2">
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
                      <button
                        type="button"
                        className="p-[8px] rounded-full hover:bg-muted transition-colors"
                        onClick={() => remove(idx)}
                        title={t("Delete")}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {igConflict && (
                      <ConflictWarning conflict={igConflict} t={t} />
                    )}
                  </label>
                );
              }

              const reg = register(`addresses.${idx}.address`, {
                validate: (value) =>
                  !value || isValidPhoneNumber(value) || "Invalid number",
              });
              const rawValue = watch(`addresses.${idx}.address`);
              const conflict =
                !isExisting && rawValue && isValidPhoneNumber(rawValue)
                  ? conflictsByAddress[normalizePhoneNumber(rawValue)]
                  : undefined;

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
                        {...reg}
                        onBlur={(e) => {
                          reg.onBlur(e);
                          if (
                            e.target.value &&
                            isValidPhoneNumber(e.target.value)
                          ) {
                            checkOnBlur(
                              "whatsapp",
                              normalizePhoneNumber(e.target.value),
                            );
                          }
                        }}
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
                  {conflict && <ConflictWarning conflict={conflict} t={t} />}
                </label>
              );
            })}

            {/* Add-address buttons. Instagram is a picker rather than a
                second text field: its addresses are igsids we can only learn
                from an inbound message (see InstagramAddressPicker), so there
                is nothing meaningful to type. */}
            <div className="flex flex-wrap gap-[10px]">
              <button
                type="button"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
                onClick={() => append({ address: "" })}
              >
                <Plus className="w-4 h-4" />
                {t("Add phone")}
              </button>

              {mergeAddress && (
                <button
                  type="button"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
                  onClick={() => setMerging(true)}
                >
                  <Merge className="w-4 h-4" />
                  {t("Merge with another contact")}
                </button>
              )}

              {connected.instagram && !hasInstagram && (
                <button
                  type="button"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
                  onClick={() => setPickingInstagram(true)}
                >
                  <Instagram className="w-4 h-4" />
                  {t("Add Instagram")}
                </button>
              )}
            </div>

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

            {updateContact.error && (
              <p className="text-destructive text-[13px]">
                {t("Could not save the contact. Please try again.")}
              </p>
            )}
            {updateContact.data?.action === "skipped" && (
              <p className="text-destructive text-[13px]">
                {t(
                  "This address now belongs to another contact. Refresh and try again.",
                )}
              </p>
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

        {mergeAddress && (
          <LinkAddressToContactModal
            open={merging}
            address={mergeAddress.address}
            service={mergeAddress.service}
            username={igExtra?.username}
            currentContact={{
              id: contact.id,
              name: contact.name,
              surname: contact.surname,
            }}
            // The merge keeps the older of the two records, which may not be
            // this one — follow the survivor rather than sitting on a deleted
            // contact's page.
            onMerged={(survivorId) => {
              if (survivorId && survivorId !== contactId) {
                void navigate({
                  to: "/contacts/$contactId",
                  params: { contactId: survivorId },
                  hash: (prevHash: string | undefined) => prevHash!,
                });
              }
            }}
            onClose={() => setMerging(false)}
          />
        )}

        <InstagramAddressPicker
          open={pickingInstagram}
          excluded={new Set(fields.map((field) => field.address ?? ""))}
          onPick={pickInstagram}
          onCancel={() => setPickingInstagram(false)}
        />

        {pendingConflict && (
          <ConfirmModal
            open
            title={t("Merge contacts?")}
            body={
              <span>
                {ltrIsolate(pendingConflict.conflict.address)}{" "}
                {fillOwner(t, pendingConflict.conflict)}
              </span>
            }
            confirmLabel={t("Merge")}
            danger
            loading={updateContact.isPending}
            onConfirm={() => submit(pendingConflict.data, "merge")}
            onCancel={() => setPendingConflict(null)}
          />
        )}
      </>
    )
  );
}

function fillOwner(t: (s: string) => string, conflict: AddressConflict) {
  const owner = conflict.contact_name || t("another contact");
  const count = conflict.conversation_count;
  return count > 0
    ? fill(
        t,
        "belongs to {name}. Merge the two contacts? {n} conversations will move. This cannot be undone.",
        { name: owner, n: count },
      )
    : fill(
        t,
        "belongs to {name}. Merge the two contacts? This cannot be undone.",
        {
          name: owner,
        },
      );
}

function ConflictWarning({
  conflict,
  t,
}: {
  conflict: AddressConflict;
  t: (s: string) => string;
}) {
  return (
    <div className="text-warning-strong text-[11.5px]">
      {t("Already belongs to")}{" "}
      <span dir="ltr">{conflict.contact_name || t("another contact")}</span> —{" "}
      {t("saving will offer to merge the two contacts")}
    </div>
  );
}
