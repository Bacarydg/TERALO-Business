import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Users, WalletCards, FileText, Settings,
  Menu, X, Search, Bell, ChevronDown, Plus, ArrowUpRight, ArrowDownRight,
  TrendingUp, AlertTriangle, MoreHorizontal, Receipt, Upload, Download, LogOut,
  Building2, Sparkles, CheckCircle2, CircleDollarSign, RefreshCw, Printer, MessageCircle
} from "lucide-react";
import Papa from "papaparse";
import { getSession, signIn, signUp, signOut, getAppData, saveEntity, deleteEntity, uploadAsset } from "./lib/api";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { money, number, dateLabel, uid, invoiceNo, todayISO } from "./utils";

const nav = [
  ["dashboard","Tableau de bord",LayoutDashboard],
  ["pos","Caisse / Vente",ShoppingCart],
  ["products","Produits & Stocks",Package],
  ["customers","Clients",Users],
  ["quotes","Devis",FileText],
  ["cash","Trésorerie",WalletCards],
  ["settings","Paramètres",Settings]
];

const sectors = ["Commerce général","Électronique & High-Tech","Artisanat & Menuiserie","Restauration","Immobilier","Aluminium","Soins & Beauté"];
const plans = ["Basic","Standard","Premium"];

const initialProduct = {name:"",sku:"",category:"",sale_price:0,purchase_price:0,stock:0,alert_threshold:2,unit:"unité",description:"",is_active:true};

