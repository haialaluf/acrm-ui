//===================================
// Mirrored from open-bsp-api/.../_shared/types/whatsapp_template_types.ts
//
// To re-sync: paste the API file over this one, then re-apply each line tagged
// `// @ui-divergence` below (run `scripts/check-type-sync.sh` to list them).
//===================================

import type {
  OutgoingDocument,
  OutgoingImage,
  OutgoingVideo,
} from "./whatsapp_endpoint_types";

// Template data, used to create or update a template message

export type TemplateData = {
  id: string;
  name: string;
  status:
    | "APPROVED"
    | "IN_APPEAL"
    | "PENDING"
    | "REJECTED"
    | "PENDING_DELETION"
    | "DELETED"
    | "DISABLED"
    | "PAUSED"
    | "LIMIT_EXCEEDED";
  // @ui-divergence: category includes "UTILITY" (API: only "MARKETING").
  category: "MARKETING" | "UTILITY"; // TODO: service and auth categories - cabra 2024/09/12
  language: string;
  components: (
    | BodyComponent
    | HeaderComponent
    | FooterComponent
    | ButtonsComponent
  )[];
  sub_category: "CUSTOM";
};

type HeaderComponent = {
  type: "HEADER";
  text: string;
  format: "TEXT"; // TODO: other formats such as image - cabra 2024/09/12
  example?: {
    header_text: [string];
  };
};

type BodyComponent = {
  type: "BODY";
  text: string;
  example?: {
    body_text: [string[]];
  };
};

type FooterComponent = {
  type: "FOOTER";
  text: string;
};

type ButtonsComponent = {
  type: "BUTTONS";
  // @ui-divergence: full call-to-action button support (API: QuickReply[] only).
  buttons: TemplateButtonDef[];
};

// @ui-divergence: buttons attached to a template definition (create/update).
// These mirror Meta's Cloud API button shapes and are sent through verbatim by
// the `whatsapp-management/templates` edge function.
type QuickReplyButton = {
  type: "QUICK_REPLY";
  text: string;
};

type UrlButton = {
  type: "URL";
  text: string;
  url: string; // may end with {{1}} when dynamic
  example?: [string]; // sample URL with {{1}} filled in (required by Meta for dynamic URLs)
};

type PhoneButton = {
  type: "PHONE_NUMBER";
  text: string;
  phone_number: string; // E.164, e.g. +97235550100
};

type CopyCodeButton = {
  type: "COPY_CODE";
  example: string; // sample coupon code; the button label is fixed by WhatsApp
};

export type TemplateButtonDef =
  | QuickReplyButton
  | UrlButton
  | PhoneButton
  | CopyCodeButton;

// Template message, used to send a template message

type CurrencyParameter = {
  type: "currency";
  currency: {
    fallback_value: string;
    code: string; // ISO 4217
    amount_1000: number;
  };
};

type DateTimeParameter = {
  type: "date_time";
  date_time: {
    fallback_value: string;
    // localization is not attempted by Cloud API, fallback_value is always used
  };
};

type TextParameter = {
  type: "text";
  text: string;
};

type TemplateParameter =
  | CurrencyParameter
  | DateTimeParameter
  | TextParameter
  | OutgoingImage
  | OutgoingVideo
  | OutgoingDocument;

type TemplateHeader = {
  type: "header";
  parameters?: TemplateParameter[];
};

type TemplateBody = {
  type: "body";
  parameters?: TemplateParameter[];
};

export type TemplateButton = {
  type: "button";
  index: string; // 0-9
} & (
  | {
      sub_type: "quick_reply";
      parameters: {
        type: "payload";
        payload: string;
      }[];
    }
  | {
      sub_type: "url";
      parameters: {
        // @ui-divergence: value substituted into the URL's {{1}} suffix (API: type "url").
        type: "text";
        text: string;
      }[];
    }
  // @ui-divergence: copy_code button support for coupon templates.
  | {
      sub_type: "copy_code";
      parameters: {
        type: "coupon_code";
        coupon_code: string;
      }[];
    }
);

export type Template = {
  components?: (TemplateHeader | TemplateBody | TemplateButton)[];
  language: {
    code: string; // es, es_AR, etc
    policy: "deterministic";
  };
  name: string;
};

export type TemplateMessage = {
  type: "template";
  template: Template;
};
