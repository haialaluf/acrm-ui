import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Loader2,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import ContactTagSelect from "@/components/ContactTagSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { isRtl, type Language } from "@/stores/uiSlice";
import { useContacts } from "@/queries/useContacts";
import {
  useImportContacts,
  type ImportContactsResult,
} from "@/queries/useImportContacts";
import {
  EmptyFileError,
  parseContactsFile,
  PREVIEW_ROWS,
  UnsupportedFileError,
  type ParsedFile,
} from "@/utils/parseContactsFile";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/utils/FormatUtils";

export const Route = createFileRoute("/_auth/contacts/import")({
  component: ImportContacts,
});

type ImportState = "pick" | "uploaded" | "importing" | "done";
type RowStatus = "ok" | "err" | "dup";
type Mapping = {
  name: number | null;
  phone: number | null;
  email: number | null;
};

/** A parsed row resolved against the chosen column mapping. */
type ResolvedRow = {
  status: RowStatus;
  name: string;
  phone: string;
  email: string;
  /** Existing contact this row duplicates, when status === "dup". */
  existing?: { id: string; tags: string[] };
};

const NAME_RE = /name|nombre|שם/i;
const PHONE_RE = /phone|mobile|tel|tel[eé]fono|טלפון|נייד/i;
const EMAIL_RE = /mail|correo|email|אימייל/i;

function detect(headers: string[], re: RegExp): number | null {
  const i = headers.findIndex((h) => re.test(h));
  return i === -1 ? null : i;
}

