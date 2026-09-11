export const money = (n=0) =>
  new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(n)||0) + " FCFA";

export const number = (n=0) =>
  new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(Number(n)||0);

export const dateLabel = (value) =>
  new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value));

export const todayISO = () => new Date().toISOString().slice(0,10);

export const uid = () => crypto.randomUUID();

export const invoiceNo = (prefix="FAC") => {
  const y=new Date().getFullYear();
  return `${prefix}-${y}-${String(Date.now()).slice(-6)}`;
};