export default function App() {
  // Tous les hooks sont déclarés de manière inconditionnelle avant le moindre return.
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [auth, setAuth] = useState({ email: "", password: "", name: "", business: "", sector: sectors[0], plan: "Standard" });
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [bootstrapError, setBootstrapError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timeoutId;

    async function bootstrap() {
      try {
        const s = await getSession();
        if (!mounted) return;

        if (!s.user) {
          setSession(null);
          return;
        }

        if (!s.demo && !s.user.email_confirmed_at) {
          await signOut();
          if (!mounted) return;
          setSession(null);
          setData(null);
          setAuthMode("login");
          setAuthError("Votre adresse e-mail n'est pas encore confirmée. Vérifiez votre boîte de réception puis reconnectez-vous.");
          return;
        }

        setSession(s);
        setDataLoading(true);

        // Sécurité anti-blocage : aucune attente infinie sur le chargement métier.
        timeoutId = setTimeout(async () => {
          if (!mounted) return;
          await signOut();
          if (!mounted) return;
          setSession(null);
          setData(null);
          setDataLoading(false);
          setAuthMode("login");
          setAuthError("Votre espace marchand n'a pas pu être chargé à temps. Vérifiez votre configuration Supabase puis reconnectez-vous.");
        }, 10000);

        const d = await getAppData(s.user.id);
        clearTimeout(timeoutId);
        if (!mounted) return;

        if (!d?.merchant) {
          await signOut();
          if (!mounted) return;
          setSession(null);
          setData(null);
          setAuthMode("login");
          setAuthError("Compte authentifié, mais profil marchand introuvable. Exécutez le schéma Supabase de TERAL’O Business puis reconnectez-vous.");
          return;
        }

        setData(d);
        if (!d.merchant.business_name || d.merchant.business_name === "Mon entreprise") {
          setOnboarding(true);
          setOnboardingStep(1);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        if (!mounted) return;
        setSession(null);
        setData(null);
        setAuthMode("login");
        setAuthError(e.message || "Impossible de charger votre espace.");
      } finally {
        if (mounted) {
          setDataLoading(false);
          setLoading(false);
        }
      }
    }

    bootstrap();

    if (isSupabaseConfigured && supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          setSession(null);
          setData(null);
          setOnboarding(false);
        }
        // Le chargement des données est piloté par bootstrap/handleAuth afin d'éviter
        // les requêtes concurrentes dans le callback Supabase.
        if (event === "TOKEN_REFRESHED" && !nextSession) {
          setSession(null);
          setData(null);
        }
      });
      return () => {
        mounted = false;
        clearTimeout(timeoutId);
        listener?.subscription?.unsubscribe();
      };
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadUserWorkspace(user, nextSession) {
    if (!user || (!nextSession?.demo && !user.email_confirmed_at)) {
      throw new Error("Session absente ou adresse e-mail non confirmée.");
    }
    setDataLoading(true);
    const d = await getAppData(user.id);
    if (!d?.merchant) {
      throw new Error("Profil marchand introuvable. Exécutez le schéma Supabase de TERAL’O Business puis réessayez.");
    }
    setSession(nextSession);
    setData(d);
    setOnboarding(!d.merchant.business_name || d.merchant.business_name === "Mon entreprise");
    setOnboardingStep(1);
    setPage("dashboard");
    setDataLoading(false);
  }

  async function reload() {
    if (!session?.user || dataLoading) return;
    setSaving(true);
    try {
      const d = await getAppData(session.user.id);
      if (!d?.merchant) throw new Error("Profil marchand introuvable.");
      setData(d);
      setToast("Données actualisées");
    } catch (e) {
      setToast(e.message || "Erreur de synchronisation");
    } finally {
      setSaving(false);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    setSignupSuccess(false);
    setSaving(true);

    try {
      if (authMode === "signup") {
        if (!auth.name.trim() || !auth.business.trim() || !auth.sector || !auth.plan || !auth.email.trim() || !auth.password) {
          throw new Error("Veuillez compléter tous les champs obligatoires avant de créer votre compte.");
        }
        if (auth.password.length < 6) {
          throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
        }

        const result = await signUp({
          email: auth.email.trim(),
          password: auth.password,
          full_name: auth.name.trim(),
          business_name: auth.business.trim(),
          sector: auth.sector,
          plan: auth.plan,
        });

        if (result?.error) throw result.error;

        const user = result?.user || result?.data?.user;
        const createdSession = result?.session || result?.data?.session;

        if (!user) throw new Error("Supabase n'a pas retourné le compte créé.");

        // Avec la confirmation e-mail activée, Supabase renvoie généralement un user
        // sans session. On ne tente surtout pas de charger le dashboard dans ce cas.
        if (!createdSession) {
          setSignupSuccess(true);
          setAuthError("");
          setAuthMode("login");
          setAuth(prev => ({ ...prev, password: "" }));
          setToast("Compte créé. Vérifiez votre e-mail.");
          window.setTimeout(() => setSignupSuccess(false), 9000);
          return;
        }

        const nextSession = { demo: !isSupabaseConfigured, user };
        await loadUserWorkspace(user, nextSession);
        setSignupSuccess(false);
        setToast("Compte créé avec succès");
        return;
      }

      const result = await signIn(auth.email.trim(), auth.password);
      if (result?.error) throw result.error;

      const user = result?.user || result?.data?.user;
      const activeSession = result?.session || result?.data?.session;
      if (!user || !activeSession) {
        throw new Error("Aucune session active n'a été établie. Si votre compte vient d'être créé, confirmez d'abord votre e-mail.");
      }
      if (isSupabaseConfigured && !user.email_confirmed_at) {
        await signOut();
        throw new Error("Votre adresse e-mail n'est pas encore confirmée. Vérifiez votre boîte de réception avant de vous connecter.");
      }

      await loadUserWorkspace(user, { demo: !isSupabaseConfigured, user });
      setAuthError("");
    } catch (e) {
      setAuthError(e.message || "Une erreur est survenue.");
      setSession(null);
      setData(null);
    } finally {
      setSaving(false);
      setDataLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    setSession(null);
    setData(null);
    setOnboarding(false);
    setAuthMode("login");
  }

  async function persist(kind, payload) {
    if (!session?.user) throw new Error("Session inactive. Veuillez vous reconnecter.");
    setSaving(true);
    try {
      const saved = await saveEntity(kind, payload, session.user.id);
      setData(prev => {
        const next = { ...prev };
        if (kind === "merchant") next.merchant = { ...next.merchant, ...saved };
        if (kind === "product") next.products = [saved, ...next.products.filter(x => x.id !== saved.id)];
        if (kind === "customer") next.customers = [saved, ...next.customers.filter(x => x.id !== saved.id)];
        if (kind === "sale") next.sales = [saved, ...next.sales];
        if (kind === "cash") next.cash_entries = [saved, ...next.cash_entries];
        if (kind === "quote") next.quotes = [saved, ...next.quotes];
        return next;
      });
      setToast("Enregistrement effectué");
      return saved;
    } catch (e) {
      setToast(e.message || "Échec de l'enregistrement");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind, id) {
    try {
      await deleteEntity(kind, id);
      setData(prev => ({
        ...prev,
        products: kind === "product" ? prev.products.filter(x => x.id !== id) : prev.products,
        customers: kind === "customer" ? prev.customers.filter(x => x.id !== id) : prev.customers,
        quotes: kind === "quote" ? prev.quotes.filter(x => x.id !== id) : prev.quotes,
      }));
      setToast("Élément supprimé");
    } catch (e) {
      setToast(e.message || "Suppression impossible");
    }
  }

  if (loading) return <Splash />;
  if (!session?.user) return <AuthScreen auth={auth} setAuth={setAuth} mode={authMode} setMode={(m) => { setAuthMode(m); setAuthError(""); setSignupSuccess(false); }} error={authError} success={signupSuccess} onSubmit={handleAuth} saving={saving} />;
  if (dataLoading || !data) return <LoadingGuard onLogout={handleLogout} message={bootstrapError || "Préparation de votre espace…"} />;

  return <>
    <div className="app-shell">
      <Sidebar page={page} setPage={p => { setPage(p); setMobileOpen(false); }} mobileOpen={mobileOpen} close={() => setMobileOpen(false)} merchant={data.merchant} />
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21}/></button>
          <div className="crumb"><span>TERAL'O Business</span><b>/</b><strong>{nav.find(x => x[0] === page)?.[1]}</strong></div>
          <div className="top-actions">
            <button className="icon-btn" onClick={reload} title="Actualiser"><RefreshCw size={18} className={saving ? "spin" : ""}/></button>
            <button className="icon-btn notification"><Bell size={18}/><i/></button>
            <div className="avatar">{(data.merchant?.business_name || "TB").slice(0, 2).toUpperCase()}</div>
          </div>
        </header>
        <div className="content">
          {page === "dashboard" && <Dashboard data={data} setPage={setPage}/>} 
          {page === "pos" && <POS data={data} persist={persist}/>} 
          {page === "products" && <Products data={data} persist={persist} remove={remove}/>} 
          {page === "customers" && <Customers data={data} persist={persist} remove={remove}/>} 
          {page === "quotes" && <Quotes data={data} persist={persist} setPage={setPage}/>} 
          {page === "cash" && <Cash data={data} persist={persist}/>} 
          {page === "settings" && <SettingsPage data={data} persist={persist} session={session}/>} 
        </div>
      </main>
    </div>
    {onboarding && <Onboarding data={data} step={onboardingStep} setStep={setOnboardingStep} persist={persist} close={() => setOnboarding(false)}/>} 
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    <button className="help-fab" title="Support"><MessageCircle size={20}/></button>
  </>;
}

function Splash({label="Chargement de TERAL'O Business…"}) {
  return <div className="splash"><div className="brand-mark">T</div><h1>TERAL'O</h1><p>{label}</p><div className="loader"/></div>
}

function AuthScreen({auth,setAuth,mode,setMode,error,success,onSubmit,saving}) {
  return <div className="auth-page">
    <div className="auth-visual">
      <div className="auth-brand"><div className="brand-mark">T</div><span>TERAL'O <b>Business</b></span></div>
      <div className="auth-copy"><span className="eyebrow">SaaS de gestion commerciale</span><h1>Pilotez votre activité.<br/><em>Simplement.</em></h1><p>Ventes, caisse, stocks, clients, devis et trésorerie dans une seule interface conçue pour les réalités du terrain.</p>
      <div className="feature-list"><span><CheckCircle2/> Caisse rapide & multi-paiements</span><span><CheckCircle2/> Stocks en temps réel</span><span><CheckCircle2/> Devis & factures professionnels</span></div></div>
      <div className="auth-foot">Une solution <b>SUPDIGI</b> pour les entrepreneurs ambitieux.</div>
    </div>
    <div className="auth-card-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-logo-mobile"><div className="brand-mark">T</div></div>
        <span className="eyebrow">{mode === "login" ? "Bienvenue" : "Créer votre espace"}</span>
        <h2>{mode === "login" ? "Connectez-vous à votre espace" : "Créez votre espace business"}</h2>
        <p className="muted">{mode === "login" ? "Accédez à votre tableau de bord." : "Renseignez votre activité pour préparer votre espace dès la création du compte."}</p>

        {success && <div className="success-box" role="status" aria-live="polite">
          <div className="success-icon"><CheckCircle2 size={19}/></div>
          <div><strong>Compte créé avec succès !</strong><p>Un e-mail de confirmation vous a été envoyé. Veuillez vérifier votre boîte de réception pour activer votre compte avant de vous connecter.</p></div>
        </div>}

        {mode === "signup" && <>
          <div className="auth-form-grid">
            <Field label="Nom complet" value={auth.name} onChange={v => setAuth({...auth,name:v})} placeholder="Ex. Bacary Kasse" required/>
            <Field label="Nom de l'entreprise" value={auth.business} onChange={v => setAuth({...auth,business:v})} placeholder="Ex. Dabakh Menuiserie" required/>
          </div>
          <div className="auth-form-grid">
            <SelectField label="Secteur d'activité" value={auth.sector} onChange={v => setAuth({...auth,sector:v})} options={sectors.filter(s => s !== "Commerce général")} required/>
            <SelectField label="Plan d'abonnement" value={auth.plan} onChange={v => setAuth({...auth,plan:v})} options={plans} required/>
          </div>
        </>}
        <Field label="Email" type="email" value={auth.email} onChange={v => setAuth({...auth,email:v})} placeholder="vous@entreprise.com" required/>
        <Field label="Mot de passe" type="password" value={auth.password} onChange={v => setAuth({...auth,password:v})} placeholder="6 caractères minimum" required/>

        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg full" disabled={saving}>{saving ? (mode === "login" ? "Connexion…" : "Création du compte…") : mode === "login" ? "Se connecter" : "Créer mon espace"} <ArrowUpRight size={17}/></button>
        {!isSupabaseConfigured && <button type="button" className="demo-link" onClick={() => onSubmit({preventDefault(){}})}>Entrer directement en démonstration</button>}
        <div className="auth-switch">{mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"} <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Créer un compte" : "Se connecter"}</button></div>
      </form>
    </div>
  </div>;
}

function SelectField({label,value,onChange,options,required=false}) {
  return <label className="field"><span>{label}{required && <b className="required-mark"> *</b>}</span><select value={value} onChange={e => onChange(e.target.value)} required={required}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function LoadingGuard({onLogout,message}) {
  return <div className="splash splash-guard"><div className="brand-mark">T</div><h1>TERAL'O</h1><div className="guard-card"><AlertTriangle size={22}/><strong>Impossible de préparer votre espace</strong><p>{message || "La session n'est pas prête ou les données du marchand sont indisponibles."}</p><button className="btn btn-primary" onClick={onLogout}>Retour à la connexion</button></div></div>;
}

function Field({label,value,onChange,type="text",placeholder=""}) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>
}

function Sidebar({page, setPage, mobileOpen, close, merchant}) {
  const businessName = merchant?.business_name || "Mon entreprise";
  const plan = merchant?.plan || "Standard";
  const city = merchant?.city || "Dakar";
  const initial = businessName.slice(0, 1).toUpperCase();

  return <aside className={"sidebar "+(mobileOpen?"open":"")}>
    <div className="sidebar-top">
      <div className="brand"><div className="brand-mark">T</div><div><strong>TERAL'O</strong><small>BUSINESS</small></div></div>
      <button className="icon-btn side-close" onClick={close}><X size={19}/></button>
    </div>
    <div className="workspace">
      <div className="business-avatar">{initial}</div>
      <div><strong>{businessName}</strong><small>{plan} · {city}</small></div>
      <ChevronDown size={15}/>
    </div>
    <div className="nav-label">ESPACE DE TRAVAIL</div>
<nav>{nav.slice(0,6).map(([id,label,Icon])=><button key={id} className={page===id?"active":""} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
    <div className="nav-label">CONFIGURATION</div>
    <nav><button className={page==="settings"?"active":""} onClick={()=>setPage("settings")}><Settings size={18}/><span>Paramètres</span></button></nav>
    <div className="sidebar-bottom">
      <div className="upgrade"><Sparkles size={17}/><strong>Passez à Premium</strong><p>Débloquez toutes les fonctionnalités.</p><button onClick={()=>setPage("settings")}>Voir le plan</button></div>
      <div className="powered">SUPDIGI · 2026</div>
    </div>
    <div style={{padding: "0 15px 15px 15px", marginTop: "10px"}}>
  <button 
    onClick={() => signOut()} 
    style={{display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "10px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "13px"}}
  >
    <LogOut size={16}/> Se déconnecter
  </button>
</div>
  </aside>
}

function PageHead({title,subtitle,actions}) {
  return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="head-actions">{actions}</div></div>
}

function Dashboard({data,setPage}) {
  const salesToday=data.sales.filter(s=>new Date(s.created_at).toDateString()===new Date().toDateString());
  const revenue=data.sales.reduce((a,s)=>a+Number(s.total||0),0);
  const cashIn=data.cash_entries.filter(e=>e.type==="income").reduce((a,e)=>a+Number(e.amount||0),0);
  const cashOut=data.cash_entries.filter(e=>e.type==="expense").reduce((a,e)=>a+Number(e.amount||0),0);
  const low=data.products.filter(p=>Number(p.stock)<=Number(p.alert_threshold));
  const chart=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i); const sum=data.sales.filter(s=>new Date(s.created_at).toDateString()===d.toDateString()).reduce((a,s)=>a+Number(s.total),0);return {day:d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".",""),value:sum}});
  return <div>
    <PageHead title="Bonjour, bienvenue 👋" subtitle={`Voici la santé de ${data.merchant?.business_name||"votre entreprise"} aujourd'hui.`} actions={<><button className="btn btn-secondary" onClick={()=>setPage("quotes")}><FileText size={16}/> Nouveau devis</button><button className="btn btn-primary" onClick={()=>setPage("pos")}><Plus size={17}/> Nouvelle vente</button></>}/>
    <div className="status-strip"><span><i className="live-dot"/> Système opérationnel</span><span>Dernière synchronisation : à l'instant</span><span className="demo-tag">Mode {isSupabaseConfigured?"SaaS":"Démo"}</span></div>
    <div className="metrics">
      <Metric title="Chiffre d'affaires" value={money(revenue)} delta="+12,8%" icon={TrendingUp} tone="green"/>
      <Metric title="Encaissements" value={money(cashIn)} delta="+8,4%" icon={CircleDollarSign} tone="blue"/>
      <Metric title="Trésorerie nette" value={money(cashIn-cashOut)} delta="+5,2%" icon={WalletCards} tone="violet"/>
      <Metric title="Créances clients" value={money(data.sales.filter(s=>s.status==="credit").reduce((a,s)=>a+Number(s.total),0))} delta="4 clients" icon={Users} tone="orange"/>
    </div>
    <div className="grid-2">
      <section className="panel chart-panel"><div className="panel-head"><div><h3>Évolution des ventes</h3><p>Les 7 derniers jours</p></div><select><option>7 derniers jours</option><option>30 derniers jours</option></select></div><SalesChart data={chart}/></section>
      <section className="panel"><div className="panel-head"><div><h3>Activité récente</h3><p>Dernières opérations</p></div><button className="text-btn" onClick={()=>setPage("pos")}>Voir tout</button></div><div className="activity-list">{data.sales.slice(0,5).map(s=><div className="activity" key={s.id}><div className="activity-icon"><Receipt size={16}/></div><div className="activity-main"><strong>{s.invoice_number}</strong><span>{s.payment_method} · {dateLabel(s.created_at)}</span></div><b>{money(s.total)}</b></div>)}</div></section>
    </div>
    <div className="grid-3">
      <section className="panel"><div className="panel-head"><div><h3>Stock à surveiller</h3><p>{low.length} article(s) sous le seuil</p></div><button className="text-btn" onClick={()=>setPage("products")}>Gérer</button></div>{low.length?<div className="stock-list">{low.map(p=><div className="stock-row" key={p.id}><div className="mini-product">{p.name.slice(0,1)}</div><div><strong>{p.name}</strong><span>{p.category||"Sans catégorie"}</span></div><b className="danger-text">{number(p.stock)} {p.unit}</b></div>)}</div>:<Empty icon={Package} text="Tous les stocks sont au vert."/>}</section>
      <section className="panel"><div className="panel-head"><div><h3>Performance métier</h3><p>{data.merchant?.sector}</p></div></div><div className="sector-card"><div className="sector-icon"><Building2 size={22}/></div><div><strong>{data.merchant?.sector==="Artisanat & Menuiserie"?"Chantiers & fabrication":"Activité commerciale"}</strong><p>Suivez les commandes, devis et ventes depuis votre espace.</p></div></div><div className="quick-grid"><button onClick={()=>setPage("quotes")}><FileText/> Devis</button><button onClick={()=>setPage("customers")}><Users/> Clients</button><button onClick={()=>setPage("cash")}><WalletCards/> Trésorerie</button><button onClick={()=>setPage("products")}><Package/> Stock</button></div></section>
      <section className="panel"><div className="panel-head"><div><h3>Objectif mensuel</h3><p>Septembre 2026</p></div><MoreHorizontal size={18}/></div><div className="goal"><div className="goal-ring"><strong>68%</strong><span>atteint</span></div><div><strong>{money(1250000)}</strong><span>sur objectif de {money(1850000)}</span><div className="progress"><i style={{width:"68%"}}/></div></div></div><div className="goal-note"><ArrowUpRight size={16}/> Encore {money(600000)} pour atteindre votre objectif.</div></section>
    </div>
  </div>
}

function Metric({title,value,delta,icon:Icon,tone}) { return <div className="metric"><div className={"metric-icon "+tone}><Icon size={20}/></div><div className="metric-copy"><span>{title}</span><strong>{value}</strong><small><ArrowUpRight size={12}/>{delta} <em>vs mois dernier</em></small></div></div> }

function SalesChart({data}) {
  const max=Math.max(...data.map(x=>x.value),1);
  return <div className="chart"><div className="y-axis"><span>{money(max).replace(" FCFA","")}</span><span>{money(max*.5).replace(" FCFA","")}</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><i/><i/><i/></div><svg viewBox="0 0 700 220" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={data.map((d,i)=>`${i*(700/(data.length-1))},${205-(d.value/max)*180}`).join(" ")}/>{data.map((d,i)=><circle key={i} cx={i*(700/(data.length-1))} cy={205-(d.value/max)*180} r="4" fill="currentColor"/>)}</svg><div className="x-axis">{data.map(d=><span key={d.day}>{d.day}</span>)}</div></div></div>
}

function Empty({icon:Icon,text}) { return <div className="empty"><Icon size={25}/><p>{text}</p></div> }

function POS({data,persist}) {
  const [cart,setCart]=useState([]);
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("Tous");
  const [payment,setPayment]=useState("Espèces");
  const [discount,setDiscount]=useState(0);
  const [customer,setCustomer]=useState("");
  const [showPrint,setShowPrint]=useState(false);
  const categories=["Tous",...new Set(data.products.map(p=>p.category).filter(Boolean))];
  const filtered=data.products.filter(p=>p.is_active && (category==="Tous"||p.category===category) && p.name.toLowerCase().includes(search.toLowerCase()));
  const subtotal=cart.reduce((a,x)=>a+x.sale_price*x.qty,0);
  const total=Math.max(0,subtotal-Number(discount||0));
  function add(p){setCart(c=>{const found=c.find(x=>x.id===p.id);return found?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}]})}
  function change(id,q){setCart(c=>c.map(x=>x.id===id?{...x,qty:Math.max(1,q)}:x))}
async function checkout(){
    if(!cart.length) return; 

    // 1. Mettre à jour le stock de chaque produit acheté en envoyant aussi son nom
    for (const item of cart) {
      const newStock = Math.max(0, (item.stock || item.quantity || 0) - item.qty);
      await persist("product", { 
        id: item.id, 
        name: item.name, 
        stock: newStock,
        sale_price: item.sale_price || item.price || 0
      });
    }

    // 2. Enregistrer la vente avec son numéro de facture et son total
    await persist("sale", { 
      total: total, 
      invoice_number: "FAC-" + Math.floor(100000 + Math.random() * 900000) 
    }); 

    // 3. Ouvrir la modale de la facture
    setShowPrint(true);
  }
  return <div><PageHead title="Caisse" subtitle="Vendez rapidement, encaissez et imprimez vos tickets." actions={<div className="pos-mode"><span className="active">Vente</span><span>Retour</span></div>}/><div className="pos-layout">
    <section className="panel catalog-panel"><div className="pos-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un article, SKU…"/><kbd>⌘ K</kbd></div><div className="chips">{categories.map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="product-grid">{filtered.map(p=><button className="product-tile" key={p.id} onClick={()=>add(p)}><div className="product-image">{p.image_url?<img src={p.image_url} alt=""/>:<span>{p.name.slice(0,1)}</span>}</div><div><strong>{p.name}</strong><small>{p.category||"Sans catégorie"}</small></div><b>{money(p.sale_price)}</b><em>{number(p.stock)} en stock</em></button>)}</div></section>
    <aside className="panel cart-panel"><div className="cart-head"><div><h3>Panier</h3><p>{cart.reduce((a,x)=>a+x.qty,0)} article(s)</p></div><button className="text-btn" onClick={()=>setCart([])}>Vider</button></div>{cart.length?<div className="cart-items">{cart.map(x=><div className="cart-item" key={x.id}><div className="cart-avatar">{x.name.slice(0,1)}</div><div className="cart-info"><strong>{x.name}</strong><span>{money(x.sale_price)}</span><div className="qty"><button onClick={()=>change(x.id,x.qty-1)}>−</button><b>{x.qty}</b><button onClick={()=>change(x.id,x.qty+1)}>+</button></div></div><b>{money(x.sale_price*x.qty)}</b></div>)}</div>:<Empty icon={ShoppingCart} text="Votre panier est vide"/>}
    <div className="cart-bottom"><label className="field"><span>Client</span><select value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Client comptant</option>{data.customers.map(c=><option value={c.id} key={c.id}>{c.name} · {c.phone}</option>)}</select></label><label className="field"><span>Remise</span><input type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)}/></label><div className="payment-grid">{["Espèces","Wave","Orange Money","Crédit client"].map(p=><button key={p} className={payment===p?"active":""} onClick={()=>setPayment(p)}>{p}</button>)}</div><div className="total-line"><span>Sous-total</span><b>{money(subtotal)}</b></div><div className="total-line grand"><span>Total à payer</span><strong>{money(total)}</strong></div><button className="btn btn-primary btn-lg full" disabled={!cart.length} onClick={checkout}><CheckCircle2 size={18}/> Encaisser {money(total)}</button><div className="receipt-actions"><button onClick={()=>setShowPrint(true)} disabled={!cart.length}><Printer size={15}/> Aperçu ticket</button><button><Download size={15}/> PDF</button></div></div></aside>
  </div>{showPrint&&<ReceiptModal cart={cart} total={total} merchant={data.merchant} close={()=>setShowPrint(false)}/>}</div>
}