function ImportContacts() {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const { data: contacts } = useContacts();
  const importContacts = useImportContacts();

  const [state, setState] = useState<ImportState>("pick");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    name: null,
    phone: null,
    email: null,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [skipDupes, setSkipDupes] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportContactsResult | null>(null);

  // Real progress reported by the mutation as each batch / update resolves.
  const { processed, total } = importContacts.progress;
  const progress = total ? Math.round((processed / total) * 100) : 0;

  /** `{n}`-style interpolation on top of the dictionary lookup. */
  const fill = (key: string, vars: Record<string, string | number>) => {
    let s = t(key);
    for (const [k, v] of Object.entries(vars))
      s = s.replace(`{${k}}`, String(v));
    return s;
  };

  // Existing phone numbers (stored normalized in the DB) → contact, for dup checks.
  const existingByPhone = useMemo(() => {
    const map = new Map<string, { id: string; tags: string[] }>();
    for (const contact of contacts ?? []) {
      const tagList = (contact as { tags?: string[] | null }).tags ?? [];
      for (const addr of contact.addresses ?? []) {
        if (addr.address)
          map.set(addr.address, { id: contact.id, tags: tagList });
      }
    }
    return map;
  }, [contacts]);

  // Classify every row against the current mapping (recomputes when the user
  // overrides a column). Required fields: name + phone.
  const rows = useMemo<ResolvedRow[]>(() => {
    if (!file) return [];
    return file.allRows.map((row) => {
      const name = mapping.name != null ? (row[mapping.name] ?? "").trim() : "";
      const phone =
        mapping.phone != null ? (row[mapping.phone] ?? "").trim() : "";
      const email =
        mapping.email != null ? (row[mapping.email] ?? "").trim() : "";

      if (
        mapping.name == null ||
        mapping.phone == null ||
        !name ||
        !phone ||
        !isValidPhoneNumber(phone)
      ) {
        return { status: "err", name, phone, email };
      }
      const existing = existingByPhone.get(normalizePhoneNumber(phone));
      if (existing) return { status: "dup", name, phone, email, existing };
      return { status: "ok", name, phone, email };
    });
  }, [file, mapping, existingByPhone]);

  // Rows shown in the preview table: error rows first (wherever they appear in
  // the file), then the rest in original order, capped at PREVIEW_ROWS.
  const previewRows = useMemo(() => {
    if (!file) return [];
    return file.allRows
      .map((cells, i) => ({ cells, status: rows[i]?.status ?? "ok" }))
      .sort(
        (a, b) => (a.status === "err" ? 0 : 1) - (b.status === "err" ? 0 : 1),
      )
      .slice(0, PREVIEW_ROWS);
  }, [file, rows]);

  const counts = useMemo(() => {
    let ok = 0,
      err = 0,
      dup = 0;
    for (const r of rows) {
      if (r.status === "ok") ok++;
      else if (r.status === "err") err++;
      else dup++;
    }
    return { ok, err, dup, total: rows.length };
  }, [rows]);

  const importableCount = skipDupes ? counts.ok : counts.ok + counts.dup;
  const mappingReady = mapping.name != null && mapping.phone != null;

  function resetToPick() {
    setFile(null);
    setTags([]);
    setResult(null);
    setParseError(null);
    setMapping({ name: null, phone: null, email: null });
    setState("pick");
  }

  async function handleFile(picked: File | undefined) {
    if (!picked) return;
    setParseError(null);
    try {
      const parsed = await parseContactsFile(picked);
      setMapping({
        name: detect(parsed.headers, NAME_RE),
        phone: detect(parsed.headers, PHONE_RE),
        email: detect(parsed.headers, EMAIL_RE),
      });
      setFile(parsed);
      setState("uploaded");
    } catch (e) {
      if (e instanceof UnsupportedFileError) {
        setParseError(t("Formato de archivo no compatible. Usa CSV o Excel."));
      } else if (e instanceof EmptyFileError) {
        setParseError(t("El archivo está vacío"));
      } else {
        setParseError(t("No se pudo leer el archivo"));
      }
    }
  }

  function startImport() {
    // Split rows into inserts vs. updates based on the dedup options.
    const okRows = rows.filter((r) => r.status === "ok");
    const dupRows = rows.filter((r) => r.status === "dup");

    let toInsert = okRows;
    let toUpdate: ResolvedRow[] = [];
    if (!skipDupes) {
      if (updateExisting) toUpdate = dupRows;
      else toInsert = [...okRows, ...dupRows];
    }

    setState("importing");

    importContacts.mutate(
      {
        contacts: toInsert.map((r) => ({
          name: r.name || null,
          phone: r.phone,
          email: r.email || null,
        })),
        updates: toUpdate.map((r) => ({
          contactId: r.existing!.id,
          existingTags: r.existing!.tags,
        })),
        tags,
      },
      {
        onSuccess: (res) => {
          setResult(res);
          // Let the bar reach 100% before flipping to the done screen.
          setTimeout(() => setState("done"), 350);
        },
        onError: () => {
          setParseError(t("No se pudo leer el archivo"));
          setState("uploaded");
        },
      },
    );
  }

  const rtl = isRtl(currentLanguage as Language);
  const importedTotal = result
    ? result.added + result.updated
    : importableCount;

  return (
    <>
      <SectionHeader
        title={t("Importar contactos")}
        onDelete={state === "uploaded" ? resetToPick : undefined}
      />

      <SectionBody>
        <div className="flex flex-col gap-[20px] px-[10px] pb-[10px]">
          {/* ─────────── PICK ─────────── */}
          {state === "pick" && (
            <>
              <p>
                {t(
                  "Importa una lista de contactos desde un archivo CSV o Excel. El sistema detectará automáticamente la estructura del archivo — nombre, teléfono y email. Todos los contactos importados recibirán las etiquetas que elijas.",
                )}
              </p>
              <DropZone onPick={handleFile} t={t} />
              {parseError && (
                <div
                  className="flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]"
                  style={{
                    background: "oklch(from var(--warning) l c h / 0.1)",
                    color: "oklch(from var(--warning) calc(l - 0.27) c h)",
                  }}
                >
                  <TriangleAlert className="w-4 h-4 mt-[1px] shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </>
          )}

          {/* ─────────── UPLOADED ─────────── */}
          {state === "uploaded" && file && (
            <div className="flex flex-col gap-[20px] import-animate-in">
              <FileCard file={file} onRemove={resetToPick} t={t} />

              <ValidationBanner
                counts={counts}
                skipDupes={skipDupes}
                importable={importableCount}
                fill={fill}
                t={t}
              />

              {/* Preview */}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <div className="label" style={{ margin: 0 }}>
                    {t("Vista previa")}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {fill("{n} de {m} filas", {
                      n: previewRows.length,
                      m: file.rows,
                    })}
                  </div>
                </div>
                <div
                  className="rounded-xl overflow-auto"
                  style={{ border: "1px solid var(--border)", maxHeight: 260 }}
                >
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}></th>
                        {file.headers.map((h, i) => (
                          <th key={i}>
                            <div className="flex items-center gap-1">
                              {h}
                              <FieldRoleChip mapping={mapping} idx={i} t={t} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map(({ cells, status }, ri) => (
                        <tr
                          key={ri}
                          className={
                            status === "err"
                              ? "row-error"
                              : status === "dup"
                                ? "row-dupe"
                                : ""
                          }
                        >
                          <td>
                            {status === "err" && (
                              <span className="row-tag err">!</span>
                            )}
                            {status === "dup" && (
                              <span className="row-tag dup">⎘</span>
                            )}
                            {status === "ok" && (
                              <span className="row-tag ok">✓</span>
                            )}
                          </td>
                          {cells.map((cell, ci) => (
                            <td
                              key={ci}
                              style={
                                ci === mapping.phone
                                  ? { direction: "ltr", textAlign: "start" }
                                  : undefined
                              }
                            >
                              {cell || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="h-px" style={{ background: "var(--border)" }} />

              {/* Detected fields */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="label" style={{ margin: 0 }}>
                    {t("Campos detectados automáticamente")}
                  </div>
                  <span className="row-tag ok inline-flex items-center gap-1">
                    <Check className="w-[10px] h-[10px]" />
                    AI
                  </span>
                </div>
                <div className="text-[12px] -mt-1 text-muted-foreground">
                  {t(
                    "Puedes cambiar la asignación si algo se detectó incorrectamente",
                  )}
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 items-center">
                  {(
                    [
                      { key: "name", label: t("Nombre"), required: true },
                      { key: "phone", label: t("Teléfono"), required: true },
                      { key: "email", label: t("Email"), required: false },
                    ] as const
                  ).map((f) => (
                    <FieldMapRow
                      key={f.key}
                      label={f.label}
                      required={f.required}
                      headers={file.headers}
                      value={mapping[f.key]}
                      onChange={(v) =>
                        setMapping((m) => ({ ...m, [f.key]: v }))
                      }
                      noneLabel={t("— Ninguno —")}
                    />
                  ))}
                </div>
              </div>

              <div className="h-px" style={{ background: "var(--border)" }} />

              {/* Tags */}
              <div className="flex flex-col">
                <div className="label">
                  {t("Etiquetas que se aplicarán a todos los contactos")}
                </div>
                <ContactTagSelect value={tags} onChange={setTags} />
                <div className="text-[12px] mt-2 text-muted-foreground">
                  {t(
                    "Presiona Enter o coma para agregar una etiqueta · puedes elegir entre etiquetas existentes",
                  )}
                </div>
              </div>

              <div className="h-px" style={{ background: "var(--border)" }} />

              {/* Options */}
              <div className="flex flex-col gap-3">
                <div className="label" style={{ margin: 0 }}>
                  {t("Opciones")}
                </div>
                <Toggle
                  checked={skipDupes}
                  onChange={(v) => {
                    setSkipDupes(v);
                    if (v) setUpdateExisting(false);
                  }}
                  rtl={rtl}
                  label={t("Omitir duplicados")}
                  hint={t(
                    "Los contactos con un número de teléfono que ya existe serán omitidos",
                  )}
                />
                <Toggle
                  checked={updateExisting}
                  onChange={setUpdateExisting}
                  disabled={skipDupes}
                  rtl={rtl}
                  label={t("Actualizar registros existentes")}
                  hint={t(
                    "Agrega las nuevas etiquetas a los contactos existentes identificados como duplicados",
                  )}
                />
              </div>
            </div>
          )}

          {/* ─────────── IMPORTING ─────────── */}
          {state === "importing" && (
            <div className="flex flex-col gap-5 import-animate-in mt-[40px]">
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="rounded-full p-4"
                  style={{
                    background: "oklch(from var(--primary) l c h / 0.1)",
                  }}
                >
                  <Loader2
                    className="w-8 h-8 animate-spin"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <div className="text-[18px]">{t("Importando contactos…")}</div>
                <div className="text-[14px] text-muted-foreground">
                  {fill("{n} de {m}", {
                    n: processed,
                    m: total || importableCount,
                  })}
                </div>
              </div>
              <div className="px-[30px]">
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─────────── DONE ─────────── */}
          {state === "done" && (
            <div className="flex flex-col gap-5 import-animate-in">
              <div className="flex flex-col items-center gap-3 text-center mt-[24px]">
                <div
                  className="rounded-full p-4"
                  style={{
                    background: "oklch(from var(--success) l c h / 0.12)",
                  }}
                >
                  <Check
                    className="w-8 h-8"
                    style={{
                      color: "oklch(from var(--success) calc(l - 0.1) c h)",
                    }}
                    strokeWidth={2.5}
                  />
                </div>
                <div className="text-[20px]">{t("Importación completada")}</div>
                <div
                  className="text-[14px] text-muted-foreground leading-relaxed"
                  style={{ maxWidth: 320 }}
                >
                  {importedTotal > 0
                    ? fill("{n} nuevos contactos agregados a tu lista.", {
                        n: result?.added ?? 0,
                      })
                    : t("No se agregaron contactos nuevos.")}
                </div>
              </div>

              <div
                className="flex flex-col gap-2"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <SummaryRow
                  label={t("Agregados")}
                  accent="ok"
                  value={result?.added ?? 0}
                />
                {counts.dup > 0 && (
                  <SummaryRow
                    label={
                      skipDupes
                        ? t("Duplicados (omitidos)")
                        : t("Duplicados (actualizados)")
                    }
                    accent="dup"
                    value={skipDupes ? counts.dup : (result?.updated ?? 0)}
                  />
                )}
                {counts.err > 0 && (
                  <SummaryRow
                    label={t("Errores (no importados)")}
                    accent="err"
                    value={counts.err}
                  />
                )}
                <div className="flex justify-between items-start text-[14px]">
                  <span className="text-muted-foreground">
                    {t("Etiquetas aplicadas")}
                  </span>
                  {tags.length === 0 ? (
                    <span className="text-muted-foreground">
                      {t("ninguna")}
                    </span>
                  ) : (
                    <div
                      className="flex flex-wrap gap-1 justify-end"
                      style={{ maxWidth: "70%" }}
                    >
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded bg-secondary text-secondary-foreground px-[6px] py-[2px] text-[12px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionBody>

      {/* ─────────── FOOTER ─────────── */}
      {state === "pick" && (
        <SectionFooter>
          <Button className="primary" invalid disabled>
            {t("Continuar")}
          </Button>
        </SectionFooter>
      )}

      {state === "uploaded" && (
        <SectionFooter>
          <Button
            className="primary"
            onClick={startImport}
            invalid={importableCount === 0 || !mappingReady}
          >
            {fill("Importar {n} contactos", { n: importableCount })}
          </Button>
        </SectionFooter>
      )}

      {state === "done" && (
        <SectionFooter className="gap-2">
          <Button
            className="primary"
            onClick={() =>
              navigate({ to: "/contacts", hash: (prevHash) => prevHash! })
            }
          >
            {t("Volver a contactos")}
          </Button>
          <Button
            className="bg-transparent border border-border hover:bg-muted rounded-full text-[14px] py-[8px]"
            onClick={resetToPick}
          >
            {t("Importar otro archivo")}
          </Button>
        </SectionFooter>
      )}
    </>
  );
}

/* ──────────────────────────── sub-components ─────────────────────────────── */

function DropZone({
  onPick,
  t,
}: {
  onPick: (f: File | undefined) => void;
  t: (s: string) => string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`dropzone ${drag ? "dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onPick(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-full p-3"
          style={{ background: "oklch(from var(--primary) l c h / 0.1)" }}
        >
          <Upload className="w-7 h-7" style={{ color: "var(--primary)" }} />
        </div>
        <div className="text-[16px]" style={{ color: "var(--foreground)" }}>
          {t("Arrastra el archivo aquí o")}{" "}
          <span
            style={{ color: "var(--primary)", textDecoration: "underline" }}
          >
            {t("selecciona desde el equipo")}
          </span>
        </div>
        <div className="text-[13px] text-muted-foreground">
          {t("CSV, XLS, XLSX · hasta 10MB")}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[12px] text-muted-foreground">
          <Sparkles
            className="w-[14px] h-[14px] shrink-0"
            style={{ color: "var(--primary)" }}
          />
          {t(
            "Detección automática de columnas — cualquier formato de archivo es compatible",
          )}
        </div>
      </div>
    </div>
  );
}

function FileCard({
  file,
  onRemove,
  t,
}: {
  file: ParsedFile;
  onRemove: () => void;
  t: (s: string) => string;
}) {
  const isExcel = /\.xlsx?$/i.test(file.filename);
  return (
    <div className="file-card">
      {isExcel ? (
        <img src="/xls.png" alt="" width={40} height={40} />
      ) : (
        <div
          className="rounded-md flex items-center justify-center font-bold text-white text-[12px]"
          style={{ width: 40, height: 40, background: "var(--success)" }}
        >
          CSV
        </div>
      )}
      <div className="grow min-w-0">
        <div
          className="truncate text-[15px]"
          style={{ direction: "ltr", textAlign: "start" }}
        >
          {file.filename}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {file.size} · {file.rows} {t("filas")} · {file.headers.length}{" "}
          {t("columnas detectadas")}
        </div>
      </div>
      <button
        type="button"
        className="p-[8px] rounded-full hover:bg-muted shrink-0"
        onClick={onRemove}
        title={t("Eliminar")}
      >
        <X className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}

function ValidationBanner({
  counts,
  skipDupes,
  importable,
  fill,
  t,
}: {
  counts: { ok: number; err: number; dup: number; total: number };
  skipDupes: boolean;
  importable: number;
  fill: (key: string, vars: Record<string, string | number>) => string;
  t: (s: string) => string;
}) {
  if (counts.err === 0 && counts.dup === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]"
        style={{
          background: "oklch(from var(--success) l c h / 0.1)",
          color: "oklch(from var(--success) calc(l - 0.2) c h)",
        }}
      >
        <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
        <span>
          {fill("Archivo limpio — {n} filas listas para importar", {
            n: counts.total,
          })}
        </span>
      </div>
    );
  }
  return (
    <div
      className="rounded-xl px-3 py-3 text-[13px] flex flex-col gap-1"
      style={{
        background: "oklch(from var(--warning) l c h / 0.1)",
        color: "oklch(from var(--warning) calc(l - 0.27) c h)",
      }}
    >
      <div className="flex items-center gap-2">
        <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2.5} />
        <span style={{ fontWeight: 500 }}>
          {t("Se encontraron problemas en el archivo")}
        </span>
      </div>
      <div className="text-[12px] mt-1 text-muted-foreground flex flex-col">
        {counts.err > 0 && (
          <span>
            ·{" "}
            {fill("{n} filas con errores (no se importarán)", {
              n: counts.err,
            })}
          </span>
        )}
        {counts.dup > 0 && (
          <span>
            ·{" "}
            {skipDupes
              ? fill("{n} duplicados (se omitirán)", { n: counts.dup })
              : fill("{n} duplicados (se actualizarán)", { n: counts.dup })}
          </span>
        )}
        <span>
          · {fill("{n} filas se importarán correctamente", { n: importable })}
        </span>
      </div>
    </div>
  );
}

function FieldRoleChip({
  mapping,
  idx,
  t,
}: {
  mapping: Mapping;
  idx: number;
  t: (s: string) => string;
}) {
  let role: string | null = null;
  let color = "";
  if (mapping.name === idx) {
    role = t("Nombre");
    color = "var(--primary)";
  } else if (mapping.phone === idx) {
    role = t("Teléfono");
    color = "oklch(0.55 0.14 220)";
  } else if (mapping.email === idx) {
    role = t("Email");
    color = "oklch(0.6 0.14 150)";
  }
  if (!role) return null;
  return (
    <span
      className="row-tag"
      style={{
        background: `oklch(from ${color} l c h / 0.13)`,
        color,
        fontSize: 10,
        padding: "1px 4px",
      }}
    >
      {role}
    </span>
  );
}

function FieldMapRow({
  label,
  required,
  headers,
  value,
  onChange,
  noneLabel,
}: {
  label: string;
  required: boolean;
  headers: string[];
  value: number | null;
  onChange: (v: number | null) => void;
  noneLabel: string;
}) {
  return (
    <>
      <div className="text-[14px]">
        {label}
        {required && <span style={{ color: "var(--destructive)" }}> *</span>}
      </div>
      <select
        className="mapping"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      >
        <option value="">{noneLabel}</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
          </option>
        ))}
      </select>
    </>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  rtl,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  rtl: boolean;
}) {
  const travel = rtl ? -14 : 14;
  return (
    <label
      className="flex items-start gap-3"
      style={{
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 22,
          borderRadius: 9999,
          padding: 2,
          background: checked ? "var(--primary)" : "var(--input)",
          border: "none",
          transition: "background .15s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: 9999,
            background: "white",
            transform: checked ? `translateX(${travel}px)` : "translateX(0)",
            transition: "transform .15s ease",
          }}
        />
      </button>
      <div className="flex flex-col">
        <span className="text-[14px]">{label}</span>
        {hint && (
          <span className="text-[12px] text-muted-foreground">{hint}</span>
        )}
      </div>
    </label>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "ok" | "err" | "dup";
}) {
  const color =
    accent === "ok"
      ? "oklch(from var(--success) l c h / 1)"
      : accent === "err"
        ? "var(--destructive)"
        : "oklch(from var(--warning) calc(l - 0.15) c h)";
  return (
    <div className="flex justify-between items-center text-[14px]">
      <span className="text-muted-foreground">{label}</span>
      <span style={{ color, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
