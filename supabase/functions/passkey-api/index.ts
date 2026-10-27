import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@13.2.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RP_NAME = "공개 소개와 패스키 실습";
const RP_ID = "ex1-passkey.vercel.app";
const ORIGIN = "https://ex1-passkey.vercel.app";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-passkey-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const randomToken = (n=32) => { const a=new Uint8Array(n); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); };
const sha256 = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const log = async (event_type:string,status_code:number,account_id:string|null,challenge_value:string|null,details:Record<string,unknown>={}) => { await db.from("ex1_passkey_audit").insert({event_type,status_code,account_id,challenge_value,details}); };
async function getSession(req:Request) {
 const token=req.headers.get("x-passkey-session") ?? "";
 if (!token) return null;
 const hash=await sha256(token);
 const {data}=await db.from("ex1_passkey_sessions").select("account_id,expires_at,revoked_at").eq("token_hash",hash).maybeSingle();
 if (!data || data.revoked_at || new Date(data.expires_at).getTime()<Date.now()) return null;
 return data;
}
async function issueChallenge(kind:string, account_id:string|null, metadata:Record<string,unknown>={}) {
 const challenge=randomToken(32);
 const {data,error}=await db.from("ex1_passkey_challenges").insert({challenge,kind,account_id,metadata}).select("id,challenge,expires_at").single();
 if (error) throw error;
 return data;
}
async function consumeChallenge(challenge:string,kind:string,account_id?:string) {
 const q=db.from("ex1_passkey_challenges").select("*").eq("challenge",challenge).eq("kind",kind).is("consumed_at",null).gt("expires_at",new Date().toISOString());
 const {data,error}=await q.maybeSingle();
 if (error || !data || (account_id && data.account_id!==account_id)) return null;
 const {data:used,error:useError}=await db.from("ex1_passkey_challenges").update({consumed_at:new Date().toISOString()}).eq("id",data.id).is("consumed_at",null).select("id").maybeSingle();
 return useError || !used ? null : data;
}
async function seedPrivate(account_id:string, username:string) {
 const {count}=await db.from("ex1_passkey_private_items").select("*",{count:"exact",head:true}).eq("account_id",account_id);
 if (count) return;
 const items=[
  {title:`${username} - 가상 자료 A`,content:`${username} 계정 전용으로 만든 테스트 예시 자료 A입니다. 실제 개인정보가 아닙니다.`,category:"만들어 넣은 예시"},
  {title:`${username} - 가상 자료 B`,content:`${username} 계정 전용으로 만든 테스트 예시 자료 B입니다. 다른 계정 자료와 구분하기 위한 가상 내용입니다.`,category:"만들어 넣은 예시"},
  {title:`${username} - 가상 자료 C`,content:`${username} 계정 전용으로 만든 테스트 예시 자료 C입니다. 실제 개인 기록이나 비밀값이 아닙니다.`,category:"만들어 넣은 예시"},
 ];
 await db.from("ex1_passkey_private_items").insert(items.map(x=>({...x,account_id})));
}
Deno.serve(async (req:Request) => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({error:"method_not_allowed"},405);
 const origin=req.headers.get("origin");
 if(origin && origin!==ORIGIN) return json({error:"origin_not_allowed"},403);
 try {
  const body=await req.json();
  const action=String(body.action??"");
  if(action==="register-options") {
   const username=String(body.username??"").trim();
   if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(username)) return json({error:"username_invalid"},400);
   const {data:existing}=await db.from("ex1_passkey_accounts").select("id").eq("username",username).maybeSingle();
   if(existing) return json({error:"account_exists"},409);
   const accountId=crypto.randomUUID();
   const userHandle=randomToken(24);
   const requestedLocation=String(body.savedLocation??"google-password-manager");
   const wantsSecurityKey=requestedLocation==="security-key";
   const prefersWindowsHello=requestedLocation==="device";
   const prefersGooglePasswordManager=requestedLocation==="google-password-manager";
   const options=await generateRegistrationOptions({rpName:RP_NAME,rpID:RP_ID,userName:username,userDisplayName:username,userID:new TextEncoder().encode(userHandle),attestationType:"none",authenticatorSelection:{residentKey:"required",userVerification:"required",...(wantsSecurityKey?{authenticatorAttachment:"cross-platform" as const}:prefersWindowsHello?{authenticatorAttachment:"platform" as const}:{})}});
   // Google Password Manager is selected with a client-device hint, but no attachment
   // restriction: forcing "platform" fails on this browser when its platform authenticator
   // reports unavailable. Chrome still chooses the provider; hints are preferences, not guarantees.
   if(!wantsSecurityKey) (options as unknown as {hints:string[]}).hints=(prefersGooglePasswordManager||prefersWindowsHello)?["client-device"]:["client-device","hybrid"];
   const diagnosticSettings = {
    selectedLocation: ["google-password-manager","device","security-key","unknown"].includes(requestedLocation) ? requestedLocation : "unknown",
    authenticatorAttachment: options.authenticatorSelection?.authenticatorAttachment ?? "unset",
    residentKey: options.authenticatorSelection?.residentKey ?? "unset",
    userVerification: options.authenticatorSelection?.userVerification ?? "unset",
    hints: (options.hints ?? []).filter((hint) => ["client-device","hybrid","security-key"].includes(hint)),
    userDisplayNameSet: Boolean(options.user.displayName),
   };
   const ch=await issueChallenge("registration",accountId,{username,userHandle,diagnosticSettings});
   await log("registration-options-issued",200,null,null,diagnosticSettings);
   return json({options:{...options,challenge:ch.challenge},challenge:ch.challenge,challengeId:ch.id});
  }
  if(action==="register-cancel") {
   const challenge=String(body.challenge??"");
   const ch=await consumeChallenge(challenge,"registration");
   if(!ch) return json({error:"challenge_invalid_or_used",stored:false},409);
   const meta = (ch.metadata ?? {}) as Record<string, unknown>;
   const diagnosticSettings = meta.diagnosticSettings && typeof meta.diagnosticSettings === "object" ? meta.diagnosticSettings as Record<string, unknown> : {};
   await log("registration-cancelled",200,null,null,{stored:false,publicKeySaved:false,...diagnosticSettings});
   return json({ok:true,stored:false,publicKeySaved:false});
  }
  if(action==="browser-diagnostic") {
   // Store allowlisted browser/authenticator metadata only; never accept usernames, messages, IDs, tokens, or challenges.
   const allowedErrorNames = ["NotAllowedError","InvalidStateError","SecurityError","TypeError","AbortError","ConstraintError","UnknownError","NotSupportedError","OperationError"];
   const rawErrorName = String(body.errorName ?? "");
   const errorName = allowedErrorNames.includes(rawErrorName) ? rawErrorName : "Other";
   const locations = ["google-password-manager","device","security-key","unknown"];
   const selectedLocation = locations.includes(String(body.selectedLocation)) ? String(body.selectedLocation) : "unknown";
   const enumValue = (value: unknown, allowed: string[]) => {
    const text = String(value ?? "unset");
    return allowed.includes(text) ? text : "unset";
   };
   const hints = Array.isArray(body.hints) ? [...new Set(body.hints.map(String).filter((hint: string) => ["client-device","hybrid","security-key"].includes(hint)))].slice(0,3) : [];
   const platformAvailable = typeof body.platformAuthenticatorAvailable === "boolean" ? body.platformAuthenticatorAvailable : null;
   const diagnostic = {
    errorName,
    selectedLocation,
    authenticatorAttachment: enumValue(body.authenticatorAttachment, ["platform","cross-platform","unset"]),
    residentKey: enumValue(body.residentKey, ["required","preferred","discouraged","unset"]),
    userVerification: enumValue(body.userVerification, ["required","preferred","discouraged","unset"]),
    hints,
    isSecureContext: body.isSecureContext === true,
    credentialsApiAvailable: body.credentialsApiAvailable === true,
    platformAuthenticatorAvailable: platformAvailable,
   };
   await log("browser-registration-diagnostic",200,null,null,diagnostic);
   return json({ok:true});
  }
  if(action==="add-passkey-options") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const {data:account}=await db.from("ex1_passkey_accounts").select("id,username,user_handle").eq("id",session.account_id).maybeSingle();
   if(!account) return json({error:"account_not_found"},404);
   const requestedLocation=String(body.savedLocation??"google-password-manager");
   const wantsSecurityKey=requestedLocation==="security-key";
   const prefersWindowsHello=requestedLocation==="device";
   const prefersGooglePasswordManager=requestedLocation==="google-password-manager";
   const {data:existingCredentials}=await db.from("ex1_passkey_credentials").select("credential_id,transports").eq("account_id",account.id);
   const options=await generateRegistrationOptions({
    rpName:RP_NAME,
    rpID:RP_ID,
    userName:account.username,
    userDisplayName:account.username,
    userID:new TextEncoder().encode(account.user_handle),
    excludeCredentials:(existingCredentials??[]).map(c=>({id:c.credential_id,transports:c.transports as AuthenticatorTransport[]})),
    attestationType:"none",
    authenticatorSelection:{
     residentKey:"required",
     userVerification:"required",
     ...(wantsSecurityKey?{authenticatorAttachment:"cross-platform" as const}:prefersWindowsHello?{authenticatorAttachment:"platform" as const}:{})
    }
   });
   if(!wantsSecurityKey) (options as unknown as {hints:string[]}).hints=(prefersGooglePasswordManager||prefersWindowsHello)?["client-device"]:["client-device","hybrid"];
   const diagnosticSettings={
    flow:"add-passkey",
    selectedLocation:["google-password-manager","device","security-key","unknown"].includes(requestedLocation)?requestedLocation:"unknown",
    authenticatorAttachment:options.authenticatorSelection?.authenticatorAttachment??"unset",
    residentKey:options.authenticatorSelection?.residentKey??"unset",
    userVerification:options.authenticatorSelection?.userVerification??"unset",
    hints:(options.hints??[]).filter((hint)=>["client-device","hybrid","security-key"].includes(hint)),
    userDisplayNameSet:Boolean(options.user.displayName)
   };
   const ch=await issueChallenge("registration-add",account.id,{username:account.username,userHandle:account.user_handle,name:String(body.name??"추가 패스키").slice(0,80),savedLocation:requestedLocation,diagnosticSettings});
   await log("passkey-add-options-issued",200,account.id,null,diagnosticSettings);
   return json({options:{...options,challenge:ch.challenge},challenge:ch.challenge});
  }
  if(action==="add-passkey-cancel") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const challenge=String(body.challenge??"");
   const ch=await consumeChallenge(challenge,"registration-add",session.account_id);
   if(!ch) return json({error:"challenge_invalid_or_used",stored:false},409);
   const meta=(ch.metadata??{}) as Record<string,unknown>;
   const diagnosticSettings=meta.diagnosticSettings&&typeof meta.diagnosticSettings==="object"?meta.diagnosticSettings as Record<string,unknown>:{};
   await log("passkey-add-cancelled",200,session.account_id,null,{stored:false,publicKeySaved:false,...diagnosticSettings});
   return json({ok:true,stored:false,publicKeySaved:false});
  }
  if(action==="add-passkey-verify") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const {challenge,credential,name,savedLocation}=body;
   const ch=await consumeChallenge(String(challenge??""),"registration-add",session.account_id);
   if(!ch) { await log("passkey-add-challenge-rejected",409,session.account_id,null,{stored:false}); return json({error:"challenge_invalid_or_used"},409); }
   let verification;
   try {
    verification=await verifyRegistrationResponse({response:credential,expectedChallenge:ch.challenge,expectedOrigin:ORIGIN,expectedRPID:RP_ID,requireUserVerification:true});
   } catch {
    await log("passkey-add-verification-failed",401,session.account_id,null,{stored:false});
    return json({error:"registration_verification_failed"},401);
   }
   if(!verification.verified||!verification.registrationInfo) { await log("passkey-add-verification-failed",401,session.account_id,null,{stored:false}); return json({error:"registration_verification_failed"},401); }
   const credentialInfo=verification.registrationInfo.credential;
   const {data:duplicate}=await db.from("ex1_passkey_credentials").select("id").eq("credential_id",credentialInfo.id).maybeSingle();
   if(duplicate) return json({error:"credential_already_registered"},409);
   const chosenLocation=[ "google-password-manager","device","security-key","unknown" ].includes(String(savedLocation))?String(savedLocation):String((ch.metadata as Record<string,unknown>).savedLocation??"unknown");
   const {error:credError}=await db.from("ex1_passkey_credentials").insert({
    account_id:session.account_id,
    credential_id:credentialInfo.id,
    public_key:btoa(String.fromCharCode(...credentialInfo.publicKey)),
    counter:credentialInfo.counter,
    transports:credential?.response?.transports??[],
    name:String(name??(ch.metadata as Record<string,unknown>).name??"추가 패스키").slice(0,80),
    saved_location:chosenLocation,
    device_type:verification.registrationInfo.credentialDeviceType,
    backed_up:verification.registrationInfo.credentialBackedUp
   });
   if(credError) return json({error:"credential_save_failed"},500);
   await log("passkey-added",201,session.account_id,null,{publicKeySaved:true,privateKeySent:false,savedLocation:chosenLocation});
   return json({ok:true,publicKeySaved:true,privateKeySent:false},201);
  }
  if(action==="register-verify") {
   const {challenge,credential,name,savedLocation}=body;
   const ch=await consumeChallenge(String(challenge??""),"registration");
   if(!ch) { await log("registration-challenge-rejected",409,null,String(challenge??"")); return json({error:"challenge_invalid_or_used"},409); }
   const meta=ch.metadata as Record<string,string>;
   let verification;
   try {
    verification=await verifyRegistrationResponse({response:credential,expectedChallenge:ch.challenge,expectedOrigin:ORIGIN,expectedRPID:RP_ID,requireUserVerification:true});
   } catch {
    await log("registration-verification-failed",401,null,ch.challenge);
    return json({error:"registration_verification_failed"},401);
   }
   if(!verification.verified||!verification.registrationInfo) { await log("registration-verification-failed",401,null,ch.challenge); return json({error:"registration_verification_failed"},401); }
   const info=verification.registrationInfo;
   const {data:account,error:accountError}=await db.from("ex1_passkey_accounts").insert({id:ch.account_id,username:meta.username,user_handle:meta.userHandle}).select("*").single();
   if(accountError) return json({error:"account_create_failed"},409);
   const credentialInfo=info.credential;
   const {error:credError}=await db.from("ex1_passkey_credentials").insert({account_id:account.id,credential_id:credentialInfo.id,public_key:btoa(String.fromCharCode(...credentialInfo.publicKey)),counter:credentialInfo.counter,transports:credential.response?.transports??[],name:String(name??"내 패스키").slice(0,80),saved_location:["google-password-manager","device","security-key","unknown"].includes(savedLocation)?savedLocation:"unknown",device_type:info.credentialDeviceType,backed_up:info.credentialBackedUp});
   if(credError) { await db.from("ex1_passkey_accounts").delete().eq("id",account.id); return json({error:"credential_save_failed"},500); }
   await seedPrivate(account.id,account.username);
   await log("registration-success",201,account.id,ch.challenge,{credentialId:credentialInfo.id,privateItemCount:3,privateKeySent:false});
   return json({ok:true,account:{username:account.username},publicKeySaved:true,privateKeySent:false},201);
  }
  if(action==="login-options") {
   const username=String(body.username??"").trim();
   const {data:account}=await db.from("ex1_passkey_accounts").select("id,username").eq("username",username).maybeSingle();
   if(!account) return json({error:"account_or_passkey_not_found"},404);
   const {data:creds}=await db.from("ex1_passkey_credentials").select("credential_id,transports").eq("account_id",account.id);
   if(!creds?.length) return json({error:"no_passkeys"},404);
   const options=await generateAuthenticationOptions({rpID:RP_ID,allowCredentials:creds.map(c=>({id:c.credential_id,transports:c.transports as AuthenticatorTransport[]})),userVerification:"required"});
   const ch=await issueChallenge("authentication",account.id,{username});
   return json({options:{...options,challenge:ch.challenge},challenge:ch.challenge});
  }
  if(action==="login-verify") {
   const {challenge,credential}=body;
   const ch=await consumeChallenge(String(challenge??""),"authentication");
   if(!ch) { await log("login-replay-rejected",409,null,String(challenge??"")); return json({error:"challenge_invalid_or_used"},409); }
   const {data:stored}=await db.from("ex1_passkey_credentials").select("*").eq("credential_id",credential?.id).eq("account_id",ch.account_id).maybeSingle();
   if(!stored) { await log("login-credential-rejected",401,ch.account_id,ch.challenge); return json({error:"credential_not_owned_by_account"},401); }
   let verification;
   try {
    verification=await verifyAuthenticationResponse({response:credential,expectedChallenge:ch.challenge,expectedOrigin:ORIGIN,expectedRPID:RP_ID,requireUserVerification:true,credential:{id:stored.credential_id,publicKey:Uint8Array.from(atob(stored.public_key),c=>c.charCodeAt(0)),counter:Number(stored.counter),transports:stored.transports}});
   } catch { await log("login-signature-failed",401,ch.account_id,ch.challenge); return json({error:"signature_verification_failed"},401); }
   if(!verification.verified) { await log("login-signature-failed",401,ch.account_id,ch.challenge); return json({error:"signature_verification_failed"},401); }
   await db.from("ex1_passkey_credentials").update({counter:verification.authenticationInfo.newCounter}).eq("id",stored.id);
   const token=randomToken(32);
   await db.from("ex1_passkey_sessions").insert({token_hash:await sha256(token),account_id:ch.account_id,expires_at:new Date(Date.now()+8*60*60*1000).toISOString()});
   await seedPrivate(ch.account_id,String((ch.metadata as Record<string,string>).username));
   await log("login-success",200,ch.account_id,ch.challenge,{sessionTokenRedacted:true});
   return json({ok:true,session:token,expiresIn:28800});
  }
  if(action==="logout") {
   const token=req.headers.get("x-passkey-session")??"";
   if(!token) return json({ok:true,revoked:false});
   const {data:revoked,error}=await db.from("ex1_passkey_sessions").update({revoked_at:new Date().toISOString()}).eq("token_hash",await sha256(token)).is("revoked_at",null).select("account_id").maybeSingle();
   if(error) return json({error:"logout_failed"},500);
   if(revoked) await log("logout-session-revoked",200,revoked.account_id,null,{sessionTokenRedacted:true,revoked:true});
   return json({ok:true,revoked:Boolean(revoked)});
  }
  if(action==="private") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const {data:account}=await db.from("ex1_passkey_accounts").select("id,username").eq("id",session.account_id).single();
   const {data:items}=await db.from("ex1_passkey_private_items").select("id,title,content,category,created_at").eq("account_id",session.account_id).order("created_at");
   await log("private-read",200,session.account_id,null,{count:items?.length??0});
   return json({account,items:items??[]});
  }
  if(action==="passkeys") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const {data}=await db.from("ex1_passkey_credentials").select("id,name,created_at,saved_location,device_type,backed_up").eq("account_id",session.account_id).order("created_at");
   return json({passkeys:data??[]});
  }
  if(action==="delete-passkey") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const {id}=body;
   const {count}=await db.from("ex1_passkey_credentials").select("*",{count:"exact",head:true}).eq("account_id",session.account_id);
   if((count??0)<=1) return json({error:"last_passkey_blocked",message:"마지막 패스키는 삭제할 수 없습니다. 먼저 두 번째 패스키를 등록하세요."},409);
   const {data:deleted}=await db.from("ex1_passkey_credentials").delete().eq("id",id).eq("account_id",session.account_id).select("id").maybeSingle();
   if(!deleted) return json({error:"passkey_not_found"},404);
   await log("passkey-deleted",200,session.account_id,null,{deleted:true});
   return json({ok:true});
  }
  if(action==="audit") {
   const session=await getSession(req);
   if(!session) return json({error:"unauthorized"},401);
   const {data}=await db.from("ex1_passkey_audit").select("event_type,status_code,account_id,challenge_value,details,created_at").eq("account_id",session.account_id).order("created_at",{ascending:false}).limit(100);
   return json({events:(data??[]).map(e=>({...e,details:{...e.details,sessionTokenRedacted:true}}))});
  }
  return json({error:"unknown_action"},400);
 } catch(error) {
  console.error("passkey-api error",error);
  return json({error:"internal_error"},500);
 }
});