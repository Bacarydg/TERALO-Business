import { supabase, isSupabaseConfigured } from "./supabase";
import { loadDemo, saveDemo } from "./demo";

const wait = (ms=180) => new Promise(r => setTimeout(r, ms));

export async function getSession() {
  if (!isSupabaseConfigured) return { demo: true, user: { id: "demo-merchant", email_confirmed_at: new Date().toISOString() } };
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return { demo: false, session: data.session || null, user: data.session?.user || null };
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured) return { demo: true, user: { id: "demo-merchant", email_confirmed_at: new Date().toISOString() }, session: { demo: true } };
  const result = await supabase.auth.signInWithPassword({ email, password });
  return result;
}

export async function signUp({email,password,full_name,business_name,sector,plan}) {
  if (!isSupabaseConfigured) return {
    demo: true,
    user: { id: "demo-merchant", email_confirmed_at: new Date().toISOString() },
    session: { demo: true },
  };
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        business_name,
        sector,
        plan,
      },
    },
  });
}

export async function signOut() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
}

export async function getAppData(userId) {
  if (!isSupabaseConfigured) { await wait(); return loadDemo(); }
  const [m,p,c,s,e,q] = await Promise.all([
    supabase.from("merchants").select("*").eq("id", userId).maybeSingle(),
    supabase.from("products").select("*").eq("merchant_id", userId).order("created_at",{ascending:false}),
    supabase.from("customers").select("*").eq("merchant_id", userId).order("created_at",{ascending:false}),
    supabase.from("sales").select("*").eq("merchant_id", userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("cash_entries").select("*").eq("merchant_id", userId).order("created_at",{ascending:false}).limit(100),
    supabase.from("quotes").select("*").eq("merchant_id", userId).order("created_at",{ascending:false}).limit(100)
  ]);
  for (const r of [m,p,c,s,e,q]) if (r.error) throw r.error;
  return { merchant:m.data, products:p.data||[], customers:c.data||[], sales:s.data||[], cash_entries:e.data||[], quotes:q.data||[] };
}

export async function saveEntity(kind, payload, userId) {
  if (!isSupabaseConfigured) {
    const state = loadDemo();
    if (kind === "merchant") state.merchant = {...state.merchant,...payload};
    else if (kind === "product") state.products = [payload, ...state.products.filter(x=>x.id!==payload.id)];
    else if (kind === "customer") state.customers = [payload, ...state.customers.filter(x=>x.id!==payload.id)];
    else if (kind === "sale") state.sales = [payload, ...state.sales];
    else if (kind === "cash") state.cash_entries = [payload, ...state.cash_entries];
    else if (kind === "quote") state.quotes = [payload, ...state.quotes];
    saveDemo(state); await wait(); return payload;
  }
  const table = {merchant:"merchants",product:"products",customer:"customers",sale:"sales",cash:"cash_entries",quote:"quotes"}[kind];
  const row = {...payload};
  if (kind !== "merchant") row.merchant_id = userId;
  const {data,error} = await supabase.from(table).upsert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEntity(kind, id) {
  if (!isSupabaseConfigured) {
    const state=loadDemo();
    const map={product:"products",customer:"customers",quote:"quotes"};
    if (map[kind]) state[map[kind]]=state[map[kind]].filter(x=>x.id!==id);
    saveDemo(state); await wait(); return;
  }
  const table={product:"products",customer:"customers",quote:"quotes"}[kind];
  if (!table) return;
  const {error}=await supabase.from(table).delete().eq("id",id);
  if(error) throw error;
}

export async function uploadAsset(file,userId) {
  if (!isSupabaseConfigured) return URL.createObjectURL(file);
  const ext=file.name.split(".").pop();
  const path=`${userId}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from("business-assets").upload(path,file,{upsert:true});
  if(error) throw error;
  const {data}=supabase.storage.from("business-assets").getPublicUrl(path);
  return data.publicUrl;
}