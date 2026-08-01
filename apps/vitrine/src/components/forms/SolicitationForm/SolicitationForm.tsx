"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui";

import { submitSolicitation } from "@/server/actions/solicitation";
import {
  HONEYPOT_FIELD,
  SOLICITATION_TYPES,
  SOLICITATION_TYPE_LABELS,
  solicitationInputSchema,
} from "@/lib/schemas/solicitation";

import styles from "./SolicitationForm.module.css";

// Ordre de priorité pour le focus au premier champ en erreur (UX-DR14/UX-DR26) — c'est
// l'ordre visuel du formulaire, pas l'ordre du schéma Zod.
const FIELD_ORDER = ["name", "email", "requestType", "message", "consentGiven"] as const;
type FieldName = (typeof FIELD_ORDER)[number];
type FieldErrors = Partial<Record<FieldName, string>>;

// Champs qui ont une validation AU BLUR (UX-DR14/UX-DR26 : « pas agressive pendant la
// frappe »). Les radios et la case consentement n'ont pas ce problème (rien à taper) —
// leur validation n'intervient qu'à la soumission.
type BlurValidatedField = "name" | "email" | "message";

type FormState = {
  status: "idle" | "success" | "error";
  error?: string;
  fieldErrors?: FieldErrors;
};

const INITIAL_STATE: FormState = { status: "idle" };

function fieldErrorsFromZod(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key as FieldName] = issue.message;
    }
  }
  return errors;
}

/** Valide un seul champ (patron `.shape.<field>`) — utilisé au blur, pas pendant la frappe. */
function validateSingleField(field: BlurValidatedField, rawValue: string): string | undefined {
  const result = solicitationInputSchema.shape[field].safeParse(rawValue);
  return result.success ? undefined : result.error.issues[0]?.message;
}

async function formAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  // Validation CLIENT complète avant tout appel réseau — le focus au premier champ en
  // erreur (UX-DR14/UX-DR26) ne doit pas attendre un aller-retour serveur.
  const parsed = solicitationInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    requestType: formData.get("requestType"),
    message: formData.get("message"),
    consentGiven: formData.get("consentGiven") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const result = await submitSolicitation(formData);
    if (result.ok) {
      return { status: "success" };
    }
    return { status: "error", error: result.error };
  } catch {
    // Erreur réseau : la saisie reste dans le DOM (formulaire toujours monté, valeurs
    // conservées) — jamais perdre ce que la personne a écrit (UX-DR20).
    return {
      status: "error",
      error: "Une erreur réseau est survenue, merci de réessayer.",
    };
  }
}

