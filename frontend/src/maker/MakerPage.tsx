import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Box,
  Camera,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FolderOpen,
  List,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import { makerSampleData } from "./sample";
import { itemStatus, moveUnits, movePart, normalizeOrder, orderParts, printJobs, stageIndex } from "./orders";
import type { OrderPart } from "./orders";
import { deleteMakerFile, formatBytes, makerFileUrl, resizeImage, storeMakerFile } from "./files";
import {
  brl,
  daysUntil,
  formatDay,
  isoOf,
  localIso,
  maskCep,
  maskPhone,
  materialQuantity,
  modelCost,
  newMakerId,
  num,
  orderItemInfo,
  orderItemTitle,
  orderStatuses,
  orderTotals,
  productionOrder,
  toNumber,
  unitLabel,
  unitShort
} from "./types";
import type {
  MakerClient,
  MakerData,
  MakerFileRef,
  MakerMaterial,
  MakerModel,
  MakerModelMaterial,
  MakerOrder,
  MakerOrderItem,
  MakerOrderStatus,
  MakerSection,
  MakerUnit
} from "./types";
import "./maker.css";

export const emptyMakerData: MakerData = { clients: [], materials: [], models: [], orders: [] };

type Update = Dispatch<SetStateAction<MakerData>>;

const sectionInfo: Record<MakerSection, { title: string; subtitle: string }> = {
  orders: { title: "Pedidos", subtitle: "Esteira de produção: entrega mais próxima primeiro." },
  models: { title: "Modelos", subtitle: "Modelos 3D com foto, arquivo de impressão e custo pelos materiais." },
  clients: { title: "Clientes", subtitle: "Cadastro de clientes do Maker." },
  materials: { title: "Material", subtitle: "Filamentos, energia e tudo o que entra no custo dos modelos." },
  reports: { title: "Relatórios", subtitle: "Custos, pedidos e clientes por período." }
};

