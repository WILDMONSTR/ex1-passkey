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

type PendingRegistration = {
  challenge: string;
  publicKey: PublicKeyCredentialCreationOptions;
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
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
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
    let activeRegistration: PendingRegistration | null = pendingRegistration;
    let browserPromptStarted = false;
    try {
      if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) {
        throw new Error('이 브라우저에서 패스키를 사용할 수 없어요. HTTPS 공식 배포 주소와 최신 브라우저를 사용하세요.');
      }

      // 첫 클릭에서는 서버 challenge/options를 준비합니다.
      // 포커스 오류가 나면 다음 클릭에서 네트워크 대기 없이 브라우저 인증기를 바로 호출합니다.
      if (!activeRegistration) {
        const optionsResult = await api('register-options', { username: registerUsername.trim(), savedLocation });
        const publicKeyOptions = optionsResult.options;
        const publicKey: PublicKeyCredentialCreationOptions = {
          ...publicKeyOptions,
          challenge: fromBase64Url(publicKeyOptions.challenge),
          user: { ...publicKeyOptions.user, id: fromBase64Url(publicKeyOptions.user.id) },
          excludeCredentials: (publicKeyOptions.excludeCredentials || []).map((item: { id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }) => ({
            ...item,
            id: fromBase64Url(item.id),
          })),
        };
        activeRegistration = { challenge: String(optionsResult.challenge || ''), publicKey };
        setPendingRegistration(activeRegistration);
      }

      if (!document.hasFocus()) {
        setMessage('패스키 등록 준비가 완료됐어요. Chrome 창과 이 탭을 활성화한 뒤 아래의 “패스키 생성 계속” 버튼을 눌러 주세요.');
        setMessageKind('info');
        return;
      }

      // pending state에서는 이 호출까지 await 네트워크 요청을 하지 않으므로
      // 사용자의 다음 클릭이 즉시 브라우저 패스키 창에 전달됩니다.
      browserPromptStarted = true;
      let credential: Credential | null;
      try {
        credential = await navigator.credentials.create({ publicKey: activeRegistration.publicKey });
      } catch (browserError) {
        // Report only allowlisted, non-identifying diagnostic values. Never send the error message or credential data.
        let platformAuthenticatorAvailable: boolean | null = null;
        try {
          if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            platformAuthenticatorAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          }
        } catch { /* diagnostics must not mask the original registration error */ }
        const creationOptions = activeRegistration.publicKey as PublicKeyCredentialCreationOptions & { hints?: string[] };
        const errorName = browserError instanceof Error ? browserError.name : 'Other';
        try {
          await api('browser-diagnostic', {
            errorName,
            selectedLocation: savedLocation,
            authenticatorAttachment: creationOptions.authenticatorSelection?.authenticatorAttachment ?? 'unset',
            residentKey: creationOptions.authenticatorSelection?.residentKey ?? 'unset',
            userVerification: creationOptions.authenticatorSelection?.userVerification ?? 'unset',
            hints: Array.isArray(creationOptions.hints) ? creationOptions.hints : [],
            isSecureContext: window.isSecureContext,
            credentialsApiAvailable: Boolean(navigator.credentials && window.PublicKeyCredential),
            platformAuthenticatorAvailable,
          });
        } catch { /* reporting failure must not mask the original registration error */ }
        throw browserError;
      }
      if (!(credential instanceof PublicKeyCredential)) throw new Error('브라우저에서 패스키 등록이 완료되지 않았어요.');

      await api('register-verify', {
        challenge: activeRegistration.challenge,
        credential: registrationCredentialJSON(credential),
        name: passkeyName.trim() || '내 패스키',
        savedLocation,
      });
      setPendingRegistration(null);
      setLoginUsername(registerUsername.trim());
      setMessage('패스키 등록이 완료됐어요. 아래의 기존 계정 로그인 영역에서 같은 계정 이름으로 로그인해 비공개 자료를 확인하세요.');
      setMessageKind('success');
    } catch (error) {
      const messageText = errorMessage(error);
      const focusError = /does not have focus|page does not have focus/i.test(messageText);
      if (activeRegistration && focusError) {
        // challenge/options를 보존해 다음 클릭에서 네트워크 대기 없이 재시도합니다.
        setPendingRegistration(activeRegistration);
        setMessage('Chrome이 페이지 포커스를 잃어 패스키 창을 열지 못했어요. 이 웹페이지를 활성화한 뒤 “패스키 생성 계속”을 한 번 더 눌러 주세요.');
        setMessageKind('error');
      } else {
        if (activeRegistration && browserPromptStarted) {
          try { await api('register-cancel', { challenge: activeRegistration.challenge }); } catch { /* challenge가 이미 사용되었을 수 있음 */ }
        }
        setPendingRegistration(null);
        setMessage(messageText);
        setMessageKind('error');
      }
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
              <input id="register-username" autoComplete="username" disabled={busy || !!pendingRegistration} value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} maxLength={32} placeholder="예: student_a" className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="passkey-name">패스키 이름</label>
              <input id="passkey-name" disabled={busy || !!pendingRegistration} value={passkeyName} onChange={(e) => setPasskeyName(e.target.value)} maxLength={80} placeholder="예: 내 노트북" className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="saved-location">패스키 인증기 우선 선택</label>
              <select id="saved-location" disabled={busy || !!pendingRegistration} value={savedLocation} onChange={(e) => setSavedLocation(e.target.value)} className="mb-4 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                <option value="google-password-manager">Google 비밀번호 관리자 우선 (Chrome)</option>
                <option value="device">이 PC의 인증기 우선 (Windows Hello 등)</option>
                <option value="security-key">외장 USB 보안 키</option>
                <option value="unknown">잘 모르겠어요 (이 기기 우선)</option>
              </select>
              <button type="button" disabled={busy || registerUsername.trim().length < 3} onClick={() => void registerPasskey()} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? '처리 중…' : pendingRegistration ? '패스키 생성 계속' : '패스키 등록 시작'}
              </button>
              <p className="mt-3 text-xs leading-5 text-stone-500">이 선택은 Chrome에 사용할 인증기의 우선순위를 안내합니다. Google 비밀번호 관리자에 저장되는 것을 강제할 수는 없으며, 가능한 인증 방식은 Chrome·Windows 설정에 따라 달라집니다. 외장 USB 보안 키를 선택한 경우에만 USB 보안 키를 우선 요청합니다.</p>
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
