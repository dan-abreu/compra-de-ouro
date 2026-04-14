"use client";

import type { KeyboardEvent } from "react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";

type TradePartyType = "CLIENT" | "SUPPLIER";

type ClientRecord = {
  id: string;
  fullName: string;
  documentId?: string | null;
  goldOrigin?: string | null;
};

type SupplierRecord = {
  id: string;
  companyName: string;
  documentId?: string | null;
  contactName?: string | null;
};

export type TradePartyOption = {
  id: string;
  type: TradePartyType;
  displayName: string;
  documentId?: string | null;
  goldOrigin?: string | null;
  contactName?: string | null;
};

type TradePartySelectorProps = {
  type: TradePartyType;
  label: string;
  value: string;
  disabled?: boolean;
  errorMessage?: string;
  placeholder?: string;
  emptyText?: string;
  onChange: (option: TradePartyOption | null) => void;
  onOptionsLoaded?: (count: number) => void;
};

const RECENT_LIMIT = 5;

const STORAGE_KEYS: Record<TradePartyType, string> = {
  CLIENT: "recent_clients",
  SUPPLIER: "recent_suppliers"
};

const API_PATHS: Record<TradePartyType, string> = {
  CLIENT: "/clients",
  SUPPLIER: "/suppliers"
};

const normalizeText = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();

const sortByName = (items: TradePartyOption[]) => {
  return [...items].sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR", { sensitivity: "base" }));
};

const toOption = (type: TradePartyType, item: ClientRecord | SupplierRecord): TradePartyOption => {
  if (type === "CLIENT") {
    const client = item as ClientRecord;
    return {
      id: client.id,
      type,
      displayName: client.fullName,
      documentId: client.documentId,
      goldOrigin: client.goldOrigin
    };
  }

  const supplier = item as SupplierRecord;
  return {
    id: supplier.id,
    type,
    displayName: supplier.companyName,
    documentId: supplier.documentId,
    contactName: supplier.contactName
  };
};

const readRecentIds = (type: TradePartyType) => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[type]);
    const parsed = raw ? (JSON.parse(raw) as Array<{ id: string; name: string }>) : [];
    return parsed.map((item) => item.id).slice(0, RECENT_LIMIT);
  } catch {
    return [] as string[];
  }
};

const writeRecentOption = (type: TradePartyType, option: TradePartyOption) => {
  if (typeof window === "undefined") {
    return;
  }

  const current = (() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS[type]);
      return raw ? (JSON.parse(raw) as Array<{ id: string; name: string }>) : [];
    } catch {
      return [] as Array<{ id: string; name: string }>;
    }
  })();

  const next = [{ id: option.id, name: option.displayName }, ...current.filter((item) => item.id !== option.id)].slice(0, RECENT_LIMIT);
  window.localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(next));
};

export function TradePartySelector({
  type,
  label,
  value,
  disabled = false,
  errorMessage,
  placeholder,
  emptyText,
  onChange,
  onOptionsLoaded
}: TradePartySelectorProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [options, setOptions] = useState<TradePartyOption[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setRecentIds(readRecentIds(type));

    const load = async () => {
      try {
        const rows = await apiRequest<Array<ClientRecord | SupplierRecord>>(API_PATHS[type], "GET");
        const mapped = sortByName(rows.map((item) => toOption(type, item)));
        setOptions(mapped);
        onOptionsLoaded?.(mapped.length);
      } catch {
        setLoadError(type === "CLIENT" ? "Nao foi possivel carregar clientes." : "Nao foi possivel carregar fornecedores.");
        onOptionsLoaded?.(0);
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => setLoading(false));
  }, [onOptionsLoaded, type]);

  const selectedOption = useMemo(() => options.find((option) => option.id === value) ?? null, [options, value]);

  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }

    if (selectedOption) {
      setQuery(selectedOption.displayName);
    }
  }, [selectedOption, value]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(deferredQuery.trim());
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystack = [option.displayName, option.documentId ?? "", option.goldOrigin ?? "", option.contactName ?? ""].join(" ");
      return normalizeText(haystack).includes(normalizedQuery);
    });
  }, [deferredQuery, options]);

  const recentOptions = useMemo(() => {
    const lookup = new Map(filteredOptions.map((option) => [option.id, option]));
    return recentIds.map((id) => lookup.get(id)).filter((option): option is TradePartyOption => Boolean(option));
  }, [filteredOptions, recentIds]);

  const allOptions = useMemo(() => {
    const recentSet = new Set(recentOptions.map((option) => option.id));
    return filteredOptions.filter((option) => !recentSet.has(option.id));
  }, [filteredOptions, recentOptions]);

  const flatOptions = useMemo(() => [...recentOptions, ...allOptions], [allOptions, recentOptions]);

  useEffect(() => {
    if (!isOpen || flatOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex(0);
  }, [flatOptions, isOpen]);

  const selectOption = (option: TradePartyOption) => {
    writeRecentOption(type, option);
    setRecentIds(readRecentIds(type));
    onChange(option);
    setQuery(option.displayName);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => {
        if (flatOptions.length === 0) {
          return -1;
        }

        return current >= flatOptions.length - 1 ? 0 : current + 1;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => {
        if (flatOptions.length === 0) {
          return -1;
        }

        return current <= 0 ? flatOptions.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === "Enter" && isOpen && highlightedIndex >= 0) {
      event.preventDefault();
      const option = flatOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="block">
        <span>{label}</span>
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder ?? (type === "CLIENT" ? "Buscar cliente" : "Buscar fornecedor")}
          autoComplete="off"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            if (value) {
              onChange(null);
            }
          }}
        />
      </label>
      {errorMessage ? <p className="mt-1 text-xs font-semibold text-red-700">{errorMessage}</p> : null}
      {loadError ? <p className="mt-1 text-xs font-semibold text-red-700">{loadError}</p> : null}
      {isOpen && !disabled ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-2xl">
          <div id={listboxId} role="listbox" className="max-h-80 overflow-y-auto py-2">
            {loading ? <p className="px-3 py-2 text-sm text-stone-500">Carregando...</p> : null}
            {!loading && recentOptions.length > 0 ? (
              <div>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Ultimos Selecionados</p>
                {recentOptions.map((option, index) => (
                  <button
                    key={`recent-${option.id}`}
                    type="button"
                    className={`flex w-full flex-col items-start px-3 py-2 text-left ${highlightedIndex === index ? "bg-amber-50 text-stone-900" : "text-stone-700 hover:bg-stone-50"}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                  >
                    <span className="text-sm font-semibold">{option.displayName}</span>
                    <span className="text-xs text-stone-500">{option.documentId || "Sem documento"}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {!loading && allOptions.length > 0 ? (
              <div>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Todos os Registros (A-Z)</p>
                {allOptions.map((option, index) => {
                  const flatIndex = recentOptions.length + index;
                  return (
                    <button
                      key={`all-${option.id}`}
                      type="button"
                      className={`flex w-full flex-col items-start px-3 py-2 text-left ${highlightedIndex === flatIndex ? "bg-amber-50 text-stone-900" : "text-stone-700 hover:bg-stone-50"}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                    >
                      <span className="text-sm font-semibold">{option.displayName}</span>
                      <span className="text-xs text-stone-500">{option.documentId || "Sem documento"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {!loading && flatOptions.length === 0 ? <p className="px-3 py-2 text-sm text-stone-500">{emptyText ?? "Nenhum registro encontrado."}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}