export function MakerPage({
  data,
  section,
  onChange,
  renderTopbar
}: {
  data: MakerData;
  section: MakerSection;
  onChange: Update;
  renderTopbar: (title: string, subtitle: string) => ReactNode;
}) {
  const info = sectionInfo[section] ?? sectionInfo.orders;

  return (
    <main className="dashboard mt maker">
      {renderTopbar(info.title, info.subtitle)}
      {section === "clients" && <ClientsSection data={data} onChange={onChange} />}
      {section === "materials" && <MaterialsSection data={data} onChange={onChange} />}
      {section === "models" && <ModelsSection data={data} onChange={onChange} />}
      {section === "orders" && <OrdersSection data={data} onChange={onChange} />}
      {section === "reports" && <ReportsSection data={data} />}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Componentes básicos                                                */
/* ------------------------------------------------------------------ */

const modalStack: number[] = [];
let modalSequence = 0;

/** Modal que pode abrir sobre outro (ex.: novo cliente dentro do pedido); Esc fecha só o de cima. */
function MakerModal({ title, children, footer, onClose, wide = false }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean }) {
  const idRef = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = ++modalSequence;
    idRef.current = id;
    modalStack.push(id);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalStack[modalStack.length - 1] === id) {
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      modalStack.splice(modalStack.indexOf(id), 1);
    };
  }, []);

  return (
    <div className="mt-modal-backdrop" onMouseDown={onClose} role="presentation">
      <div aria-modal="true" className={`mt-modal maker-modal ${wide ? "wide" : ""}`} onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header>
          <h2>{title}</h2>
          <button aria-label="Fechar" className="mt-icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="mt-modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

function SectionHead({ title, count, action }: { title: string; count: number; action?: ReactNode }) {
  return (
    <div className="mt-head">
      <div>
        <h2 className="maker-title">{title}</h2>
        <p className="mt-muted">{count} cadastrado{count === 1 ? "" : "s"}</p>
      </div>
      {action}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="mt-search">
      <Search size={16} />
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="mt-empty maker-empty">{children}</p>;

/* ------------------------------------------------------------------ */
/* Clientes                                                           */
/* ------------------------------------------------------------------ */

function ClientsSection({ data, onChange }: { data: MakerData; onChange: Update }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MakerClient | "new" | null>(null);
  const term = search.trim().toLowerCase();
  const rows = [...data.clients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((client) => !term || [client.name, client.phone, client.email, client.address, client.cep].join(" ").toLowerCase().includes(term));

  function remove(client: MakerClient) {
    const orders = data.orders.filter((order) => order.clientId === client.id);
    if (orders.length) {
      window.alert(`"${client.name}" tem ${orders.length} pedido(s). Exclua os pedidos antes de excluir o cliente.`);
      return;
    }
    if (window.confirm(`Excluir o cliente "${client.name}"?`)) {
      onChange((current) => ({ ...current, clients: current.clients.filter((item) => item.id !== client.id) }));
    }
  }

  return (
    <section className="mt-panel">
      <SectionHead
        action={<button className="mt-btn primary" onClick={() => setEditing("new")} type="button"><Plus size={16} /> Novo cliente</button>}
        count={data.clients.length}
        title="Clientes"
      />
      <SearchBox onChange={setSearch} placeholder="Buscar por nome, telefone, e-mail ou endereço" value={search} />
      {rows.length === 0 ? (
        <Empty>{data.clients.length ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</Empty>
      ) : (
        <div className="maker-cards">
          {rows.map((client) => (
            <article className="maker-card" key={client.id}>
              <div className="maker-card-body">
                <h3>{client.name}</h3>
                {client.phone && <p><Phone size={14} /> {client.phone}</p>}
                {client.email && <p><Mail size={14} /> {client.email}</p>}
                <p className="mt-muted"><MapPin size={14} /> {client.address}, {client.number} · CEP {client.cep}</p>
              </div>
              <div className="maker-card-actions">
                <button className="mt-btn small" onClick={() => setEditing(client)} type="button"><Pencil size={14} /> Editar</button>
                <button className="mt-btn small ghost maker-danger" onClick={() => remove(client)} type="button"><Trash2 size={14} /> Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <ClientModal client={editing === "new" ? undefined : editing} onChange={onChange} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ClientModal({ client, onChange, onClose, onSaved }: { client?: MakerClient; onChange: Update; onClose: () => void; onSaved?: (id: string) => void }) {
  const [form, setForm] = useState({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    cep: client?.cep ?? "",
    number: client?.number ?? "",
    address: client?.address ?? ""
  });
  const [error, setError] = useState("");
  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function onCep(value: string) {
    const cep = maskCep(value);
    set("cep", cep);
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8 || form.address.trim()) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!json.erro) {
        const address = [json.logradouro, json.bairro, json.localidade && `${json.localidade}/${json.uf}`].filter(Boolean).join(", ");
        setForm((current) => (current.address.trim() ? current : { ...current, address }));
      }
    } catch {
      // sem internet: o endereço é digitado à mão
    }
  }

  function save() {
    if (!form.name.trim()) return setError("O nome é obrigatório.");
    if (!/^\d{5}-\d{3}$/.test(form.cep)) return setError("Informe o CEP no formato 00000-000.");
    if (!form.number.trim()) return setError("O número é obrigatório.");
    if (!form.address.trim()) return setError("O endereço é obrigatório.");
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("E-mail inválido.");

    const saved: MakerClient = {
      id: client?.id ?? newMakerId("client"),
      createdAt: client?.createdAt ?? new Date().toISOString(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      cep: form.cep,
      number: form.number.trim(),
      address: form.address.trim()
    };
    onChange((current) => ({
      ...current,
      clients: client ? current.clients.map((item) => (item.id === saved.id ? saved : item)) : [...current.clients, saved]
    }));
    onSaved?.(saved.id);
    onClose();
  }

  return (
    <MakerModal
      footer={<><button className="mt-btn ghost" onClick={onClose} type="button">Cancelar</button><button className="mt-btn primary" onClick={save} type="button">Salvar</button></>}
      onClose={onClose}
      title={client ? "Editar cliente" : "Novo cliente"}
    >
      <form className="mt-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label className="mt-field">Nome *<input autoFocus onChange={(event) => set("name", event.target.value)} value={form.name} /></label>
        <div className="maker-row">
          <label className="mt-field">Telefone<input inputMode="tel" onChange={(event) => set("phone", maskPhone(event.target.value))} placeholder="(00) 00000-0000" type="tel" value={form.phone} /></label>
          <label className="mt-field">E-mail<input inputMode="email" onChange={(event) => set("email", event.target.value)} placeholder="nome@exemplo.com" type="email" value={form.email} /></label>
        </div>
        <div className="maker-row">
          <label className="mt-field">CEP *<input inputMode="numeric" onChange={(event) => onCep(event.target.value)} placeholder="00000-000" value={form.cep} /></label>
          <label className="mt-field small">Número *<input onChange={(event) => set("number", event.target.value)} value={form.number} /></label>
        </div>
        <label className="mt-field">Endereço *<input onChange={(event) => set("address", event.target.value)} placeholder="Rua, bairro, cidade" value={form.address} /></label>
        {error && <p className="mt-error" role="alert">{error}</p>}
        <button hidden type="submit" />
      </form>
    </MakerModal>
  );
}

/* ------------------------------------------------------------------ */
/* Materiais                                                          */
/* ------------------------------------------------------------------ */

function MaterialsSection({ data, onChange }: { data: MakerData; onChange: Update }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MakerMaterial | "new" | null>(null);
  const term = search.trim().toLowerCase();
  const rows = [...data.materials]
    .sort((a, b) => a.title.localeCompare(b.title))
    .filter((material) => !term || [material.title, material.description, material.details].join(" ").toLowerCase().includes(term));

  function remove(material: MakerMaterial) {
    const used = data.models.filter((model) => model.materials.some((item) => item.materialId === material.id));
    if (used.length) {
      window.alert(`"${material.title}" está em ${used.length} modelo(s):\n\n• ${used.map((model) => model.title).join("\n• ")}\n\nRemova-o desses modelos antes de excluir.`);
      return;
    }
    if (window.confirm(`Excluir o material "${material.title}"?`)) {
      onChange((current) => ({ ...current, materials: current.materials.filter((item) => item.id !== material.id) }));
    }
  }

  return (
    <section className="mt-panel">
      <SectionHead
        action={<button className="mt-btn primary" onClick={() => setEditing("new")} type="button"><Plus size={16} /> Novo material</button>}
        count={data.materials.length}
        title="Materiais"
      />
      <SearchBox onChange={setSearch} placeholder="Buscar material" value={search} />
      {rows.length === 0 ? (
        <Empty>{data.materials.length ? "Nenhum material encontrado." : "Nenhum material cadastrado. Cadastre filamentos, energia (em horas), embalagem…"}</Empty>
      ) : (
        <div className="maker-cards">
          {rows.map((material) => (
            <article className="maker-card" key={material.id}>
              <div className="maker-card-body">
                <h3>{material.title}</h3>
                {material.description && <p>{material.description}</p>}
                {material.details && <p className="mt-muted maker-small">{material.details}</p>}
                <p className="maker-price">{brl(material.price)} <span className="mt-muted">/ {unitShort[material.unit]}</span></p>
                {material.unit === "h" && <span className="maker-tag">Usa as horas de impressão</span>}
              </div>
              <div className="maker-card-actions">
                <button className="mt-btn small" onClick={() => setEditing(material)} type="button"><Pencil size={14} /> Editar</button>
                <button className="mt-btn small ghost maker-danger" onClick={() => remove(material)} type="button"><Trash2 size={14} /> Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <MaterialModal material={editing === "new" ? undefined : editing} onChange={onChange} onClose={() => setEditing(null)} />}
    </section>
  );
}

function MaterialModal({ material, onChange, onClose }: { material?: MakerMaterial; onChange: Update; onClose: () => void }) {
  const [title, setTitle] = useState(material?.title ?? "");
  const [description, setDescription] = useState(material?.description ?? "");
  const [details, setDetails] = useState(material?.details ?? "");
  const [unit, setUnit] = useState<MakerUnit>(material?.unit ?? "g");
  const [price, setPrice] = useState(material ? String(material.price) : "");
  const [error, setError] = useState("");

  function save() {
    if (!title.trim()) return setError("O título é obrigatório.");
    const value = toNumber(price);
    if (value === null || value < 0) return setError("Informe o valor por unidade.");

    const saved: MakerMaterial = {
      id: material?.id ?? newMakerId("material"),
      createdAt: material?.createdAt ?? new Date().toISOString(),
      title: title.trim(),
      description: description.trim() || undefined,
      details: details.trim() || undefined,
      unit,
      price: value
    };
    onChange((current) => ({
      ...current,
      materials: material ? current.materials.map((item) => (item.id === saved.id ? saved : item)) : [...current.materials, saved]
    }));
    onClose();
  }

  return (
    <MakerModal
      footer={<><button className="mt-btn ghost" onClick={onClose} type="button">Cancelar</button><button className="mt-btn primary" onClick={save} type="button">Salvar</button></>}
      onClose={onClose}
      title={material ? "Editar material" : "Novo material"}
    >
      <form className="mt-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label className="mt-field">Título *<input autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: PLA Preto, Energia elétrica" value={title} /></label>
        <label className="mt-field">Descrição breve<input onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Filamento PLA 1,75 mm" value={description} /></label>
        <label className="mt-field">Descrição detalhada<textarea onChange={(event) => setDetails(event.target.value)} placeholder="Marca, fornecedor, observações…" rows={3} value={details} /></label>
        <div className="maker-row">
          <label className="mt-field">
            Unidade *
            <select onChange={(event) => setUnit(event.target.value as MakerUnit)} value={unit}>
              {(Object.keys(unitLabel) as MakerUnit[]).map((key) => <option key={key} value={key}>{unitLabel[key]}</option>)}
            </select>
          </label>
          <label className="mt-field">Valor (R$ por {unitShort[unit]}) *<input inputMode="decimal" min="0" onChange={(event) => setPrice(event.target.value)} placeholder="0,00" step="any" type="number" value={price} /></label>
        </div>
        {unit === "h" && <p className="mt-hint">Materiais em horas (como a energia) usam automaticamente as horas de impressão de cada modelo.</p>}
        {error && <p className="mt-error" role="alert">{error}</p>}
        <button hidden type="submit" />
      </form>
    </MakerModal>
  );
}

/* ------------------------------------------------------------------ */
/* Modelos                                                            */
/* ------------------------------------------------------------------ */

function ModelsSection({ data, onChange }: { data: MakerData; onChange: Update }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MakerModel | "new" | null>(null);
  const term = search.trim().toLowerCase();
  const rows = [...data.models].sort((a, b) => a.title.localeCompare(b.title)).filter((model) => !term || model.title.toLowerCase().includes(term));

  function remove(model: MakerModel) {
    const orders = data.orders.filter((order) => order.items.some((item) => item.modelId === model.id));
    if (orders.length) {
      window.alert(`"${model.title}" está em ${orders.length} pedido(s). Remova-o dos pedidos antes de excluir.`);
      return;
    }
    if (window.confirm(`Excluir o modelo "${model.title}"?`)) {
      deleteMakerFile(model.photo);
      deleteMakerFile(model.file);
      onChange((current) => ({ ...current, models: current.models.filter((item) => item.id !== model.id) }));
    }
  }

  return (
    <section className="mt-panel">
      <SectionHead
        action={<button className="mt-btn primary" onClick={() => setEditing("new")} type="button"><Plus size={16} /> Novo modelo</button>}
        count={data.models.length}
        title="Modelos"
      />
      <SearchBox onChange={setSearch} placeholder="Buscar modelo" value={search} />
      {rows.length === 0 ? (
        <Empty>{data.models.length ? "Nenhum modelo encontrado." : "Nenhum modelo cadastrado ainda."}</Empty>
      ) : (
        <div className="maker-cards">
          {rows.map((model) => (
            <article className="maker-card" key={model.id}>
              <div className="maker-thumb" style={model.photo ? { backgroundImage: `url("${makerFileUrl(model.photo)}")` } : undefined}>
                {!model.photo && <Box size={40} />}
              </div>
              <div className="maker-card-body">
                <h3>{model.title}</h3>
                <p className="mt-muted">{model.grams !== null ? `${num(model.grams)} g` : "— g"} · {model.hours !== null ? `${num(model.hours)} h` : "— h"} · {model.materials.length} material(is)</p>
                {model.file && <p className="maker-small"><Paperclip size={13} /> {model.file.name}</p>}
                <p className="maker-price">{brl(modelCost(model, data.materials))}</p>
              </div>
              <div className="maker-card-actions">
                {model.file && <a className="mt-btn small" download={model.file.name} href={makerFileUrl(model.file, true)}><Download size={14} /> 3D</a>}
                <button className="mt-btn small" onClick={() => setEditing(model)} type="button"><Pencil size={14} /> Editar</button>
                <button className="mt-btn small ghost maker-danger" onClick={() => remove(model)} type="button"><Trash2 size={14} /> Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <ModelModal data={data} model={editing === "new" ? undefined : editing} onChange={onChange} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ModelModal({ data, model, onChange, onClose, onSaved }: { data: MakerData; model?: MakerModel; onChange: Update; onClose: () => void; onSaved?: (id: string) => void }) {
  const [title, setTitle] = useState(model?.title ?? "");
  const [grams, setGrams] = useState(model?.grams != null ? String(model.grams) : "");
  const [hours, setHours] = useState(model?.hours != null ? String(model.hours) : "");
  const [perPrint, setPerPrint] = useState(model?.perPrint ? String(model.perPrint) : "1");
  const [photo, setPhoto] = useState<MakerFileRef | undefined>(model?.photo);
  const [file, setFile] = useState<MakerFileRef | undefined>(model?.file);
  const [items, setItems] = useState<Array<{ materialId: string; quantity: string }>>(
    () => model?.materials.map((item) => ({ materialId: item.materialId, quantity: item.quantity != null ? String(item.quantity) : "" })) ?? []
  );
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const createdFiles = useRef<MakerFileRef[]>([]);
  const byId = new Map(data.materials.map((material) => [material.id, material]));
  const hoursValue = toNumber(hours);
  const lines = items.map((item) => {
    const material = byId.get(item.materialId);
    const quantity = material ? materialQuantity({ materialId: item.materialId, quantity: toNumber(item.quantity) }, material, hoursValue) : 0;
    return { item, material, quantity, cost: material ? quantity * (Number(material.price) || 0) : 0 };
  });
  const total = lines.reduce((sum, line) => sum + line.cost, 0);

  async function upload(kind: "photo" | "file", input: HTMLInputElement) {
    const chosen = input.files?.[0];
    input.value = "";
    if (!chosen) return;
    setBusy(kind === "photo" ? "Enviando foto…" : "Enviando arquivo…");
    const blob = kind === "photo" ? await resizeImage(chosen) : chosen;
    const name = kind === "photo" ? chosen.name.replace(/\.[^.]+$/, "") + ".jpg" : chosen.name;
    const ref = await storeMakerFile(blob, name);
    createdFiles.current.push(ref);
    if (kind === "photo") setPhoto(ref);
    else setFile(ref);
    setBusy("");
  }

  function cancel() {
    // Arquivos enviados agora e não salvos são descartados.
    createdFiles.current.forEach(deleteMakerFile);
    onClose();
  }

  function addMaterial() {
    if (!selectedMaterial) return setError("Selecione um material.");
    if (items.some((item) => item.materialId === selectedMaterial)) return setError("Esse material já está na lista.");
    setItems((current) => [...current, { materialId: selectedMaterial, quantity: "" }]);
    setSelectedMaterial("");
    setError("");
  }

  function save() {
    if (!title.trim()) return setError("O título é obrigatório.");
    if (busy) return setError("Aguarde o envio do arquivo terminar.");

    const saved: MakerModel = {
      id: model?.id ?? newMakerId("model"),
      createdAt: model?.createdAt ?? new Date().toISOString(),
      title: title.trim(),
      grams: toNumber(grams),
      hours: hoursValue,
      perPrint: Math.max(1, Math.floor(toNumber(perPrint) ?? 1)),
      photo,
      file,
      materials: items.map<MakerModelMaterial>((item) => ({
        materialId: item.materialId,
        quantity: byId.get(item.materialId)?.unit === "h" ? null : toNumber(item.quantity)
      }))
    };
    // Arquivos substituídos ou removidos saem do servidor.
    if (model?.photo && model.photo !== photo) deleteMakerFile(model.photo);
    if (model?.file && model.file !== file) deleteMakerFile(model.file);
    createdFiles.current.filter((ref) => ref !== photo && ref !== file).forEach(deleteMakerFile);

    onChange((current) => ({
      ...current,
      models: model ? current.models.map((item) => (item.id === saved.id ? saved : item)) : [...current.models, saved]
    }));
    onSaved?.(saved.id);
    onClose();
  }

  return (
    <MakerModal
      footer={<><button className="mt-btn ghost" onClick={cancel} type="button">Cancelar</button><button className="mt-btn primary" disabled={Boolean(busy)} onClick={save} type="button">Salvar</button></>}
      onClose={cancel}
      title={model ? "Editar modelo" : "Novo modelo"}
      wide
    >
      <form className="mt-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label className="mt-field">Título *<input autoFocus onChange={(event) => setTitle(event.target.value)} value={title} /></label>

        <div className="mt-field">
          Foto
          <div className="maker-photo-box">
            <div className="maker-photo" style={photo ? { backgroundImage: `url("${makerFileUrl(photo)}")` } : undefined}>{!photo && <Box size={30} />}</div>
            <div className="maker-inline">
              <label className="mt-btn small"><FolderOpen size={14} /> Escolher imagem<input accept="image/*" hidden onChange={(event) => upload("photo", event.currentTarget)} type="file" /></label>
              <label className="mt-btn small"><Camera size={14} /> Tirar foto<input accept="image/*" capture="environment" hidden onChange={(event) => upload("photo", event.currentTarget)} type="file" /></label>
              {photo && <button className="mt-btn small ghost maker-danger" onClick={() => setPhoto(undefined)} type="button">Remover</button>}
            </div>
          </div>
        </div>

        <label className="mt-field">
          Quantidade por impressão
          <input inputMode="numeric" min="1" onChange={(event) => setPerPrint(event.target.value)} placeholder="1" step="1" type="number" value={perPrint} />
          <small className="mt-hint">Quantas unidades deste modelo saem de uma vez em cada impressão.</small>
        </label>

        <div className="maker-row">
          <label className="mt-field">Gramatura (g)<input inputMode="decimal" min="0" onChange={(event) => setGrams(event.target.value)} placeholder="0" step="any" type="number" value={grams} /></label>
          <label className="mt-field">Horas de impressão<input inputMode="decimal" min="0" onChange={(event) => setHours(event.target.value)} placeholder="Ex.: 2,5" step="any" type="number" value={hours} /></label>
        </div>

        <div className="mt-field">
          Arquivo 3D (3MF, STL, OBJ, STEP, G-code…)
          <div className="maker-inline">
            <span className="maker-file-name">{file ? `${file.name} · ${formatBytes(file.size)}` : "Nenhum arquivo anexado"}</span>
            <label className="mt-btn small"><Paperclip size={14} /> Anexar<input hidden onChange={(event) => upload("file", event.currentTarget)} type="file" /></label>
            {file && <a className="mt-btn small" download={file.name} href={makerFileUrl(file, true)}><Download size={14} /> Baixar</a>}
            {file && <button className="mt-btn small ghost maker-danger" onClick={() => setFile(undefined)} type="button">Remover</button>}
          </div>
        </div>
        {busy && <p className="mt-hint">{busy}</p>}

        <div className="mt-field">
          Materiais utilizados
          {data.materials.length === 0 ? (
            <p className="mt-hint">Nenhum material cadastrado. Cadastre em Maker › Material.</p>
          ) : (
            <div className="maker-inline">
              <select className="maker-grow" onChange={(event) => setSelectedMaterial(event.target.value)} value={selectedMaterial}>
                <option value="">Selecione um material…</option>
                {data.materials.map((material) => (
                  <option key={material.id} value={material.id}>{material.title} — {brl(material.price)}/{unitShort[material.unit]}</option>
                ))}
              </select>
              <button className="mt-btn small" onClick={addMaterial} type="button"><Plus size={14} /> Adicionar</button>
            </div>
          )}
          <div className="maker-lines">
            {lines.length === 0 && <p className="mt-hint">Nenhum material adicionado.</p>}
            {lines.map(({ item, material, quantity, cost }, index) => (
              <div className="maker-line" key={item.materialId}>
                <div className="maker-line-info">
                  <strong>{material?.title ?? "Material excluído"}</strong>
                  {material && <small>{brl(material.price)} / {unitShort[material.unit]}{material.unit === "h" ? " · usa as horas" : ""}</small>}
                </div>
                <div className="maker-line-qty">
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setItems((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantity: event.target.value } : entry)))}
                    placeholder="0"
                    readOnly={material?.unit === "h"}
                    step="any"
                    type="number"
                    value={material?.unit === "h" ? String(quantity) : item.quantity}
                  />
                  <span>{material ? unitShort[material.unit] : ""}</span>
                </div>
                <strong className="maker-line-cost">{brl(cost)}</strong>
                <button aria-label="Remover material" className="mt-icon-button" onClick={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))} type="button"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="maker-total"><span>Custo total</span><strong>{brl(total)}</strong></div>
        </div>
        {error && <p className="mt-error" role="alert">{error}</p>}
        <button hidden type="submit" />
      </form>
    </MakerModal>
  );
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                            */
/* ------------------------------------------------------------------ */

type OrderTab = "line" | MakerOrderStatus;

function dueBadge(dueDate: string) {
  const days = daysUntil(dueDate);
  if (days < 0) return { text: `Atrasado ${-days} dia${days < -1 ? "s" : ""}`, tone: "late" };
  if (days === 0) return { text: "Entrega hoje", tone: "today" };
  if (days === 1) return { text: "Amanhã", tone: "" };
  return { text: `Em ${days} dias`, tone: "" };
}

const statusOf = (status: MakerOrderStatus) => orderStatuses.find((item) => item.id === status) ?? orderStatuses[0];

type OrderCard = {
  key: string;
  order: MakerOrder;
  /** Etapa do pedaço exibido (na Esteira, a etapa mais atrasada do pedido). */
  status: MakerOrderStatus;
  items: MakerOrderItem[];
  split: boolean;
  line: boolean;
};

function OrdersSection({ data, onChange }: { data: MakerData; onChange: Update }) {
  const [tab, setTab] = useState<OrderTab>("line");
  const [view, setView] = useState<"tabs" | "board">(() => {
    try {
      return window.localStorage.getItem("maker-orders-view") === "board" ? "board" : "tabs";
    } catch {
      return "tabs";
    }
  });
  const [drag, setDrag] = useState<{ orderId: string; from: MakerOrderStatus } | null>(null);
  const [dragOver, setDragOver] = useState<MakerOrderStatus | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
  const [editing, setEditing] = useState<MakerOrder | "new" | null>(null);
  const isEmpty = !data.clients.length && !data.materials.length && !data.models.length && !data.orders.length;
  const clientName = (id: string) => data.clients.find((client) => client.id === id)?.name ?? "Cliente excluído";
  const today = localIso();

  function changeView(next: "tabs" | "board") {
    setView(next);
    try {
      window.localStorage.setItem("maker-orders-view", next);
    } catch {
      // sem persistência: segue funcionando na sessão
    }
  }

  const open = data.orders.filter((order) => order.status !== "delivered").sort(productionOrder);
  const delivered = data.orders.filter((order) => order.status === "delivered");

  /** Um card por pedaço do pedido em cada etapa: o mesmo pedido pode aparecer em etapas diferentes. */
  const partCards = (status: MakerOrderStatus): OrderCard[] =>
    data.orders
      .flatMap((order) => {
        const parts = orderParts(order);
        return parts.filter((part: OrderPart) => part.status === status).map((part: OrderPart) => ({ key: `${order.id}:${status}`, order, status, items: part.items, split: parts.length > 1, line: false }));
      })
      .sort((a, b) => (status === "delivered" ? productionOrder(b.order, a.order) : productionOrder(a.order, b.order)));

  const lineCards: OrderCard[] = open.map((order) => {
    const parts = orderParts(order);
    return { key: order.id, order, status: order.status, items: parts.filter((part: OrderPart) => part.status !== "delivered").flatMap((part: OrderPart) => part.items), split: parts.length > 1, line: true };
  });
  const cardsFor = (id: OrderTab) => (id === "line" ? lineCards : partCards(id));
  const list = cardsFor(tab);

  function updateOrder(orderId: string, change: (order: MakerOrder) => MakerOrder) {
    onChange((current) => ({ ...current, orders: current.orders.map((order) => (order.id === orderId ? change(order) : order)) }));
  }

  function move(card: Pick<OrderCard, "order" | "status">, to: MakerOrderStatus) {
    updateOrder(card.order.id, (order) => movePart(order, card.status, to));
  }

  function remove(order: MakerOrder) {
    if (window.confirm(`Excluir o pedido de ${clientName(order.clientId)}?`)) {
      onChange((current) => ({ ...current, orders: current.orders.filter((item) => item.id !== order.id) }));
    }
  }

  // ----- Resumo de hoje -----
  const late = open.filter((order) => order.dueDate < today).length;
  const dueToday = open.filter((order) => order.dueDate === today).length;

  // ----- Impressões: modelos na fila, agrupados em levas -----
  const jobs = printJobs(data.orders, data.models, () => "Modelo excluído");
  const totalBatches = jobs.reduce((sum, job) => sum + job.batches.length, 0);
  const totalPrintHours = jobs.reduce((sum, job) => sum + job.hours, 0);

  function sendBatch(modelId: string, batch: { lines: Array<{ orderId: string; quantity: number }> }) {
    onChange((current) => ({
      ...current,
      orders: current.orders.map((order) => {
        const lines = batch.lines.filter((line) => line.orderId === order.id);
        return lines.reduce((result, line) => moveUnits(result, modelId, "queue", "printing", line.quantity), order);
      })
    }));
  }

  const tabs: Array<{ id: OrderTab; label: string; count: number }> = [
    { id: "line", label: "Esteira", count: open.length },
    ...orderStatuses.map((status) => ({ id: status.id as OrderTab, label: status.label, count: partCards(status.id).length }))
  ];

  function renderItems(card: OrderCard) {
    return (
      <ul className="maker-card-items">
        {card.items.map((item, index) => {
          const itemState = itemStatus(card.order, item);
          return (
            <li key={`${item.modelId}:${itemState}:${index}`}>
              <span>{item.quantity}× {orderItemTitle(item, data.models)}</span>
              {card.line && card.split && <span className="maker-chip" style={{ color: statusOf(itemState).color, borderColor: statusOf(itemState).color }}>{statusOf(itemState).label}</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  function renderActions(card: OrderCard, className: string) {
    const statusIndex = stageIndex(card.status);
    const next = orderStatuses[statusIndex + 1];
    const previous = orderStatuses[statusIndex - 1];

    return (
      <div className={className} onClick={(event) => event.stopPropagation()}>
        {previous && <button aria-label={`Voltar para ${previous.label}`} className="maker-icon-btn" onClick={() => move(card, previous.id)} title={`Voltar para ${previous.label}`} type="button"><ChevronLeft size={14} /></button>}
        {next && <button aria-label={`Avançar para ${next.label}`} className="maker-icon-btn" onClick={() => move(card, next.id)} title={`Avançar para ${next.label}`} type="button"><ChevronRight size={14} /></button>}
        <button aria-label="Excluir pedido" className="maker-icon-btn danger" onClick={() => remove(card.order)} title="Excluir pedido" type="button"><Trash2 size={13} /></button>
      </div>
    );
  }

  return (
    <>
      <section className="mt-panel maker-today">
        <h2 className="maker-title">Resumo de hoje</h2>
        <div className="maker-stats">
          <Stat label="Pedidos em aberto" value={open.length} />
          <Stat alert={dueToday > 0} label="Entregas hoje" value={dueToday} />
          <Stat alert={late > 0} label="Atrasados" value={late} />
        </div>
      </section>

      <section className="mt-panel">
        <div className="mt-head">
          <div>
            <h2 className="maker-title">Pedidos</h2>
            <p className="mt-muted">{open.length} em aberto · {delivered.length} entregue(s)</p>
          </div>
          <div className="maker-head-actions">
            {isEmpty && <button className="mt-btn" onClick={() => onChange(makerSampleData())} type="button">Carregar dados de teste</button>}
            <div className="mt-segment maker-view-toggle" role="group" aria-label="Modo de visualização">
              <button aria-label="Abas (lista)" className={view === "tabs" ? "active" : ""} onClick={() => changeView("tabs")} title="Abas (lista)" type="button"><List size={17} /></button>
              <button aria-label="Por abas (quadro)" className={view === "board" ? "active" : ""} onClick={() => changeView("board")} title="Por abas (quadro)" type="button"><Columns3 size={17} /></button>
            </div>
            <button className="mt-btn primary" onClick={() => setEditing("new")} type="button"><Plus size={16} /> Novo pedido</button>
          </div>
        </div>

        {view === "board" ? (
          <div className="maker-board" aria-label="Pedidos por etapa">
            {orderStatuses.map((status) => {
              const cards = partCards(status.id);

              return (
                <section
                  className={`maker-column ${dragOver === status.id ? "over" : ""}`}
                  key={status.id}
                  onDragLeave={() => setDragOver((current) => (current === status.id ? null : current))}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(status.id); }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = drag && data.orders.find((order) => order.id === drag.orderId);
                    if (dropped && drag && drag.from !== status.id) updateOrder(dropped.id, (order) => movePart(order, drag.from, status.id));
                    setDrag(null);
                    setDragOver(null);
                  }}
                >
                  <header className="maker-column-head" style={{ borderTopColor: status.color }}>
                    <strong>{status.label}</strong>
                    <span className="mt-count">{cards.length}</span>
                  </header>
                  <div className="maker-column-body">
                    {cards.length === 0 && <p className="maker-column-empty">Arraste um pedido para cá</p>}
                    {cards.map((card) => {
                      const value = orderTotals({ items: card.items }, data);
                      const badge = status.id !== "delivered" ? dueBadge(card.order.dueDate) : null;

                      return (
                        <article
                          className={`maker-card ${badge?.tone === "late" ? "late" : ""} ${drag?.orderId === card.order.id && drag.from === status.id ? "dragging" : ""}`}
                          draggable
                          key={card.key}
                          onClick={() => setEditing(card.order)}
                          onDragEnd={() => { setDrag(null); setDragOver(null); }}
                          onDragStart={(event) => { setDrag({ orderId: card.order.id, from: status.id }); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.order.id); }}
                          style={{ borderLeftColor: status.color }}
                        >
                          {renderActions(card, "maker-card-corner")}
                          <strong className="maker-card-title">{clientName(card.order.clientId)}</strong>
                          {card.split && <small className="mt-muted">Pedido dividido em etapas</small>}
                          {renderItems(card)}
                          <div className="maker-card-meta">
                            <span>{formatDay(card.order.dueDate, false)}</span>
                            {badge && <span className={`maker-chip due ${badge.tone}`}>{badge.text}</span>}
                          </div>
                          <small className="mt-muted">{value.pieces} peça(s) · {num(value.hours)} h · {brl(value.cost)}</small>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <>
            <div className="mt-segment maker-tabs" role="tablist">
              {tabs.map((item) => (
                <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)} role="tab" type="button">
                  {item.label} <span className="mt-count">{item.count}</span>
                </button>
              ))}
            </div>
            {list.length === 0 ? (
              <Empty>{tab === "line" ? "Nenhum pedido em produção. Crie um novo pedido." : "Nenhum pedido nesta etapa."}</Empty>
            ) : (
              <div className="maker-orders">
                {list.map((card, index) => {
                  const status = statusOf(card.status);
                  const value = orderTotals({ items: card.items }, data);
                  const badge = card.status !== "delivered" ? dueBadge(card.order.dueDate) : null;

                  return (
                    <article className={`maker-order ${badge?.tone === "late" ? "late" : ""}`} key={card.key} style={{ borderLeftColor: status.color }}>
                      <span className="maker-order-pos">{tab === "delivered" ? "✓" : index + 1}</span>
                      <div className="maker-order-main">
                        <div className="maker-order-top">
                          <strong>{clientName(card.order.clientId)}</strong>
                          {!(card.line && card.split) && <span className="maker-chip" style={{ color: status.color, borderColor: status.color }}>{status.label}</span>}
                          {badge && <span className={`maker-chip due ${badge.tone}`}>{badge.text}</span>}
                        </div>
                        {renderItems(card)}
                        <small className="mt-muted">Entrega {formatDay(card.order.dueDate)} · {value.pieces} peça(s) · {num(value.hours)} h · {num(value.grams)} g · custo {brl(value.cost)}</small>
                        {card.order.notes && <small className="mt-muted">📝 {card.order.notes}</small>}
                      </div>
                      <div className="maker-order-actions">
                        <button className="mt-btn small ghost" onClick={() => setEditing(card.order)} type="button">Editar</button>
                        {renderActions(card, "maker-inline-actions")}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-panel maker-prints">
        <div className="mt-head">
          <div>
            <h2 className="maker-title">Impressões</h2>
            <p className="mt-muted">{jobs.length} modelo(s) · {totalBatches} leva(s) · {num(totalPrintHours)} h · pela entrega mais próxima</p>
          </div>
        </div>
        {jobs.length === 0 ? (
          <Empty>Nada na fila para imprimir.</Empty>
        ) : (
          <div className="maker-print-list">
            {jobs.map((job) => {
              const isOpen = expandedJobs.includes(job.modelId);
              const badge = dueBadge(job.nextDue);

              return (
                <div className="maker-print" key={job.modelId}>
                  <div className="maker-print-head">
                    <button
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Recolher" : "Expandir"} ${job.title}`}
                      className="maker-icon-btn"
                      onClick={() => setExpandedJobs((current) => (current.includes(job.modelId) ? current.filter((id) => id !== job.modelId) : [...current, job.modelId]))}
                      type="button"
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="maker-print-info">
                      <strong>{job.title}</strong>
                      <small className="mt-muted">
                        {job.pending} un · {job.perPrint} por impressão · {job.batches.length} leva(s) · {num(job.hours)} h · entrega {formatDay(job.nextDue, false)}
                      </small>
                    </div>
                    <span className={`maker-chip due ${badge.tone}`}>{badge.text}</span>
                    <button
                      aria-label={`Enviar a próxima leva de ${job.title} para impressão`}
                      className="maker-icon-btn primary"
                      onClick={() => sendBatch(job.modelId, job.batches[0])}
                      title="Próxima leva foi para a impressão"
                      type="button"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="maker-batches">
                      {job.batches.map((batch, index) => (
                        <div className="maker-batch" key={index}>
                          <div className="maker-batch-info">
                            <strong>Leva {index + 1}</strong>
                            <small className="mt-muted">{batch.units} un · {num(job.model?.hours)} h</small>
                            <ul>
                              {batch.lines.map((line) => {
                                const order = data.orders.find((item) => item.id === line.orderId);
                                return (
                                  <li key={line.orderId}>
                                    {order ? clientName(order.clientId) : "Cliente excluído"} — {line.quantity}×
                                    {order && <small className="mt-muted"> · entrega {formatDay(order.dueDate, false)}</small>}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <button
                            aria-label={`Leva ${index + 1} de ${job.title} foi para a impressão`}
                            className="maker-icon-btn primary"
                            onClick={() => sendBatch(job.modelId, batch)}
                            title="Esta leva foi para a impressão"
                            type="button"
                          >
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && <OrderModal data={data} onChange={onChange} onClose={() => setEditing(null)} order={editing === "new" ? undefined : editing} />}
    </>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div className={`maker-stat ${alert ? "alert" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OrderModal({ data, order, onChange, onClose }: { data: MakerData; order?: MakerOrder; onChange: Update; onClose: () => void }) {
  const [clientId, setClientId] = useState(order?.clientId ?? "");
  const [dueDate, setDueDate] = useState(order?.dueDate ?? "");
  // Todo pedido novo entra na esteira (Na fila); a etapa muda pela esteira ou pelo quadro.
  const status: MakerOrderStatus = order?.status ?? "queue";
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [items, setItems] = useState<Array<MakerOrderItem & { quantityText: string }>>(() => order?.items.map((item) => ({ ...item, quantityText: String(item.quantity) })) ?? []);
  const [selectedModel, setSelectedModel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [recalculate, setRecalculate] = useState(false);
  const [nested, setNested] = useState<"client" | "model" | null>(null);
  const [error, setError] = useState("");
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name));
  const models = [...data.models].sort((a, b) => a.title.localeCompare(b.title));
  const parsedItems = items.map((item) => ({ ...item, quantity: Math.max(1, parseInt(item.quantityText, 10) || 0) }));
  const totals = orderTotals({ items: parsedItems }, data, recalculate);

  function addItem(modelId: string, amount: number) {
    setItems((current) => {
      // Pedido dividido em etapas: o item novo entra na etapa do pedido; senão acompanha o pedido.
      const newStatus = order && current.some((item) => item.status) ? order.status : undefined;
      const existing = current.find((item) => item.modelId === modelId && item.status === newStatus);
      if (existing) {
        return current.map((item) => (item === existing ? { ...item, quantityText: String((parseInt(item.quantityText, 10) || 0) + amount) } : item));
      }
      return [...current, { modelId, quantity: amount, quantityText: String(amount), status: newStatus }];
    });
    setError("");
  }

  function save() {
    if (!clientId) return setError("Selecione o cliente.");
    if (!dueDate) return setError("Informe a data de entrega.");
    if (items.length === 0) return setError("Adicione pelo menos um modelo.");

    const saved: MakerOrder = {
      id: order?.id ?? newMakerId("order"),
      createdAt: order?.createdAt ?? new Date().toISOString(),
      clientId,
      dueDate,
      status,
      notes: notes.trim() || undefined,
      deliveredAt: status === "delivered" ? order?.deliveredAt ?? new Date().toISOString() : null,
      // Custo congelado: itens que já tinham custo guardado o mantêm, a não ser que peça para recalcular.
      items: parsedItems.map((item) => ({ modelId: item.modelId, quantity: item.quantity, status: item.status, snap: orderItemInfo(item, data, recalculate) }))
    };
    const normalized = normalizeOrder(saved);
    onChange((current) => ({
      ...current,
      orders: order ? current.orders.map((item) => (item.id === saved.id ? normalized : item)) : [...current.orders, normalized]
    }));
    onClose();
  }

  return (
    <>
      <MakerModal
        footer={<><button className="mt-btn ghost" onClick={onClose} type="button">Cancelar</button><button className="mt-btn primary" onClick={save} type="button">Salvar</button></>}
        onClose={onClose}
        title={order ? "Editar pedido" : "Novo pedido"}
        wide
      >
        <form className="mt-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="mt-field">
            Cliente *
            <div className="maker-inline">
              <select className="maker-grow" onChange={(event) => { setClientId(event.target.value); setError(""); }} value={clientId}>
                <option value="">Selecione o cliente…</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <button aria-label="Novo cliente" className="mt-btn small maker-plus" onClick={() => setNested("client")} title="Novo cliente" type="button"><Plus size={16} /></button>
            </div>
          </div>
          <label className="mt-field">Data de entrega *<input onChange={(event) => { setDueDate(event.target.value); setError(""); }} type="date" value={dueDate} /></label>

          <div className="mt-field">
            Modelos *
            <div className="maker-inline">
              <select className="maker-grow" onChange={(event) => setSelectedModel(event.target.value)} value={selectedModel}>
                <option value="">{models.length ? "Selecione o modelo…" : "Nenhum modelo cadastrado"}</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.title} — {brl(modelCost(model, data.materials))}</option>)}
              </select>
              <input aria-label="Quantidade" className="maker-qty" inputMode="numeric" min="1" onChange={(event) => setQuantity(event.target.value)} step="1" type="number" value={quantity} />
              <button aria-label="Cadastrar novo modelo" className="mt-btn small maker-plus" onClick={() => setNested("model")} title="Cadastrar novo modelo" type="button"><Plus size={16} /></button>
              <button
                className="mt-btn small"
                onClick={() => {
                  if (!selectedModel) return setError("Selecione um modelo.");
                  addItem(selectedModel, Math.max(1, parseInt(quantity, 10) || 1));
                  setSelectedModel("");
                  setQuantity("1");
                }}
                type="button"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="maker-lines">
              {items.length === 0 && <p className="mt-hint">Nenhum modelo adicionado.</p>}
              {parsedItems.map((item, index) => {
                const info = orderItemInfo(item, data, recalculate);
                return (
                  <div className="maker-line" key={`${item.modelId}:${item.status ?? ""}:${index}`}>
                    <div className="maker-line-info">
                      <strong>{info?.title ?? "Modelo excluído"}{item.status && <span className="maker-chip" style={{ marginLeft: 8, color: statusOf(item.status).color, borderColor: statusOf(item.status).color }}>{statusOf(item.status).label}</span>}</strong>
                      {info && <small>{brl(info.cost)} / un · {num(info.hours)} h · {num(info.grams)} g</small>}
                    </div>
                    <div className="maker-line-qty">
                      <input
                        inputMode="numeric"
                        min="1"
                        onChange={(event) => setItems((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantityText: event.target.value } : entry)))}
                        step="1"
                        type="number"
                        value={items[index].quantityText}
                      />
                      <span>un</span>
                    </div>
                    <strong className="maker-line-cost">{brl((info?.cost ?? 0) * item.quantity)}</strong>
                    <button aria-label="Remover modelo" className="mt-icon-button" onClick={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))} type="button"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
            <div className="maker-total"><span>{totals.pieces} peça(s) · {num(totals.hours)} h · {num(totals.grams)} g</span><strong>{brl(totals.cost)}</strong></div>
          </div>

          {order && (
            <label className="maker-check">
              <input checked={recalculate} onChange={(event) => setRecalculate(event.target.checked)} type="checkbox" />
              Recalcular custos com os preços atuais dos materiais e modelos
            </label>
          )}
          {order && <p className="mt-hint">O custo deste pedido ficou guardado com os preços do dia em que ele foi criado.</p>}

          <label className="mt-field">Observações<textarea onChange={(event) => setNotes(event.target.value)} placeholder="Cor, acabamento, detalhes do pedido…" rows={3} value={notes} /></label>
          {error && <p className="mt-error" role="alert">{error}</p>}
          <button hidden type="submit" />
        </form>
      </MakerModal>

      {/* Cadastros feitos aqui também ficam em Clientes e Modelos. */}
      {nested === "client" && <ClientModal onChange={onChange} onClose={() => setNested(null)} onSaved={(id) => { setClientId(id); setError(""); }} />}
      {nested === "model" && (
        <ModelModal data={data} onChange={onChange} onClose={() => setNested(null)} onSaved={(id) => addItem(id, Math.max(1, parseInt(quantity, 10) || 1))} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Relatórios                                                         */
/* ------------------------------------------------------------------ */

type Period = "today" | "7d" | "30d" | "month" | "lastMonth" | "year" | "all" | "custom";

const periods: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "lastMonth", label: "Mês passado" },
  { id: "year", label: "Este ano" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Personalizado" }
];

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function periodRange(period: Period, custom: { from: string; to: string }): [string, string] {
  const today = localIso();
  const now = new Date(`${today}T12:00:00`);
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case "today": return [today, today];
    case "7d": return [addDays(today, -6), today];
    case "30d": return [addDays(today, -29), today];
    case "month": return [localIso(new Date(year, month, 1)), localIso(new Date(year, month + 1, 0))];
    case "lastMonth": return [localIso(new Date(year, month - 1, 1)), localIso(new Date(year, month, 0))];
    case "year": return [`${year}-01-01`, `${year}-12-31`];
    case "all": return ["0000-01-01", "9999-12-31"];
    default: return [custom.from || today, custom.to || today];
  }
}

function ReportsSection({ data }: { data: MakerData }) {
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState(() => ({ from: addDays(localIso(), -29), to: localIso() }));
  const [from, to] = periodRange(period, custom);
  const inRange = (iso?: string | null) => Boolean(iso) && iso! >= from && iso! <= to;
  const today = localIso();

  const report = useMemo(() => {
    const received = data.orders.filter((order) => inRange(isoOf(order.createdAt)));
    const delivered = data.orders.filter((order) => order.status === "delivered" && order.deliveredAt && inRange(isoOf(order.deliveredAt)));
    const dueInPeriod = data.orders.filter((order) => inRange(order.dueDate));
    const late = dueInPeriod.filter((order) => (order.status === "delivered" ? Boolean(order.deliveredAt) && isoOf(order.deliveredAt!) > order.dueDate : order.dueDate < today));
    const onTime = delivered.filter((order) => isoOf(order.deliveredAt!) <= order.dueDate).length;
    const newClients = data.clients.filter((client) => inRange(isoOf(client.createdAt)));

    const firstOrder = received.reduce((min, order) => (order.createdAt < min ? order.createdAt : min), new Date().toISOString());
    const spanDays = period === "all" ? (Date.now() - new Date(firstOrder).getTime()) / 86400000 : (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000;
    const byMonth = spanDays > 62;
    const keyOf = (iso: string) => (byMonth ? iso.slice(0, 7) : iso);

    const totals = { cost: 0, pieces: 0, hours: 0, grams: 0 };
    const byDate = new Map<string, { orders: number; pieces: number; hours: number; grams: number; cost: number }>();
    const byMaterial = new Map<string, { title: string; unit: string; quantity: number; cost: number }>();
    const byModel = new Map<string, { title: string; pieces: number; orders: number; cost: number }>();
    const byClient = new Map<string, { orders: number; pieces: number; cost: number }>();

    received.forEach((order) => {
      const value = orderTotals(order, data);
      totals.cost += value.cost;
      totals.pieces += value.pieces;
      totals.hours += value.hours;
      totals.grams += value.grams;

      const key = keyOf(isoOf(order.createdAt));
      const dateRow = byDate.get(key) ?? { orders: 0, pieces: 0, hours: 0, grams: 0, cost: 0 };
      dateRow.orders += 1;
      dateRow.pieces += value.pieces;
      dateRow.hours += value.hours;
      dateRow.grams += value.grams;
      dateRow.cost += value.cost;
      byDate.set(key, dateRow);

      const clientRow = byClient.get(order.clientId) ?? { orders: 0, pieces: 0, cost: 0 };
      clientRow.orders += 1;
      clientRow.pieces += value.pieces;
      clientRow.cost += value.cost;
      byClient.set(order.clientId, clientRow);

      order.items.forEach((item) => {
        const info = orderItemInfo(item, data);
        const quantity = Number(item.quantity) || 0;
        const modelRow = byModel.get(item.modelId) ?? { title: orderItemTitle(item, data.models), pieces: 0, orders: 0, cost: 0 };
        modelRow.pieces += quantity;
        modelRow.orders += 1;
        modelRow.cost += (info?.cost ?? 0) * quantity;
        byModel.set(item.modelId, modelRow);

        info?.materials.forEach((line) => {
          const materialRow = byMaterial.get(line.materialId) ?? {
            title: data.materials.find((material) => material.id === line.materialId)?.title ?? line.title,
            unit: unitShort[line.unit] ?? "",
            quantity: 0,
            cost: 0
          };
          materialRow.quantity += line.quantity * quantity;
          materialRow.cost += line.cost * quantity;
          byMaterial.set(line.materialId, materialRow);
        });
      });
    });

    return {
      received,
      delivered,
      late,
      onTime,
      newClients,
      byMonth,
      totals,
      dates: [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      materials: [...byMaterial.values()].sort((a, b) => b.cost - a.cost),
      models: [...byModel.values()].sort((a, b) => b.pieces - a.pieces),
      clients: [...byClient.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 10)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, from, to, period, today]);

  const maxDateCost = Math.max(1, ...report.dates.map(([, row]) => row.cost));
  const maxMaterialCost = Math.max(1, ...report.materials.map((row) => row.cost));
  const label = (key: string) =>
    report.byMonth
      ? new Date(`${key}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
      : new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const bar = (value: number, max: number) => <span className="maker-bar"><i style={{ width: `${Math.max(2, (value / max) * 100)}%` }} /></span>;

  return (
    <>
      <section className="mt-panel">
        <div className="mt-head">
          <div>
            <h2 className="maker-title">Relatórios</h2>
            <p className="mt-muted">{period === "all" ? "Todo o período" : `${formatDay(from)} até ${formatDay(to)}`}</p>
          </div>
        </div>
        <div className="mt-segment maker-tabs" role="tablist">
          {periods.map((item) => (
            <button className={period === item.id ? "active" : ""} key={item.id} onClick={() => { if (item.id === "custom" && period !== "custom") setCustom({ from, to }); setPeriod(item.id); }} role="tab" type="button">
              {item.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="maker-inline">
            <label className="mt-field inline">De<input max={custom.to} onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))} type="date" value={custom.from} /></label>
            <label className="mt-field inline">Até<input min={custom.from} onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))} type="date" value={custom.to} /></label>
          </div>
        )}
        <div className="maker-stats">
          <Stat label="Custo de produção" value={brl(report.totals.cost)} />
          <Stat label="Pedidos recebidos" value={report.received.length} />
          <Stat label="Pedidos entregues" value={report.delivered.length} />
          <Stat alert={report.late.length > 0} label="Atrasados" value={report.late.length} />
          <Stat label="Entregues no prazo" value={report.delivered.length ? `${Math.round((report.onTime / report.delivered.length) * 100)}%` : "—"} />
          <Stat label="Clientes novos" value={report.newClients.length} />
          <Stat label="Peças" value={report.totals.pieces} />
          <Stat label="Custo médio por pedido" value={brl(report.received.length ? report.totals.cost / report.received.length : 0)} />
          <Stat label="Horas de impressão" value={`${num(report.totals.hours)} h`} />
          <Stat label="Filamento" value={report.totals.grams >= 1000 ? `${num(report.totals.grams / 1000)} kg` : `${num(report.totals.grams)} g`} />
        </div>
      </section>

      <section className="mt-panel maker-summary">
        <h3 className="maker-subtitle">Custos por {report.byMonth ? "mês" : "dia"}</h3>
        {report.dates.length === 0 ? <Empty>Nenhum pedido recebido neste período.</Empty> : (
          <div className="maker-table-wrap">
            <table className="maker-table">
              <thead><tr><th>{report.byMonth ? "Mês" : "Data"}</th><th className="num">Pedidos</th><th className="num">Peças</th><th className="num">Horas</th><th className="num">Filamento</th><th className="num">Custo</th><th className="bar-col" /></tr></thead>
              <tbody>
                {report.dates.map(([key, row]) => (
                  <tr key={key}>
                    <td>{label(key)}</td><td className="num">{row.orders}</td><td className="num">{row.pieces}</td><td className="num">{num(row.hours)} h</td><td className="num">{num(row.grams)} g</td>
                    <td className="num"><strong>{brl(row.cost)}</strong></td><td className="bar-col">{bar(row.cost, maxDateCost)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total</td><td className="num">{report.received.length}</td><td className="num">{report.totals.pieces}</td><td className="num">{num(report.totals.hours)} h</td><td className="num">{num(report.totals.grams)} g</td><td className="num">{brl(report.totals.cost)}</td><td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <h3 className="maker-subtitle">Custos por material</h3>
        {report.materials.length === 0 ? <Empty>Sem custos de material neste período.</Empty> : (
          <div className="maker-table-wrap">
            <table className="maker-table">
              <thead><tr><th>Material</th><th className="num">Quantidade</th><th className="num">Custo</th><th className="num">%</th><th className="bar-col" /></tr></thead>
              <tbody>
                {report.materials.map((row) => (
                  <tr key={row.title}>
                    <td>{row.title}</td><td className="num">{num(row.quantity)} {row.unit}</td><td className="num"><strong>{brl(row.cost)}</strong></td>
                    <td className="num">{report.totals.cost ? `${num(Number(((row.cost / report.totals.cost) * 100).toFixed(1)))}%` : "—"}</td>
                    <td className="bar-col">{bar(row.cost, maxMaterialCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="maker-subtitle">Modelos mais pedidos</h3>
        {report.models.length === 0 ? <Empty>Nenhum modelo pedido neste período.</Empty> : (
          <div className="maker-table-wrap">
            <table className="maker-table">
              <thead><tr><th>Modelo</th><th className="num">Peças</th><th className="num">Pedidos</th><th className="num">Custo</th></tr></thead>
              <tbody>
                {report.models.map((row) => (
                  <tr key={row.title}><td>{row.title}</td><td className="num"><strong>{row.pieces}</strong></td><td className="num">{row.orders}</td><td className="num">{brl(row.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="maker-subtitle">Clientes no período</h3>
        {report.clients.length === 0 ? <Empty>Nenhum cliente fez pedido neste período.</Empty> : (
          <div className="maker-table-wrap">
            <table className="maker-table">
              <thead><tr><th>Cliente</th><th className="num">Pedidos</th><th className="num">Peças</th><th className="num">Custo</th><th>Cadastro</th></tr></thead>
              <tbody>
                {report.clients.map(([id, row]) => {
                  const client = data.clients.find((item) => item.id === id);
                  const isNew = client && inRange(isoOf(client.createdAt));
                  return (
                    <tr key={id}>
                      <td>{client?.name ?? "Cliente excluído"} {isNew && <span className="maker-chip due today">Novo</span>}</td>
                      <td className="num">{row.orders}</td><td className="num">{row.pieces}</td><td className="num">{brl(row.cost)}</td>
                      <td>{client ? formatDay(isoOf(client.createdAt), false) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-hint">Os pedidos entram no relatório pela data em que foram criados. Os custos são os do dia em que cada pedido foi criado.</p>
      </section>
    </>
  );
}
