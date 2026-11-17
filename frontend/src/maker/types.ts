/* ===== Maker: tipos e regras de cálculo ===== */

export type MakerSection = "orders" | "models" | "clients" | "materials" | "reports";

export type MakerUnit = "g" | "kg" | "h" | "kwh" | "un" | "ml" | "m";

export const unitLabel: Record<MakerUnit, string> = {
  g: "Grama (g)",
  kg: "Quilo (kg)",
  h: "Hora (h)",
  kwh: "kWh",
  un: "Unidade",
  ml: "Mililitro (ml)",
  m: "Metro (m)"
};

export const unitShort: Record<MakerUnit, string> = { g: "g", kg: "kg", h: "h", kwh: "kWh", un: "un", ml: "ml", m: "m" };

export interface MakerClient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address: string;
  number: string;
  cep: string;
  createdAt: string;
}

export interface MakerMaterial {
  id: string;
  title: string;
  description?: string;
  details?: string;
  unit: MakerUnit;
  /** Valor por unidade (R$). */
  price: number;
  createdAt: string;
}

/** Arquivo salvo no servidor (id) ou, sem servidor, dentro dos dados (dataUrl). */
export interface MakerFileRef {
  id?: string;
  dataUrl?: string;
  name: string;
  size: number;
  type: string;
}

export interface MakerModelMaterial {
  materialId: string;
  /** Materiais em horas usam as horas de impressão do modelo (quantity fica nulo). */
  quantity: number | null;
}

export interface MakerModel {
  id: string;
  title: string;
  photo?: MakerFileRef;
  grams: number | null;
  hours: number | null;
  file?: MakerFileRef;
  materials: MakerModelMaterial[];
  createdAt: string;
}

/** Custo de um modelo congelado no dia em que o pedido foi criado. */
export interface MakerModelSnapshot {
  title: string;
  hours: number;
  grams: number;
  cost: number;
  materials: Array<{ materialId: string; title: string; unit: MakerUnit; price: number; quantity: number; cost: number }>;
  at: string;
}

export type MakerOrderStatus = "queue" | "printing" | "ready" | "delivered";

export const orderStatuses: Array<{ id: MakerOrderStatus; label: string; color: string }> = [
  { id: "queue", label: "Na fila", color: "#8a8a8a" },
  { id: "printing", label: "Imprimindo", color: "#f59e0b" },
  { id: "ready", label: "Pronto", color: "#22c55e" },
  { id: "delivered", label: "Entregue", color: "#38bdf8" }
];

export interface MakerOrderItem {
  modelId: string;
  quantity: number;
  snap?: MakerModelSnapshot;
}

export interface MakerOrder {
  id: string;
  clientId: string;
  /** AAAA-MM-DD */
  dueDate: string;
  status: MakerOrderStatus;
  notes?: string;
  items: MakerOrderItem[];
  createdAt: string;
  deliveredAt?: string | null;
}

export interface MakerData {
  clients: MakerClient[];
  materials: MakerMaterial[];
  models: MakerModel[];
  orders: MakerOrder[];
}

/* ------------------------------------------------------------------ */

export const newMakerId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`}`;

export const brl = (value: number) => (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (value: number | null | undefined) => (Number(value) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseFloat(String(value).replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

export function localIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isoOf(timestamp: string) {
  return localIso(new Date(timestamp));
}

export function formatDay(iso?: string | null, withWeekday = true) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", withWeekday ? { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" } : undefined);
}

export function daysUntil(iso: string) {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${localIso()}T12:00:00`).getTime()) / 86400000);
}

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** Quantidade usada de um material: em horas, segue as horas de impressão do modelo. */
export function materialQuantity(item: MakerModelMaterial, material: MakerMaterial, hours: number | null) {
  return material.unit === "h" ? Number(hours) || 0 : Number(item.quantity) || 0;
}

/** Custo atual de um modelo (preços de hoje). */
export function snapshotModel(model: MakerModel | undefined, materials: MakerMaterial[]): MakerModelSnapshot | undefined {
  if (!model) return undefined;
  const byId = new Map(materials.map((material) => [material.id, material]));
  const lines = model.materials
    .map((item) => {
      const material = byId.get(item.materialId);
      if (!material) return null;
      const quantity = materialQuantity(item, material, model.hours);
      const price = Number(material.price) || 0;
      return { materialId: material.id, title: material.title, unit: material.unit, price, quantity, cost: quantity * price };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  return {
    title: model.title,
    hours: Number(model.hours) || 0,
    grams: Number(model.grams) || 0,
    cost: lines.reduce((total, line) => total + line.cost, 0),
    materials: lines,
    at: new Date().toISOString()
  };
}

export const modelCost = (model: MakerModel | undefined, materials: MakerMaterial[]) => snapshotModel(model, materials)?.cost ?? 0;

/** Dados de um item do pedido: custo congelado; sem ele (ou ao recalcular), os preços atuais. */
export function orderItemInfo(item: MakerOrderItem, data: Pick<MakerData, "models" | "materials">, current = false) {
  return (!current && item.snap) || snapshotModel(data.models.find((model) => model.id === item.modelId), data.materials);
}

export function orderItemTitle(item: MakerOrderItem, models: MakerModel[]) {
  return models.find((model) => model.id === item.modelId)?.title ?? item.snap?.title ?? "Modelo excluído";
}

export function orderTotals(order: Pick<MakerOrder, "items">, data: Pick<MakerData, "models" | "materials">, current = false) {
  return order.items.reduce(
    (totals, item) => {
      const info = orderItemInfo(item, data, current);
      const quantity = Number(item.quantity) || 0;
      totals.pieces += quantity;
      if (info) {
        totals.hours += info.hours * quantity;
        totals.grams += info.grams * quantity;
        totals.cost += info.cost * quantity;
      }
      return totals;
    },
    { pieces: 0, hours: 0, grams: 0, cost: 0 }
  );
}

/** Ordem da esteira: entrega mais próxima primeiro; empate, o pedido mais antigo. */
export const productionOrder = (a: MakerOrder, b: MakerOrder) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt);
