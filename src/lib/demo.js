const KEY = "teralo-demo-state-v1";

const seed = {
  merchant: {
    id: "demo-merchant",
    business_name: "Dabakh Menuiserie",
    slug: "dabakh-menuiserie",
    full_name: "Administrateur",
    phone: "77 000 00 00",
    city: "Dakar",
    address: "Dakar, Sénégal",
    description: "Atelier de menuiserie moderne et sur mesure.",
    logo_url: "",
    cover_url: "",
    ninea: "000000000",
    rccm: "SN-DKR-2026-A",
    sector: "Artisanat & Menuiserie",
    plan: "Premium",
    currency: "FCFA"
  },
  products: [
    {id:"p1",name:"Lit 2 places",sku:"LIT-200",category:"Lits",sale_price:185000,purchase_price:110000,stock:7,alert_threshold:2,unit:"unité",is_active:true},
    {id:"p2",name:"Armoire 3 portes",sku:"ARM-300",category:"Armoires",sale_price:240000,purchase_price:150000,stock:3,alert_threshold:2,unit:"unité",is_active:true},
    {id:"p3",name:"Coiffeuse premium",sku:"COI-100",category:"Coiffeuses",sale_price:95000,purchase_price:55000,stock:12,alert_threshold:3,unit:"unité",is_active:true},
    {id:"p4",name:"Table à manger",sku:"TAB-080",category:"Tables",sale_price:135000,purchase_price:80000,stock:2,alert_threshold:3,unit:"unité",is_active:true},
    {id:"p5",name:"Chaise design",sku:"CHA-020",category:"Chaises",sale_price:35000,purchase_price:19000,stock:18,alert_threshold:5,unit:"unité",is_active:true}
  ],
  customers: [
    {id:"c1",name:"Awa Ndiaye",phone:"77 123 45 67",email:"",address:"Dakar",notes:"Cliente fidèle"},
    {id:"c2",name:"Mamadou Fall",phone:"76 222 33 44",email:"",address:"Thiès",notes:"Projet salon"},
    {id:"c3",name:"Entreprise Sutura",phone:"33 800 00 00",email:"",address:"Dakar",notes:"Compte B2B"}
  ],
  sales: [
    {id:"s1",invoice_number:"FAC-2026-0018",total:320000,discount:5000,payment_method:"Wave",status:"paid",created_at:"2026-09-11T10:20:00"},
    {id:"s2",invoice_number:"FAC-2026-0017",total:185000,discount:0,payment_method:"Espèces",status:"paid",created_at:"2026-09-10T16:10:00"},
    {id:"s3",invoice_number:"FAC-2026-0016",total:95000,discount:0,payment_method:"Orange Money",status:"paid",created_at:"2026-09-09T11:45:00"},
    {id:"s4",invoice_number:"FAC-2026-0015",total:240000,discount:10000,payment_method:"Crédit client",status:"credit",created_at:"2026-09-08T14:30:00"}
  ],
  cash_entries: [
    {id:"e1",type:"income",label:"Encaissement vente FAC-2026-0018",category:"Vente",amount:320000,payment_method:"Wave",created_at:"2026-09-11T10:20:00"},
    {id:"e2",type:"expense",label:"Achat panneaux bois",category:"Approvisionnement",amount:125000,payment_method:"Espèces",created_at:"2026-09-10T09:15:00"},
    {id:"e3",type:"income",label:"Encaissement vente FAC-2026-0017",category:"Vente",amount:185000,payment_method:"Espèces",created_at:"2026-09-10T16:10:00"},
    {id:"e4",type:"expense",label:"Transport",category:"Logistique",amount:25000,payment_method:"Wave",created_at:"2026-09-09T18:20:00"}
  ],
  quotes: [
    {id:"q1",quote_number:"DEV-2026-0008",customer_id:"c2",status:"sent",total:490000,valid_until:"2026-09-20",created_at:"2026-09-10T12:00:00"},
    {id:"q2",quote_number:"DEV-2026-0007",customer_id:"c1",status:"draft",total:185000,valid_until:"2026-09-18",created_at:"2026-09-09T09:30:00"}
  ]
};

export function loadDemo() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(seed));
  return structuredClone(seed);
}

export function saveDemo(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetDemo() {
  localStorage.setItem(KEY, JSON.stringify(seed));
  return structuredClone(seed);
}