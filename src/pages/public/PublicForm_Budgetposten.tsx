import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupKey } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '6a0f4fd5f913a3aa3d026472';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormBudgetposten() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Budgetposten — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input
              id="bezeichnung"
              value={fields.bezeichnung ?? ''}
              onChange={e => setFields(f => ({ ...f, bezeichnung: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geplanter_betrag">Geplanter Betrag (€)</Label>
            <Input
              id="geplanter_betrag"
              type="number"
              value={fields.geplanter_betrag ?? ''}
              onChange={e => setFields(f => ({ ...f, geplanter_betrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tatsaechlicher_betrag">Tatsächlicher Betrag (€)</Label>
            <Input
              id="tatsaechlicher_betrag"
              type="number"
              value={fields.tatsaechlicher_betrag ?? ''}
              onChange={e => setFields(f => ({ ...f, tatsaechlicher_betrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ausgabendatum">Datum der Ausgabe</Label>
            <Input
              id="ausgabendatum"
              type="date"
              value={fields.ausgabendatum ?? ''}
              onChange={e => setFields(f => ({ ...f, ausgabendatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zahlungsart">Zahlungsart</Label>
            <Select
              value={lookupKey(fields.zahlungsart) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zahlungsart: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="zahlungsart"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="bargeld">Bargeld</SelectItem>
                <SelectItem value="kreditkarte">Kreditkarte</SelectItem>
                <SelectItem value="ec_karte">EC-Karte</SelectItem>
                <SelectItem value="online">Online-Zahlung</SelectItem>
                <SelectItem value="ueberweisung">Überweisung</SelectItem>
                <SelectItem value="sonstige">Sonstige</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bereits_bezahlt">Bereits bezahlt</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="bereits_bezahlt"
                checked={!!fields.bereits_bezahlt}
                onCheckedChange={(v) => setFields(f => ({ ...f, bereits_bezahlt: !!v }))}
              />
              <Label htmlFor="bereits_bezahlt" className="font-normal">Bereits bezahlt</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="beleg_vorhanden">Beleg vorhanden</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="beleg_vorhanden"
                checked={!!fields.beleg_vorhanden}
                onCheckedChange={(v) => setFields(f => ({ ...f, beleg_vorhanden: !!v }))}
              />
              <Label htmlFor="beleg_vorhanden" className="font-normal">Beleg vorhanden</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anmerkungen">Anmerkungen</Label>
            <Textarea
              id="anmerkungen"
              value={fields.anmerkungen ?? ''}
              onChange={e => setFields(f => ({ ...f, anmerkungen: e.target.value }))}
              rows={3}
            />
          </div>

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