function ReceiptModal({cart, total, merchant, close}) {
  const calculatedTotal = total || cart.reduce((sum, item) => sum + (item.qty * (item.sale_price || item.price || 0)), 0);
  const currentDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const invoiceNo = "FAC-" + Math.floor(100000 + Math.random() * 900000);

  return (
    <div className="modal-backdrop">
      <div className="modal receipt-modal" style={{maxWidth: "560px", width: "100%"}}>
        
        {/* En-tête avec le bouton Croix pour fermer */}
        <div className="modal-head" style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 25px", borderBottom: "1px solid #e2e8f0"}}>
          <h3 style={{margin: 0, fontSize: "16px", fontWeight: "bold", color: "#0f172a"}}>Facture & Aperçu</h3>
          <button className="icon-btn" onClick={close} style={{background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#64748b"}}>
            <X size={20}/>
          </button>
        </div>
        
        {/* Corps de la facture */}
        <div className="receipt" id="printable-receipt" style={{padding: "30px", fontFamily: "Helvetica, Arial, sans-serif", fontSize: "13px", color: "#1f2937", background: "#fff", minHeight: "440px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box"}}>
          
          <div>
            {/* En-tête de l'entreprise */}
            <div style={{textAlign: "center", borderBottom: "2px solid #059669", paddingBottom: "15px", marginBottom: "20px"}}>
              <strong style={{fontSize: "20px", color: "#065f46", display: "block", letterSpacing: "0.5px"}}>{merchant?.business_name || "TERAL'O Business"}</strong>
              <span style={{fontSize: "12px", color: "#4b5563"}}>{merchant?.address || "Dakar, Sénégal"}</span><br/>
              <span style={{fontSize: "12px", color: "#4b5563"}}>Tél : {merchant?.phone || "+221 ..."}</span>
              {merchant?.ninea && <span style={{display: "block", fontSize: "11px", color: "#6b7280", marginTop: "4px"}}>NINEA : {merchant.ninea}</span>}
            </div>

            {/* Bloc d'informations de la facture */}
            <div style={{display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "25px", background: "#f8fafc", padding: "12px 15px", borderRadius: "8px", border: "1px solid #e2e8f0"}}>
              <div>
                <div style={{marginBottom: "4px"}}><strong>N° de Facture :</strong> <span style={{color: "#0f766e"}}>{invoiceNo}</span></div>
                <div><strong>Caisse :</strong> Principal</div>
              </div>
              <div style={{textAlign: "right"}}>
                <div style={{marginBottom: "4px"}}><strong>Date :</strong> {currentDate}</div>
                <div><strong>Client :</strong> Client comptant</div>
              </div>
            </div>

            {/* Tableau des articles structuré */}
            <div style={{marginBottom: "20px"}}>
              <div style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: "2px solid #cbd5e1", paddingBottom: "8px", fontSize: "11px", fontWeight: "bold", color: "#475569", textTransform: "uppercase"}}>
                <span>Désignation</span>
                <span style={{textAlign: "center"}}>Qté</span>
                <span style={{textAlign: "right"}}>P.U.</span>
                <span style={{textAlign: "right"}}>Total</span>
              </div>
              {cart.map((x, i) => {
                const unitPrice = x.sale_price || x.price || 0;
                const lineTotal = x.qty * unitPrice;
                return (
                  <div key={i} style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "12px 0", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: "12px"}}>
                    <span style={{fontWeight: "500", color: "#0f172a"}}>{x.name}</span>
                    <span style={{textAlign: "center", color: "#475569"}}>{x.qty}</span>
                    <span style={{textAlign: "right", color: "#475569"}}>{money(unitPrice)}</span>
                    <span style={{textAlign: "right", fontWeight: "600", color: "#0f172a"}}>{money(lineTotal)}</span>
                  </div>
                );
              })}
            </div>

            {/* Totaux & Paiement */}
            <div style={{borderTop: "2px solid #cbd5e1", paddingTop: "15px", marginTop: "15px"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "16px", fontWeight: "bold", color: "#065f46", marginBottom: "8px"}}>
                <span>NET À PAYER</span>
                <span style={{fontSize: "18px"}}>{money(calculatedTotal)}</span>
              </div>
              <div style={{display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569"}}>
                <span>Mode de règlement</span>
                <span style={{fontWeight: "500"}}>Espèces</span>
              </div>
            </div>
          </div>

          {/* Pied de page calé tout en bas */}
          <div style={{textAlign: "center", borderTop: "1px dashed #cbd5e1", paddingTop: "15px", marginTop: "30px", fontSize: "11px", color: "#64748b"}}>
            <p style={{fontWeight: "600", color: "#0f172a", marginBottom: "4px"}}>Merci pour votre confiance !</p>
            <p>Les marchandises vendues ne sont ni reprises ni échangées.</p>
          </div>
        </div>

        {/* Boutons d'action en bas (Imprimer + Fermer) */}
        <div style={{padding: "15px 25px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", gap: "12px"}}>
          <button className="btn btn-secondary" onClick={close} style={{flex: 1, padding: "12px", background: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer", color: "#334155"}}>
            Fermer / Retour
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} style={{flex: 2, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "12px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer"}}>
            <Printer size={18}/> Imprimer la facture
          </button>
        </div>
      </div>
    </div>
  );
}

function Products({data,persist,remove}) {
  const [query,setQuery]=useState("");
  const [show,setShow]=useState(false);
  const [edit,setEdit]=useState(null);
  const [form,setForm]=useState(initialProduct);
  const filtered=data.products.filter(p=>`${p.name} ${p.sku||""} ${p.category||""}`.toLowerCase().includes(query.toLowerCase()));
  function open(p=null){setEdit(p);setForm(p?{...p}:initialProduct);setShow(true)}
  async function submit(e){e.preventDefault();await persist("product",{...form,id:form.id||uid(),sale_price:Number(form.sale_price),purchase_price:Number(form.purchase_price),stock:Number(form.stock),alert_threshold:Number(form.alert_threshold)});setShow(false)}
  function csv(e){const file=e.target.files?.[0];if(!file)return;Papa.parse(file,{header:true,skipEmptyLines:true,complete:async r=>{for(const row of r.data){if(row.name) await persist("product",{...initialProduct,...row,id:uid(),sale_price:Number(row.sale_price||0),purchase_price:Number(row.purchase_price||0),stock:Number(row.stock||0),alert_threshold:Number(row.alert_threshold||2)})}}})}
  return <div><PageHead title="Produits & Stocks" subtitle="Votre catalogue, vos niveaux de stock et vos alertes." actions={<><label className="btn btn-secondary file-btn"><Upload size={16}/> Importer CSV<input type="file" accept=".csv" onChange={csv}/></label><button className="btn btn-primary" onClick={()=>open()}><Plus size={17}/> Ajouter un produit</button></>}/><div className="toolbar"><div className="search-input"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher par nom, SKU ou catégorie…"/></div><button className="filter-btn">Tous les produits <ChevronDown size={15}/></button><span className="toolbar-count">{filtered.length} produits</span></div><section className="panel table-panel"><table><thead><tr><th>Produit</th><th>SKU</th><th>Catégorie</th><th>Prix de vente</th><th>Stock</th><th>Seuil</th><th>Statut</th><th></th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><div className="table-product"><div className="mini-product">{p.name.slice(0,1)}</div><strong>{p.name}</strong></div></td><td>{p.sku||"—"}</td><td><span className="pill neutral">{p.category||"Non classé"}</span></td><td><b>{money(p.sale_price)}</b></td><td><b className={Number(p.stock)<=Number(p.alert_threshold)?"danger-text":""}>{number(p.stock)} {p.unit}</b></td><td>{number(p.alert_threshold)}</td><td><span className={"pill "+(p.is_active?"success":"neutral")}>{p.is_active?"Actif":"Inactif"}</span></td><td><button className="more-btn" onClick={()=>open(p)}><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table></section>{show&&<ProductModal form={form} setForm={setForm} edit={edit} close={()=>setShow(false)} submit={submit} remove={remove}/>}</div>
}

function ProductModal({form,setForm,edit,close,submit,remove}) {
  return <Modal title={edit?"Modifier le produit":"Nouveau produit"} close={close}><form onSubmit={submit}><div className="form-grid"><Field label="Nom du produit" value={form.name} onChange={v=>setForm({...form,name:v})} placeholder="Ex. Lit 2 places"/><Field label="SKU / Référence" value={form.sku} onChange={v=>setForm({...form,sku:v})} placeholder="LIT-200"/><Field label="Catégorie" value={form.category} onChange={v=>setForm({...form,category:v})} placeholder="Lits"/><Field label="Unité" value={form.unit} onChange={v=>setForm({...form,unit:v})} placeholder="unité"/><Field label="Prix de vente" type="number" value={form.sale_price} onChange={v=>setForm({...form,sale_price:v})}/><Field label="Prix d'achat" type="number" value={form.purchase_price} onChange={v=>setForm({...form,purchase_price:v})}/><Field label="Stock actuel" type="number" value={form.stock} onChange={v=>setForm({...form,stock:v})}/><Field label="Seuil d'alerte" type="number" value={form.alert_threshold} onChange={v=>setForm({...form,alert_threshold:v})}/></div><label className="field"><span>Description</span><textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description courte…"/></label><div className="modal-actions">{edit&&<button type="button" className="btn btn-danger" onClick={()=>{remove("product",edit.id);close()}}>Supprimer</button>}<span/><button type="button" className="btn btn-secondary" onClick={close}>Annuler</button><button className="btn btn-primary">Enregistrer</button></div></form></Modal>
}

function Customers({data,persist,remove}) {
  const [show,setShow]=useState(false); const [form,setForm]=useState({name:"",phone:"",email:"",address:"",notes:""});
  const [q,setQ]=useState("");
  const list=data.customers.filter(c=>`${c.name} ${c.phone||""}`.toLowerCase().includes(q.toLowerCase()));
  async function submit(e){e.preventDefault();await persist("customer",{...form,id:form.id||uid()});setShow(false);setForm({name:"",phone:"",email:"",address:"",notes:""})}
  return <div><PageHead title="Clients" subtitle="Centralisez vos contacts et suivez leurs comptes." actions={<button className="btn btn-primary" onClick={()=>setShow(true)}><Plus size={17}/> Nouveau client</button>}/><div className="toolbar"><div className="search-input"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un client…"/></div><span className="toolbar-count">{list.length} clients</span></div><div className="customer-grid">{list.map(c=>{const total=data.sales.filter(s=>s.customer_id===c.id).reduce((a,s)=>a+Number(s.total),0);return <div className="panel customer-card" key={c.id}><div className="customer-top"><div className="customer-avatar">{c.name.slice(0,1)}</div><div><h3>{c.name}</h3><span>{c.phone||"Téléphone non renseigné"}</span></div><button className="more-btn" onClick={()=>remove("customer",c.id)}><MoreHorizontal/></button></div><div className="customer-stats"><div><span>Achats</span><b>{money(total)}</b></div><div><span>Dernier achat</span><b>{dateLabel(data.sales.find(s=>s.customer_id===c.id)?.created_at||new Date())}</b></div></div><div className="customer-actions"><button><MessageCircle size={15}/> WhatsApp</button><button><FileText size={15}/> Historique</button></div></div>})}{show&&<Modal title="Nouveau client" close={()=>setShow(false)}><form onSubmit={submit}><Field label="Nom complet" value={form.name} onChange={v=>setForm({...form,name:v})} placeholder="Ex. Awa Ndiaye"/><Field label="Téléphone" value={form.phone} onChange={v=>setForm({...form,phone:v})} placeholder="77 000 00 00"/><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})}/><Field label="Adresse" value={form.address} onChange={v=>setForm({...form,address:v})}/><div className="modal-actions"><span/><button type="button" className="btn btn-secondary" onClick={()=>setShow(false)}>Annuler</button><button className="btn btn-primary">Ajouter</button></div></form></Modal>}</div></div>
}

function Quotes({data,persist,setPage}) {
  const [show,setShow]=useState(false); const [customer,setCustomer]=useState(""); const [items,setItems]=useState([]);
  const total=items.reduce((a,x)=>a+x.sale_price*x.qty,0);
  function add(){const p=data.products[0];if(p)setItems([...items,{...p,qty:1}])}
  async function save(){await persist("quote",{id:uid(),quote_number:invoiceNo("DEV"),customer_id:customer||null,status:"draft",total,valid_until:todayISO(),created_at:new Date().toISOString()});setShow(false);setItems([])}
  return <div><PageHead title="Devis" subtitle="Créez des propositions commerciales élégantes et transformez-les en ventes." actions={<button className="btn btn-primary" onClick={()=>setShow(true)}><Plus size={17}/> Nouveau devis</button>}/><section className="panel table-panel"><table><thead><tr><th>Référence</th><th>Client</th><th>Date</th><th>Validité</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>{data.quotes.map(q=><tr key={q.id}><td><b>{q.quote_number}</b></td><td>{data.customers.find(c=>c.id===q.customer_id)?.name||"Client comptant"}</td><td>{dateLabel(q.created_at)}</td><td>{q.valid_until?dateLabel(q.valid_until):"—"}</td><td><b>{money(q.total)}</b></td><td><span className={"pill "+(q.status==="sent"?"info":"neutral")}>{q.status==="sent"?"Envoyé":"Brouillon"}</span></td><td><button className="more-btn"><MoreHorizontal/></button></td></tr>)}</tbody></table></section>{show&&<Modal title="Créer un devis" close={()=>setShow(false)}><div className="quote-builder"><label className="field"><span>Client</span><select value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Sélectionner</option>{data.customers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><div className="quote-items">{items.map((x,i)=><div className="quote-line" key={i}><span>{x.name}</span><b>{money(x.sale_price)}</b><input type="number" min="1" value={x.qty} onChange={e=>setItems(items.map((a,j)=>j===i?{...a,qty:Number(e.target.value)}:a))}/></div>)}</div><button className="btn btn-secondary full" onClick={add}><Plus/> Ajouter un article</button><div className="total-line grand"><span>Total</span><strong>{money(total)}</strong></div><button className="btn btn-primary full" onClick={save}>Enregistrer le devis</button></div></Modal>}</div>
}

function Cash({data,persist}) {
  const [type,setType]=useState("income"); const [label,setLabel]=useState(""); const [amount,setAmount]=useState(""); const [category,setCategory]=useState("");
  const income=data.cash_entries.filter(e=>e.type==="income").reduce((a,e)=>a+Number(e.amount),0), expense=data.cash_entries.filter(e=>e.type==="expense").reduce((a,e)=>a+Number(e.amount),0);
  async function add(e){e.preventDefault();if(!label||!amount)return;await persist("cash",{id:uid(),type,label,category,amount:Number(amount),payment_method:"Espèces",created_at:new Date().toISOString()});setLabel("");setAmount("");}
  return <div><PageHead title="Trésorerie" subtitle="Suivez vos entrées, dépenses et votre solde disponible."/><div className="metrics three"><Metric title="Total entrées" value={money(income)} delta="+9,1%" icon={ArrowDownRight} tone="green"/><Metric title="Total dépenses" value={money(expense)} delta="+3,2%" icon={ArrowUpRight} tone="orange"/><Metric title="Solde net" value={money(income-expense)} delta="+6,8%" icon={WalletCards} tone="blue"/></div><div className="grid-2"><section className="panel"><div className="panel-head"><div><h3>Nouvelle opération</h3><p>Ajoutez une entrée ou une dépense.</p></div></div><form onSubmit={add}><div className="segmented"><button type="button" className={type==="income"?"active":""} onClick={()=>setType("income")}>Entrée</button><button type="button" className={type==="expense"?"active":""} onClick={()=>setType("expense")}>Dépense</button></div><Field label="Libellé" value={label} onChange={setLabel} placeholder={type==="income"?"Encaissement client":"Achat fournisseur"}/><div className="form-grid two"><Field label="Montant" type="number" value={amount} onChange={setAmount} placeholder="0"/><Field label="Catégorie" value={category} onChange={setCategory} placeholder="Ex. Approvisionnement"/></div><button className="btn btn-primary full"><Plus size={17}/> Ajouter</button></form></section><section className="panel"><div className="panel-head"><div><h3>Journal financier</h3><p>Dernières opérations</p></div></div><div className="finance-list">{data.cash_entries.slice(0,8).map(e=><div className="finance-row" key={e.id}><div className={"finance-icon "+e.type}>{e.type==="income"?<ArrowDownRight/>:<ArrowUpRight/>}</div><div><strong>{e.label}</strong><span>{e.category||"Divers"} · {dateLabel(e.created_at)}</span></div><b className={e.type==="income"?"green-text":"danger-text"}>{e.type==="income"?"+":"−"} {money(e.amount)}</b></div>)}</div></section></div></div>
}

function SettingsPage({data,persist,session}) {
  const [form,setForm]=useState({...data.merchant});
  const [tab,setTab]=useState("company");
  async function save(e){e.preventDefault();await persist("merchant",{...form,id:session.user.id,updated_at:new Date().toISOString()})}
  async function logo(e){const f=e.target.files?.[0];if(!f)return;const url=await uploadAsset(f,session.user.id);setForm({...form,logo_url:url});}
  return <div><PageHead title="Paramètres" subtitle="Personnalisez votre entreprise et vos préférences de gestion."/><div className="settings-layout"><aside className="settings-nav panel">{[["company","Entreprise",Building2],["billing","Abonnement",Sparkles],["invoice","Facturation",Receipt],["security","Sécurité",Settings]].map(([id,l,I])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><I size={17}/>{l}</button>)}</aside><section className="panel settings-main">{tab==="company"&&<form onSubmit={save}><div className="section-head"><div><h3>Identité de l'entreprise</h3><p>Ces informations apparaissent sur vos documents commerciaux.</p></div><button className="btn btn-primary">Enregistrer</button></div><div className="logo-upload"><div className="logo-preview">{form.logo_url?<img src={form.logo_url} alt="logo"/>:<Building2 size={25}/>}</div><div><strong>Logo officiel</strong><p>PNG, JPG ou WebP · recommandé 512 × 512 px</p><label className="btn btn-secondary file-btn">Changer le logo<input type="file" accept="image/*" onChange={logo}/></label></div></div><div className="form-grid"><Field label="Nom de l'entreprise" value={form.business_name||""} onChange={v=>setForm({...form,business_name:v})}/><Field label="Nom du responsable" value={form.full_name||""} onChange={v=>setForm({...form,full_name:v})}/><Field label="Téléphone" value={form.phone||""} onChange={v=>setForm({...form,phone:v})}/><Field label="Ville" value={form.city||""} onChange={v=>setForm({...form,city:v})}/><Field label="Adresse" value={form.address||""} onChange={v=>setForm({...form,address:v})}/><Field label="Secteur d'activité" value={form.sector||""} onChange={v=>setForm({...form,sector:v})}/><Field label="NINEA (optionnel)" value={form.ninea||""} onChange={v=>setForm({...form,ninea:v})}/><Field label="RCCM (optionnel)" value={form.rccm||""} onChange={v=>setForm({...form,rccm:v})}/></div><label className="field"><span>Description</span><textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></label></form>}{tab==="billing"&&<Billing plan={data.merchant?.plan||"Premium"}/>} {tab==="invoice"&&<InvoiceSettings merchant={form}/>} {tab==="security"&&<div className="security-box"><CheckCircle2/><div><h3>Compte sécurisé</h3><p>Authentification gérée par Supabase Auth avec isolation RLS par marchand.</p></div></div>}</section></div></div>
}

function Billing({plan}){return <div><div className="section-head"><div><h3>Votre abonnement</h3><p>Choisissez le niveau adapté à votre activité.</p></div></div><div className="plans">{plans.map((p,i)=><div className={"plan "+(plan===p?"selected":"")} key={p}><span>{p}</span><h3>{["9 900","19 900","34 900"][i]} <small>FCFA / mois</small></h3><p>{["Pour démarrer","Pour les PME","Pour piloter sans limites"][i]}</p><ul><li>✓ Caisse & ventes</li><li>✓ Gestion des stocks</li><li>✓ Clients & devis</li><li>{i>0?"✓":"—"} Trésorerie avancée</li></ul><button className="btn btn-secondary full">{plan===p?"Plan actuel":"Choisir"}</button></div>)}</div></div>}

function InvoiceSettings({merchant}){return <div><div className="section-head"><div><h3>Facturation & impression</h3><p>Préparez vos documents pour A4 ou ticket thermique.</p></div></div><div className="invoice-options"><div><strong>Format par défaut</strong><p>Choisissez le format utilisé à l'impression.</p></div><div className="segmented"><button className="active">A4</button><button>80 mm</button><button>58 mm</button></div></div><div className="invoice-options"><div><strong>Mentions légales</strong><p>Logo, NINEA et RCCM peuvent être affichés ou masqués.</p></div><label className="toggle"><input type="checkbox" defaultChecked/><i/></label></div><div className="document-preview"><div className="doc-head"><div className="brand-mark">T</div><div><strong>{merchant.business_name||"Votre entreprise"}</strong><span>{merchant.phone||"Téléphone"} · {merchant.city||"Dakar"}</span></div></div><hr/><p>FACTURE N° FAC-2026-0001</p><div className="doc-lines"><i/><i/><i/><i/></div><div className="doc-total">TOTAL <b>185 000 FCFA</b></div></div></div>}

function Onboarding({data,step,setStep,persist,close}) {
  const [plan,setPlan]=useState(data.merchant?.plan||"Standard");
  const [sector,setSector]=useState(data.merchant?.sector||sectors[0]);
  const [business,setBusiness]=useState(data.merchant?.business_name||"");
  async function finish(){await persist("merchant",{id:data.merchant.id,business_name:business||"Mon entreprise",plan,sector,updated_at:new Date().toISOString()});close()}
  return <div className="modal-backdrop"><div className="modal onboarding"><div className="onboard-progress"><span className={step>=1?"active":""}>1</span><i/><span className={step>=2?"active":""}>2</span><i/><span className={step>=3?"active":""}>3</span></div>{step===1&&<div><span className="eyebrow">Bienvenue</span><h2>Choisissez votre plan</h2><p className="muted">Vous pourrez le modifier à tout moment.</p><div className="onboard-plans">{plans.map(p=><button className={plan===p?"selected":""} key={p} onClick={()=>setPlan(p)}><strong>{p}</strong><span>{p==="Basic"?"Pour commencer":p==="Standard"?"Pour accélérer":"Pour aller plus loin"}</span>{plan===p&&<CheckCircle2/>}</button>)}</div></div>}{step===2&&<div><span className="eyebrow">Personnalisation</span><h2>Quel est votre secteur ?</h2><p className="muted">TERAL'O adaptera vos écrans et indicateurs métier.</p><div className="sector-grid">{sectors.map(s=><button className={sector===s?"selected":""} key={s} onClick={()=>setSector(s)}><Building2 size={20}/><span>{s}</span>{sector===s&&<CheckCircle2/>}</button>)}</div></div>}{step===3&&<div><span className="eyebrow">Votre entreprise</span><h2>Finalisons votre espace</h2><p className="muted">Vous pourrez compléter les informations plus tard.</p><Field label="Nom de l'entreprise" value={business} onChange={setBusiness} placeholder="Ex. Dabakh Menuiserie"/><div className="onboard-summary"><span><strong>Plan</strong>{plan}</span><span><strong>Secteur</strong>{sector}</span></div></div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={step===1?close:()=>setStep(step-1)}>{step===1?"Plus tard":"Retour"}</button><span/><button className="btn btn-primary" onClick={step<3?()=>setStep(step+1):finish}>{step<3?"Continuer":"Terminer la configuration"} <ArrowUpRight size={16}/></button></div></div></div>
}

function Modal({title,close,children}){return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><h3>{title}</h3></div><button className="icon-btn" onClick={close}><X size={19}/></button></div>{children}</div></div>}
