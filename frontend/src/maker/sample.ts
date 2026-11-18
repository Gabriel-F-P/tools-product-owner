import { localIso, newMakerId, orderStatuses, snapshotModel } from "./types";
import type { MakerClient, MakerData, MakerMaterial, MakerModel, MakerOrder, MakerOrderStatus } from "./types";

const dayFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localIso(date);
};

/** Dados de teste do Maker: 3 clientes, 3 materiais, 3 modelos e 2 pedidos em cada etapa. */
export function makerSampleData(): MakerData {
  const now = new Date().toISOString();

  const clients: MakerClient[] = [
    { id: newMakerId("client"), name: "Ana Souza", phone: "(11) 91234-5678", email: "ana.souza@exemplo.com", address: "Rua das Flores", number: "120", cep: "01310-100", createdAt: now },
    { id: newMakerId("client"), name: "Bruno Lima", phone: "(21) 99876-5432", email: "bruno.lima@exemplo.com", address: "Av. Atlântica", number: "850", cep: "22010-000", createdAt: now },
    { id: newMakerId("client"), name: "Carla Mendes", phone: "(31) 98765-4321", email: "carla.mendes@exemplo.com", address: "Rua da Bahia", number: "45", cep: "30160-011", createdAt: now }
  ];

  const filament: MakerMaterial = { id: newMakerId("material"), title: "Filamento PLA", description: "Bobina de 1 kg", details: "R$ 120,00 por kg", unit: "g", price: 0.12, createdAt: now };
  const energy: MakerMaterial = { id: newMakerId("material"), title: "Energia elétrica", description: "Consumo da impressora", details: "Tarifa média por kWh", unit: "kwh", price: 0.95, createdAt: now };
  const labor: MakerMaterial = { id: newMakerId("material"), title: "Mão de obra", description: "Acabamento e preparo", details: "Segue as horas de impressão do modelo", unit: "h", price: 12, createdAt: now };
  const materials = [filament, energy, labor];

  const model = (title: string, grams: number, hours: number, perPrint: number): MakerModel => ({
    id: newMakerId("model"),
    title,
    grams,
    hours,
    perPrint,
    createdAt: now,
    materials: [
      { materialId: filament.id, quantity: grams },
      { materialId: energy.id, quantity: Math.round(hours * 0.2 * 100) / 100 },
      { materialId: labor.id, quantity: null }
    ]
  });
  const models = [model("Vaso Geométrico", 120, 6, 2), model("Suporte de Celular", 45, 2.5, 4), model("Miniatura de Dragão", 85, 9, 1)];

  // [cliente, modelos (índice, quantidade), dias até a entrega, observação]
  type Draft = [number, Array<[number, number]>, number, string?];
  const plan: Record<MakerOrderStatus, Draft[]> = {
    queue: [
      [0, [[0, 2]], 5, "Cor branca"],
      [1, [[1, 4], [0, 1]], 8]
    ],
    printing: [
      [2, [[2, 1]], 2, "Acabamento fosco"],
      [0, [[1, 2], [0, 1]], -1, "Cliente pediu urgência"]
    ],
    ready: [
      [1, [[0, 1]], 0],
      [2, [[1, 3]], 1, "Embalar para presente"]
    ],
    delivered: [
      [0, [[2, 2]], -6],
      [1, [[1, 1], [2, 1]], -3, "Entregue pessoalmente"]
    ]
  };

  const orders: MakerOrder[] = [];
  orderStatuses.forEach((status) => {
    plan[status.id].forEach(([clientIndex, lines, days, notes]) => {
      orders.push({
        id: newMakerId("order"),
        clientId: clients[clientIndex].id,
        dueDate: dayFromToday(days),
        status: status.id,
        notes,
        createdAt: now,
        deliveredAt: status.id === "delivered" ? now : null,
        items: lines.map(([modelIndex, quantity]) => ({ modelId: models[modelIndex].id, quantity, snap: snapshotModel(models[modelIndex], materials) }))
      });
    });
  });

  return { clients, materials, models, orders };
}
