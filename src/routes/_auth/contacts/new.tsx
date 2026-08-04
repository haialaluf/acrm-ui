import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useCreateContact } from "@/queries/useContacts";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import ContactTagSelect from "@/components/ContactTagSelect";
import { Plus, X } from "lucide-react";
import type { ContactWithAddressesInsert } from "@/supabase/client";
import { isValidPhoneNumber } from "@/utils/FormatUtils";
import FieldError from "@/components/FieldError";

// `tags` is a contacts column not yet present in the generated db_types.ts;
// remove this once ContactWithAddressesInsert includes it (see useContactTags).
type ContactFormValues = ContactWithAddressesInsert & {
  tags?: string[];
  email?: string | null;
};

export const Route = createFileRoute("/_auth/contacts/new")({
  component: ContactNew,
});

function ContactNew() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const createContact = useCreateContact();

  const {
    register,
    handleSubmit,
    control,
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

  return (
    <>
      <SectionHeader title={t("New contact")} />

      <SectionBody>
        <form
          id="contact-form"
          onSubmit={handleSubmit((data) =>
            createContact.mutate(data, {
              onSuccess: (contact) =>
                navigate({
                  to: `/contacts/${contact.id}`,
                  hash: (prevHash: string | undefined) => prevHash!,
                }),
            }),
          )}
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

          {fields.map((field, idx) => (
            <label key={field.id}>
              <div className="label">
                {t("Phone")} {idx + 1}
              </div>
              <div className="flex items-center gap-2">
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
          ))}

          {/* Add phone number button */}
          <button
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
            onClick={() => append({ address: "" })}
          >
            <Plus className="w-4 h-4" />
            {t("Add phone")}
          </button>
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
    </>
  );
}
