import { orderStatuses, productionOrder } from "./types";
import type { MakerModel, MakerOrder, MakerOrderItem, MakerOrderStatus } from "./types";

/**
 * Cada item do pedido pode estar numa etapa diferente do pedido (impressão em levas).
 * Sem `status`, o item acompanha a etapa do pedido.
 */
export const stageIndex = (status: MakerOrderStatus) => orderStatuses.findIndex((item) => item.id === status);

export const itemStatus = (order: MakerOrder, item: MakerOrderItem): MakerOrderStatus => item.status ?? order.status;

/** Junta itens iguais na mesma etapa. Se tudo estiver na mesma etapa, o pedido volta a ser um só. */
export function normalizeOrder(order: MakerOrder): MakerOrder {
  const rows = new Map<string, MakerOrderItem>();

  order.items.forEach((item) => {
    const status = itemStatus(order, item);
    const key = `${item.modelId}|${status}`;
    const existing = rows.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      rows.set(key, { ...item, status });
    }
  });

  const items = [...rows.values()].filter((item) => item.quantity > 0);
  const statuses = new Set(items.map((item) => item.status as MakerOrderStatus));
  const status = items.length
    ? ([...statuses].sort((a, b) => stageIndex(a) - stageIndex(b))[0] as MakerOrderStatus)
    : order.status;

  return {
    ...order,
    status,
    deliveredAt: status === "delivered" ? order.deliveredAt ?? new Date().toISOString() : null,
    items: statuses.size > 1 ? items : items.map(({ status: _status, ...item }) => item)
  };
}

export interface OrderPart {
  status: MakerOrderStatus;
  items: MakerOrderItem[];
}

/** Pedaços do pedido por etapa (um só quando o pedido não está dividido). */
export function orderParts(order: MakerOrder): OrderPart[] {
  const parts = new Map<MakerOrderStatus, MakerOrderItem[]>();
  order.items.forEach((item) => {
    const status = itemStatus(order, item);
    parts.set(status, [...(parts.get(status) ?? []), item]);
  });
  return [...parts.entries()].sort((a, b) => stageIndex(a[0]) - stageIndex(b[0])).map(([status, items]) => ({ status, items }));
}

/** Move todos os itens de uma etapa para outra. */
export function movePart(order: MakerOrder, from: MakerOrderStatus, to: MakerOrderStatus): MakerOrder {
  if (from === to) return order;
  return normalizeOrder({ ...order, items: order.items.map((item) => (itemStatus(order, item) === from ? { ...item, status: to } : item)) });
}

/** Move só parte das unidades de um modelo (uma leva), dividindo o item se preciso. */
export function moveUnits(order: MakerOrder, modelId: string, from: MakerOrderStatus, to: MakerOrderStatus, quantity: number): MakerOrder {
  let remaining = quantity;
  const items: MakerOrderItem[] = [];

  order.items.forEach((item) => {
    if (remaining > 0 && item.modelId === modelId && itemStatus(order, item) === from) {
      const taken = Math.min(remaining, item.quantity);
      remaining -= taken;
      items.push({ ...item, quantity: taken, status: to });
      if (item.quantity > taken) items.push({ ...item, quantity: item.quantity - taken, status: from });
    } else {
      items.push(item);
    }
  });

  return normalizeOrder({ ...order, items });
}

export interface PrintBatch {
  /** Quem está nesta leva e quantas unidades de cada. */
  lines: Array<{ orderId: string; quantity: number }>;
  units: number;
}

export interface PrintJob {
  model: MakerModel | undefined;
  modelId: string;
  title: string;
  pending: number;
  perPrint: number;
  batches: PrintBatch[];
  /** Entrega mais próxima entre os pedidos que pedem este modelo. */
  nextDue: string;
  /** Horas de impressão de todas as levas (horas do modelo = uma impressão). */
  hours: number;
}

/** Modelos a imprimir (itens "Na fila"), agrupados em levas conforme a quantidade por impressão. */
export function printJobs(orders: MakerOrder[], models: MakerModel[], titleOf: (modelId: string) => string): PrintJob[] {
  const jobs = new Map<string, { units: Array<{ orderId: string; quantity: number; due: string }>; nextDue: string }>();

  [...orders].sort(productionOrder).forEach((order) => {
    order.items.forEach((item) => {
      if (itemStatus(order, item) !== "queue") return;
      const job = jobs.get(item.modelId) ?? { units: [], nextDue: order.dueDate };
      job.units.push({ orderId: order.id, quantity: item.quantity, due: order.dueDate });
      if (order.dueDate < job.nextDue) job.nextDue = order.dueDate;
      jobs.set(item.modelId, job);
    });
  });

  return [...jobs.entries()]
    .map(([modelId, job]) => {
      const model = models.find((item) => item.id === modelId);
      const perPrint = Math.max(1, Math.floor(Number(model?.perPrint) || 1));
      const batches: PrintBatch[] = [];
      let current: PrintBatch = { lines: [], units: 0 };

      job.units.forEach((entry) => {
        let left = entry.quantity;
        while (left > 0) {
          const take = Math.min(left, perPrint - current.units);
          const last = current.lines[current.lines.length - 1];
          if (last && last.orderId === entry.orderId) last.quantity += take;
          else current.lines.push({ orderId: entry.orderId, quantity: take });
          current.units += take;
          left -= take;
          if (current.units >= perPrint) {
            batches.push(current);
            current = { lines: [], units: 0 };
          }
        }
      });
      if (current.units > 0) batches.push(current);

      return {
        model,
        modelId,
        title: model?.title ?? titleOf(modelId),
        pending: batches.reduce((sum, batch) => sum + batch.units, 0),
        perPrint,
        batches,
        nextDue: job.nextDue,
        hours: (Number(model?.hours) || 0) * batches.length
      };
    })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.title.localeCompare(b.title));
}
