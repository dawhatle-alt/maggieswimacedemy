'use client';
import { useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
export default function SignIn({
  ready = false,
}: {
  ready?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function start(provider: string, email?: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, email }),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.url) window.location.assign(d.url);
      else
        setMessage(
          'Check your email for a one-time sign-in link. Open it in this browser.',
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 23, fontWeight: 800 }}>
        Your lessons, in one place.
      </h3>
      <p className="muted">
        Sign in or create your parent account to request lessons, check upcoming
        swims, and view invoices.
      </p>
      {!ready && (
        <p className="notice">
          Parent sign-in is being connected. Please check back soon.
        </p>
      )}
      <button
        className="secondary full"
        disabled={busy || !ready}
        onClick={() => void start('google')}
      >
        <b style={{ marginRight: 12 }}>G</b>Continue with Google
      </button>
      <p className="muted" style={{ textAlign: 'center' }}>
        or use your email
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void start('email', String(f.get('email')));
        }}
      >
        <label className="field">
          Email address
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>
        <button className="primary full" disabled={busy || !ready}>
          <Mail size={17} />
          Send me a sign-in link <ArrowRight size={16} />
        </button>
      </form>
      <p className="muted">
        No password to remember. Use the same email each time to keep your
        family’s lessons together.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
    </div>
  );
}