export function SolicitationForm() {
  const [state, formAction2, isPending] = useActionState(formAction, INITIAL_STATE);

  // 🔴 CHAMPS CONTRÔLÉS, ET C'EST NON NÉGOCIABLE (défaut réel trouvé par `gate:solicitation`
  // pendant cette même story) : React 19 RÉINITIALISE les champs NON contrôlés d'un
  // `<form action={fn}>` une fois l'action résolue, succès COMME échec — un `<textarea>`
  // non contrôlé perdait donc le message tapé exactement au moment où UX-DR20 exige de le
  // conserver. Seul un champ piloté par le state React survit à ce reset.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState<(typeof SOLICITATION_TYPES)[number] | "">("");
  const [message, setMessage] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  // Erreurs déclenchées AU BLUR (AC5) — distinctes des erreurs de soumission de `state`,
  // fusionnées à l'affichage. Vidées à la soumission (voir `onSubmit` du <form>) :
  // `state.fieldErrors`, recalculé sur la validation COMPLÈTE, redevient seul juge après coup.
  const [blurErrors, setBlurErrors] = useState<FieldErrors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const fieldRefs: Record<FieldName, React.RefObject<HTMLElement | null>> = {
    name: nameRef,
    email: emailRef,
    requestType: firstRadioRef,
    message: messageRef,
    consentGiven: consentRef,
  };

  const fieldErrors: FieldErrors = { ...blurErrors, ...state.fieldErrors };

  useEffect(() => {
    if (!state.fieldErrors) return;
    const firstErrored = FIELD_ORDER.find((field) => state.fieldErrors?.[field]);
    if (firstErrored) {
      fieldRefs[firstErrored].current?.focus();
    }
    // fieldRefs est recréé à chaque rendu (refs stables) : ne dépendre que de l'état.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fieldErrors]);

  if (state.status === "success") {
    return (
      <p className={styles.confirmation} role="status" aria-live="polite">
        Merci, c&apos;est bien reçu — on te répond vite.
      </p>
    );
  }

  const handleBlur = (field: BlurValidatedField, rawValue: string) => () => {
    const msg = validateSingleField(field, rawValue);
    setBlurErrors((prev) => {
      const next = { ...prev };
      if (msg) {
        next[field] = msg;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const errorId = (field: FieldName) => `solicitation-${field}-error`;
  const describedBy = (field: FieldName) => (fieldErrors[field] ? errorId(field) : undefined);

  return (
    <form
      action={formAction2}
      // Vide les erreurs de blur AVANT l'envoi (pas dans un effet — voir react-hooks/set-state-in-effect) :
      // `state.fieldErrors`, recalculé sur la validation COMPLÈTE, redevient seul juge après coup.
      onSubmit={() => setBlurErrors({})}
      className={styles.form}
      noValidate
    >
      <div className={styles.field}>
        <label htmlFor="solicitation-name">Nom ou structure</label>
        <input
          ref={nameRef}
          id="solicitation-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur("name", name)}
          aria-invalid={fieldErrors.name ? "true" : undefined}
          aria-describedby={describedBy("name")}
        />
        {fieldErrors.name && (
          <p id={errorId("name")} className={styles.fieldError}>
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="solicitation-email">Email</label>
        <input
          ref={emailRef}
          id="solicitation-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleBlur("email", email)}
          aria-invalid={fieldErrors.email ? "true" : undefined}
          aria-describedby={describedBy("email")}
        />
        {fieldErrors.email && (
          <p id={errorId("email")} className={styles.fieldError}>
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* `aria-invalid` sur le `<fieldset>` (rôle `group`), pas sur chaque `<input
          type="radio">` : le rôle implicite `radio` ne supporte pas cet attribut
          (jsx-a11y/role-supports-aria-props) — le groupe entier porte l'état invalide. */}
      <fieldset
        className={styles.field}
        aria-invalid={fieldErrors.requestType ? "true" : undefined}
        aria-describedby={describedBy("requestType")}
      >
        <legend>Type de demande</legend>
        {SOLICITATION_TYPES.map((type, index) => (
          <label key={type} className={styles.radioLabel}>
            <input
              ref={index === 0 ? firstRadioRef : undefined}
              type="radio"
              name="requestType"
              value={type}
              checked={requestType === type}
              onChange={() => setRequestType(type)}
            />
            {SOLICITATION_TYPE_LABELS[type]}
          </label>
        ))}
        {fieldErrors.requestType && (
          <p id={errorId("requestType")} className={styles.fieldError}>
            {fieldErrors.requestType}
          </p>
        )}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="solicitation-message">Message</label>
        <textarea
          ref={messageRef}
          id="solicitation-message"
          name="message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={handleBlur("message", message)}
          aria-invalid={fieldErrors.message ? "true" : undefined}
          aria-describedby={describedBy("message")}
        />
        {fieldErrors.message && (
          <p id={errorId("message")} className={styles.fieldError}>
            {fieldErrors.message}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.consentLabel}>
          <input
            ref={consentRef}
            type="checkbox"
            name="consentGiven"
            value="on"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            aria-invalid={fieldErrors.consentGiven ? "true" : undefined}
            aria-describedby={describedBy("consentGiven")}
          />
          J&apos;accepte que ces informations soient utilisées pour me répondre.
        </label>
        {fieldErrors.consentGiven && (
          <p id={errorId("consentGiven")} className={styles.fieldError}>
            {fieldErrors.consentGiven}
          </p>
        )}
      </div>

      {/* Honeypot — jamais en position tab, jamais display:none (certains bots l'ignorent).
          Non contrôlé délibérément : un bot qui le remplit n'a pas besoin d'être « conservé »
          après une erreur, et le laisser incontrôlé simplifie le composant. */}
      <input
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className={styles.honeypot}
      />

      {state.status === "error" && state.error && (
        <p className={styles.formError} role="alert" aria-live="polite">
          {state.error}
        </p>
      )}

      {/* 🔴 JAMAIS `disabled` (AC5) — même pendant l'envoi : on laisse cliquer, l'anti-spam
          et le rate-limit serveur gèrent les soumissions multiples, pas l'UI. */}
      <Button type="submit">
        {isPending ? "Envoi…" : state.status === "error" ? "Réessayer" : "Envoyer la demande"}
      </Button>
    </form>
  );
}
