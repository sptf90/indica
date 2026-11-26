"use client";

import MobileHelp from "@/components/MobileHelp";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ContactModePicker from "@/components/ContactModePicker";
import RequestPhoto from "@/components/RequestPhoto";
import { isRequestContactMode, validateContactMode } from "@/lib/indication-contact";
import IbgeCityPicker from "@/components/IbgeCityPicker";
import { api } from "@/lib/client-api";
import { REQUEST_RESPONSE_HOURS } from "@/lib/constants";
import { loadRequestDraft, saveRequestDraft } from "@/lib/request-draft";
import { REQUEST_PHOTO_HINT, REQUEST_PHOTO_TYPES, requestPhotoError, shrinkCameraPhoto } from "@/lib/request-photo";
import { useTouchDevice } from "@/lib/use-touch-device";

const TIPS = [
  "Seja específico",
  "Inclua bairro se ajudar",
  "Diga o que importa pra você",
];

export default function PedirPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [contactMode, setContactMode] = useState("");
  const [cityId, setCityId] = useState("");
  const [state, setState] = useState("");
  const [cityName, setCityName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoSrc = photo?.src;
  const touch = useTouchDevice();

  useEffect(() => () => {
    if (photoSrc) URL.revokeObjectURL(photoSrc);
  }, [photoSrc]);

  useEffect(() => {
    let active = true;
    api("/api/auth/me")
      .then(async (meData) => {
        const draft = await loadRequestDraft();
        if (!active) return;
        setMe(meData.user);
        if (draft) {
          setTitle(draft.title || "");
          setDetails(draft.details || "");
          setContactMode(isRequestContactMode(draft.contactMode) ? draft.contactMode : "");
          if (draft.photo) {
            setPhoto({ file: draft.photo, src: URL.createObjectURL(draft.photo) });
          } else if (draft.photoUnavailable) {
            setPhotoError("Não foi possível recuperar a foto da prévia. Selecione o arquivo novamente.");
          }
        }
        setCityId(String(draft?.cityId || meData.user?.cityId || ""));
        setState(draft?.state || meData.user?.cityState || "");
        setCityName(draft?.cityName || meData.user?.cityName || "");
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      });
    return () => { active = false; };
  }, [router]);

  async function onPlaceChange({ state: nextState, cityName: nextCity }) {
    setState(nextState);
    setCityName(nextCity);

    if (!nextState || !nextCity) {
      setCityId("");
      return;
    }

    setResolving(true);
    setError("");
    try {
      const data = await api("/api/cities/ensure", {
        method: "POST",
        body: JSON.stringify({ name: nextCity, state: nextState }),
      });
      setCityId(String(data.city.id));
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setError(err.message);
      setCityId("");
    } finally {
      setResolving(false);
    }
  }

  async function choosePhoto(event, fromCamera = false) {
    let file = event.currentTarget.files[0];
    event.currentTarget.value = "";
    if (!file) return;
    setReadingPhoto(true);
    if (fromCamera) {
      try { file = await shrinkCameraPhoto(file); } catch { /* segue com o arquivo original */ }
    }
    const validationError = requestPhotoError(file);
    setPhotoError(validationError || "");
    if (validationError) {
      setReadingPhoto(false);
      return;
    }

    const src = URL.createObjectURL(file);
    try {
      const image = new window.Image();
      image.src = src;
      await image.decode();
      setPhoto({ file, src });
    } catch {
      URL.revokeObjectURL(src);
      setPhotoError("Não foi possível abrir essa foto. Escolha outra imagem.");
    } finally {
      setReadingPhoto(false);
    }
  }

  async function goPreview(event) {
    event.preventDefault();
    if (readingPhoto || savingDraft) return;
    setError("");
    try { validateContactMode(contactMode); } catch (err) { setError(err.message); return; }
    if (!title.trim()) {
      setError("Título obrigatório.");
      return;
    }
    if (!state || !cityName || !cityId) {
      setError("Selecione o estado e a cidade.");
      return;
    }
    if (resolving) {
      setError("Aguarde a cidade ser confirmada.");
      return;
    }
    setSavingDraft(true);
    try {
      await saveRequestDraft({
        title: title.trim(),
        details: details.trim(),
        contactMode,
        cityId: Number(cityId),
        state,
        cityName,
        cityLabel: `${cityName} (${state})`,
      }, photo?.file);
    } catch {
      setError("Não foi possível guardar a prévia neste navegador. Tente novamente.");
      return;
    } finally {
      setSavingDraft(false);
    }
    router.push("/pedir/preview");
  }

  return (
    <main className="page page-pedir">
      <section className="pedir-hero reveal">
        <div className="pedir-hero-copy">
          <p className="pedir-kicker">Novo pedido</p>
          <MobileHelp
            className="pedir-lead" label="Como montar um pedido"
            heading={
              <h1 className="pedir-title">
                Conta o que você procura — <span>a galera indica</span>
              </h1>
            }
          >
            Diga o que procura, a cidade e como quer receber a indicação. Detalhes ajudam a receber
            indicações mais certeiras.
          </MobileHelp>
          <ul className="pedir-tips" aria-label="Dicas rápidas">
            {TIPS.map((tip) => (
              <li key={tip} className="pedir-chip">
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="pedir-hero-art" aria-hidden>
          <div className="pedir-hero-panel">
            <Image
              src="/home/cta-pedir.png"
              alt=""
              width={240}
              height={240}
              className="pedir-hero-illustration"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <section className="pedir-card reveal delay-1">
        <header className="pedir-card-head">
          <h2>Monte seu pedido</h2>
          <p>Confira a prévia antes de publicar. O pedido pode receber indicações por até {REQUEST_RESPONSE_HOURS} horas.</p>
        </header>

        <form className="pedir-form" onSubmit={goPreview}>
          <div className="pedir-field">
            <MobileHelp
              heading={<label className="pedir-label" htmlFor="pedido-titulo">Título <span className="pedir-req">obrigatório</span></label>}
              className="pedir-field-hint" label="Exemplo de título"
            >
              Seja específico. Exemplo: Dentista infantil perto do centro.
            </MobileHelp>
            <input
              id="pedido-titulo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoComplete="off"
            />
            <span className="pedir-field-hint">{title.length}/200</span>
          </div>

          <div className="pedir-field">
            <span className="pedir-label">
              Local
              <span className="pedir-req">obrigatório</span>
            </span>
            <IbgeCityPicker
              layout="row"
              required
              state={state}
              cityName={cityName}
              onChange={onPlaceChange}
              disabled={resolving}
            />
            {me?.cityId ? (
              <span className="pedir-field-hint">
                Padrão: cidade do seu perfil
              </span>
            ) : (
              <span className="pedir-field-hint">
                Estado à esquerda, cidade à direita
              </span>
            )}
          </div>

          <label className="pedir-field">
            <span className="pedir-label">
              Detalhes
              <span className="pedir-opt">opcional</span>
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Bairro, orçamento, preferências, horário…"
            />
          </label>

          <div className="pedir-field">
            <label className="pedir-label" htmlFor="pedido-foto">
              Foto <span className="pedir-opt">opcional</span>
            </label>
            <input
              id="pedido-foto"
              type="file"
              accept={REQUEST_PHOTO_TYPES.join(",")}
              aria-describedby="pedido-foto-ajuda"
              disabled={!me || readingPhoto || savingDraft}
              onChange={choosePhoto}
            />
            {touch ? (
              <>
                <input
                  id="pedido-foto-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  disabled={!me || readingPhoto || savingDraft}
                  onChange={(event) => choosePhoto(event, true)}
                />
                <button className="request-visibility-button" type="button"
                  disabled={!me || readingPhoto || savingDraft}
                  onClick={() => document.getElementById("pedido-foto-camera").click()}>
                  Tirar foto com a câmera
                </button>
              </>
            ) : null}
            <span className="pedir-field-hint" id="pedido-foto-ajuda">{REQUEST_PHOTO_HINT}</span>
            {photo ? (
              <>
                <RequestPhoto src={photoSrc} />
                <button className="request-visibility-button request-photo-remove" type="button"
                  disabled={readingPhoto || savingDraft} onClick={() => { setPhoto(null); setPhotoError(""); }}>
                  Remover foto
                </button>
              </>
            ) : null}
            {photoError ? <p className="error-box" role="alert">{photoError}</p> : null}
          </div>

          <ContactModePicker value={contactMode} onChange={setContactMode} disabled={resolving} />

          <div className="pedir-actions">
            <button
              className="pedir-submit"
              type="submit"
              disabled={resolving || readingPhoto || savingDraft}
            >
              {resolving ? "Confirmando cidade…" : readingPhoto ? "Carregando foto…" : savingDraft ? "Guardando prévia…" : "Pré-visualizar"}
              {!resolving && !readingPhoto && !savingDraft ? (
                <span className="btn-arrow" aria-hidden>
                  →
                </span>
              ) : null}
            </button>
          </div>
        </form>

        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <p className="pedir-footer reveal delay-2">
        <Link href="/pedir/meus">Meus pedidos</Link>
        <span aria-hidden>·</span>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
