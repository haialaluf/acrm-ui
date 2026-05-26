import {
  useState,
  useEffect,
  type FormEventHandler,
  useMemo,
} from "react";
import useBoundStore from "@/stores/useBoundStore";
import { type TemplateMessage, type TemplateData } from "@/supabase/client";
import { OutMessage, InMessage, TextMessage } from "./Message/Message";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ButtonKindIcon,
  buttonDefToPreview,
  buttonSendComponents,
} from "./templateButtons";

export default function TemplatePreview({
  template: { name, language, components },
  sendTemplateMessage,
  editMode = false,
}: {
  template: TemplateData;
  sendTemplateMessage?: (
    template: TemplateMessage["template"],
    body: string,
    header?: string,
    footer?: string,
  ) => void;
  editMode?: boolean;
}) {
  "use no memo";
  const toggle = useBoundStore((store) => store.ui.toggle);
  const { translate: t } = useTranslation();

  const headMemo = useMemo(
    () => components.find((c) => c.type === "HEADER"),
    [components],
  );
  const bodyMemo = useMemo(
    () => components.find((c) => c.type === "BODY")!,
    [components],
  );
  const footMemo = useMemo(
    () => components.find((c) => c.type === "FOOTER"),
    [components],
  );
  const buttMemo = useMemo(
    () => components.find((c) => c.type === "BUTTONS"),
    [components],
  );

  // In editMode, bypass memos to always reflect latest form values
  const head = editMode ? components.find((c) => c.type === "HEADER") : headMemo;
  const body = editMode ? components.find((c) => c.type === "BODY")! : bodyMemo;
  const foot = editMode ? components.find((c) => c.type === "FOOTER") : footMemo;
  const butt = editMode ? components.find((c) => c.type === "BUTTONS") : buttMemo;

  let headPlaceholders = head?.text;
  let bodyPlaceholders = body.text;

  const headExamples = head?.example?.header_text || [];
  const bodyExamplesMemo = useMemo(
    () => body.example?.body_text[0] || [],
    [body.example?.body_text],
  );
  const bodyExamples = editMode ? (body.example?.body_text[0] || []) : bodyExamplesMemo;

  const buttons = butt?.buttons;

  // Quick replies render as pills outside the bubble (à la WhatsApp); CTA
  // buttons (link / call / copy) stack inside it, divided by hairlines.
  const previewButtons =
    buttons?.map((b) => buttonDefToPreview(b, t("Copiar código"))) || [];
  const qrButtons = previewButtons.filter((b) => b.kind === "QR");
  const ctaButtons = previewButtons.filter((b) => b.kind !== "QR");

  const [headValues, setHeadValues] = useState(headExamples);
  const [bodyValues, setBodyValues] = useState(bodyExamples);

  useEffect(() => {
    if (!editMode) setBodyValues(bodyExamples);
  }, [bodyExamples]);

  // In editMode, use examples directly from props (no internal state needed)
  const effectiveHeadValues = editMode ? headExamples : headValues;
  const effectiveBodyValues = editMode ? bodyExamples : bodyValues;

  let idx = 1;
  for (const value of effectiveHeadValues) {
    headPlaceholders = headPlaceholders?.replaceAll(
      `{{${idx}}}`,
      editMode
        ? value
        : `<span id="${idx}" class="templateField templateHeader" contentEditable>${value}</span>`,
    );
    idx++;
  }

  idx = 1;
  for (const value of effectiveBodyValues) {
    bodyPlaceholders = bodyPlaceholders.replaceAll(
      `{{${idx}}}`,
      editMode
        ? value
        : `<span id="${idx}" class="templateField templateBody" contentEditable>${value}</span>`,
    );
    idx++;
  }

  const onInputHandler: FormEventHandler<HTMLDivElement> = (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    //@ts-expect-error Property 'id' does not exist on type 'NamedNodeMap'
    const idx = Number(event.target.attributes.id.value) - 1;

    //@ts-expect-error Property 'class' does not exist on type 'NamedNodeMap'
    if (event.target.attributes.class.value.includes("templateHeader")) {
      headValues[idx] = event.target.textContent || "???";
      setHeadValues(headValues);
    } else {
      bodyValues[idx] = event.target.textContent || "???";
      setBodyValues(bodyValues);
    }
  };

  const sendHandler = () => {
    if (!sendTemplateMessage) {
      return;
    }

    let headContent = head?.text;
    let bodyContent = body.text;
    const components = [];

    if (headValues.length) {
      let idx = 1;
      for (const value of headValues) {
        headContent = headContent?.replaceAll(`{{${idx}}}`, value);
        idx++;
      }

      components.push({
        type: "header",
        parameters: headValues.map((text) => ({ type: "text", text })),
      });
    }

    if (bodyValues.length) {
      idx = 1;
      for (const value of bodyValues) {
        bodyContent = bodyContent.replaceAll(`{{${idx}}}`, value);
        idx++;
      }

      components.push({
        type: "body",
        parameters: bodyValues.map((text) => ({ type: "text", text })),
      });
    }

    if (buttons) {
      components.push(...buttonSendComponents(buttons));
    }

    const template = {
      name,
      language: {
        code: language,
        policy: "deterministic" as const,
      },
    };

    if (components.length) {
      //@ts-expect-error
      template["components"] = components;
    }

    sendTemplateMessage(template, bodyContent, headContent, foot?.text);
    toggle("templatePicker");
  };

  const Message = editMode ? InMessage : OutMessage;

  return (
    <div className="relative mx-[16px]">
      <Message first text>
        <TextMessage
          header={headPlaceholders}
          body={bodyPlaceholders}
          footer={foot?.text}
          buttons={ctaButtons}
          direction="outgoing"
          onInput={onInputHandler}
        />
      </Message>
      {qrButtons.length > 0 && (
        <div
          className={
            "flex flex-wrap gap-[6px] mt-[8px] " +
            (editMode ? "justify-start" : "justify-end")
          }
        >
          {qrButtons.map((b, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-[6px] bg-popover text-primary rounded-full px-[14px] py-[6px] text-[14px] font-medium shadow-sm"
            >
              <ButtonKindIcon kind="QR" className="w-[13px] h-[13px]" />
              {b.text}
            </div>
          ))}
        </div>
      )}
      {sendTemplateMessage && (
        <button
          className="p-[8px] absolute right-[16px] top-0"
          onClick={sendHandler}
        >
          <svg className="send-icon w-[24px] h-[24px] text-gray-icon">
            <use href="/icons.svg#send" />
          </svg>
        </button>
      )}
    </div>
  );
}
