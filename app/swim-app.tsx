'use client';
import SignIn from './sign-in';
import { useEffect, useState } from 'react';
import {
  Waves,
  ArrowRight,
  Clock,
  MapPin,
  Heart,
  CalendarDays,
  UserRound,
  Sun,
  ArrowLeft,
  Check,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  money,
  displayDate,
  displayTime,
  DEFAULT_SETTINGS,
} from '@/lib/domain';
type Row = Record<string, any>;
async function request(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || 'Please try again.');
  return d;
}
function Field({
  label,
  name,
  defaultValue = '',
  type = 'text',
  required = true,
  min,
  max,
  step,
}: any) {
  return (
    <label className="field">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
function LocationChoice({ value, onChange, both = true }: any) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      aria-label="Lesson location"
    >
      {(both ? ['community', 'home', 'both'] : ['community', 'home']).map(
        (v) => (
          <label key={v} className="radio-line">
            <RadioGroupItem value={v} />
            {v === 'community'
              ? 'Forest Creek community pool'
              : v === 'home'
                ? 'Parent’s home pool'
                : 'Either pool — parent chooses'}
          </label>
        ),
      )}
    </RadioGroup>
  );
}
export default function SwimApp() {
  const [view, setView] = useState('book'),
    [data, setData] = useState<Row>({
      settings: DEFAULT_SETTINGS,
      services: [],
      user: null,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [service, setService] = useState<Row | null>(null),
    [slots, setSlots] = useState<Row[]>([]),
    [slot, setSlot] = useState<Row | null>(null),
    [step, setStep] = useState(1),
    [location, setLocation] = useState('community'),
    [guardian, setGuardian] = useState(false);
  const [bookings, setBookings] = useState<Row[]>([]),
    [admin, setAdmin] = useState<Row | null>(null),
    [tab, setTab] = useState('requests'),
    [editing, setEditing] = useState<Row | null>(null),
    [scheduleService, setScheduleService] = useState(''),
    [scheduleLocation, setScheduleLocation] = useState('both'),
    [isOpen, setIsOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    text: string;
    run: () => Promise<void>;
  } | null>(null);
  async function load() {
    setError('');
    try {
      const d = await request('bootstrap');
      setData(d);
      setIsOpen(d.settings.open);
      return d;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function loadBookings() {
    try {
      setBookings(await request('bookings'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadAdmin() {
    try {
      setAdmin(await request('manage'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('view');
    if (q === 'portal' || q === 'manage') setView(q);
    void load().then(() => {
      if (new URLSearchParams(window.location.search).has('authError'))
        setError(
          'That sign-in link could not be verified. Request a new link and open it in the same browser.',
        );
    });
  }, []);
  useEffect(() => {
    if (view === 'portal' && data.user) void loadBookings();
    if (view === 'manage' && data.user?.isAdmin) void loadAdmin();
  }, [view, data.user?.userId]);
  function navigate(v: string) {
    setView(v);
    setError('');
    setNotice('');
    window.history.replaceState(null, '', v === 'book' ? '/' : '/?view=' + v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function act(run: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(s: Row) {
    await act(async () => {
      setService(s);
      setSlot(null);
      setSlots(await request('slots?service=' + encodeURIComponent(s.id)));
      setStep(2);
    });
  }
  async function saveAdmin(payload: Row, message: string) {
    await request('manage', 'POST', payload);
    await loadAdmin();
    await load();
    setNotice(message);
  }
  async function updateBooking(id: string, status: string) {
    await request('bookings/' + id, 'PATCH', { status });
    if (view === 'manage') await loadAdmin();
    else await loadBookings();
    setNotice('Booking updated.');
  }
  async function invoice(id: string, action: string) {
    await request('bookings/' + id + '/invoice', 'POST', { action });
    if (view === 'manage') await loadAdmin();
    else await loadBookings();
    setNotice(
      action === 'create'
        ? 'Square invoice is ready in the family portal.'
        : 'Invoice status refreshed from Square.',
    );
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'start_lesson_request',
          title: 'Choose a swim lesson',
          description:
            'Choose an available lesson and display times. Does not submit a booking request.',
          inputSchema: {
            type: 'object',
            properties: { serviceId: { type: 'string' } },
            required: ['serviceId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input: any) {
            if (!input || typeof input.serviceId !== 'string')
              throw new Error('serviceId is required');
            const s = data.services.find((s: Row) => s.id === input.serviceId);
            if (!s) throw new Error('Unknown lesson');
            const available = await request(
              'slots?service=' + encodeURIComponent(s.id),
            );
            navigate('book');
            setService(s);
            setSlots(available);
            setSlot(null);
            setStep(2);
            return {
              serviceId: s.id,
              availableTimes: available.length,
              submitted: false,
            };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, [data.services]);
  function bookingCard(b: Row, manage = false) {
    return (
      <article key={b.id} className="panel booking-item">
        <div className="row">
          <div>
            <span className={'status ' + b.status}>
              {b.status === 'pending' ? 'Awaiting Maggie’s approval' : b.status}
            </span>
            <h3>
              {b.service_name} · {b.swimmer}
            </h3>
          </div>
          <b>{money(b.price)}</b>
        </div>
        <div className="inline-details">
          <span>
            <CalendarDays size={16} style={{ display: 'inline' }} />{' '}
            {displayDate(b.start)}
          </span>
          <span>
            {displayTime(b.start)} – {displayTime(b.end)} CT
          </span>
          <span>
            {b.location === 'home' ? 'Home pool' : data.settings.poolName}
          </span>
        </div>
        <p className="muted">{b.address}</p>
        {manage && (
          <>
            <p className="muted">
              Parent: {b.parent} · {b.email} · {b.phone}
            </p>
            {b.notes && <p className="notice">{b.notes}</p>}
          </>
        )}
        <p className="muted">
          {b.invoice_status
            ? 'Square invoice: ' +
              b.invoice_status.replaceAll('_', ' ').toLowerCase()
            : b.price === 0
              ? 'No payment required.'
              : 'Invoice will appear here after Maggie prepares it.'}
        </p>
        <div className="actions">
          {manage && b.status === 'pending' && (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void act(() => updateBooking(b.id, 'confirmed'))}
              >
                <Check size={16} />
                Approve request
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    text: 'Decline this lesson request and release the time?',
                    run: () => updateBooking(b.id, 'declined'),
                  })
                }
              >
                Decline
              </button>
            </>
          )}
          {manage && b.status === 'confirmed' && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void act(() => updateBooking(b.id, 'completed'))}
            >
              Mark completed
            </button>
          )}
          {((manage && ['pending', 'confirmed'].includes(b.status)) ||
            (!manage && b.status === 'pending')) && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  text: 'Cancel this lesson and release the time?',
                  run: () => updateBooking(b.id, 'cancelled'),
                })
              }
            >
              Cancel {b.status === 'pending' ? 'request' : 'lesson'}
            </button>
          )}
          {manage &&
            ['confirmed', 'completed'].includes(b.status) &&
            (!b.invoice_id || b.invoice_status === 'DRAFT') &&
            b.price > 0 && (
              <button
                className="primary"
                disabled={busy || !data.squareReady}
                onClick={() =>
                  setConfirm({
                    text:
                      'Create a ' +
                      money(b.price) +
                      ' Square invoice for ' +
                      b.parent +
                      '? It will be available in the family portal. No email will be sent.',
                    run: () => invoice(b.id, 'create'),
                  })
                }
              >
                Create Square invoice
              </button>
            )}
          {b.invoice_url && (
            <a
              className="primary"
              href={b.invoice_url}
              target="_blank"
              rel="noreferrer"
            >
              {b.invoice_status === 'PAID'
                ? 'View Square receipt'
                : 'View / pay Square invoice'}{' '}
              <ArrowRight size={15} />
            </a>
          )}
          {b.invoice_id && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void act(() => invoice(b.id, 'refresh'))}
            >
              <RefreshCw size={14} style={{ display: 'inline' }} /> Refresh
              payment status
            </button>
          )}
        </div>
        {!manage && b.status === 'confirmed' && (
          <p className="muted">
            Need a change? Contact Maggie to arrange a different time.
          </p>
        )}
      </article>
    );
  }
  const pending =
    admin?.bookings.filter((b: Row) => b.status === 'pending') || [];
  const upcoming =
    admin?.bookings.filter((b: Row) => b.status === 'confirmed') || [];
  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('book');
          }}
        >
          <span className="brand-icon">
            <Waves />
          </span>
          <span>
            Maggie’s<span className="brand-sub">SWIM ACADEMY</span>
          </span>
        </a>
        <nav>
          <a
            className={view === 'book' ? 'active' : ''}
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('book');
            }}
          >
            Book a lesson
          </a>
          <a
            className={view === 'portal' ? 'active' : ''}
            href="/?view=portal"
            onClick={(e) => {
              e.preventDefault();
              navigate('portal');
            }}
          >
            <UserRound size={17} />
            Family portal
          </a>
          <a
            href="/?view=manage"
            onClick={(e) => {
              e.preventDefault();
              navigate('manage');
            }}
          >
            Maggie’s dashboard <ArrowRight size={16} />
          </a>
        </nav>
      </header>
      <main className="shell">
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="success">
            {notice}
          </div>
        )}
        {view === 'book' && (
          <>
            <section className="intro">
              <div>
                <div className="eyebrow">
                  <Sun size={17} /> LITTLE SWIMMERS. BIG POSSIBILITIES.
                </div>
                <h1>
                  A little splash.
                  <br />
                  <span>A lot of confidence.</span>
                </h1>
                <p>
                  Swim lessons with Maggie, at your pace.
                  <br />
                  Pick a lesson. Find a time. Let’s make waves.
                </p>
                <span className="location">
                  <MapPin size={16} /> Forest Creek · Round Rock, Texas
                </span>
              </div>
              <div className="intro-art">
                <img
                  src="/swim-lessons.png"
                  alt="Children enjoying a swim lesson with their instructor"
                />
                <span className="art-note">
                  <Heart size={18} /> Every little splash counts.
                </span>
              </div>
            </section>
            <section className="booking-layout">
              <div>
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">LET’S GET IN THE WATER</div>
                    <h2>
                      {step === 1
                        ? 'Find their next little win.'
                        : step === 2
                          ? 'Make time for a splash.'
                          : 'Tell Maggie a little more.'}
                    </h2>
                  </div>
                  <span className="step-count">STEP {step} OF 3</span>
                </div>
                <div className="steps">
                  {[
                    'Choose a lesson',
                    'Pick a time',
                    'Request your lesson',
                  ].map((s, i) => (
                    <span className={step === i + 1 ? 'current' : ''} key={s}>
                      {i + 1} {s}
                    </span>
                  ))}
                </div>
                {loading ? (
                  <div className="notice">Loading lessons…</div>
                ) : step === 1 ? (
                  <>
                    {data.services.map((s: Row) => (
                      <button
                        key={s.id}
                        className="lesson-card"
                        disabled={busy}
                        onClick={() => void choose(s)}
                      >
                        <div className="lesson-icon">
                          <Waves />
                        </div>
                        <div>
                          <span className="pill">SWIM WITH MAGGIE</span>
                          <h3>{s.name}</h3>
                          <p>{s.description}</p>
                          <span className="meta">
                            <Clock size={15} /> {s.duration} minutes ·{' '}
                            {money(s.price)}
                          </span>
                        </div>
                        <ArrowRight />
                      </button>
                    ))}
                    {!data.services.length && (
                      <>
                        <div className="lesson-card">
                          <div className="lesson-icon">
                            <Waves />
                          </div>
                          <div>
                            <span className="pill">SWIM WITH MAGGIE</span>
                            <h3>Lessons made for your swimmer</h3>
                            <p>
                              Individual attention, little milestones, and lots
                              of encouragement.
                            </p>
                            <span className="meta">
                              Lesson options and prices coming soon
                            </span>
                          </div>
                        </div>
                        <div className="notice">
                          Maggie is getting her schedule ready. Check back for
                          available lessons.
                        </div>
                      </>
                    )}
                    {!data.settings.open && !!data.services.length && (
                      <div className="notice">
                        You can explore lessons. Maggie will open requests when
                        her schedule is ready.
                      </div>
                    )}
                  </>
                ) : step === 2 ? (
                  <>
                    <button className="secondary" onClick={() => setStep(1)}>
                      <ArrowLeft size={14} style={{ display: 'inline' }} />{' '}
                      Lessons
                    </button>
                    <p className="muted">
                      All times are Central Time. Your request holds the time
                      while Maggie reviews it.
                    </p>
                    <div className="slot-grid">
                      {slots.map((s) => (
                        <button
                          key={s.id}
                          className={
                            'slot ' + (slot?.id === s.id ? 'selected' : '')
                          }
                          onClick={() => {
                            setSlot(s);
                            setLocation(
                              s.location === 'home' ? 'home' : 'community',
                            );
                          }}
                        >
                          <b>{displayDate(s.start)}</b>
                          <span>
                            {displayTime(s.start)} · {service?.duration} min
                          </span>
                          <span>
                            {s.location === 'both'
                              ? 'Your pool or Forest Creek'
                              : s.location === 'home'
                                ? 'Home pool'
                                : 'Forest Creek pool'}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!slots.length && (
                      <div className="empty">
                        <CalendarDays style={{ margin: 'auto' }} />
                        <h3>No open times just yet</h3>
                        <p>Maggie will add more availability here.</p>
                      </div>
                    )}
                    <div className="actions">
                      <button
                        className="primary"
                        disabled={!slot || !data.settings.open}
                        onClick={() => setStep(3)}
                      >
                        Continue <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button className="secondary" onClick={() => setStep(2)}>
                      Back to times
                    </button>
                    {!data.user ? (
                      <SignIn
                        ready={data.authReady}
                      />
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          void act(async () => {
                            const result = await request('bookings', 'POST', {
                              ...f,
                              slotId: slot?.id,
                              location,
                              guardian,
                            });
                            navigate('portal');
                            await loadBookings();
                            setNotice(
                              result.emailStatus === 'sent'
                                ? 'Request sent to Maggie. A request summary has been emailed to you. Your lesson is awaiting her approval.'
                                : 'Your request is saved and awaiting Maggie’s approval. The summary email is delayed; your details are available here in the portal.',
                            );
                            setStep(1);
                            setSlot(null);
                            setService(null);
                          });
                        }}
                      >
                        <div className="form-grid">
                          <Field
                            label="Parent / guardian name"
                            name="parent"
                            defaultValue={data.user.fullName || ''}
                          />
                          <Field label="Swimmer’s first name" name="swimmer" />
                          <Field
                            label="Parent’s phone"
                            name="phone"
                            type="tel"
                          />
                        </div>
                        <p className="muted">
                          Account email: {data.user.email}
                        </p>
                        <h3>Where shall we swim?</h3>
                        {slot?.location === 'both' ? (
                          <LocationChoice
                            value={location}
                            onChange={setLocation}
                            both={false}
                          />
                        ) : (
                          <p className="notice">
                            {location === 'home'
                              ? 'Your home pool'
                              : data.settings.poolName}
                          </p>
                        )}
                        {location === 'home' ? (
                          <>
                            <Field
                              label="Home pool street address"
                              name="address"
                            />
                            <p className="muted">
                              Serving {data.settings.homeArea}. Maggie will
                              review travel arrangements before approval.
                            </p>
                          </>
                        ) : (
                          <p className="muted">{data.settings.poolAddress}</p>
                        )}
                        <label className="field">
                          Anything Maggie should know?{' '}
                          <textarea
                            name="notes"
                            maxLength={1200}
                            placeholder="Age range, comfort in the water, and what you’d like to work on."
                          />
                          <small>
                            Optional. Please leave medical or sensitive
                            information for a direct conversation.
                          </small>
                        </label>
                        <label className="checkline">
                          <Checkbox
                            checked={guardian}
                            onCheckedChange={(v) => setGuardian(v === true)}
                          />
                          I am the swimmer’s parent or guardian.
                        </label>
                        <p className="notice">
                          This is a request, not a confirmed lesson. Check your
                          family portal for Maggie’s decision. Payment is
                          handled separately through a Square invoice.
                        </p>
                        <button
                          className="primary"
                          type="submit"
                          disabled={busy || !guardian || !data.settings.open}
                        >
                          {busy ? 'Sending…' : 'Request this lesson'}{' '}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
              <aside className="summary">
                <div className="summary-icon">
                  <CalendarDays />
                </div>
                <h3>
                  {service ? (
                    service.name
                  ) : (
                    <>
                      Good things start
                      <br />
                      with a little splash.
                    </>
                  )}
                </h3>
                <p>
                  {service
                    ? service.duration + ' minutes · ' + money(service.price)
                    : 'Choose a lesson and a time to send Maggie a request.'}
                </p>
                {slot && (
                  <p>
                    <b>
                      {displayDate(slot.start)}
                      <br />
                      {displayTime(slot.start)} Central Time
                    </b>
                  </p>
                )}
                <hr />
                <div className="detail">
                  <MapPin />
                  <div>
                    <b>Your pool or ours</b>
                    <p>{data.settings.poolName} or your home pool.</p>
                  </div>
                </div>
                <div className="detail">
                  <Heart />
                  <div>
                    <b>Confirmed by Maggie</b>
                    <p>
                      She’ll review the details before your lesson is confirmed.
                    </p>
                  </div>
                </div>
                <span className="square-note">
                  Invoices handled securely by Square
                </span>
              </aside>
            </section>
          </>
        )}
        {view === 'portal' && (
          <>
            <div className="eyebrow">YOUR FAMILY’S SWIM SPACE</div>
            <div className="row">
              <h2>Your next splash, all set.</h2>
              <button className="primary" onClick={() => navigate('book')}>
                Request a lesson <Plus size={16} />
              </button>
            </div>
            {!data.user ? (
              <SignIn
                ready={data.authReady}
              />
            ) : (
              <>
                <p className="muted">
                  Signed in as {data.user.email} ·{' '}
                  <button
                    onClick={() =>
                      void act(async () => {
                        
                          await request('auth/logout', 'POST', {});
                          setBookings([]);
                          setAdmin(null);
                          await load();
                      })
                    }
                  >
                    Sign out
                  </button>
                </p>
                <div className="notice">
                  Requests are reviewed by Maggie. We email your request details and approval. Check here for updates and
                  Square invoices.
                </div>
                <button
                  className="secondary"
                  onClick={() => void loadBookings()}
                >
                  Refresh lessons
                </button>
                {bookings.length ? (
                  bookings.map((b) => bookingCard(b))
                ) : (
                  <div className="empty">
                    <Waves style={{ margin: 'auto' }} />
                    <h3>A little adventure is waiting.</h3>
                    <p>Your lesson requests will appear here.</p>
                    <button
                      className="primary"
                      onClick={() => navigate('book')}
                    >
                      Find a lesson
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {view === 'manage' && (
          <>
            <div className="eyebrow">MAGGIE’S POOLSIDE PLANNER</div>
            <div className="row">
              <h2>A great day to make waves.</h2>
              {data.user?.isAdmin && (
                <button className="secondary" onClick={() => void loadAdmin()}>
                  Refresh dashboard
                </button>
              )}
            </div>
            {!data.user ? (
              <SignIn
                ready={data.authReady}
              />
            ) : !data.user.isAdmin ? (
              <div className="panel">
                <h3>Maggie’s private dashboard</h3>
                <p className="muted">
                  {data.adminConfigured
                    ? 'This account does not have management access. Sign in with Maggie’s authorized email.'
                    : 'Management access is waiting for Maggie’s email to be configured.'}
                </p>
                <p className="muted">Signed in as {data.user.email}</p>
                <button
                  className="secondary"
                  onClick={() =>
                    void act(async () => {
                      
                        await request('auth/logout', 'POST', {});
                        await load();
                    })
                  }
                >
                  Switch account
                </button>
              </div>
            ) : (
              admin && (
                <>
                  <div className="metric-grid">
                    <div className="metric">
                      <strong>{pending.length}</strong>
                      <span>Requests to review</span>
                    </div>
                    <div className="metric">
                      <strong>{upcoming.length}</strong>
                      <span>Confirmed lessons</span>
                    </div>
                    <div className="metric">
                      <strong>
                        {admin.slots.filter((s: Row) => s.active).length}
                      </strong>
                      <span>Scheduled times</span>
                    </div>
                  </div>
                  {!data.squareReady && (
                    <div className="notice">
                      Square is not connected yet. You can manage bookings;
                      invoice creation will be available after setup.
                    </div>
                  )}
                  <Tabs
                    className="dashboard-tabs"
                    value={tab}
                    onValueChange={(v) => setTab(String(v))}
                  >
                    <TabsList>
                      <TabsTrigger value="requests">
                        Requests & lessons
                      </TabsTrigger>
                      <TabsTrigger value="availability">
                        Availability
                      </TabsTrigger>
                      <TabsTrigger value="lessons">Lesson options</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>
                    <TabsContent value="requests">
                      {!!admin.emails?.some((e: Row) => e.state === 'pending' || e.state === 'review') && (
                        <div className="notice" role="status">
                          <p>Some booking emails need attention. Bookings are saved.</p>
                          {admin.emails.filter((e: Row) => e.state === 'pending' || e.state === 'review').map((e: Row) => (
                            <p key={e.id}>
                              {admin.bookings.find((b: Row) => b.id === e.booking_id)?.parent || 'Customer'} — {e.kind === 'submitted' ? 'request summary' : 'approval confirmation'}: {e.state === 'review' ? 'Check delivery in Resend before contacting the family; the safe retry window has passed.' : 'Waiting to send'}
                            </p>
                          ))}
                          <button className="secondary" disabled={busy} onClick={() => void act(async () => {
                            const result = await request('booking-emails', 'POST', {});
                            await loadAdmin();
                            setNotice(`${result.sent} booking email(s) accepted for delivery. Any remaining messages are listed below.`);
                          })}>Retry pending emails</button>
                        </div>
                      )}
                      {admin.bookings.length ? (
                        admin.bookings.map((b: Row) => bookingCard(b, true))
                      ) : (
                        <div className="empty">
                          <h3>Your next swimmer is on the way.</h3>
                          <p>
                            Add a lesson, set available times, and open booking
                            in Settings.
                          </p>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="availability">
                      <div className="panel">
                        <h3>Add an available lesson time</h3>
                        <p className="muted">
                          Central Time · A {data.settings.bufferMinutes}-minute
                          buffer follows each lesson. Overlapping times are
                          blocked.
                        </p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = Object.fromEntries(
                              new FormData(e.currentTarget),
                            );
                            void act(() =>
                              saveAdmin(
                                {
                                  ...f,
                                  action: 'slot',
                                  serviceId: scheduleService,
                                  location: scheduleLocation,
                                },
                                'Available time added.',
                              ),
                            );
                          }}
                        >
                          <RadioGroup
                            aria-label="Lesson type"
                            value={scheduleService}
                            onValueChange={(v) => setScheduleService(String(v))}
                          >
                            {admin.services
                              .filter((s: Row) => s.active)
                              .map((s: Row) => (
                                <label className="radio-line" key={s.id}>
                                  <RadioGroupItem value={s.id} />
                                  {s.name} · {s.duration} min
                                </label>
                              ))}
                          </RadioGroup>
                          <Field
                            label="Date and start time (Central Time)"
                            name="start"
                            type="datetime-local"
                          />
                          <LocationChoice
                            value={scheduleLocation}
                            onChange={setScheduleLocation}
                          />
                          <button
                            className="primary"
                            style={{ marginTop: 20 }}
                            disabled={busy || !scheduleService}
                          >
                            <Plus size={16} />
                            Add time
                          </button>
                        </form>
                      </div>
                      {admin.slots
                        .filter((s: Row) => s.active)
                        .map((s: Row) => (
                          <div className="panel row" key={s.id}>
                            <div>
                              <b>
                                {displayDate(s.start)} · {displayTime(s.start)}
                              </b>
                              <p className="muted">
                                {s.service_name} ·{' '}
                                {s.location === 'both'
                                  ? 'Either pool'
                                  : s.location === 'home'
                                    ? 'Home pool'
                                    : 'Forest Creek'}{' '}
                                · buffer until {displayTime(s.blocked_until)}
                              </p>
                            </div>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  text: 'Remove this available time?',
                                  run: () =>
                                    saveAdmin(
                                      { action: 'removeSlot', id: s.id },
                                      'Time removed.',
                                    ),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </TabsContent>
                    <TabsContent value="lessons">
                      <div className="panel">
                        <h3>
                          {editing ? 'Edit lesson' : 'Add a lesson option'}
                        </h3>
                        <form
                          key={editing?.id || 'new'}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = Object.fromEntries(
                              new FormData(e.currentTarget),
                            );
                            void act(async () => {
                              await saveAdmin(
                                {
                                  ...f,
                                  action: 'service',
                                  id: editing?.id,
                                  duration: Number(f.duration),
                                  price: Math.round(Number(f.price) * 100),
                                  active: true,
                                },
                                'Lesson saved. Existing requests keep their original price.',
                              );
                              setEditing(null);
                            });
                          }}
                        >
                          <Field
                            label="Lesson name"
                            name="name"
                            defaultValue={editing?.name || ''}
                          />
                          <label className="field">
                            Description
                            <textarea
                              name="description"
                              defaultValue={editing?.description || ''}
                              required
                              maxLength={500}
                            />
                          </label>
                          <div className="form-grid">
                            <Field
                              label="Length in minutes"
                              name="duration"
                              type="number"
                              min={10}
                              max={180}
                              step={5}
                              defaultValue={editing?.duration || 30}
                            />
                            <Field
                              label="Price in US dollars"
                              name="price"
                              type="number"
                              min={0}
                              max={1000}
                              step=".01"
                              defaultValue={editing ? editing.price / 100 : ''}
                            />
                          </div>
                          <div className="actions">
                            <button className="primary" disabled={busy}>
                              Save lesson
                            </button>
                            {editing && (
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setEditing(null)}
                              >
                                Cancel editing
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                      {admin.services.map((s: Row) => (
                        <div className="panel row" key={s.id}>
                          <div>
                            <b>
                              {s.name} {!s.active && '(hidden)'}
                            </b>
                            <p className="muted">
                              {s.duration} minutes · {money(s.price)}
                            </p>
                          </div>
                          <div className="actions">
                            <button
                              className="secondary"
                              onClick={() => setEditing(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void act(() =>
                                  saveAdmin(
                                    {
                                      ...s,
                                      action: 'service',
                                      active: !s.active,
                                    },
                                    s.active
                                      ? 'Lesson hidden from new bookings.'
                                      : 'Lesson available again.',
                                  ),
                                )
                              }
                            >
                              {s.active ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="settings">
                      <form
                        className="panel"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          void act(() =>
                            saveAdmin(
                              {
                                ...f,
                                action: 'settings',
                                bufferMinutes: Number(f.bufferMinutes),
                                open: isOpen,
                              },
                              'Settings saved.',
                            ),
                          );
                        }}
                      >
                        <h3>Your pools, your pace.</h3>
                        <Field
                          label="Community pool name"
                          name="poolName"
                          defaultValue={admin.settings.poolName}
                        />
                        <Field
                          label="Pool address / meeting instructions"
                          name="poolAddress"
                          defaultValue={admin.settings.poolAddress}
                        />
                        <Field
                          label="Home pool service area"
                          name="homeArea"
                          defaultValue={admin.settings.homeArea}
                        />
                        <Field
                          label="Buffer after each new lesson (minutes)"
                          name="bufferMinutes"
                          type="number"
                          min={0}
                          max={120}
                          step={5}
                          defaultValue={admin.settings.bufferMinutes}
                        />
                        <p className="muted">
                          Buffer changes apply to newly added times. Existing
                          times keep their saved buffer.
                        </p>
                        <label className="checkline">
                          <Checkbox
                            checked={isOpen}
                            onCheckedChange={(v) => setIsOpen(v === true)}
                          />
                          Accept new lesson requests
                        </label>
                        <button className="primary" disabled={busy}>
                          Save settings
                        </button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </>
              )
            )}
          </>
        )}
      </main>
      <footer>
        <a className="brand" href="/">
          <Waves /> Maggie’s Swim Academy
        </a>
        <span>Little splashes. Lifelong confidence.</span>
        <span>Round Rock, TX · Central Time</span>
      </footer>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Please confirm</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirm;
                setConfirm(null);
                if (action) void act(action.run);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
