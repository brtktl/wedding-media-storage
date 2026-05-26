import { domAnimation, LazyMotion, m, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronRight,
  Cloud,
  ImagePlus,
  Loader2,
  RefreshCw,
  TriangleAlert,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type ReactElement } from "react";
import {
  MAX_FILE_SIZE_LABEL,
  validateUploadFile,
  type UploadFileMetadata,
} from "../shared/uploadRules";

type UploadStatus = "queued" | "signing" | "uploading" | "complete" | "failed";

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  key?: string;
};

type PresignResponse = {
  uploads: Array<{
    originalName: string;
    key: string;
    url: string;
    method: "PUT";
    headers: {
      "content-type": string;
    };
  }>;
};

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const rowVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -10 },
};

function App() {
  const [guestName, setGuestName] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [formError, setFormError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(
    () => ({
      complete: items.filter((item) => item.status === "complete").length,
      failed: items.filter((item) => item.status === "failed").length,
      active: items.filter((item) => ["queued", "signing", "uploading"].includes(item.status)).length,
    }),
    [items],
  );

  function submitGuestName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = guestName.trim();

    if (trimmedName.length < 2) {
      setFormError("Please enter your full name.");
      return;
    }

    setFormError("");
    setConfirmedName(trimmedName);
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length || !confirmedName) {
      return;
    }

    const nextItems = Array.from(files).map((file) => createUploadItem(file));
    setItems((current) => [...nextItems, ...current]);
    void uploadItems(nextItems);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function uploadItems(nextItems: UploadItem[]) {
    const validItems = nextItems.filter((item) => {
      const validation = validateUploadFile(toMetadata(item.file));

      if (!validation.ok) {
        updateItem(item.id, {
          status: "failed",
          progress: 0,
          error: validation.reason,
        });
        return false;
      }

      return true;
    });

    if (!validItems.length) {
      return;
    }

    validItems.forEach((item) => updateItem(item.id, { status: "signing", progress: 8 }));

    try {
      const response = await fetch("/api/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          guestName: confirmedName,
          files: validItems.map((item) => toMetadata(item.file)),
        }),
      });

      const body = (await response.json()) as Partial<PresignResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not prepare uploads.");
      }

      const uploads = body.uploads;
      if (!uploads) {
        throw new Error("Upload details were missing.");
      }

      await Promise.all(
        validItems.map((item, index) => uploadFile(item, uploads[index])),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      validItems.forEach((item) =>
        updateItem(item.id, {
          status: "failed",
          progress: 0,
          error: message,
        }),
      );
    }
  }

  async function uploadFile(item: UploadItem, upload: PresignResponse["uploads"][number] | undefined) {
    if (!upload) {
      updateItem(item.id, {
        status: "failed",
        progress: 0,
        error: "Upload details were missing.",
      });
      return;
    }

    updateItem(item.id, { status: "uploading", progress: 20, key: upload.key });

    try {
      await putWithProgress(item.file, upload, (progress) => {
        updateItem(item.id, {
          status: "uploading",
          progress: Math.max(20, Math.round(progress)),
        });
      });

      updateItem(item.id, { status: "complete", progress: 100, key: upload.key, error: undefined });
    } catch (error) {
      updateItem(item.id, {
        status: "failed",
        progress: 0,
        error: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  }

  function retryItem(item: UploadItem) {
    const retry = { ...item, id: createItemId(), status: "queued" as const, progress: 0, error: undefined };
    setItems((current) => [retry, ...current.filter((currentItem) => currentItem.id !== item.id)]);
    void uploadItems([retry]);
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <main className="min-h-screen overflow-hidden bg-linen text-ink">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(240,216,211,0.75),transparent_34%),linear-gradient(135deg,rgba(143,169,154,0.2),transparent_45%)]" />
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-moss text-linen shadow-soft">
                <Cloud size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-moss">Wedding memories</p>
                <p className="text-xs text-ink/55">Photo and video upload</p>
              </div>
            </div>
            <span className="rounded-full border border-moss/15 bg-white/55 px-3 py-1 text-xs font-medium text-moss">
              QR upload
            </span>
          </header>

          <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-10">
            <div className="order-2 lg:order-1">
              <div className="relative aspect-[4/5] min-h-[340px] overflow-hidden rounded-[28px] bg-moss shadow-soft">
                <img
                  alt="Wedding table with guests sharing memories"
                  className="h-full w-full object-cover opacity-95"
                  src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=82"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/8 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-linen">
                  <p className="font-serif text-3xl leading-tight">Share the moments we missed.</p>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-linen/82">
                    Upload from your phone while the celebration is still fresh.
                  </p>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <AnimatePresence mode="wait">
                {!confirmedName ? (
                  <m.form
                    key="name"
                    animate="animate"
                    className="mx-auto w-full max-w-xl"
                    exit="exit"
                    initial="initial"
                    onSubmit={submitGuestName}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    variants={pageVariants}
                  >
                    <div className="mb-8">
                      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brass">
                        Welcome
                      </p>
                      <h1 className="font-serif text-5xl leading-[0.98] text-ink sm:text-6xl">
                        Add your photos to the wedding album
                      </h1>
                    </div>

                    <label className="mb-3 block text-sm font-semibold text-moss" htmlFor="guest-name">
                      Full name
                    </label>
                    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-moss/18 bg-white/80 px-4 shadow-soft backdrop-blur">
                      <UserRound className="shrink-0 text-moss" size={22} aria-hidden="true" />
                      <input
                        autoComplete="name"
                        autoFocus
                        className="h-14 w-full bg-transparent text-lg font-medium text-ink outline-none placeholder:text-ink/35"
                        id="guest-name"
                        onChange={(event) => setGuestName(event.target.value)}
                        placeholder="Jane Doe"
                        type="text"
                        value={guestName}
                      />
                    </div>
                    {formError ? <p className="mt-3 text-sm font-medium text-red-700">{formError}</p> : null}

                    <button
                      className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-moss px-5 text-base font-semibold text-white shadow-soft transition hover:bg-[#3f5b4f] focus:outline-none focus:ring-4 focus:ring-sage/35"
                      type="submit"
                    >
                      Continue
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  </m.form>
                ) : (
                  <m.div
                    key="uploader"
                    animate="animate"
                    className="mx-auto w-full max-w-xl"
                    exit="exit"
                    initial="initial"
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    variants={pageVariants}
                  >
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-brass">Hi, {confirmedName}</p>
                        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Upload memories</h1>
                      </div>
                      <button
                        aria-label="Change name"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-moss/15 bg-white/70 text-moss transition hover:bg-white"
                        onClick={() => setConfirmedName("")}
                        type="button"
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>

                    <label className="group block cursor-pointer rounded-[24px] border border-dashed border-moss/35 bg-white/75 p-5 text-center shadow-soft backdrop-blur transition hover:border-moss hover:bg-white">
                      <input
                        ref={inputRef}
                        accept="image/*,video/*"
                        className="sr-only"
                        multiple
                        onChange={(event) => handleFiles(event.target.files)}
                        type="file"
                      />
                      <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-petal text-moss transition group-hover:scale-105">
                        <ImagePlus size={28} aria-hidden="true" />
                      </span>
                      <span className="block text-lg font-semibold">Tap to choose photos or videos</span>
                      <span className="mt-2 block text-sm leading-6 text-ink/58">
                        Multiple uploads are welcome. Each file can be up to {MAX_FILE_SIZE_LABEL}.
                      </span>
                    </label>

                    {items.length ? (
                      <div className="mt-5 rounded-[24px] border border-moss/12 bg-white/70 p-4 shadow-soft backdrop-blur">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-moss">Uploads</p>
                            <p className="text-xs text-ink/55">
                              {stats.complete} complete · {stats.active} active · {stats.failed} failed
                            </p>
                          </div>
                          <button
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-moss px-4 text-sm font-semibold text-white transition hover:bg-[#3f5b4f]"
                            onClick={() => inputRef.current?.click()}
                            type="button"
                          >
                            <UploadCloud size={16} aria-hidden="true" />
                            Add more
                          </button>
                        </div>

                        <ul className="space-y-3">
                          <AnimatePresence initial={false}>
                            {items.map((item) => (
                              <UploadRow
                                item={item}
                                key={item.id}
                                onRemove={() => removeItem(item.id)}
                                onRetry={() => retryItem(item)}
                              />
                            ))}
                          </AnimatePresence>
                        </ul>
                      </div>
                    ) : null}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>
    </LazyMotion>
  );
}

function UploadRow({
  item,
  onRemove,
  onRetry,
}: {
  item: UploadItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const icon = getStatusIcon(item.status);

  return (
    <m.li
      animate="animate"
      className="rounded-2xl border border-moss/10 bg-linen/80 p-3"
      exit="exit"
      initial="initial"
      layout="position"
      transition={{ duration: 0.2, ease: "easeOut" }}
      variants={rowVariants}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${icon.className}`}>
          {icon.node}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{item.file.name}</p>
              <p className="mt-0.5 text-xs text-ink/52">
                {formatBytes(item.file.size)} · {getStatusLabel(item)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.status === "failed" ? (
                <button
                  aria-label={`Retry ${item.file.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-moss transition hover:bg-sage/15"
                  onClick={onRetry}
                  type="button"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
              ) : null}
              <button
                aria-label={`Remove ${item.file.name}`}
                className="grid h-8 w-8 place-items-center rounded-full text-ink/45 transition hover:bg-petal/55 hover:text-ink"
                onClick={onRemove}
                type="button"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {item.status === "uploading" || item.status === "signing" || item.status === "queued" ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-moss/10">
              <div
                className="h-full rounded-full bg-moss transition-[width] duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          ) : null}

          {item.error ? <p className="mt-2 text-xs font-medium text-red-700">{item.error}</p> : null}
        </div>
      </div>
    </m.li>
  );
}

function createUploadItem(file: File): UploadItem {
  return {
    id: createItemId(),
    file,
    status: "queued",
    progress: 0,
  };
}

function createItemId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toMetadata(file: File): UploadFileMetadata {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

function putWithProgress(
  file: File,
  upload: PresignResponse["uploads"][number],
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.url);
    Object.entries(upload.headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${request.status}.`));
    };
    request.onerror = () => reject(new Error("Network error while uploading."));
    request.send(file);
  });
}

function getStatusIcon(status: UploadStatus): { className: string; node: ReactElement } {
  if (status === "complete") {
    return { className: "bg-sage/20 text-moss", node: <Check size={17} aria-hidden="true" /> };
  }

  if (status === "failed") {
    return { className: "bg-red-100 text-red-700", node: <TriangleAlert size={17} aria-hidden="true" /> };
  }

  return {
    className: "bg-petal/80 text-moss",
    node: <Loader2 className="animate-spin" size={17} aria-hidden="true" />,
  };
}

function getStatusLabel(item: UploadItem): string {
  if (item.status === "queued") return "Queued";
  if (item.status === "signing") return "Preparing";
  if (item.status === "uploading") return `${item.progress}% uploaded`;
  if (item.status === "complete") return "Uploaded";

  return "Needs attention";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default App;
