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
import type { ContactWithAddressesInsert } from "@/supabase/client";
import {
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

export const Route = createFileRoute("/_auth/contacts/new")({
  component: ContactNew,
});

/** The RPC-shaped address list this form's fields resolve to. */
function buildAddresses(data: ContactFormValues) {
  return [
    ...data.addresses
      .filter((a) => a.address)
      .map((a) => ({
        service: "whatsapp",
        address: normalizePhoneNumber(a.address!),
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

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { isValid, isDirty, errors },
  } = useForm<ContactFormValues>({
    mode: "onTouched",
    defaultValues: {
      addresses: [{ address: "" }],
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
