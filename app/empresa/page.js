"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import {
  formatCnpj,
  normalizeCnpj,
  validateCnpj,
} from "@/lib/cnpj";
import {
  SPONSOR_BANNER_UPLOAD,
  formatBannerRatio,
  isCanonicalSponsorBannerSize,
  isSponsorBannerRatioOk,
  sponsorBannerRejectMessage,
} from "@/lib/sponsor-banner";

/** Alinhado a MAX_PRIZE_POSITION em lib/rankings.js */
const PRIZE_POSITION_MAX = 1000;
/** Acima deste N, “distinto” usa benefício padrão + overrides (sem N textareas). */
const PER_POSITION_FULL_UI = 10;
const PRIZE_PRESETS = [3, 5, 10, 50, 100];

function topNPositions(n) {
  const capped = Math.min(
    Math.max(Math.floor(Number(n) || 0), 0),
    PRIZE_POSITION_MAX
  );
  if (capped < 1) return [];
  return Array.from({ length: capped }, (_, i) => i + 1);
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(value) {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriod(start, end) {
  if (!start) return "—";
  const left = formatDay(start);
  if (!end) return left;
  return `${left} → ${formatDay(end)}`;
}

function formatDeadline(value) {
  const d = parseDate(value);
  if (!d) return "—";
  const day = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day} · 23h59 UTC`;
}

function statusClass(status) {
  if (
    status === "pending" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "awaiting_correction"
  ) {
    return "emp-status emp-status-pending";
  }
  if (status === "redeemed" || status === "approved") {
    return "emp-status emp-status-ok";
  }
  if (status === "expired" || status === "rejected") {
    return "emp-status emp-status-bad";
  }
  return "emp-status";
}

/** next start não serve uploads novos em /uploads — preferir /api/uploads. */
function resolveBannerSrc(url) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    return `/api/uploads/${url.slice("/uploads/".length)}`;
  }
  return url;
}

export default function EmpresaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("loading"); // loading | guest-register | dashboard
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [slots, setSlots] = useState([]);
  const [requests, setRequests] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [cities, setCities] = useState([]);

  // register form — CNPJ stored as digits only
  const [cnpjDigits, setCnpjDigits] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [registerCityId, setRegisterCityId] = useState("");
  const [cnpjTouched, setCnpjTouched] = useState(false);

  // perfil empresa (cidade de instalação)
  const [profileCityId, setProfileCityId] = useState("");
  const [profileLegalName, setProfileLegalName] = useState("");

  // sponsorship form
  const [slotModality, setSlotModality] = useState("weekly");
  const [slotKey, setSlotKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [regulationText, setRegulationText] = useState("");
  const [topNInput, setTopNInput] = useState("3");
  const [benefitMode, setBenefitMode] = useState("equal");
  const [benefitEqual, setBenefitEqual] = useState("");
  const [benefitDefault, setBenefitDefault] = useState("");
  const [benefitByPosition, setBenefitByPosition] = useState({});
  const [benefitFocusPos, setBenefitFocusPos] = useState(null);
  const [overridePosInput, setOverridePosInput] = useState("");
  const [expandedOverrides, setExpandedOverrides] = useState([]);
  const [instructions, setInstructions] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState("");
  const [bannerMeta, setBannerMeta] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const cnpjMasked = useMemo(() => formatCnpj(cnpjDigits), [cnpjDigits]);
  const cnpjOk = useMemo(() => validateCnpj(cnpjDigits), [cnpjDigits]);
  const cnpjHint = useMemo(() => {
    if (!cnpjTouched && !cnpjDigits) return "";
    if (cnpjDigits.length < 14) {
      return `Informe os 14 dígitos (${cnpjDigits.length}/14).`;
    }
    if (!cnpjOk) return "CNPJ inválido — confira os dígitos verificadores.";
    return "";
  }, [cnpjDigits, cnpjOk, cnpjTouched]);

  const openSlots = useMemo(
    () => slots.filter((s) => !s.alreadyRequested),
    [slots]
  );

  const slotsByModality = useMemo(
    () => openSlots.filter((s) => s.modality === slotModality),
    [openSlots, slotModality]
  );

  const weeklyCount = useMemo(
    () => openSlots.filter((s) => s.modality === "weekly").length,
    [openSlots]
  );
  const monthlyCount = useMemo(
    () => openSlots.filter((s) => s.modality === "monthly").length,
    [openSlots]
  );

  const selectedSlot = useMemo(
    () => slots.find((s) => s.key === slotKey) || null,
    [slots, slotKey]
  );

  const editingRequest = useMemo(
    () => (editingId ? requests.find((r) => r.id === editingId) || null : null),
    [editingId, requests]
  );

  const rankingPreview = useMemo(() => {
    const bannerSrc =
      bannerPreviewUrl || (bannerUrl ? resolveBannerSrc(bannerUrl) : "");
    const modality =
      editingRequest?.modality ||
      selectedSlot?.modality ||
      slotModality ||
      "weekly";
    const cityName =
      editingRequest?.cityName ||
      selectedSlot?.cityName ||
      company?.cityName ||
      null;
    const cityState =
      editingRequest?.cityState ||
      selectedSlot?.cityState ||
      company?.cityState ||
      null;
    const place = cityName
      ? `${cityName}${cityState ? `/${cityState}` : ""}`
      : "Sua cidade";
    const modalityLabel = modality === "monthly" ? "Mensal" : "Semanal";
    const name = displayName.trim() || company?.legalName || "Sua marca";
    return {
      bannerSrc,
      title: `${place} — ${modalityLabel} · ${name}`,
      modalityLabel,
      place,
      name,
      hasBanner: Boolean(bannerSrc),
    };
  }, [
    bannerPreviewUrl,
    bannerUrl,
    editingRequest,
    selectedSlot,
    slotModality,
    displayName,
    company?.cityName,
    company?.cityState,
    company?.legalName,
  ]);

  const topNParsed = useMemo(() => {
    const n = Number(topNInput);
    if (!Number.isInteger(n)) return null;
    return n;
  }, [topNInput]);

  const topNValid =
    topNParsed != null && topNParsed >= 1 && topNParsed <= PRIZE_POSITION_MAX;

  const prizePositions = useMemo(
    () => (topNValid ? topNPositions(topNParsed) : []),
    [topNValid, topNParsed]
  );

  const useCompactDistinct =
    benefitMode === "per_position" && prizePositions.length > PER_POSITION_FULL_UI;

  const pendingRewards = useMemo(
    () => rewards.filter((r) => r.status === "pending").length,
    [rewards]
  );

  const companyCityLabel = company?.cityName
    ? `${company.cityName}${company.cityState ? `/${company.cityState}` : ""}`
    : null;

  const hasCompanyCity = Boolean(company?.cityId);

  useEffect(() => {
    if (!openSlots.length) {
      if (slotKey) setSlotKey("");
      return;
    }
    const selectedStillOpen = openSlots.some((s) => s.key === slotKey);
    if (selectedStillOpen) return;
    const firstInTab = openSlots.find((s) => s.modality === slotModality);
    setSlotKey(firstInTab?.key || "");
  }, [openSlots, slotModality, slotKey]);

  useEffect(() => {
    setExpandedOverrides((prev) =>
      prev.filter((p) => prizePositions.includes(p))
    );
  }, [prizePositions]);

  useEffect(() => {
    api("/api/cities")
      .then((data) => setCities(data.cities || []))
      .catch(() => setCities([]));
  }, []);

  const loadDashboard = useCallback(async () => {
    const [me, slotData, reqData, rewardData] = await Promise.all([
      api("/api/empresa"),
      api("/api/empresa/slots"),
      api("/api/empresa/sponsorships"),
      api("/api/empresa/rewards"),
    ]);
    setUser(me.user);
    setCompany(me.company);
    setSlots(slotData.items || []);
    setRequests(reqData.items || []);
    setRewards(rewardData.items || []);
    if (me.company?.legalName) {
      setDisplayName((prev) => prev || me.company.legalName);
      setLogoUrl((prev) => prev || me.company.logoUrl || "");
      setProfileLegalName(me.company.legalName);
    }
    setProfileCityId(
      me.company?.cityId != null ? String(me.company.cityId) : ""
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/api/auth/me");
        if (cancelled) return;
        if (!me.user?.isCompany) {
          setUser(me.user);
          setMode("guest-register");
          setReady(true);
          return;
        }
        await loadDashboard();
        if (cancelled) return;
        setMode("dashboard");
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          setMode("guest-register");
          setReady(true);
        } else {
          setError(err.message);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  function onCnpjChange(event) {
    setCnpjTouched(true);
    setCnpjDigits(normalizeCnpj(event.target.value));
  }

  async function onRegister(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCnpjTouched(true);
    if (!validateCnpj(cnpjDigits)) {
      setError(
        cnpjDigits.length !== 14
          ? "CNPJ deve ter 14 dígitos."
          : "CNPJ inválido."
      );
      return;
    }
    if (!registerCityId) {
      setError("Selecione a cidade onde a empresa está instalada.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/register-company", {
        method: "POST",
        body: JSON.stringify({
          cnpj: cnpjDigits,
          legalName,
          email,
          password,
          logoUrl: logoUrl.trim() || null,
          cityId: Number(registerCityId),
        }),
      });
      await loadDashboard();
      setMode("dashboard");
      setSuccess(
        "Conta empresarial criada. Patrocínio só na cidade da empresa."
      );
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveProfile(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!profileCityId) {
      setError("Selecione a cidade onde a empresa está instalada.");
      return;
    }
    if (!profileLegalName || profileLegalName.trim().length < 2) {
      setError("Razão social obrigatória.");
      return;
    }
    setBusy(true);
    try {
      const data = await api("/api/empresa", {
        method: "PATCH",
        body: JSON.stringify({
          legalName: profileLegalName.trim(),
          cityId: Number(profileCityId),
          logoUrl: logoUrl.trim() || company?.logoUrl || null,
        }),
      });
      setCompany(data.company);
      setProfileCityId(
        data.company?.cityId != null ? String(data.company.cityId) : ""
      );
      setProfileLegalName(data.company?.legalName || "");
      if (data.company?.legalName) {
        setDisplayName((prev) => prev || data.company.legalName);
      }
      const slotData = await api("/api/empresa/slots");
      setSlots(slotData.items || []);
      setSuccess(
        "Perfil atualizado. Só aparecem períodos da sua cidade de instalação."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function selectModality(modality) {
    setSlotModality(modality);
    const first = openSlots.find((s) => s.modality === modality);
    setSlotKey(first?.key || "");
  }

  function applyTopN(n) {
    const capped = Math.min(Math.max(Math.floor(Number(n) || 0), 1), PRIZE_POSITION_MAX);
    setTopNInput(String(capped));
  }

  function onTopNChange(value) {
    const digits = String(value).replace(/\D/g, "").slice(0, 4);
    setTopNInput(digits);
  }

  function setBenefitForPosition(pos, value) {
    setBenefitByPosition((prev) => ({ ...prev, [String(pos)]: value }));
  }

  /** Copia o texto do 1º (ou do campo focado) para as restantes posições. */
  function replicateBenefitToAll() {
    if (!prizePositions.length) return;
    const sourcePos =
      benefitFocusPos != null && prizePositions.includes(benefitFocusPos)
        ? benefitFocusPos
        : prizePositions[0];
    const text = String(benefitByPosition[String(sourcePos)] || "").trim();
    if (!text) {
      setError(
        `Escreve o benefício do ${sourcePos}º (ou foca outro campo) antes de replicar.`
      );
      return;
    }
    setError("");
    setBenefitByPosition((prev) => {
      const next = { ...prev };
      for (const pos of prizePositions) {
        next[String(pos)] = text;
      }
      return next;
    });
  }

  function addOverridePosition() {
    const pos = Number(overridePosInput);
    if (!Number.isInteger(pos) || pos < 1 || pos > prizePositions.length) {
      setError(
        `Override: informe uma posição entre 1 e ${prizePositions.length || "N"}.`
      );
      return;
    }
    setError("");
    setExpandedOverrides((prev) =>
      prev.includes(pos) ? prev : [...prev, pos].sort((a, b) => a - b)
    );
    setOverridePosInput("");
  }

  function removeOverride(pos) {
    setExpandedOverrides((prev) => prev.filter((p) => p !== pos));
    setBenefitByPosition((prev) => {
      const next = { ...prev };
      delete next[String(pos)];
      return next;
    });
  }

  function readImageSize(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const size = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(size);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem."));
      };
      img.src = url;
    });
  }

  function revokeBannerPreview() {
    setBannerPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return "";
    });
  }

  async function onBannerFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess("");
    let localPreview = "";
    try {
      const size = await readImageSize(file);
      if (!isSponsorBannerRatioOk(size.width, size.height)) {
        setError(sponsorBannerRejectMessage(size.width, size.height));
        return;
      }
      localPreview = URL.createObjectURL(file);
      revokeBannerPreview();
      setBannerPreviewUrl(localPreview);
      const canonical = isCanonicalSponsorBannerSize(size.width, size.height);
      setBannerMeta({
        width: size.width,
        height: size.height,
        ratioLabel: formatBannerRatio(size.width, size.height),
        canonical,
        fitted: !canonical,
      });
      setBannerUploading(true);
      const form = new FormData();
      form.append("banner", file);
      const res = await fetch("/api/empresa/banner", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(
          new Error(data?.error || "Falha no upload do banner."),
          { status: res.status }
        );
      }
      const serverUrl = data.bannerUrl || "";
      setBannerUrl(serverUrl);
      // Mantém blob na prévia (instantâneo) e URL de API para o save.
      setSuccess(
        canonical
          ? "Banner carregado (1200×240 exacto)."
          : `Banner carregado (${size.width}×${size.height}, ${formatBannerRatio(size.width, size.height)}). Enquadrado com cover no slot 5:1 — ideal ${SPONSOR_BANNER_UPLOAD.label}.`
      );
    } catch (err) {
      if (localPreview) {
        try {
          URL.revokeObjectURL(localPreview);
        } catch {
          /* ignore */
        }
      }
      revokeBannerPreview();
      setError(err.message || "Falha no upload do banner.");
    } finally {
      setBannerUploading(false);
    }
  }

  function clearBanner() {
    revokeBannerPreview();
    setBannerUrl("");
    setBannerMeta(null);
  }

  function resetSponsorshipFormFields() {
    setRegulationText("");
    setBenefitEqual("");
    setBenefitDefault("");
    setBenefitByPosition({});
    setExpandedOverrides([]);
    setInstructions("");
    setTopNInput("3");
    setBenefitMode("equal");
    setDeadlineDays("30");
    clearBanner();
    setEditingId(null);
  }

  function startEditRequest(r) {
    if (!r?.editable) return;
    setError("");
    setSuccess("");
    setEditingId(r.id);
    setDisplayName(r.displayName || company?.legalName || "");
    setLogoUrl(r.logoUrl || company?.logoUrl || "");
    setRegulationText(r.regulationText || "");
    setInstructions(r.prizeRedemptionInstructions || "");
    setDeadlineDays(String(r.redemptionDeadlineDays || 30));
    setBenefitMode(r.prizeBenefitMode === "per_position" ? "per_position" : "equal");
    const positions = Array.isArray(r.prizePositions) ? r.prizePositions : [];
    setTopNInput(String(positions.length || 3));
    const benefits = r.prizeBenefits || {};
    if (r.prizeBenefitMode === "per_position") {
      setBenefitDefault(String(benefits.default || ""));
      setBenefitEqual("");
      const byPos = {};
      const overrides = [];
      for (const pos of positions) {
        const text = String(benefits[String(pos)] || "").trim();
        if (text && text !== String(benefits.default || "").trim()) {
          byPos[String(pos)] = text;
          overrides.push(pos);
        } else if (text) {
          byPos[String(pos)] = text;
        }
      }
      setBenefitByPosition(byPos);
      setExpandedOverrides(overrides.sort((a, b) => a - b));
    } else {
      setBenefitEqual(String(benefits.default || ""));
      setBenefitDefault("");
      setBenefitByPosition({});
      setExpandedOverrides([]);
    }
    revokeBannerPreview();
    const src = resolveBannerSrc(r.bannerUrl || "");
    setBannerUrl(r.bannerUrl || "");
    setBannerPreviewUrl(src);
    setBannerMeta(src ? { width: 1200, height: 240, canonical: true } : null);
    setSlotModality(r.modality === "monthly" ? "monthly" : "weekly");
    // Scroll to form
    try {
      document
        .querySelector('[data-tour="emp-sponsor-form"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      /* ignore */
    }
  }

  function cancelEdit() {
    resetSponsorshipFormFields();
    if (company?.legalName) setDisplayName(company.legalName);
    setSuccess("Edição cancelada.");
  }

  async function onSubmitSponsorship(event) {
    event.preventDefault();
    if (!editingId && !selectedSlot) {
      setError("Selecione um período disponível.");
      return;
    }
    if (!bannerUrl.trim()) {
      setError(
        `Banner obrigatório — carregue a arte ${SPONSOR_BANNER_UPLOAD.label} antes de enviar.`
      );
      return;
    }
    if (!topNValid) {
      setError(
        `Top N inválido — use um número entre 1 e ${PRIZE_POSITION_MAX}.`
      );
      return;
    }
    const positions = prizePositions;
    if (!positions.length) {
      setError("Selecione ao menos uma posição premiada.");
      return;
    }
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      let prizeBenefits;
      if (benefitMode === "equal") {
        prizeBenefits = { default: benefitEqual.trim() };
      } else if (useCompactDistinct) {
        prizeBenefits = { default: benefitDefault.trim() };
        for (const pos of expandedOverrides) {
          const text = String(benefitByPosition[String(pos)] || "").trim();
          if (text) prizeBenefits[String(pos)] = text;
        }
      } else {
        prizeBenefits = Object.fromEntries(
          positions.map((p) => [
            String(p),
            String(benefitByPosition[String(p)] || "").trim(),
          ])
        );
      }
      const body = {
        displayName: displayName.trim(),
        logoUrl: logoUrl.trim() || company?.logoUrl || null,
        bannerUrl: bannerUrl.trim(),
        regulationText: regulationText.trim(),
        prizePositions: positions,
        prizeBenefitMode: benefitMode,
        prizeBenefits,
        prizeRedemptionInstructions: instructions.trim(),
        redemptionDeadlineDays: Number(deadlineDays) || 30,
      };
      if (!editingId && selectedSlot) {
        body.cityId = selectedSlot.cityId;
        body.modality = selectedSlot.modality;
        body.periodStart = selectedSlot.periodStart;
        body.periodEnd = selectedSlot.periodEnd;
      }
      const data = editingId
        ? await api(`/api/empresa/sponsorships/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await api("/api/empresa/sponsorships", {
            method: "POST",
            body: JSON.stringify(body),
          });
      setSuccess(
        data.message ||
          (editingId ? "Solicitação atualizada." : "Solicitação enviada.")
      );
      resetSponsorshipFormFields();
      setSlotKey("");
      if (company?.legalName) setDisplayName(company.legalName);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmReward(id) {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const data = await api(`/api/empresa/rewards/${id}/confirm`, {
        method: "POST",
      });
      setSuccess(data.message || "Resgate confirmado.");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || mode === "loading") {
    return (
      <main className="page page-empresa">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (mode === "guest-register") {
    return (
      <main className="page page-empresa">
        <section className="emp-hero emp-hero-register reveal">
          <div>
            <p className="eyebrow">Conta empresarial</p>
            <h1>Cadastro por CNPJ</h1>
            <p className="lead emp-hero-lead">
              Só para patrocinar rankings e confirmar resgates. Sem perfil
              público, sem catálogo e sem pedir ou indicar.
            </p>
          </div>
        </section>

        <section className="emp-panel reveal">
          {user && !user.isCompany ? (
            <p className="form-error" role="alert">
              Você está logado como usuário comum. Saia e cadastre a empresa
              com outro e-mail, ou use uma conta empresarial existente.
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="form-success" role="status">
              {success}
            </p>
          ) : null}

          <form className="emp-form" onSubmit={onRegister}>
            <div className="emp-form-grid">
              <label className="emp-field emp-field-cnpj">
                CNPJ
                <input
                  className="emp-cnpj-input"
                  value={cnpjMasked}
                  onChange={onCnpjChange}
                  onBlur={() => setCnpjTouched(true)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  aria-invalid={Boolean(cnpjHint)}
                  aria-describedby="cnpj-hint"
                  required
                />
                <span
                  id="cnpj-hint"
                  className={`hint emp-cnpj-hint${cnpjHint ? " is-error" : cnpjOk ? " is-ok" : ""}`}
                >
                  {cnpjHint ||
                    (cnpjOk
                      ? "CNPJ válido"
                      : "Formato 00.000.000/0001-00 · 14 dígitos")}
                </span>
              </label>
              <label className="emp-field">
                Razão social
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required
                />
              </label>
              <label className="emp-field">
                Cidade de instalação
                <select
                  value={registerCityId}
                  onChange={(e) => setRegisterCityId(e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Patrocínio só nesta cidade — não em outras.
                </span>
              </label>
              <label className="emp-field">
                E-mail de acesso
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="emp-field">
                Senha
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]+"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Só números · mín. 6"
                  required
                />
              </label>
              <label className="emp-field emp-field-span">
                URL do logotipo (opcional)
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="/brand/goindica-logo.png"
                />
              </label>
            </div>
            <div className="toolbar emp-toolbar">
              <button
                className="pill-cta"
                type="submit"
                disabled={busy || !cnpjOk || !registerCityId}
              >
                {busy ? "Cadastrando…" : "Criar conta empresarial"}
              </button>
              <Link className="pill-outline" href="/login">
                Já tenho conta
              </Link>
            </div>
          </form>
        </section>
      </main>
    );
  }

  const cnpjDisplay =
    company?.cnpjFormatted || formatCnpj(company?.cnpj || "");

  return (
    <main className="page page-empresa">
      <section className="emp-hero reveal" data-tour="emp-hero">
        <div className="emp-hero-main">
          <p className="eyebrow">Área da empresa</p>
          <h1>{company?.legalName || "Empresa"}</h1>
          <p className="lead emp-hero-lead">
            Patrocínio e resgates da própria campanha — sem pedir nem indicar.
            {companyCityLabel
              ? ` Instalada em ${companyCityLabel}.`
              : " Defina a cidade de instalação no perfil."}
          </p>
        </div>
        <div className="emp-hero-meta">
          <span className="emp-cnpj-badge" title="CNPJ">
            {cnpjDisplay}
          </span>
          {companyCityLabel ? (
            <span className="emp-cnpj-badge" title="Cidade">
              {companyCityLabel}
            </span>
          ) : null}
          <div className="emp-hero-stats">
            <span>
              <strong>{requests.length}</strong> solicitações
            </span>
            <span>
              <strong>{pendingRewards}</strong> resgates pendentes
            </span>
          </div>
        </div>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="form-success" role="status">
          {success}
        </p>
      ) : null}

      <div className="emp-dashboard">
        <section
          className="emp-panel reveal"
          data-tour="emp-profile"
        >
          <header className="emp-panel-head">
            <h2>Perfil da empresa</h2>
            <p className="muted emp-lead">
              Cidade de instalação obrigatória — só pode patrocinar rankings
              nessa cidade.
            </p>
          </header>
          <form className="emp-form" onSubmit={onSaveProfile}>
            <div className="emp-form-grid">
              <label className="emp-field">
                Razão social
                <input
                  value={profileLegalName}
                  onChange={(e) => setProfileLegalName(e.target.value)}
                  required
                />
              </label>
              <label className="emp-field">
                Cidade de instalação
                <select
                  value={profileCityId}
                  onChange={(e) => setProfileCityId(e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="toolbar emp-toolbar">
              <button
                className="pill-cta"
                type="submit"
                disabled={busy || !profileCityId}
              >
                {busy ? "Salvando…" : "Salvar perfil"}
              </button>
            </div>
          </form>
        </section>

        <section
          className="emp-panel emp-panel-sponsor reveal"
          data-tour="emp-sponsor-form"
        >
          <header className="emp-panel-head">
            <h2>
              {editingId
                ? "Editar solicitação (antes do período)"
                : "Solicitar patrocínio"}
            </h2>
            <p className="muted emp-lead">
              {editingId
                ? "Corriga campos e banner enquanto o ranking ainda não começou. Guardar sincroniza a campanha se já estiver aprovada."
                : hasCompanyCity
                  ? `Só períodos em ${companyCityLabel}. Até 3 dias antes do início (23h59). Banner obrigatório.`
                  : "Defina a cidade no perfil acima para ver períodos disponíveis."}
            </p>
          </header>
          <form className="emp-form" onSubmit={onSubmitSponsorship}>
            <div className="emp-form-grid">
              {!editingId ? (
              <fieldset
                className="emp-field emp-field-span emp-slot-fieldset"
                data-tour="emp-slot"
              >
                <legend>
                  Período disponível
                  {companyCityLabel ? ` · ${companyCityLabel}` : ""}
                </legend>
                {!hasCompanyCity ? (
                  <p className="muted emp-slot-empty" role="status">
                    Sem cidade no perfil — salve a cidade de instalação para
                    liberar slots locais.
                  </p>
                ) : (
                <>
                <div
                  className="emp-modality-tabs"
                  role="tablist"
                  aria-label="Tipo de ranking"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={slotModality === "weekly"}
                    className={
                      slotModality === "weekly" ? "emp-tab is-active" : "emp-tab"
                    }
                    onClick={() => selectModality("weekly")}
                  >
                    Semanal
                    <span className="emp-tab-count">{weeklyCount}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={slotModality === "monthly"}
                    className={
                      slotModality === "monthly"
                        ? "emp-tab is-active"
                        : "emp-tab"
                    }
                    onClick={() => selectModality("monthly")}
                  >
                    Mensal
                    <span className="emp-tab-count">{monthlyCount}</span>
                  </button>
                </div>

                {slotsByModality.length === 0 ? (
                  <p className="muted emp-slot-empty">
                    Nenhum período{" "}
                    {slotModality === "weekly" ? "semanal" : "mensal"} aberto em{" "}
                    {companyCityLabel} agora.
                  </p>
                ) : (
                  <div
                    className="emp-slot-list"
                    role="radiogroup"
                    aria-label={`Períodos em ${companyCityLabel}`}
                  >
                    {slotsByModality.map((s) => {
                      const selected = s.key === slotKey;
                      return (
                        <label
                          key={s.key}
                          className={
                            selected
                              ? "emp-slot-card is-selected"
                              : "emp-slot-card"
                          }
                        >
                          <input
                            type="radio"
                            name="sponsorship-slot"
                            value={s.key}
                            checked={selected}
                            onChange={() => setSlotKey(s.key)}
                            required
                          />
                          <span className="emp-slot-place">
                            {s.cityName}/{s.cityState}
                          </span>
                          <span className="emp-slot-dates">
                            {formatPeriod(s.periodStart, s.periodEnd)}
                          </span>
                          <span className="emp-slot-deadline">
                            Solicitar até {formatDeadline(s.requestDeadline)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                </>
                )}
              </fieldset>
              ) : (
                <p className="muted emp-field-span emp-edit-period-note">
                  Período bloqueado nesta edição — só campos da campanha e
                  banner.
                </p>
              )}

              <label
                className="emp-field emp-field-span"
                data-tour="emp-display-name"
              >
                Nome exibido (“Patrocinado por”)
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </label>

              <div
                className="emp-banner-field emp-field-span"
                data-tour="emp-banner"
              >
                <div className="emp-banner-head">
                  <span className="emp-banner-title">
                    Banner do ranking
                    <em>obrigatório</em>
                  </span>
                  <span className="emp-banner-spec">
                    Ideal <strong>{SPONSOR_BANNER_UPLOAD.label}</strong> ·
                    aceita {SPONSOR_BANNER_UPLOAD.ratioMin}:1–
                    {SPONSOR_BANNER_UPLOAD.ratioMax}:1 (cover no slot 5:1) ·
                    full-bleed · texto e logo na própria arte
                  </span>
                </div>
                <div
                  className="emp-banner-preview-frame"
                  aria-hidden={!bannerPreviewUrl && !bannerUrl}
                >
                  {bannerPreviewUrl || bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={bannerPreviewUrl || resolveBannerSrc(bannerUrl)}
                      src={bannerPreviewUrl || resolveBannerSrc(bannerUrl)}
                      alt="Prévia do banner do ranking"
                      className="emp-banner-preview"
                    />
                  ) : (
                    <div className="emp-banner-placeholder">
                      <span>1200</span>
                      <span aria-hidden>×</span>
                      <span>240</span>
                      <p>Ratio 5:1 · arte completa na imagem</p>
                    </div>
                  )}
                </div>
                <div className="emp-banner-actions">
                  <label className="emp-banner-upload pill-outline sm">
                    {bannerUploading
                      ? "Enviando…"
                      : bannerUrl
                        ? "Trocar imagem"
                        : "Carregar banner"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={onBannerFileChange}
                      disabled={bannerUploading || busy}
                      required={!bannerUrl}
                    />
                  </label>
                  {bannerUrl ? (
                    <button
                      type="button"
                      className="pill-outline sm"
                      onClick={clearBanner}
                      disabled={busy || bannerUploading}
                    >
                      Remover
                    </button>
                  ) : null}
                  {bannerMeta ? (
                    <span
                      className={
                        bannerMeta.canonical
                          ? "emp-banner-meta is-ok"
                          : "emp-banner-meta is-fit"
                      }
                    >
                      {bannerMeta.width}×{bannerMeta.height}
                      {bannerMeta.ratioLabel
                        ? ` · ${bannerMeta.ratioLabel}`
                        : ""}
                      {bannerMeta.canonical
                        ? " · exacto"
                        : " · cover no slot 5:1"}
                    </span>
                  ) : (
                    <span className="emp-banner-meta muted">
                      Sem banner — envio bloqueado
                    </span>
                  )}
                </div>
              </div>

              <section
                className="emp-ranking-preview emp-field-span"
                data-tour="emp-ranking-preview"
                aria-label="Prévia do ranking"
              >
                <header className="emp-ranking-preview-head">
                  <h3>Prévia do ranking</h3>
                  <p className="muted">
                    Como o banner aparece em Rankings (mesmo layout do
                    detalhe).
                  </p>
                </header>
                <div
                  className={`rm-sponsor-hero emp-ranking-preview-hero${
                    rankingPreview.hasBanner ? " is-real" : " is-placeholder"
                  }`}
                  style={{
                    "--rm-banner-ratio": `${SPONSOR_BANNER_UPLOAD.ratioNumber} / 1`,
                  }}
                  data-banner-upload={`${SPONSOR_BANNER_UPLOAD.width}x${SPONSOR_BANNER_UPLOAD.height}`}
                  data-banner-ratio={SPONSOR_BANNER_UPLOAD.ratio}
                >
                  {rankingPreview.hasBanner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={rankingPreview.bannerSrc}
                      src={rankingPreview.bannerSrc}
                      alt={`Prévia: ranking ${rankingPreview.modalityLabel.toLowerCase()} patrocinado por ${rankingPreview.name}`}
                      className="rm-sponsor-hero-img emp-ranking-preview-img"
                    />
                  ) : (
                    <div className="emp-ranking-preview-empty">
                      <p>Carregue o banner para ver a prévia full-bleed</p>
                      <span>Slot 5:1 · cover</span>
                    </div>
                  )}
                  <p className="rm-banner-crumb">
                    <span>← Rankings</span>
                  </p>
                </div>
                <div className="emp-ranking-preview-meta">
                  <strong className="emp-ranking-preview-title">
                    {rankingPreview.title}
                  </strong>
                  <p className="ranking-sponsor emp-ranking-preview-sponsor">
                    <span className="ranking-sponsor-label">
                      Patrocinado por
                    </span>{" "}
                    <strong>{rankingPreview.name}</strong>
                  </p>
                </div>
              </section>

              <fieldset
                className="emp-field emp-field-span emp-pos-fieldset"
                data-tour="emp-prizes"
              >
                <legend>Posições premiadas</legend>
                <div
                  className="emp-pos-presets"
                  role="group"
                  aria-label="Atalhos Top N"
                >
                  {PRIZE_PRESETS.map((n) => {
                    const on = topNValid && topNParsed === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={
                          on ? "emp-pos-preset is-active" : "emp-pos-preset"
                        }
                        aria-pressed={on}
                        onClick={() => applyTopN(n)}
                      >
                        Top {n}
                      </button>
                    );
                  })}
                </div>
                <div className="emp-topn-row">
                  <label className="emp-topn-field">
                    <span>Até a posição (Top N)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={PRIZE_POSITION_MAX}
                      value={topNInput}
                      onChange={(e) => onTopNChange(e.target.value)}
                      aria-describedby="emp-topn-hint"
                      required
                    />
                  </label>
                  {topNValid ? (
                    <p className="emp-topn-summary" aria-live="polite">
                      Premia o <strong>1º ao {topNParsed}º</strong>
                      <span className="muted">
                        {" "}
                        · {topNParsed}{" "}
                        {topNParsed === 1 ? "posição" : "posições"}
                      </span>
                    </p>
                  ) : (
                    <p className="emp-topn-summary muted" aria-live="polite">
                      Informe N entre 1 e {PRIZE_POSITION_MAX}.
                    </p>
                  )}
                </div>
                <p id="emp-topn-hint" className="hint">
                  Ex.: 50, 100 ou 1000 — selecciona 1…N. Máximo{" "}
                  {PRIZE_POSITION_MAX}.
                </p>
              </fieldset>

              <label className="emp-field emp-field-span">
                Regulamento
                <textarea
                  rows={3}
                  value={regulationText}
                  onChange={(e) => setRegulationText(e.target.value)}
                  required
                />
              </label>
              <label className="emp-field">
                Benefício
                <select
                  value={benefitMode}
                  onChange={(e) => setBenefitMode(e.target.value)}
                >
                  <option value="equal">Igual para todas</option>
                  <option value="per_position">Distinto por posição</option>
                </select>
              </label>
              {benefitMode === "equal" ? (
                <label className="emp-field">
                  Texto do benefício
                  <input
                    value={benefitEqual}
                    onChange={(e) => setBenefitEqual(e.target.value)}
                    required
                  />
                </label>
              ) : useCompactDistinct ? (
                <div className="emp-field emp-field-span emp-benefit-by-pos">
                  <span className="emp-benefit-by-pos-label">
                    Benefício distinto (Top {prizePositions.length})
                  </span>
                  <p className="hint emp-benefit-scale-note">
                    Com mais de {PER_POSITION_FULL_UI} posições, usa um texto
                    padrão para todas e overrides só onde precisares — sem{" "}
                    {prizePositions.length} campos.
                  </p>
                  <label className="emp-field">
                    Benefício padrão (todas as posições)
                    <input
                      value={benefitDefault}
                      onChange={(e) => setBenefitDefault(e.target.value)}
                      placeholder="Ex.: voucher de R$ 50"
                      required
                    />
                  </label>
                  <div className="emp-override-add">
                    <label className="emp-field emp-field-narrow">
                      Override posição
                      <input
                        type="number"
                        min={1}
                        max={prizePositions.length || 1}
                        value={overridePosInput}
                        onChange={(e) =>
                          setOverridePosInput(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="ex. 1"
                      />
                    </label>
                    <button
                      type="button"
                      className="pill-outline sm"
                      onClick={addOverridePosition}
                    >
                      Personalizar
                    </button>
                  </div>
                  {expandedOverrides.length ? (
                    <div className="emp-benefit-rows">
                      {expandedOverrides.map((pos) => (
                        <label key={pos} className="emp-benefit-row emp-benefit-row-override">
                          <span>{pos}º</span>
                          <input
                            value={benefitByPosition[String(pos)] || ""}
                            onChange={(e) =>
                              setBenefitForPosition(pos, e.target.value)
                            }
                            placeholder={`Benefício do ${pos}º (substitui o padrão)`}
                          />
                          <button
                            type="button"
                            className="emp-override-remove"
                            onClick={() => removeOverride(pos)}
                            aria-label={`Remover override do ${pos}º`}
                          >
                            ×
                          </button>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">
                      Sem overrides — todas usam o benefício padrão.
                    </p>
                  )}
                </div>
              ) : (
                <div className="emp-field emp-field-span emp-benefit-by-pos">
                  <div className="emp-benefit-by-pos-head">
                    <span className="emp-benefit-by-pos-label">
                      Benefício por posição
                    </span>
                    <button
                      type="button"
                      className="pill-outline sm emp-replicate-btn"
                      onClick={replicateBenefitToAll}
                      disabled={!prizePositions.length}
                      title="Copia o texto do 1º (ou do campo focado) para as outras posições"
                    >
                      Replicar para todos
                    </button>
                  </div>
                  {prizePositions.length === 0 ? (
                    <p className="muted">Defina o Top N acima.</p>
                  ) : (
                    <>
                      <p className="hint emp-benefit-scale-note">
                        Preenche uma posição e usa «Replicar para todos» para
                        aplicar às restantes
                        {benefitFocusPos != null
                          ? ` (origem: ${benefitFocusPos}º)`
                          : " (origem: 1º)"}.
                      </p>
                      <div className="emp-benefit-rows">
                        {prizePositions.map((pos) => (
                          <label key={pos} className="emp-benefit-row">
                            <span>{pos}º</span>
                            <input
                              value={benefitByPosition[String(pos)] || ""}
                              onChange={(e) =>
                                setBenefitForPosition(pos, e.target.value)
                              }
                              onFocus={() => setBenefitFocusPos(pos)}
                              placeholder={`Benefício do ${pos}º lugar`}
                              required
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <label className="emp-field emp-field-span">
                Instruções de resgate
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  required
                />
              </label>
              <label className="emp-field emp-field-narrow">
                Prazo de resgate (dias)
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="toolbar emp-toolbar" data-tour="emp-submit">
              <button
                className="pill-cta"
                type="submit"
                disabled={
                  busy ||
                  bannerUploading ||
                  (!editingId && (!hasCompanyCity || !openSlots.length)) ||
                  !topNValid ||
                  !bannerUrl
                }
              >
                {busy
                  ? editingId
                    ? "Guardando…"
                    : "Enviando…"
                  : editingId
                    ? "Guardar alterações"
                    : "Enviar para análise"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="pill-outline"
                  disabled={busy || bannerUploading}
                  onClick={cancelEdit}
                >
                  Cancelar edição
                </button>
              ) : null}
              {!bannerUrl ? (
                <p className="muted emp-save-block">
                  Carregue o banner {SPONSOR_BANNER_UPLOAD.label} para liberar o
                  envio.
                </p>
              ) : !editingId && !hasCompanyCity ? (
                <p className="muted">
                  Defina a cidade no perfil para solicitar patrocínio local.
                </p>
              ) : !editingId && !openSlots.length ? (
                <p className="muted">
                  Nenhum período aberto em {companyCityLabel} no momento.
                </p>
              ) : null}
            </div>
          </form>
        </section>

        <aside className="emp-side">
          <section className="emp-panel reveal" data-tour="emp-requests">
            <header className="emp-panel-head">
              <h2>Minhas solicitações</h2>
            </header>
            {requests.length === 0 ? (
              <p className="muted">Nenhuma solicitação ainda.</p>
            ) : (
              <ul className="emp-list">
                {requests.map((r) => (
                  <li
                    key={r.id}
                    className={
                      editingId === r.id
                        ? "emp-list-item is-editing"
                        : "emp-list-item"
                    }
                    data-request-id={r.id}
                    data-request-status={r.status}
                  >
                    <div>
                      <strong>
                        {r.cityName}/{r.cityState} · {r.modalityLabel}
                      </strong>
                      <p className="muted">
                        {formatPeriod(r.periodStart, r.periodEnd)} ·{" "}
                        {r.displayName}
                      </p>
                      {r.editable ? (
                        <p className="hint emp-edit-hint">
                          Editável até {formatDay(r.periodStart)} (início do
                          período).
                        </p>
                      ) : null}
                    </div>
                    <div className="emp-request-actions">
                      <span className={statusClass(r.status)}>
                        {r.statusLabel}
                      </span>
                      {r.editable ? (
                        <button
                          type="button"
                          className="pill-outline sm"
                          disabled={busy}
                          onClick={() => startEditRequest(r)}
                        >
                          {editingId === r.id ? "A editar…" : "Editar"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="emp-panel reveal" data-tour="emp-rewards">
            <header className="emp-panel-head">
              <h2>Resgates da campanha</h2>
              <p className="muted emp-lead">
                Pendente → Resgatado (você confirma) → Expirado. Só a empresa
                confirma.
              </p>
            </header>
            {rewards.length === 0 ? (
              <p className="muted">Nenhum benefício a confirmar.</p>
            ) : (
              <ul className="emp-list">
                {rewards.map((rw) => (
                  <li key={rw.id} className="emp-list-item emp-reward">
                    <div>
                      <strong>
                        {rw.finalPosition}º · @{rw.username}
                      </strong>
                      <p className="muted">{rw.rankingTitle}</p>
                      <p className="emp-reward-benefit">{rw.benefitText}</p>
                      <p className="hint">
                        Validade até {formatPeriod(rw.expiresAt)}
                        {rw.redeemedAt
                          ? ` · confirmado em ${formatPeriod(rw.redeemedAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="emp-reward-actions">
                      <span className={statusClass(rw.status)}>
                        {rw.statusLabel}
                      </span>
                      {rw.status === "pending" ? (
                        <button
                          type="button"
                          className="pill-cta sm"
                          disabled={busy}
                          onClick={() => onConfirmReward(rw.id)}
                        >
                          Confirmar resgate
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
