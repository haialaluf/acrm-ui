import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useCreateContact } from "@/queries/useContacts";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import ContactTagSelect from "@/components/ContactTagSelect";
import ConfirmModal from "@/components/ConfirmModal";
import { Plus, X } from "lucide-react";
import type { ContactWithAddressesInsert, Service } from "@/supabase/client";
import {
  formatPhoneNumber,
  isValidPhoneNumber,
  ltrIsolate,
  normalizePhoneNumber,
} from "@/utils/FormatUtils";
import FieldError from "@/components/FieldError";
import EmailSuggestion from "@/components/EmailSuggestion";
import { validateEmailField } from "@/utils/emailValidation";
import {
  useAddressConflicts,
  type AddressConflict,
} from "@/hooks/useAddressConflicts";
import { fill } from "@/utils/fill";

// `tags` is a contacts column not yet present in the generated db_types.ts;
// remove this once ContactWithAddressesInsert includes it (see useContactTags).
type ContactFormValues = ContactWithAddressesInsert & {
  tags?: string[];
  email?: string | null;
};

/**
 * Opened from a conversation whose address belongs to nobody yet ("Create a
 * new contact" in LinkAddressToContactModal): the address rides in the URL so
 * the new contact is born already linked to the thread.
 */
type NewContactSearch = {
  address?: string;
  service?: string;
  /** Display name to seed the Name field with — an IG profile name, a push name. */
  name?: string;
  /** Instagram @username, so the read-only row shows a handle and not an igsid. */
  username?: string;
};

export const Route = createFileRoute("/_auth/contacts/new")({
  component: ContactNew,
  validateSearch: (search: Record<string, unknown>): NewContactSearch => ({
    address: typeof search.address === "string" ? search.address : undefined,
    service: typeof search.service === "string" ? search.service : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    username: typeof search.username === "string" ? search.username : undefined,
  }),
});

/** The RPC-shaped address list this form's fields resolve to. */
function buildAddresses(data: ContactFormValues) {
  return [
    ...data.addresses
      .filter((a) => a.address)
      .map((a) => ({
        service: a.service ?? "whatsapp",
        // Only phone-based addresses get normalized: an igsid is an id, not a
        // number, and running it through the phone normalizer would corrupt
        // the routing key.
        address:
          a.service && a.service !== "whatsapp"
            ? a.address!
            : normalizePhoneNumber(a.address!),
      })),
    ...(data.email?.trim()
      ? [{ service: "email", address: data.email.trim().toLowerCase() }]
      : []),
  ];
}

function ContactNew() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const createContact = useCreateContact();
  const { conflictsByAddress, checkOnBlur, findConflictBeforeSubmit } =
    useAddressConflicts();
  const [pendingConflict, setPendingConflict] = useState<{
    data: ContactFormValues;
    conflict: AddressConflict;
  } | null>(null);

  // An address handed over from a conversation (see NewContactSearch): a phone
  // seeds the first phone field, an email the Email field, and anything else
  // (Instagram, Facebook) rides along as a read-only row — those addresses are
  // platform ids there is nothing to type into.
  const prefill = Route.useSearch();
  const prefillService = prefill.service as Service | undefined;
  const prefillIsPhone = !prefill.address || prefill.service === "whatsapp";

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { isValid, isDirty, errors },
  } = useForm<ContactFormValues>({
    mode: "onTouched",
    defaultValues: {
      name: prefill.name ?? "",
      email: prefill.service === "email" ? prefill.address : "",
      addresses:
        prefill.address && !prefillIsPhone
          ? [
              { address: prefill.address, service: prefillService },
              { address: "" },
            ]
          : [
              {
                address:
                  prefillIsPhone && prefill.address
                    ? formatPhoneNumber(prefill.address)
                    : "",
              },
            ],
      tags: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses",
  });

  function goToNewContact(contactId: string) {
    navigate({
      to: `/contacts/${contactId}`,
      hash: (prevHash: string | undefined) => prevHash!,
      // Replace rather than push: the contact now exists, so this form is a
      // dead end. The detail page steps back through history, and a pushed
      // entry would bounce the user into an empty "New contact" form instead
      // of the list (or the conversation) they came from.
      replace: true,
    });
  }

  function submit(data: ContactFormValues, strategy: "skip" | "merge") {
    createContact.mutate(
      { ...data, strategy },
      {
        onSuccess: (result) => {
          setPendingConflict(null);
          if (result.contact_id) goToNewContact(result.contact_id);
        },
      },
    );
  }

  async function onValidSubmit(data: ContactFormValues) {
    const conflict = await findConflictBeforeSubmit(buildAddresses(data));
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
    <>
      <SectionHeader title={t("New contact")} />

      <SectionBody>
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
                if (value && validateEmailField(value) === true) {
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

          {/* Reaches the AI agent's prompt on every message, and the agent
              appends its own dated lines here — see $contactId.tsx. */}
          <label>
            <div className="label">{t("Notes")}</div>
            <textarea
              className="text"
              rows={3}
              placeholder={t("Anything worth knowing about this contact")}
              {...register("notes")}
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
            // Instagram/Facebook addresses are platform ids, not numbers: show
            // the handle read-only rather than running an igsid through the
            // phone formatter (which turned it into a bogus "+1 05158…").
            if (field.service && field.service !== "whatsapp") {
              return (
                <label key={field.id}>
                  <div className="label">
                    {field.service === "instagram" ? "Instagram" : "Facebook"}
                  </div>
                  <input
                    type="text"
                    className="text"
                    value={
                      prefill.username
                        ? `@${prefill.username}`
                        : (field.address ?? "")
                    }
                    readOnly
                  />
                </label>
              );
            }

            const reg = register(`addresses.${idx}.address`, {
              validate: (value) =>
                !value || isValidPhoneNumber(value) || "Invalid number",
            });
            const rawValue = watch(`addresses.${idx}.address`);
            const conflict =
              rawValue && isValidPhoneNumber(rawValue)
                ? conflictsByAddress[normalizePhoneNumber(rawValue)]
                : undefined;

            return (
              <label key={field.id}>
                <div className="label">
                  {t("Phone")} {idx + 1}
                </div>
                <div className="flex items-center gap-2">
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

          {/* Add phone number button */}
          <button
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
            onClick={() => append({ address: "" })}
          >
            <Plus className="w-4 h-4" />
            {t("Add phone")}
          </button>

          {createContact.error && (
            <p className="text-destructive text-[13px]">
              {t("Could not save the contact. Please try again.")}
            </p>
          )}
          {createContact.data?.action === "skipped" && (
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
          loading={createContact.isPending}
          className="primary"
        >
          {t("Create")}
        </Button>
      </SectionFooter>

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
          loading={createContact.isPending}
          onConfirm={() => submit(pendingConflict.data, "merge")}
          onCancel={() => setPendingConflict(null)}
        />
      )}
    </>
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
