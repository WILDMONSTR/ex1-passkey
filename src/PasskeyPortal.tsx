import { useEffect, useState } from 'react';

const API_URL = 'https://zskattfklxijebwsgava.supabase.co/functions/v1/passkey-api';

type Passkey = {
  id: string;
  name: string;
  created_at: string;
  saved_location: string;
  device_type: string;
  backed_up: boolean;
};
type PrivateItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
};
type AuditEvent = {
  event_type: string;
  status_code: number;
  challenge_value: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
}

function registrationCredentialJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
  };
}

function authenticationCredentialJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
  };
}

async function api(action: string, payload: Record<string, unknown> = {}, session?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) headers['x-passkey-session'] = session;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(data.message || explainError(data.error || `HTTP ${response.status}`)));
    (error as Error & { code?: string }).code = String(data.error || '');
    throw error;
  }
  return data;
}

function explainError(code: string) {
  const messages: Record<string, string> = {
    username_invalid: '계정 이름은 영문/숫자로 시작하며, 3~32자의 영문·숫자·밑줄·하이픈만 사용할 수 있어요.',
    account_exists: '이미 사용 중인 계정 이름이에요. 다른 이름을 입력하세요.',
    account_or_passkey_not_found: '계정을 찾을 수 없거나 등록된 패스키가 없어요.',
    no_passkeys: '이 계정에는 등록된 패스키가 없어요.',
    challenge_invalid_or_used: '인증 요청이 만료되었거나 이미 사용됐어요. 다시 시도하세요.',
    registration_verification_failed: '패스키 등록 검증에 실패했어요. 등록 창에서 끝까지 완료했는지 확인하세요.',
    signature_verification_failed: '패스키 서명 검증에 실패했어요.',
    credential_not_owned_by_account: '이 패스키는 입력한 계정에 등록되어 있지 않아요.',
    last_passkey_blocked: '마지막 패스키는 삭제할 수 없어요. 먼저 두 번째 패스키를 등록하세요.',
    unauthorized: '로그인이 만료되었어요. 다시 패스키로 로그인하세요.',
    origin_not_allowed: '허용되지 않은 웹사이트에서 요청했어요. 공식 배포 주소에서 다시 접속하세요.',
  };
  return messages[code] || `요청을 처리하지 못했어요 (${code}). 다시 시도하거나 개발자 로그를 확인하세요.`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '예상하지 못한 오류가 발생했어요.';
}

