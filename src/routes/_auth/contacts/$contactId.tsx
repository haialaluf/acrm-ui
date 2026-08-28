import { useMemo, useState } from "react";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useContact,
  useDeleteContact,
  useUpdateContact,
} from "@/queries/useContacts";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import type {
  FieldArrayWithId,
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
} from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import ContactTagSelect from "@/components/ContactTagSelect";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Bot,
  Instagram,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import type {
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
import {
  useAddressConflicts,
  type AddressConflict,
} from "@/hooks/useAddressConflicts";
import { fill } from "@/utils/fill";
import InstagramAddressPicker, {
  type InstagramAddressRow,
} from "@/components/contacts/InstagramAddressPicker";
import ContactActivityTab from "@/components/contacts/ContactActivityTab";
import ContactLeadTab from "@/components/contacts/ContactLeadTab";
import { useIntegrations } from "@/hooks/useIntegrations";
import { joinNotes, splitNotes } from "@/utils/contactNotes";
import { useContactConversations } from "@/queries/useContactConversations";
import { threadKey } from "@/utils/ConversationUtils";

/** The form binds `notes` to the human half of the field only — the agents'
 *  dated lines are read-only above it and are re-joined on submit. */
type ContactFormValues = ContactWithAddressesUpdate;

type Tab = "details" | "notes" | "activity" | "lead";
type Channel = "whatsapp" | "instagram" | "email";

const CHANNELS: Channel[] = ["whatsapp", "instagram", "email"];

/** Phones, then Instagram, then email — so a row's index is stable as rows are
 *  added and each channel's group stays contiguous. */
const CHANNEL_ORDER: Record<string, number> = {
  whatsapp: 0,
  instagram: 1,
  email: 2,
};

/** The stored form of an address, per service: phone numbers are normalized to
 *  the routing key, email is lowercased, an igsid is already canonical. */
function storedAddress(service: string | null | undefined, address: string) {
  if (service === "instagram") return address;
  if (service === "email") return address.trim().toLowerCase();
  return normalizePhoneNumber(address);
}

export const Route = createFileRoute("/_auth/contacts/$contactId")({
  component: ContactDetail,
});

/** The RPC-shaped address list for only the NEW rows this submit would add —
 * addresses already on the contact can never collide with it. */
function buildNewAddresses(
  data: ContactFormValues,
  originalAddresses: Set<string>,
) {
  return (data.addresses ?? [])
    .filter((a) => a.address?.trim())
    .map((a) => ({
      service: a.service ?? "whatsapp",
      address: storedAddress(a.service, a.address!),
    }))
    .filter((a) => !originalAddresses.has(a.address));
}

function ContactDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
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
  const [tab, setTab] = useState<Tab>("details");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const { connected } = useIntegrations();

  // Track original addresses — phones and Instagram accounts already linked are
  // read-only, and only the rest need a conflict check.
  const originalAddresses = useMemo(
    () => new Set(contact?.addresses.map((a) => a.address) ?? []),
    [contact],
  );

  const conversations = useContactConversations(
    contactId,
    useMemo(() => contact?.addresses.map((a) => a.address) ?? [], [contact]),
  );

  // Instagram profile details (avatar, @username) are read live from the
  // linked address, which the webhook keeps fresh — they are not copied onto
  // the contact record.
  const igExtra = contact?.addresses.find((a) => a.service === "instagram")
    ?.extra as InstagramContactAddressExtra | null | undefined;

  // The agents' dated lines, shown above the box rather than inside it — see
  // utils/contactNotes.ts for the convention that separates them.
  const agentNotes = useMemo(
    () => splitNotes(contact?.notes).agent,
    [contact?.notes],
  );

  const formValues = useMemo(
    () =>
      contact && {
        ...contact,
        notes: splitNotes(contact.notes).human,
        addresses: [...contact.addresses].sort(
          (a, b) =>
            (CHANNEL_ORDER[a.service ?? "whatsapp"] ?? 0) -
            (CHANNEL_ORDER[b.service ?? "whatsapp"] ?? 0),
        ),
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

  const { fields, append, insert, remove } = useFieldArray({
    control,
    name: "addresses",
  });

  // Rows are numbered within their own channel, so a contact with two numbers
  // and two accounts reads "Phone 1, Phone 2, Account 1, Account 2" rather
  // than being numbered by position in one flat list.
  const numbering = new Map<string, number>();
  const counts: Record<Channel, number> = {
    whatsapp: 0,
    instagram: 0,
    email: 0,
  };
  for (const field of fields) {
    const service = (field.service ?? "whatsapp") as Channel;
    if (!(service in counts)) continue;
    counts[service] += 1;
    numbering.set(field.id, counts[service]);
  }

  /** Insert a blank row at the end of its channel's group, so adding a phone
   *  never lands it below the Instagram or email rows. */
  function addRow(service: Channel) {
    let at = fields.length;
    for (let i = fields.length - 1; i >= 0; i--) {
      if ((fields[i].service ?? "whatsapp") === service) {
        at = i + 1;
        break;
      }
      if ((CHANNEL_ORDER[fields[i].service ?? "whatsapp"] ?? 0) < CHANNEL_ORDER[service]) {
        at = i + 1;
        break;
      }
      at = i;
    }
    insert(at, { address: "", service });
  }

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
      {
        ...data,
        // Put the human block back among the agents' lines before storing.
        notes: joinNotes(contact?.notes, data.notes ?? ""),
        addresses: (data.addresses ?? [])
          .filter((a) => a.address?.trim())
          .map((a) => ({ ...a, address: storedAddress(a.service, a.address!) })),
        strategy,
      },
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

  function openConversation() {
    const conversation = conversations.data?.[0];
    if (!conversation) return;
    void navigate({ to: "/conversations", hash: threadKey(conversation) });
  }

  const channelRows = fields
    .map((field, idx) => ({ field, idx }))
    .filter(({ field }) => (field.service ?? "whatsapp") === channel);

  return (
    contact && (
      <>
        <SectionHeader
          title={t("Contact")}
          // The contact page is opened both from the contacts list and from a
          // chat's header, so the depth-based `to=".."` back link is wrong half
          // the time — it always lands on /contacts. Step back through history
          // instead, falling back to the list on a direct/deep-link entry.
          onBack={() => {
            if (router.history.canGoBack()) {
              router.history.back();
            } else {
              void navigate({ to: "..", hash: (prevHash) => prevHash! });
            }
          }}
          onDelete={() => {
            deleteContact.mutate(contactId, {
              onSuccess: () =>
                navigate({ to: "..", hash: (prevHash) => prevHash! }),
            });
          }}
          deleteLoading={deleteContact.isPending}
        />

        {/* Identity + tabs. Sticky above the panel's scroll so the name and the
            tab you are on stay visible however long the tab's content runs. */}
        <div className="bg-sidebar border-b border-border px-[20px] pt-[14px] shrink-0 flex flex-col gap-[14px]">
          <div className="flex items-center gap-[12px]">
            <Avatar
              src={igExtra?.profile_picture_url}
              fallback={nameInitials(contact.name || igExtra?.username || "?")}
              size={52}
              className="bg-accent text-accent-foreground border border-border text-[18px] shrink-0"
            />
            <div className="flex flex-col gap-[4px] grow min-w-0">
              <div className="text-[18px] font-semibold text-card-foreground truncate">
                {contact.name || t("No name")}
              </div>
              {igExtra?.username && (
                <div className="text-[13px] text-muted-foreground truncate">
                  @{igExtra.username}
                </div>
              )}
            </div>
            {conversations.data?.length ? (
              <button
                type="button"
                className="w-[40px] h-[40px] rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0"
                title={t("Open conversation")}
                onClick={openConversation}
              >
                <MessageSquare className="w-[18px] h-[18px]" />
              </button>
            ) : null}
          </div>

          <div className="flex gap-[22px]">
            {(["details", "notes", "activity", "lead"] as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                className={
                  "text-[14px] py-[12px] px-[4px] border-b-2 " +
                  (tab === key
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent")
                }
                onClick={() => setTab(key)}
              >
                {t(
                  key === "details"
                    ? "Details"
                    : key === "notes"
                      ? "Notes"
                      : key === "activity"
                        ? "Activity"
                        : "Lead",
                )}
              </button>
            ))}
          </div>
        </div>

        <SectionBody>
          {/* One form across the tabs: switching tabs must not drop what was
              typed on another, so both editable tabs stay mounted and the
              inactive one is hidden rather than unmounted. */}
          {/* `form` is `flex-grow` in the base layer, so an empty one would
              still claim the panel and push a read-only tab's content below
              the fold — it is hidden outright rather than emptied. */}
          <form
            id="contact-form"
            className={tab === "details" || tab === "notes" ? "" : "hidden"}
            onSubmit={handleSubmit(onValidSubmit)}
          >
            <div className={tab === "details" ? "contents" : "hidden"}>
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

              <div>
                <div className="label">{t("Channels")}</div>

                {/* One channel at a time. The count on each chip is what keeps
                    an empty channel visible without opening it. Below md the
                    three named chips overflow the panel, so only the open one
                    keeps its name there — the icon and the count carry the
                    other two, and the row still fits without scrolling. */}
                <div className="flex gap-[8px] mb-[18px]">
                  {CHANNELS.map((key) => {
                    const label =
                      key === "whatsapp"
                        ? "WhatsApp"
                        : key === "instagram"
                          ? "Instagram"
                          : t("Email");
                    return (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-pressed={channel === key}
                        className={
                          "text-[14px] text-nowrap px-[12px] py-[6px] rounded-full flex items-center gap-[6px] " +
                          (channel === key
                            ? "text-foreground bg-primary/10 border border-primary"
                            : "text-foreground bg-background hover:bg-accent border border-border")
                        }
                        onClick={() => setChannel(key)}
                      >
                        {key === "whatsapp" ? (
                          <MessageCircle className="w-[15px] h-[15px] text-[#25D366]" />
                        ) : key === "instagram" ? (
                          <Instagram className="w-[15px] h-[15px] text-[#E1306C]" />
                        ) : (
                          <Mail className="w-[15px] h-[15px] text-blue-500" />
                        )}
                        <span
                          className={channel === key ? "" : "hidden md:inline"}
                        >
                          {label}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          {counts[key]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-[12px]">
                  {channelRows.map(({ field, idx }, position) => (
                    <div key={field.id}>
                      {position > 0 && (
                        <div className="h-px bg-border mb-[12px]" />
                      )}
                      <AddressRow
                        channel={channel}
                        number={numbering.get(field.id) ?? 1}
                        field={field}
                        idx={idx}
                        isExisting={originalAddresses.has(field.address ?? "")}
                        register={register}
                        watch={watch}
                        errors={errors}
                        conflictsByAddress={conflictsByAddress}
                        checkOnBlur={checkOnBlur}
                        onRemove={() => remove(idx)}
                        t={t}
                      />
                    </div>
                  ))}

                  {/* Instagram is a picker rather than a text field: its
                      addresses are igsids we can only learn from an inbound
                      message (see InstagramAddressPicker), so there is nothing
                      meaningful to type. */}
                  {channel === "instagram" ? (
                    connected.instagram && (
                      <AddButton
                        icon={<Instagram className="w-4 h-4" />}
                        label={t("Add Instagram")}
                        onClick={() => setPickingInstagram(true)}
                      />
                    )
                  ) : (
                    <AddButton
                      icon={<Plus className="w-4 h-4" />}
                      label={
                        channel === "email" ? t("Add email") : t("Add phone")
                      }
                      onClick={() => addRow(channel)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Shared with the AI agents, in both directions: what is typed
                here reaches their prompt on every message, and they append
                their own dated lines through `update_contact`. Those lines are
                listed above the box rather than mixed into it, so an edit here
                cannot quietly delete what an agent learned. */}
            <div className={tab === "notes" ? "contents" : "hidden"}>
              <div className="flex flex-col gap-[10px]">
                <div className="flex items-center gap-[7px] w-fit bg-accent text-accent-foreground rounded-full ps-[10px] pe-[12px] py-[6px] text-[12px]">
                  <Bot className="w-[14px] h-[14px]" />
                  {t("Your AI agents read everything here")}
                </div>
              </div>

              {agentNotes.length > 0 && (
                <div className="flex flex-col gap-[16px]">
                  <div className="label mb-0">{t("Written by your agents")}</div>
                  {agentNotes.map((note, idx) => (
                    <div key={`${note.date}-${idx}`}>
                      {idx > 0 && <div className="h-px bg-border mb-[16px]" />}
                      <div className="flex gap-[10px]">
                        <Bot className="w-[16px] h-[16px] mt-[3px] shrink-0 text-muted-foreground" />
                        <div className="grow min-w-0">
                          <div className="text-[11.5px] text-muted-foreground">
                            {note.date}
                          </div>
                          <div className="text-[15px] leading-relaxed mt-[3px]">
                            {note.text}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label>
                <div className="label">{t("Your notes")}</div>
                <textarea
                  className="text border border-input rounded-[12px] px-[14px] py-[12px] min-h-[92px]"
                  rows={3}
                  placeholder={t("Anything worth knowing about this contact")}
                  {...register("notes")}
                />
                <div className="text-muted-foreground text-[11.5px] mt-[6px]">
                  {t("Free text — your agents never edit this part")}
                </div>
              </label>
            </div>

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

          {tab === "activity" && <ContactActivityTab contact={contact} />}
          {tab === "lead" && <ContactLeadTab contact={contact} />}
        </SectionBody>

        <SectionFooter>
          {tab === "details" || tab === "notes" ? (
            <Button
              form="contact-form"
              type="submit"
              invalid={!isValid || !isDirty}
              loading={updateContact.isPending}
              className="primary"
            >
              {t("Update")}
            </Button>
          ) : (
            <Button
              type="button"
              className="primary"
              disabled={!conversations.data?.length}
              onClick={openConversation}
            >
              {t("Open conversation")}
            </Button>
          )}
        </SectionFooter>

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


/**
 * One address, rendered by the rules of its own channel.
 *
 * The three differ in what can be edited, not just in how they look: a phone
 * already linked is read-only (removing and re-adding is the only way to
 * change the routing key), an Instagram row is always read-only because its
 * address is an igsid nobody can type, and an email stays editable so a typo
 * can be corrected in place — the update diffs addresses, so editing one
 * unlinks the old and links the new.
 */
function AddressRow({
  channel,
  number,
  field,
  idx,
  isExisting,
  register,
  watch,
  errors,
  conflictsByAddress,
  checkOnBlur,
  onRemove,
  t,
}: {
  channel: Channel;
  number: number;
  field: FieldArrayWithId<ContactFormValues, "addresses", "id">;
  idx: number;
  isExisting: boolean;
  register: UseFormRegister<ContactFormValues>;
  watch: UseFormWatch<ContactFormValues>;
  errors: FieldErrors<ContactFormValues>;
  conflictsByAddress: Record<string, AddressConflict>;
  checkOnBlur: (service: string, address: string) => void;
  onRemove: () => void;
  t: (s: string) => string;
}) {
  const extra = field.extra as
    | { synced?: { action?: string }; username?: string }
    | undefined;
  // A synced address is owned by the phone's contact book, not by this form:
  // `manage_contact_on_address_sync` restores the link on any UPDATE that nulls
  // contact_id, so a delete here would silently come back on the next refetch.
  // Point the user at the one place the removal actually sticks instead of
  // offering an X that does nothing.
  const isSynced = extra?.synced?.action === "add";
  const label =
    channel === "whatsapp"
      ? `${t("Phone")} ${number}`
      : channel === "instagram"
        ? `${t("Account")} ${number}`
        : `${t("Email")} ${number}`;

  const removeButton = (
    <button
      type="button"
      className="p-[8px] rounded-full hover:bg-muted transition-colors shrink-0"
      onClick={onRemove}
      title={t("Delete")}
    >
      <X className="w-5 h-5" />
    </button>
  );

  if (channel === "instagram") {
    const conflict = isExisting
      ? undefined
      : conflictsByAddress[field.address ?? ""];

    return (
      <label>
        <div className="flex items-center gap-[6px] mb-[5px]">
          <div className="label mb-0 grow">{label}</div>
          {isSynced && <Chip>{t("Synced")}</Chip>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="text"
            value={
              extra?.username ? `@${extra.username}` : (field.address ?? "")
            }
            readOnly
          />
          {!isSynced && removeButton}
        </div>
        {conflict && <ConflictWarning conflict={conflict} t={t} />}
      </label>
    );
  }

  if (channel === "email") {
    const reg = register(`addresses.${idx}.address`, {
      validate: (value) => !value || validateEmailField(value),
    });
    const raw = watch(`addresses.${idx}.address`);
    const normalized = raw?.trim().toLowerCase() ?? "";
    const conflict =
      normalized && !isExisting ? conflictsByAddress[normalized] : undefined;
    // Set by SES on a hard bounce or a complaint against this exact mailbox.
    // Shown rather than hidden: sending skips an inactive row silently, and
    // an address that looks fine but is never used is the confusing case.
    const isBounced = field.status === "inactive";

    return (
      <label>
        <div className="flex items-center gap-[6px] mb-[5px]">
          <div className="label mb-0 grow">{label}</div>
          {isBounced && <Chip tone="destructive">{t("Bounced")}</Chip>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="email"
            className={`text ${errors.addresses?.[idx]?.address ? "border-destructive" : ""} ${isBounced ? "text-muted-foreground" : ""}`}
            placeholder={t("email@example.com")}
            {...reg}
            onBlur={(e) => {
              void reg.onBlur(e);
              const value = e.target.value.trim().toLowerCase();
              if (value && validateEmailField(value) === true && !isExisting) {
                checkOnBlur("email", value);
              }
            }}
          />
          {removeButton}
        </div>
        <FieldError error={errors.addresses?.[idx]?.address} />
        <EmailSuggestion value={raw} />
        {conflict && <ConflictWarning conflict={conflict} t={t} />}
      </label>
    );
  }

  // A saved number is shown, never edited — so it must NOT be registered.
  // `register` with a rule but no element attached leaves react-hook-form
  // validating a field that can never show an error: the address is stored
  // digits-only ("46762945584"), which `isValidPhoneNumber` rejects because it
  // parses neither as international nor against DEFAULT_COUNTRY, so `isValid`
  // went false and the Update button died with nothing on screen to explain
  // it. Israeli numbers happened to survive the DEFAULT_COUNTRY retry, which
  // is why this only ever showed up on foreign numbers.
  if (isExisting) {
    return (
      <label>
        <div className="flex items-center gap-[6px] mb-[5px]">
          <div className="label mb-0 grow">{label}</div>
          {isSynced && <Chip>{t("Synced")}</Chip>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="tel"
            className="text"
            value={formatPhoneNumber(field.address || "")}
            readOnly
          />
          {!isSynced && removeButton}
        </div>
        {isSynced && (
          <div className="text-muted-foreground text-[11.5px] mt-[3px]">
            {t(
              "This number comes from your phone's contacts — remove it there to remove it here",
            )}
          </div>
        )}
      </label>
    );
  }

  const reg = register(`addresses.${idx}.address`, {
    validate: (value) => !value || isValidPhoneNumber(value) || "Invalid number",
  });
  const raw = watch(`addresses.${idx}.address`);
  const conflict =
    raw && isValidPhoneNumber(raw)
      ? conflictsByAddress[normalizePhoneNumber(raw)]
      : undefined;

  return (
    <label>
      <div className="flex items-center gap-[6px] mb-[5px]">
        <div className="label mb-0 grow">{label}</div>
        {isSynced && <Chip>{t("Synced")}</Chip>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="tel"
          className={`text ${errors.addresses?.[idx]?.address ? "border-destructive" : ""}`}
          placeholder={t("+54 9 11 1234 5678")}
          {...reg}
          onBlur={(e) => {
            void reg.onBlur(e);
            if (e.target.value && isValidPhoneNumber(e.target.value)) {
              checkOnBlur("whatsapp", normalizePhoneNumber(e.target.value));
            }
          }}
        />
        {!isSynced && removeButton}
      </div>
      {isSynced && (
        <div className="text-muted-foreground text-[11.5px] mt-[3px]">
          {t(
            "This number comes from your phone's contacts — remove it there to remove it here",
          )}
        </div>
      )}
      <FieldError error={errors.addresses?.[idx]?.address} />
      {conflict && <ConflictWarning conflict={conflict} t={t} />}
    </label>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "destructive";
}) {
  return (
    <span
      className={
        "text-[11px] rounded-full px-[8px] py-[2px] shrink-0 " +
        (tone === "destructive"
          ? "bg-destructive/12 text-destructive"
          : "bg-accent text-accent-foreground")
      }
    >
      {children}
    </span>
  );
}

function AddButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-[13px] py-[6px] rounded-full font-medium transition-colors w-fit text-[13px] flex items-center gap-2 mt-[4px]"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

export default ContactDetail;

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
