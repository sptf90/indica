"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client-api";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function SearchableField({
  id,
  label,
  selectedLabel,
  selectedMeta,
  query,
  onQueryChange,
  open,
  setOpen,
  options,
  loading,
  disabled,
  required,
  placeholder,
  emptyText,
  onSelect,
  onClear,
  activeIndex,
  setActiveIndex,
  inputRef,
}) {
  const listId = `${id}-list`;

  function onKeyDown(event) {
    if (!open || !options.length) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      onSelect(options[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="ibge-pick-field">
      <span className="ibge-pick-label-row">
        <label htmlFor={selectedLabel ? undefined : id}>{label}</label>
        {selectedLabel ? (
          <button
            type="button"
            className="ibge-pick-clear"
            onClick={onClear}
            disabled={disabled}
          >
            Trocar
          </button>
        ) : null}
      </span>

      {selectedLabel ? (
        <div className="ibge-pick-selected" aria-live="polite">
          <strong>{selectedLabel}</strong>
          {selectedMeta ? <span>{selectedMeta}</span> : null}
          <input type="hidden" value={selectedLabel} required={required} readOnly />
        </div>
      ) : (
        <div className="ibge-pick-search">
          <input
            ref={inputRef}
            id={id}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 140)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled || loading}
            required={required}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined
            }
          />

          {open && !loading ? (
            <div
              className="ibge-pick-dropdown"
              id={listId}
              role="listbox"
              aria-label={label}
            >
              {options.length ? (
                options.map((opt, index) => (
                  <button
                    key={opt.key}
                    type="button"
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`ibge-pick-option${index === activeIndex ? " is-active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelect(opt)}
                  >
                    <span className="ibge-pick-option-main">{opt.label}</span>
                    {opt.meta ? (
                      <span className="ibge-pick-option-meta">{opt.meta}</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="ibge-pick-empty">{emptyText}</p>
              )}
              {options.length >= 80 ? (
                <p className="ibge-pick-more">
                  Digite mais letras para refinar a lista.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   state: string,
 *   cityName: string,
 *   onChange: (next: { state: string, cityName: string, ibgeId: number | null }) => void,
 *   required?: boolean,
 *   disabled?: boolean,
 *   layout?: "stack" | "row",
 * }} props
 */
export default function IbgeCityPicker({
  state = "",
  cityName = "",
  onChange,
  required = true,
  disabled = false,
  layout = "stack",
}) {
  const baseId = useId();
  const stateInputRef = useRef(null);
  const cityInputRef = useRef(null);

  const [estados, setEstados] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [loadingEstados, setLoadingEstados] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  const [stateQuery, setStateQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [stateActive, setStateActive] = useState(-1);
  const [cityActive, setCityActive] = useState(-1);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingEstados(true);
    api("/api/ibge/estados")
      .then((data) => {
        if (cancelled) return;
        setEstados(data.estados || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Não foi possível carregar os estados.");
        setEstados([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEstados(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) {
      setMunicipios([]);
      setCityQuery("");
      return;
    }
    let cancelled = false;
    setLoadingCities(true);
    setError("");
    api(`/api/ibge/municipios?uf=${encodeURIComponent(state)}`)
      .then((data) => {
        if (cancelled) return;
        setMunicipios(data.municipios || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setMunicipios([]);
        setError(err.message || "Não foi possível carregar as cidades.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const estadoSelecionado = useMemo(
    () => estados.find((e) => e.sigla === state) || null,
    [estados, state]
  );

  const stateOptions = useMemo(() => {
    const q = normalizeSearch(stateQuery);
    const list = !q
      ? estados
      : estados.filter(
          (e) =>
            normalizeSearch(e.nome).includes(q) ||
            normalizeSearch(e.sigla).includes(q)
        );
    return list.slice(0, 80).map((e) => ({
      key: e.sigla,
      label: e.nome,
      meta: e.sigla,
      value: e,
    }));
  }, [estados, stateQuery]);

  const cityOptions = useMemo(() => {
    const q = normalizeSearch(cityQuery);
    const list = !q
      ? municipios.slice(0, 80)
      : municipios
          .filter((m) => normalizeSearch(m.nome).includes(q))
          .slice(0, 80);
    return list.map((m) => ({
      key: String(m.id),
      label: m.nome,
      meta: null,
      value: m,
    }));
  }, [municipios, cityQuery]);

  function selectState(opt) {
    const uf = opt.value.sigla;
    onChange({ state: uf, cityName: "", ibgeId: null });
    setStateQuery("");
    setCityQuery("");
    setStateOpen(false);
    setCityOpen(false);
    setStateActive(-1);
    setCityActive(-1);
    setTimeout(() => cityInputRef.current?.focus(), 0);
  }

  function clearState() {
    onChange({ state: "", cityName: "", ibgeId: null });
    setStateQuery("");
    setCityQuery("");
    setTimeout(() => stateInputRef.current?.focus(), 0);
  }

  function selectCity(opt) {
    const m = opt.value;
    onChange({ state, cityName: m.nome, ibgeId: m.id });
    setCityQuery("");
    setCityOpen(false);
    setCityActive(-1);
  }

  function clearCity() {
    onChange({ state, cityName: "", ibgeId: null });
    setCityQuery("");
    setTimeout(() => cityInputRef.current?.focus(), 0);
  }

  return (
    <div
      className={`ibge-pick${layout === "row" ? " ibge-pick--row" : ""}`}
    >
      <SearchableField
        id={`${baseId}-state`}
        label="Estado"
        selectedLabel={estadoSelecionado?.nome || (state ? state : "")}
        selectedMeta={state || null}
        query={stateQuery}
        onQueryChange={setStateQuery}
        open={stateOpen}
        setOpen={setStateOpen}
        options={stateOptions}
        loading={loadingEstados}
        disabled={disabled}
        required={required && !state}
        placeholder={
          loadingEstados ? "Carregando estados…" : "Pesquisar estado…"
        }
        emptyText={
          stateQuery.trim()
            ? `Nenhum estado encontrado para “${stateQuery.trim()}”.`
            : "Nenhum estado encontrado."
        }
        onSelect={selectState}
        onClear={clearState}
        activeIndex={stateActive}
        setActiveIndex={setStateActive}
        inputRef={stateInputRef}
      />

      <SearchableField
        id={`${baseId}-city`}
        label="Cidade"
        selectedLabel={cityName || ""}
        selectedMeta={cityName ? state : null}
        query={cityQuery}
        onQueryChange={setCityQuery}
        open={cityOpen}
        setOpen={setCityOpen}
        options={cityOptions}
        loading={loadingCities}
        disabled={disabled || !state}
        required={required && !cityName}
        placeholder={
          !state
            ? "Selecione o estado primeiro"
            : loadingCities
              ? "Carregando cidades…"
              : "Pesquisar cidade…"
        }
        emptyText={
          cityQuery.trim()
            ? `Nenhuma cidade encontrada para “${cityQuery.trim()}”.`
            : "Nenhuma cidade encontrada."
        }
        onSelect={selectCity}
        onClear={clearCity}
        activeIndex={cityActive}
        setActiveIndex={setCityActive}
        inputRef={cityInputRef}
      />

      {error ? <p className="ibge-pick-error">{error}</p> : null}
    </div>
  );
}