export function PasskeyPortal() {
  const [registerUsername, setRegisterUsername] = useState('');
  const [passkeyName, setPasskeyName] = useState('내 기기 패스키');
  const [savedLocation, setSavedLocation] = useState('google-password-manager');
  const [loginUsername, setLoginUsername] = useState('');
  const [session, setSession] = useState<string | null>(() => {
    try { return sessionStorage.getItem('ex1-passkey-session'); } catch { return null; }
  });
  const [accountName, setAccountName] = useState('');
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [items, setItems] = useState<PrivateItem[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error' | 'success'>('info');

  async function loadPrivateArea(token: string) {
    try {
      const [privateResult, passkeyResult, auditResult] = await Promise.all([
        api('private', {}, token),
        api('passkeys', {}, token),
        api('audit', {}, token),
      ]);
      setAccountName(privateResult.account?.username || '');
      setItems(privateResult.items || []);
      setPasskeys(passkeyResult.passkeys || []);
      setEvents(auditResult.events || []);
      setSession(token);
      setMessage('인증 성공. 비공개 자료는 인증된 세션으로 서버에서 불러왔어요.');
      setMessageKind('success');
    } catch (error) {
      try { sessionStorage.removeItem('ex1-passkey-session'); } catch { /* private mode */ }
      setSession(null);
      setAccountName('');
      setItems([]);
      setPasskeys([]);
      setEvents([]);
      setMessage(errorMessage(error));
      setMessageKind('error');
    }
  }

  useEffect(() => {
    if (session) void loadPrivateArea(session);
    // 세션을 복원할 때 한 번만 서버에서 유효성을 확인합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registerPasskey() {
    setBusy(true);
    setMessage('');
    let challenge = '';
    let browserPromptStarted = false;
    try {
      if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) {
        throw new Error('이 브라우저에서 패스키를 사용할 수 없어요. HTTPS 공식 배포 주소와 최신 브라우저를 사용하세요.');
      }
      const optionsResult = await api('register-options', { username: registerUsername.trim(), savedLocation });
      challenge = String(optionsResult.challenge || '');
      const options = optionsResult.options;
      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: fromBase64Url(options.challenge),
        user: { ...options.user, id: fromBase64Url(options.user.id) },
        excludeCredentials: (options.excludeCredentials || []).map((item: { id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }) => ({
          ...item,
          id: fromBase64Url(item.id),
        })),
      };
      browserPromptStarted = true;
      const credential = await navigator.credentials.create({ publicKey });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('브라우저에서 패스키 등록이 완료되지 않았어요.');
      await api('register-verify', {
        challenge,
        credential: registrationCredentialJSON(credential),
        name: passkeyName.trim() || '내 패스키',
        savedLocation,
      });
      setLoginUsername(registerUsername.trim());
      setMessage('패스키 등록이 완료됐어요. 아래의 기존 계정 로그인 영역에서 같은 계정 이름으로 로그인해 비공개 자료를 확인하세요.');
      setMessageKind('success');
    } catch (error) {
      if (challenge && browserPromptStarted) {
        try { await api('register-cancel', { challenge }); } catch { /* 검증 단계에서 이미 사용된 challenge일 수 있음 */ }
      }
      setMessage(errorMessage(error));
      setMessageKind('error');
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPasskey() {
    setBusy(true);
    setMessage('');
    try {
      if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) {
        throw new Error('이 브라우저에서 패스키를 사용할 수 없어요. HTTPS 공식 배포 주소와 최신 브라우저를 사용하세요.');
      }
      const username = loginUsername.trim();
      const optionsResult = await api('login-options', { username });
      const options = optionsResult.options;
      const publicKey: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: fromBase64Url(options.challenge),
        allowCredentials: (options.allowCredentials || []).map((item: { id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }) => ({
          ...item,
          id: fromBase64Url(item.id),
        })),
      };
      const credential = await navigator.credentials.get({ publicKey });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('브라우저에서 패스키 인증이 완료되지 않았어요.');
      const verified = await api('login-verify', {
        challenge: optionsResult.challenge,
        credential: authenticationCredentialJSON(credential),
      });
      const token = String(verified.session || '');
      if (!token) throw new Error('서버가 세션을 발급하지 않았어요.');
      try { sessionStorage.setItem('ex1-passkey-session', token); } catch { /* in-memory session still works */ }
      setSession(token);
      await loadPrivateArea(token);
    } catch (error) {
      setMessage(errorMessage(error));
      setMessageKind('error');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      if (session) await api('logout', {}, session);
    } catch { /* server may already have expired the session */ }
    try { sessionStorage.removeItem('ex1-passkey-session'); } catch { /* private mode */ }
    setSession(null);
    setAccountName('');
    setItems([]);
    setPasskeys([]);
    setEvents([]);
    setMessage('로그아웃했어요. 비공개 자료 요청은 세션이 없어 거부됩니다.');
    setMessageKind('success');
    setBusy(false);
  }

  async function deletePasskey(id: string) {
    if (!session || !window.confirm('이 계정에서 이 패스키를 삭제할까요?')) return;
    setBusy(true);
    try {
      await api('delete-passkey', { id }, session);
      await loadPrivateArea(session);
      setMessage('패스키를 삭제했어요. 다른 패스키로 로그인할 수 있는지 확인하세요.');
      setMessageKind('success');
    } catch (error) {
      setMessage(errorMessage(error));
      setMessageKind('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="passkey-gate" className="relative border-t-4 border-dashed border-stone-300 bg-stone-100 px-4 py-10 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center mb-7">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-stone-800 px-3 py-1.5 text-xs font-bold tracking-wide text-white">
            <span aria-hidden="true">🔒</span> 공개 영역 종료 · 인증 경계
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">비공개 영역</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            여기부터는 공개 소개 페이지와 분리된 영역이에요. 패스키로 인증하기 전에는 비공개 자료를 내려받지 않으며,
            서버가 로그인 세션을 확인한 뒤 해당 계정의 자료만 반환합니다.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-300 text-stone-700">공개: 소개 · 취미 · 사진</span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-300 text-stone-700">비공개: 서버 인증 후 계정별 자료</span>
          </div>
        </div>

        {message && (
          <div role="status" aria-live="polite" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${messageKind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : messageKind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
            {message}
          </div>
        )}

        {!session ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-200 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-lg">＋</span>
                <div>
                  <h3 className="font-bold text-stone-900">새 계정 · 패스키 등록</h3>
                  <p className="text-xs text-stone-500">처음 이용할 때 한 번 진행하세요.</p>
                </div>
              </div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="register-username">새 계정 이름</label>
              <input id="register-username" autoComplete="username" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} maxLength={32} placeholder="예: student_a" className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="passkey-name">패스키 이름</label>
              <input id="passkey-name" value={passkeyName} onChange={(e) => setPasskeyName(e.target.value)} maxLength={80} placeholder="예: 내 노트북" className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="saved-location">패스키 등록 방식(선택)</label>
              <select id="saved-location" value={savedLocation} onChange={(e) => setSavedLocation(e.target.value)} className="mb-4 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                <option value="google-password-manager">Google 비밀번호 관리자 (Chrome)</option>
                <option value="device">이 기기 (Windows Hello 등)</option>
                <option value="security-key">외장 USB 보안 키</option>
                <option value="unknown">잘 모르겠어요 (이 기기 우선)</option>
              </select>
              <button type="button" disabled={busy || registerUsername.trim().length < 3} onClick={() => void registerPasskey()} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? '처리 중…' : '패스키 등록 시작'}
              </button>
              <p className="mt-3 text-xs leading-5 text-stone-500">선택한 종류에 맞춰 브라우저에 인증기를 요청합니다. Google 비밀번호 관리자/이 기기는 USB 키 대신 PC의 인증 방식을 우선하고, 외장 USB 보안 키를 선택하면 보안 키를 요청합니다. 실제 저장·동기화 방식은 Chrome과 Windows 설정에 따라 달라질 수 있어요.</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-sky-200 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-lg">↪</span>
                <div>
                  <h3 className="font-bold text-stone-900">기존 계정 · 패스키 로그인</h3>
                  <p className="text-xs text-stone-500">등록한 계정 이름으로 인증하세요.</p>
                </div>
              </div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="login-username">계정 이름</label>
              <input id="login-username" autoComplete="username webauthn" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} maxLength={32} placeholder="예: student_a" className="mb-4 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
              <button type="button" disabled={busy || loginUsername.trim().length < 3} onClick={() => void loginWithPasskey()} className="w-full rounded-lg bg-sky-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? '처리 중…' : '패스키로 로그인'}
              </button>
              <p className="mt-3 text-xs leading-5 text-stone-500">등록 당시 사용한 기기나 동기화된 패스키를 선택하세요. 로그인에 성공해야 아래 비공개 자료가 표시됩니다.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-200 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">인증 완료</p>
                <h3 className="text-lg font-bold text-stone-900">계정: {accountName || '확인 중'}</h3>
                <p className="text-xs text-stone-500">서버에서 이 계정의 비공개 자료를 가져왔습니다.</p>
              </div>
              <button type="button" onClick={() => void logout()} disabled={busy} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">로그아웃</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                <h3 className="mb-3 font-bold text-stone-900">이 계정의 비공개 자료 <span className="ml-1 text-xs font-normal text-stone-500">({items.length}개)</span></h3>
                {items.length ? <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-100"><div className="mb-1 flex flex-wrap items-center gap-2"><h4 className="font-semibold text-stone-900">{item.title}</h4><span className="rounded-full bg-white px-2 py-0.5 text-xs text-stone-500 ring-1 ring-stone-200">{item.category}</span></div><p className="text-sm leading-6 text-stone-700">{item.content}</p></article>)}</div> : <p className="text-sm text-stone-500">표시할 자료가 없어요.</p>}
                <p className="mt-4 text-xs text-stone-500">이 데모의 기본 자료는 실제 개인정보가 아닌 가상 시험 데이터입니다.</p>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                  <h3 className="mb-3 font-bold text-stone-900">등록된 패스키 <span className="text-xs font-normal text-stone-500">({passkeys.length}개)</span></h3>
                  {passkeys.length ? <ul className="space-y-3">{passkeys.map((key) => <li key={key.id} className="rounded-xl border border-stone-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-stone-900">{key.name}</p><p className="mt-1 text-xs text-stone-500">등록일: {new Date(key.created_at).toLocaleString('ko-KR')}</p><p className="text-xs text-stone-500">저장 위치 표기: {key.saved_location}</p></div><button type="button" disabled={busy} onClick={() => void deletePasskey(key.id)} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">삭제</button></div></li>)}</ul> : <p className="text-sm text-stone-500">등록된 패스키가 없어요.</p>}
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                  <h3 className="mb-2 font-bold text-stone-900">보안 기록</h3>
                  <p className="mb-3 text-xs text-stone-500">이 계정에 연결된 최근 서버 처리 결과입니다. 세션 토큰은 표시하지 않습니다.</p>
                  {events.length ? <ul className="max-h-64 space-y-2 overflow-auto">{events.map((event, index) => <li key={`${event.created_at}-${index}`} className="rounded-lg bg-stone-50 px-3 py-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-stone-700">{event.event_type}</span><span className={event.status_code >= 400 ? 'text-rose-700' : 'text-emerald-700'}>HTTP {event.status_code}</span></div><p className="mt-1 text-stone-500">{new Date(event.created_at).toLocaleString('ko-KR')}</p>{event.challenge_value && <p className="mt-1 break-all font-mono text-stone-500">challenge: {event.challenge_value.slice(0, 12)}…</p>}</li>)}</ul> : <p className="text-sm text-stone-500">기록이 없어요.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
