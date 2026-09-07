import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Plus, Minus, Trash2, Send, UtensilsCrossed, Leaf, Search,
  Maximize2, Minimize2, Wallet, Printer, Receipt, XCircle, Ban,
  Scissors, Users, MoreHorizontal, PauseCircle, Tag, Gift,
  Armchair, BedDouble, Bike, ShoppingBag, Check, ClipboardList, X,
  ChevronLeft, Sparkles, BadgeCheck, LogOut,
} from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { useAuth } from "../lib/auth"
import { subscribeRealtime } from "../lib/realtime"
import { serverError } from "../lib/resource"
import { printThermal, kotHtml, billHtml, type BillData, type KotLine } from "../lib/thermal"
import { useFloorFullscreen } from "../lib/kiosk"
import { Button } from "../components/ui/button"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"
import { cur, moneyLocale, taxLabel } from "../lib/money"
import { useT } from "../lib/i18n"
import { cn } from "../lib/utils"

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })
const inr2 = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface MenuItem {
  name: string
  item_name: string
  category: string
  price: number
  is_veg: number
  image: string | null
  description?: string | null
}
interface Outlet { name: string; outlet_name: string; gst_rate: number }
interface OpenOrder {
  name: string
  label: string
  status: string
  order_total: number
  items: number
  pending: number
  kot_fired: number
  kot_no: number | null
  order_type: string | null
  table_no: string | null
  creation: string
  nc?: number
}
interface TableBill {
  order: string
  label: string
  order_total: number
  state: "running" | "fired" | "ready"
}
interface TableTile {
  table: string
  seats: number | null
  area: string | null
  temp?: boolean
  state: "vacant" | "running" | "fired" | "ready" | "reserved" | "cleaning"
  bills: number
  order_total?: number
  guests?: number | null
  since?: string
  reservation?: string
  res_guest?: string
  res_party?: number | null
  res_phone?: string | null
  res_time?: string
  orders: TableBill[]
}
interface RecentOrder {
  name: string
  label: string
  status: string
  order_type: string | null
  order_total: number
  paid: number
  payment_mode: string | null
  nc: number
  modified: string
  open: boolean
}
interface CartLine {
  menu_item: string
  item_name: string
  price: number
  is_veg: number
  qty: number
  instructions: string
}
interface OrderItem {
  row: string
  item_name: string
  qty: number
  amount: number
  instructions: string | null
  kot_status: string
  voided: number
}
interface KotTicket {
  kot_no: number | null
  at?: string
  round?: number
  nc?: boolean
  nc_by?: string | null
  label: string
  order_type?: string | null
  order: string
  customer?: string | null
  address?: string | null
  items: KotLine[]
}
interface Detail {
  name: string
  status: string
  table_no: string | null
  room: string | null
  order_type: string | null
  kot_no: number | null
  guests: number | null
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  nc: number
  nc_authorized_by: string | null
  nc_note: string | null
  kot_tickets: KotTicket[]
  paid: number
  payment_mode: string | null
  discount_amount: number
  subtotal: number
  order_total: number
  items: OrderItem[]
}

type OrderType = "Dine In" | "Room Service" | "Takeaway" | "Delivery"
const ORDER_TYPES: OrderType[] = ["Dine In", "Room Service", "Takeaway", "Delivery"]
const ORDER_TYPE_META = {
  "Dine In": { icon: Armchair, description: "Choose a table and guest count" },
  "Room Service": { icon: BedDouble, description: "Post the order to an in-house room" },
  Takeaway: { icon: ShoppingBag, description: "Counter pickup — no table required" },
  Delivery: { icon: Bike, description: "Customer, phone and address required" },
} satisfies Record<OrderType, { icon: typeof Armchair; description: string }>

// Table tile look (color + subtle fill) — the dual room-state discipline reads
// state via color AND the little status word, never color alone.
const TILE: Record<TableTile["state"], string> = {
  vacant: "border-zinc-200 bg-white text-zinc-700 hover:border-brand-400 hover:text-brand-700",
  running: "border-gold-300 bg-gold-50 text-gold-800 hover:border-gold-400",
  fired: "border-brand-800 bg-brand-800 text-white hover:bg-brand-900",
  ready: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400",
  reserved: "border-violet-300 bg-violet-50 text-violet-900 hover:border-violet-400",
  cleaning: "border-zinc-300 bg-zinc-100 text-zinc-500 hover:border-brand-400",
}

const inputCls =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm h-11 " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

/** "23m" / "2h 5m" since a server timestamp. */
function ago(ts?: string) {
  if (!ts) return ""
  const mins = Math.max(0, Math.round((Date.now() - new Date(ts.replace(" ", "T")).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  if (mins < 600) return `${Math.floor(mins / 60)}h ${mins % 60}m`
  return `${Math.round(mins / 60)}h` // keep long-running tags compact
}

export default function POS() {
  const { t } = useT()
  const { signOut } = useAuth()
  const rootRef = useRef<HTMLDivElement>(null)
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletsLoaded, setOutletsLoaded] = useState(false)
  const [outlet, setOutlet] = useState("")
  const [rooms, setRooms] = useState<{ name: string; room_number: string; guest_name: string | null }[]>([])
  const [roomQuery, setRoomQuery] = useState("")
  const [cats, setCats] = useState<{ category: string; items: MenuItem[] }[]>([])
  const [cat, setCat] = useState("All")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<OpenOrder[]>([])
  const [tables, setTables] = useState<TableTile[]>([])
  const [recent, setRecent] = useState<RecentOrder[]>([])
  const [tableQuery, setTableQuery] = useState("")
  const [tableFilter, setTableFilter] = useState<"all" | "available" | "occupied">("all")
  const [areaFilter, setAreaFilter] = useState("All")
  const [resTile, setResTile] = useState<string | null>(null) // reserved table with panel open
  const [reserveOpen, setReserveOpen] = useState(false)
  const [resForm, setResForm] = useState({ table: "", guest: "", phone: "", party: "", at: "" })
  const [ncOpen, setNcOpen] = useState(false)
  const [ncBy, setNcBy] = useState("Captain")
  const [ncNote, setNcNote] = useState("")
  const [selected, setSelected] = useState<string | null>(null) // null = new bill
  const [detail, setDetail] = useState<Detail | null>(null)
  const [orderType, setOrderType] = useState<OrderType>("Dine In")
  const [room, setRoom] = useState("")
  const [table, setTable] = useState("")
  const [guests, setGuests] = useState("")
  const [custName, setCustName] = useState("")
  const [custPhone, setCustPhone] = useState("")
  const [custAddr, setCustAddr] = useState("")
  const [cart, setCart] = useState<CartLine[]>([]) // new lines (new bill OR next round)
  const [discount, setDiscount] = useState("")
  const [discOpen, setDiscOpen] = useState(false)
  const [printKot, setPrintKot] = useState(() => localStorage.getItem("pos_print_kot") !== "0")
  const [settling, setSettling] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [voiding, setVoiding] = useState<OrderItem | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [chooser, setChooser] = useState<string | null>(null) // table with several bills
  const [splitMode, setSplitMode] = useState(false)
  const [splitSel, setSplitSel] = useState<Set<string>>(new Set())
  const [customTable, setCustomTable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printNote, setPrintNote] = useState<string | null>(null)
  const [posTab, setPosTab] = useState<"context" | "menu" | "cart">("menu") // 390 pane switch
  const [historyOpen, setHistoryOpen] = useState(false)
  const { browserFs, toggleBrowserFs } = useFloorFullscreen(rootRef)

  // Fill exactly from the POS's own top to the viewport bottom, minus the
  // scroll container's bottom padding. Robust to the demo banner / header /
  // kiosk chrome toggling — the panes then scroll internally, never the page.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const fit = () => {
      const parent = el.parentElement
      const pb = parent ? parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 0
      const top = el.getBoundingClientRect().top
      el.style.height = `${Math.max(360, window.innerHeight - top - pb)}px`
    }
    const raf = requestAnimationFrame(fit)
    const t = setTimeout(fit, 120) // after chrome/kiosk settle
    window.addEventListener("resize", fit)
    window.addEventListener("hotelpms:kiosk", fit as EventListener)
    document.addEventListener("fullscreenchange", fit)
    return () => {
      cancelAnimationFrame(raf); clearTimeout(t)
      window.removeEventListener("resize", fit)
      window.removeEventListener("hotelpms:kiosk", fit as EventListener)
      document.removeEventListener("fullscreenchange", fit)
    }
  }, [])

  useEffect(() => {
    call<Outlet[]>("hotelpms.pos.outlets", { property: getCurrentProperty() })
      .then((o) => { setOutlets(o); if (o[0]) setOutlet(o[0].name) })
      .catch((e) => setError(serverError(e)))
      .finally(() => setOutletsLoaded(true))
    call<{ room: string; room_number: string; guest_name?: string | null }[]>("hotelpms.pos.in_house_rooms", { property: getCurrentProperty() })
      .then((d) => setRooms(d.map((r) => ({ name: r.room, room_number: r.room_number, guest_name: r.guest_name ?? null }))))
      .catch(() => {})
  }, [])

  useEffect(() => { localStorage.setItem("pos_print_kot", printKot ? "1" : "0") }, [printKot])

  const loadMenu = useCallback(() => {
    if (!outlet) return
    call<{ categories: { category: string; items: MenuItem[] }[] }>("hotelpms.pos.pos_menu", { outlet })
      .then((m) => { setCats(m.categories); setCat("All") })
      .catch((e) => setError(serverError(e)))
  }, [outlet])
  useEffect(loadMenu, [loadMenu])

  const loadOpen = useCallback(() => {
    if (!outlet) return
    call<OpenOrder[]>("hotelpms.pos.open_orders", { outlet }).then(setOpen).catch(() => {})
    call<{ tables: TableTile[] }>("hotelpms.pos.table_map", { outlet })
      .then((d) => setTables(d.tables)).catch(() => {})
    call<RecentOrder[]>("hotelpms.pos.recent_orders", { outlet }).then(setRecent).catch(() => {})
  }, [outlet])
  useEffect(() => {
    loadOpen()
    const unsub = subscribeRealtime(loadOpen) // live tables + bills across captains
    const t = setInterval(loadOpen, 20_000)
    return () => { unsub(); clearInterval(t) }
  }, [loadOpen])

  function resetPanel() {
    setCart([]); setDiscount(""); setDiscOpen(false); setSettling(false); setMoreOpen(false)
    setVoiding(null); setVoidReason(""); setCancelling(false); setCancelReason("")
    setSplitMode(false); setSplitSel(new Set()); setChooser(null)
    setNcOpen(false); setNcBy("Captain"); setNcNote("")
    setResTile(null); setReserveOpen(false)
  }
  function newOrder(atTable?: string) {
    setSelected(null); setDetail(null); setRoom(""); resetPanel()
    setTable(atTable || ""); setCustomTable(false)
    setGuests(""); setCustName(""); setCustPhone(""); setCustAddr("")
    if (atTable) setOrderType("Dine In")
  }
  function chooseOrderType(type: OrderType) {
    // An open bill is immutable with regard to its service channel. Switching
    // modes starts a clean bill; a draft cart keeps its items but sheds fields
    // that do not belong to the newly selected fulfilment path.
    if (selected) newOrder()
    setOrderType(type)
    if (type !== "Dine In") {
      setTable("")
      setGuests("")
      setCustomTable(false)
      setReserveOpen(false)
      setResTile(null)
      setChooser(null)
    }
    if (type !== "Room Service") setRoom("")
    if (type !== "Takeaway" && type !== "Delivery") {
      setCustName("")
      setCustPhone("")
    }
    if (type !== "Delivery") setCustAddr("")
  }
  async function openTab(name: string) {
    setSelected(name); resetPanel(); setPosTab("cart")
    const d = await call<Detail>("hotelpms.pos.order_detail", { order: name })
    setDetail(d)
  }
  async function reloadDetail() {
    if (!selected) return
    const d = await call<Detail>("hotelpms.pos.order_detail", { order: selected })
    setDetail(d)
  }
  /** Cycle open bills (F3); from "new bill" it enters at the first tab. */
  function traverse(dir: 1 | -1) {
    if (open.length === 0) return
    const idx = selected === null ? -1 : open.findIndex((o) => o.name === selected)
    const next = idx === -1
      ? (dir === 1 ? 0 : open.length - 1)
      : (idx + dir + open.length) % open.length
    openTab(open[next].name)
  }

  const addToCart = (it: MenuItem) => {
    setCart((c) => {
      const ex = c.find((l) => l.menu_item === it.name)
      if (ex) return c.map((l) => l.menu_item === it.name ? { ...l, qty: l.qty + 1 } : l)
      return [...c, { menu_item: it.name, item_name: it.item_name, price: it.price, is_veg: it.is_veg, qty: 1, instructions: "" }]
    })
  }
  const setQty = (mi: string, d: number) =>
    setCart((c) => c.flatMap((l) => l.menu_item === mi ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l]))
  const setInstr = (mi: string, v: string) =>
    setCart((c) => c.map((l) => l.menu_item === mi ? { ...l, instructions: v } : l))

  const newSubtotal = cart.reduce((s, l) => s + l.qty * l.price, 0)
  const disc = Math.min(Number(discount) || 0, selected ? Number.MAX_SAFE_INTEGER : newSubtotal)
  const newOrderContextReady =
    orderType === "Dine In" ? Boolean(table.trim())
      : orderType === "Room Service" ? Boolean(room)
        : orderType === "Delivery"
          ? Boolean(custName.trim() && custPhone.trim() && custAddr.trim())
          : true
  const contextHint =
    orderType === "Dine In" ? "Choose a table before sending the order"
      : orderType === "Room Service" ? "Choose an occupied room before sending the order"
        : orderType === "Delivery" ? "Add customer name, phone and delivery address"
          : "Ready for counter pickup"

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await fn(); loadOpen() }
    catch (e) { setError(serverError(e)) }
    finally { setBusy(false) }
  }

  const outletDoc = outlets.find((o) => o.name === outlet)
  const outletName = outletDoc?.outlet_name || outlet
  const gstRate = Number(outletDoc?.gst_rate ?? 5)
  const orderLabel = (d: { table_no?: string | null; room?: string | null; order_type?: string | null; customer_name?: string | null; name?: string }) =>
    d.table_no ? `${t("Table")} ${d.table_no}`
      : d.room ? `${t("Room")} ${d.room.split("-").pop()}`
        : d.order_type === "Takeaway" || d.order_type === "Delivery"
          ? `${t(d.order_type)}${d.customer_name ? ` · ${d.customer_name.split(" ")[0]}` : ""}`
          : (d.name || t("Bill"))
  // Compact, localized label for the header bill chips (backend labels lead
  // with an English service word — swap it so the AR view has no leak).
  const billChipLabel = (o: OpenOrder) =>
    o.table_no ? `${t("Table")} ${o.table_no}`
      : (o.label || "").replace(/^Room /, `${t("Room")} `).replace(/^Takeaway/, t("Takeaway")).replace(/^Delivery/, t("Delivery"))

  // what the bill panel is pricing right now
  const taxable = selected && detail ? Number(detail.order_total || 0) : newSubtotal - disc
  const gstAmt = taxable * gstRate / 100
  const grand = taxable + gstAmt

  function printSavedKot(t: KotTicket, reprint = false) {
    printThermal(`KOT #${t.kot_no}`, kotHtml({
      outlet: outletName, kot_no: t.kot_no, label: t.label,
      order_type: t.order_type, order: t.order, reprint,
      customer: t.customer, address: t.address,
      nc: !!t.nc, nc_by: t.nc_by, items: t.items,
    }))
  }

  function maybePrintKot(kot: {
    kot_no: number | null
    nc?: boolean
    ticket?: KotTicket
    fired_items: { item_name: string; qty: number; instructions?: string | null }[]
  }, label: string, type: string | null,
                         customer?: string | null, address?: string | null,
                         ncBy?: string | null) {
    const ticket = kot.ticket ?? {
      kot_no: kot.kot_no, label, order_type: type, order: "",
      customer, address, nc: !!kot.nc, nc_by: ncBy, items: kot.fired_items,
    }
    if (!ticket.items?.length) return
    setPrintNote(`KOT #${ticket.kot_no ?? "—"} saved${printKot ? " and sent to printer" : ". Turn on Print KOT to send it to the kitchen printer"}.`)
    if (!printKot) return
    printSavedKot(ticket)
  }

  function newBillArgs() {
    return {
      outlet, property: getCurrentProperty(),
      order_type: orderType,
      room: orderType === "Room Service" ? room || null : null,
      table_no: orderType === "Dine In" ? table || null : null,
      guests: orderType === "Dine In" ? guests || null : null,
      customer_name: orderType === "Takeaway" || orderType === "Delivery" ? custName || null : null,
      customer_phone: orderType === "Takeaway" || orderType === "Delivery" ? custPhone || null : null,
      delivery_address: orderType === "Delivery" ? custAddr || null : null,
      items: cart.map((l) => ({ menu_item: l.menu_item, qty: l.qty, instructions: l.instructions })),
    }
  }
  const newBillLabel = () =>
    orderType === "Dine In" && table ? `Table ${table}`
      : orderType === "Room Service" && room ? `Room ${room.split("-").pop()}`
        : `${orderType}${custName ? ` · ${custName.split(" ")[0]}` : ""}`

  /** Create the bill (optionally firing the KOT). Returns the order id. */
  async function createBill(fire: boolean) {
    const r = await call<{ order: string }>("hotelpms.pos.create_order", newBillArgs())
    if (disc > 0) await call("hotelpms.pos.apply_discount", { order: r.order, amount: disc, reason: "" })
    await call("hotelpms.pos.confirm_order", { order: r.order })
    if (fire) {
      const kot = await call<{ kot_no: number | null; fired_items: { item_name: string; qty: number; instructions?: string | null }[]; ticket?: KotTicket }>(
        "hotelpms.pos.fire_kot", { order: r.order })
      maybePrintKot(kot, newBillLabel(), orderType,
        custName || null, orderType === "Delivery" ? custAddr || null : null)
    }
    return r.order
  }

  async function kotAction() { // F6 - fire the kitchen ticket
    if (selected) {
      if (cart.length === 0) return
      await act(async () => {
        await call("hotelpms.pos.add_items", {
          order: selected,
          items: cart.map((l) => ({ menu_item: l.menu_item, qty: l.qty, instructions: l.instructions })),
        })
        const kot = await call<{ kot_no: number | null; nc?: boolean; ticket?: KotTicket; fired_items: { item_name: string; qty: number; instructions?: string | null }[] }>(
          "hotelpms.pos.fire_kot", { order: selected })
        if (detail) maybePrintKot(kot, orderLabel(detail), detail.order_type,
          detail.customer_name, detail.delivery_address, detail.nc_authorized_by)
        await reloadDetail(); setCart([])
      })
    } else {
      if (cart.length === 0 || !newOrderContextReady) return
      await act(async () => { await createBill(true); newOrder() })
    }
  }
  async function hold() { // F5 - park the bill without firing
    if (selected || cart.length === 0 || !newOrderContextReady) return
    await act(async () => { await createBill(false); newOrder() })
  }
  async function proceedToPay() { // F4
    if (selected && detail) {
      if (detail.room || detail.nc) await act(async () => { await call("hotelpms.pos.deliver_order", { order: selected }); newOrder() })
      else setSettling(true)
    } else if (cart.length > 0 && newOrderContextReady) {
      await act(async () => {
        const order = await createBill(true)
        await openTab(order)
        setSettling(true)
      })
    }
  }
  async function settle(mode: "Cash" | "Card" | "Mada" | "Digital Wallet") {
    if (!selected) return
    const order = selected
    await act(async () => {
      await call("hotelpms.pos.pay_order", { order, mode })
      const bill = await call<BillData>("hotelpms.pos.bill_data", { order })
      printThermal(`Bill ${order}`, billHtml(bill))
      newOrder()
    })
  }
  async function printBill() {
    if (!selected) return
    const bill = await call<BillData>("hotelpms.pos.bill_data", { order: selected })
    printThermal(`Bill ${selected}`, billHtml(bill))
  }
  function reprintKot() {
    if (!detail) return
    const last = (detail.kot_tickets || []).at(-1)
    if (last?.items?.length) {
      printSavedKot(last, true)
      setPrintNote(`Reprinting KOT #${last.kot_no}.`)
      return
    }
    const items = detail.items.filter((i) => !i.voided && i.kot_status !== "New")
    if (!items.length) return
    printThermal(`KOT #${detail.kot_no}`, kotHtml({
      outlet: outletName, kot_no: detail.kot_no, label: orderLabel(detail),
      order_type: detail.order_type, order: detail.name, reprint: true,
      customer: detail.customer_name, address: detail.delivery_address,
      nc: !!detail.nc, nc_by: detail.nc_authorized_by, items,
    }))
  }

  async function saveNc(undo = false) {
    if (!selected) return
    await act(async () => {
      await call("hotelpms.pos.mark_nc", {
        order: selected, authorized_by: ncBy, note: ncNote, undo: undo ? 1 : 0,
      })
      setNcOpen(false)
      await reloadDetail()
    })
  }
  async function applyDiscount() {
    if (!selected) { setDiscOpen(false); return } // new bill: applied at create
    await act(async () => {
      await call("hotelpms.pos.apply_discount", { order: selected, amount: Number(discount) || 0, reason: "" })
      setDiscOpen(false)
      await reloadDetail()
    })
  }
  async function confirmVoid() {
    if (!selected || !voiding || !voidReason.trim()) return
    await act(async () => {
      await call("hotelpms.pos.void_item", { order: selected, item_row: voiding.row, reason: voidReason })
      setVoiding(null); setVoidReason("")
      await reloadDetail()
    })
  }
  async function confirmCancel() {
    if (!selected || !cancelReason.trim()) return
    await act(async () => {
      await call("hotelpms.pos.cancel_order", { order: selected, reason: cancelReason })
      newOrder()
    })
  }
  function toggleSplitSel(row: string) {
    setSplitSel((s) => {
      const n = new Set(s)
      if (n.has(row)) n.delete(row); else n.add(row)
      return n
    })
  }
  async function confirmSplit() {
    if (!selected || splitSel.size === 0) return
    const order = selected
    await act(async () => {
      const r = await call<{ new_order: string }>("hotelpms.pos.split_order", {
        order, item_rows: [...splitSel],
      })
      await openTab(r.new_order) // land on the party's new bill
    })
  }
  async function saveReservation() {
    const f = resForm
    if (!f.table || !f.guest.trim() || !f.at) return
    await act(async () => {
      await call("hotelpms.pos.reserve_table", {
        outlet, table_no: f.table, guest_name: f.guest, phone: f.phone || null,
        party_size: f.party || null, reserved_at: f.at.replace("T", " "),
      })
      setReserveOpen(false)
      setResForm({ table: "", guest: "", phone: "", party: "", at: "" })
    })
  }
  async function seatReservation(t: TableTile) {
    if (!t.reservation) return
    await act(async () => {
      await call("hotelpms.pos.set_reservation", { reservation: t.reservation, status: "Seated" })
      newOrder(t.table)
      if (t.res_party) setGuests(String(t.res_party))
    })
  }
  async function closeReservation(t: TableTile, status: "Cancelled" | "No Show") {
    if (!t.reservation) return
    await act(async () => {
      await call("hotelpms.pos.set_reservation", { reservation: t.reservation, status })
      setResTile(null)
    })
  }
  async function cleanTable(t: TableTile) {
    await act(async () => {
      await call("hotelpms.pos.mark_table_clean", { outlet, table_no: t.table })
      newOrder(t.table)
    })
  }

  // F-key shortcuts (the bar at the bottom is the legend)
  const keysRef = useRef({ newOrder, traverse, proceedToPay, hold, kotAction })
  keysRef.current = { newOrder, traverse, proceedToPay, hold, kotAction }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keysRef.current
      if (e.key === "F2") { e.preventDefault(); k.newOrder() }
      else if (e.key === "F3") { e.preventDefault(); k.traverse(1) }
      else if (e.key === "F4") { e.preventDefault(); k.proceedToPay() }
      else if (e.key === "F5") { e.preventDefault(); k.hold() }
      else if (e.key === "F6") { e.preventDefault(); k.kotAction() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const allItems = cats.flatMap((c) => c.items)
  const shownItems = query.trim()
    ? allItems.filter((it) => it.item_name.toLowerCase().includes(query.toLowerCase()))
    : cat === "All" ? null : (cats.find((c) => c.category === cat)?.items || [])

  const areas = [...new Set(tables.map((t) => t.area).filter(Boolean))] as string[]
  const visibleTables = tables.filter((t) =>
    (tableFilter === "all" || (tableFilter === "available" ? t.state === "vacant" : t.state !== "vacant")) &&
    (areaFilter === "All" || (t.area || "Other") === areaFilter) &&
    (!tableQuery.trim() || t.table.toLowerCase().includes(tableQuery.toLowerCase())))
  const availableCount = tables.filter((t) => t.state === "vacant").length
  // group under area headings when a floor plan has areas and no area is picked
  const tableGroups: [string | null, TableTile[]][] =
    areas.length > 0 && areaFilter === "All"
      ? [...new Map(visibleTables.map((t) => [t.area || "Other", true])).keys()]
          .map((a) => [a, visibleTables.filter((t) => (t.area || "Other") === a)])
      : [[null, visibleTables]]

  const displayedOrderType = (selected && detail?.order_type
    ? detail.order_type
    : orderType) as OrderType
  const modeOpen = open.filter((o) => (o.order_type || "Dine In") === displayedOrderType)
  const kitchenBills = modeOpen.filter((o) => o.kot_fired && o.pending > 0)

  // quantity already in the working cart, by menu item — drives the item qty badge
  const cartQty = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of cart) m[l.menu_item] = l.qty
    return m
  }, [cart])

  const roomList = rooms.filter((r) =>
    !roomQuery.trim() ||
    r.room_number.toLowerCase().includes(roomQuery.toLowerCase()) ||
    (r.guest_name || "").toLowerCase().includes(roomQuery.toLowerCase()))

  const canFire = !busy && cart.length > 0 && (selected != null || newOrderContextReady)
  const isRoomOrNc = Boolean(selected && detail && (detail.room || detail.nc))
  const canPay = !busy && (selected ? Boolean(detail) : cart.length > 0 && newOrderContextReady)

  const containerCls = "flex min-h-0 flex-col overflow-hidden bg-zinc-50"

  const newTargetLabel =
    orderType === "Dine In"
      ? (table ? `${t("Table")} ${table}` : t("New order · Dine In"))
      : orderType === "Room Service"
        ? (room ? `${t("Room")} ${room.split("-").pop()}` : t("New order · Room service"))
        : `${t(orderType)}${custName ? ` · ${custName.split(" ")[0]}` : ""}`

  // ── bill chip tone (cross-mode header chips) ──
  const chipTone = (o: OpenOrder, active: boolean) => {
    if (active) return "border-gold-500 bg-gold-500 text-[#3A2405]"
    if (!o.kot_fired) return "border-gold-400 bg-gold-50 text-gold-800"
    if (o.pending > 0) return "border-brand-200 bg-brand-50 text-brand-800"
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }

  return (
    <div ref={rootRef} className={containerCls}>
      {!outletsLoaded ? (
        <PosSkeleton />
      ) : outlets.length === 0 ? (
        <div className="grid flex-1 place-items-center p-6">
          <OnboardingEmptyState
            icon={UtensilsCrossed}
            title="Set up a restaurant outlet to start selling"
            message="The POS runs on an outlet and its menu. Create an outlet (with its tables), then add menu items — orders, tables, KOT and payments all flow from here."
            cta={{ label: "Create an outlet", to: "/outlets" }}
            secondary={{ label: "Add menu items", to: "/menu-items" }}
            gatedNote="Ask a hotel administrator to set up the restaurant outlet and menu."
          />
        </div>
      ) : (
        <>
          {/* ═══ ROW 1 — identity bar ═══ */}
          <header className="flex h-14 shrink-0 items-center gap-3 bg-brand-900 px-3 text-white sm:px-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-brand-950 shadow-inner">
              <UtensilsCrossed className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold tracking-tight sm:text-[15px]">{t("Restaurant POS")}</h1>
              </div>
              <select
                aria-label={t("Outlet")}
                className="-ms-0.5 max-w-[9rem] truncate border-0 bg-transparent p-0 text-[11px] text-brand-100 outline-none sm:max-w-[14rem]"
                value={outlet}
                onChange={(e) => { setOutlet(e.target.value); newOrder() }}
              >
                {outlets.map((o) => <option className="text-zinc-900" key={o.name} value={o.name}>{o.outlet_name}</option>)}
              </select>
            </div>

            <span className="ms-2 hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-brand-100 md:flex">
              <span className={cn("size-2 rounded-full", printKot ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(105,217,163,0.25)]" : "bg-zinc-400")} />
              {t("Kitchen printer")} · <b className="text-white">{printKot ? t("connected") : t("off")}</b>
            </span>

            <div className="ms-auto flex items-center gap-2">
              <button type="button" onClick={() => setHistoryOpen(true)}
                className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-xs font-semibold text-brand-100 transition hover:bg-white/10 sm:inline-flex"
                title={t("Today's orders")}>
                <ClipboardList className="size-4" />{t("Today")}
              </button>
              <button type="button" onClick={() => setPrintKot((v) => !v)}
                className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition",
                  printKot ? "border-gold-400/50 bg-gold-500/15 text-gold-300" : "border-white/15 bg-white/5 text-brand-100")}
                title={printKot ? t("KOT printer on") : t("KOT printer off")}>
                <Printer className="size-4" /><span className="hidden lg:inline">{printKot ? t("KOT on") : t("KOT off")}</span>
              </button>
              <button onClick={toggleBrowserFs}
                className="rounded-lg border border-white/15 bg-white/5 p-2 text-white transition hover:bg-white/10"
                title={browserFs ? t("Exit full screen (Esc)") : t("Full screen till")}>
                {browserFs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button onClick={() => void signOut()}
                className="rounded-lg border border-white/15 bg-white/5 p-2 text-white transition hover:bg-rose-500/25"
                aria-label={t("Sign out")} title={t("Sign out")}>
                <LogOut className="size-4" />
              </button>
              <Button variant="gold" className="h-10" onClick={() => newOrder()}>
                <Plus className="size-4" /><span className="hidden sm:inline">{t("New Bill")}</span>
                <kbd className="hidden rounded bg-brand-950/20 px-1 text-[10px] lg:inline">F2</kbd>
              </Button>
            </div>
          </header>

          {/* ═══ ROW 2 — command bar: persistent order-type segment + cross-mode bill chips ═══ */}
          <div className="flex h-auto min-h-[3rem] shrink-0 flex-wrap items-center gap-2 bg-brand-800 px-3 py-1.5 sm:flex-nowrap sm:px-4">
            <div role="radiogroup" aria-label={t("Order type")}
              className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-black/20 p-1">
              {ORDER_TYPES.map((type) => {
                const Icon = ORDER_TYPE_META[type].icon
                const active = displayedOrderType === type
                return (
                  <button key={type} type="button" role="radio" aria-checked={active}
                    data-order-type={type}
                    onClick={() => { chooseOrderType(type); setPosTab("context") }}
                    className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition",
                      active ? "bg-brand-600 text-white shadow" : "text-brand-100 hover:bg-white/10")}>
                    <Icon className="size-4" strokeWidth={1.9} aria-hidden />
                    <span className="whitespace-nowrap">{t(type)}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              {open.length === 0 ? (
                <span className="ps-1 text-[11px] text-brand-200/80">{t("No open bills")}</span>
              ) : open.map((o) => {
                const active = selected === o.name
                return (
                  <button key={o.name} type="button" onClick={() => openTab(o.name)}
                    className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                      chipTone(o, active))}>
                    <b>{billChipLabel(o)}</b>
                    <span className="tabular-nums opacity-80">· {o.kot_fired ? `${cur()}${inr(o.order_total)}` : t("not sent")}</span>
                  </button>
                )
              })}
              {open.length > 0 && (
                <button type="button" onClick={() => setHistoryOpen(true)}
                  className="ms-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-white/20 px-3 text-[11px] font-semibold text-brand-100 hover:bg-white/10">
                  {t("All")} <ChevronLeft className="size-3.5 rtl:rotate-180" />
                </button>
              )}
            </div>
          </div>

          {/* mobile pane tabs */}
          <div className="flex shrink-0 gap-1 border-b border-zinc-200 bg-white p-1.5 lg:hidden">
            {([["context", t("Service")], ["menu", t("Menu")], ["cart", `${t("Cart")}${cart.length ? ` (${cart.length})` : ""}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setPosTab(k)}
                className={cn("h-11 flex-1 rounded-lg text-sm font-semibold transition",
                  posTab === k ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600")}>
                {l}
              </button>
            ))}
          </div>

          {error && (
            <div className="mx-3 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <span>{error}</span>
              <button className="text-xs font-semibold" onClick={() => setError(null)}>{t("Dismiss")}</button>
            </div>
          )}

          {/* ═══ MAIN — 3 panes ═══ */}
          <div className="grid min-h-0 flex-1 lg:grid-cols-[232px_minmax(0,1fr)_320px] xl:grid-cols-[296px_minmax(0,1fr)_376px]">

            {/* ── LEFT: service context (swaps by mode) ── */}
            <aside className={cn("flex min-h-0 flex-col border-zinc-200 bg-white lg:border-e",
              posTab === "context" ? "flex" : "hidden lg:flex")}>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {displayedOrderType === "Dine In" ? (
                  <DineInPane
                    t={t} tables={tables} visibleTables={visibleTables} tableGroups={tableGroups}
                    tableQuery={tableQuery} setTableQuery={setTableQuery}
                    tableFilter={tableFilter} setTableFilter={setTableFilter}
                    areas={areas} areaFilter={areaFilter} setAreaFilter={setAreaFilter}
                    availableCount={availableCount} selected={selected} table={table}
                    chooser={chooser} setChooser={setChooser} resTile={resTile} setResTile={setResTile}
                    onTapTile={(tl) =>
                      tl.state === "reserved" ? setResTile(resTile === tl.table ? null : tl.table)
                        : tl.state === "cleaning" ? cleanTable(tl)
                          : tl.bills === 0 ? (newOrder(tl.table), setPosTab("menu"))
                            : tl.bills === 1 ? openTab(tl.orders[0].order)
                              : setChooser(chooser === tl.table ? null : tl.table)}
                    onOpenBill={openTab} onNewOnTable={(tbl) => { newOrder(tbl); setPosTab("menu") }}
                    onTempTable={() => { newOrder(); setOrderType("Dine In"); setCustomTable(true); setPosTab("context") }}
                    onReserve={() => setReserveOpen(true)}
                    seatReservation={seatReservation} closeReservation={closeReservation}
                    busy={busy} customTable={customTable} setCustomTable={setCustomTable}
                    setTable={setTable} guests={guests} setGuests={setGuests}
                  />
                ) : displayedOrderType === "Room Service" ? (
                  <RoomServicePane
                    t={t} rooms={roomList} roomQuery={roomQuery} setRoomQuery={setRoomQuery}
                    room={room} setRoom={setRoom} selected={selected} detail={detail}
                    guests={guests} setGuests={setGuests} onPick={() => setPosTab("menu")}
                  />
                ) : (
                  <CustomerPane
                    t={t} mode={displayedOrderType} selected={selected} detail={detail}
                    custName={custName} setCustName={setCustName}
                    custPhone={custPhone} setCustPhone={setCustPhone}
                    custAddr={custAddr} setCustAddr={setCustAddr}
                    ready={newOrderContextReady} hint={t(contextHint)}
                  />
                )}
              </div>
              <div className="shrink-0 border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{t("Open bills")}</span>
                  <b className="tabular-nums text-zinc-700">{modeOpen.length} · {cur()}{inr(modeOpen.reduce((s, o) => s + o.order_total, 0))}</b>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-zinc-400">{t("In kitchen")}</span>
                  <b className="tabular-nums text-zinc-700">{kitchenBills.length}</b>
                </div>
              </div>
            </aside>

            {/* ── MIDDLE: menu ── */}
            <section className={cn("flex min-h-0 flex-col bg-zinc-50", posTab === "menu" ? "flex" : "hidden lg:flex")}>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-1 pt-3">
                {["All", ...cats.map((c) => c.category)].map((c) => (
                  <button key={c} onClick={() => { setCat(c); setQuery("") }}
                    className={cn("inline-flex h-11 items-center rounded-full border px-4 text-sm font-bold transition",
                      cat === c && !query.trim() ? "border-brand-800 bg-brand-800 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-400")}>
                    {t(c)}
                  </button>
                ))}
                <div className="relative ms-auto min-w-[9rem] flex-1 sm:max-w-[16rem]">
                  <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" style={{ insetInlineStart: "0.75rem" }} />
                  <input className="h-11 w-full rounded-full border border-zinc-200 bg-white ps-9 pe-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
                    placeholder={t("Search menu items…")} value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {allItems.length === 0 ? (
                  <div className="grid h-full place-items-center px-6 text-center text-sm text-zinc-400">
                    {t("No menu items for this outlet yet.")}
                  </div>
                ) : shownItems ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                    {shownItems.map((it) => <MenuCard key={it.name} it={it} qty={cartQty[it.name] || 0} onAdd={() => addToCart(it)} />)}
                    {shownItems.length === 0 && <p className="col-span-full py-8 text-center text-sm text-zinc-400">{t("No matches.")}</p>}
                  </div>
                ) : (
                  cats.map((c) => (
                    <div key={c.category} className="mb-4">
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t(c.category)}</h3>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                        {c.items.map((it) => <MenuCard key={it.name} it={it} qty={cartQty[it.name] || 0} onAdd={() => addToCart(it)} />)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ── RIGHT: cart ── */}
            <aside className={cn("min-h-0 flex-col border-zinc-200 bg-white lg:flex lg:border-s",
              posTab === "cart" ? "flex" : "hidden lg:flex")}>
              {/* cart header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                <button onClick={() => setPosTab("menu")} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 lg:hidden"><ChevronLeft className="size-5 rtl:rotate-180" /></button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <b className="truncate text-sm">{selected && detail ? orderLabel(detail) : newTargetLabel}</b>
                    {selected && detail?.guests ? <span className="flex items-center gap-0.5 text-[11px] text-zinc-400"><Users className="size-3" />{detail.guests}</span> : null}
                  </div>
                  <div className="truncate text-[11px] text-zinc-400">
                    {selected && detail
                      ? `${detail.kot_no ? `KOT #${detail.kot_no} · ` : ""}${t(detail.status)}`
                      : t("New bill")}
                  </div>
                </div>
                {selected && detail?.table_no && detail.status !== "Delivered" && (
                  <button title={t("New bill on this table")} onClick={() => newOrder(detail.table_no!)}
                    className="rounded-lg border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-500 hover:border-brand-500 hover:text-brand-700">
                    + {t("bill")}
                  </button>
                )}
              </div>

              {/* lines */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {selected && detail && (
                  <>
                    {!!detail.nc && (
                      <div className="m-3 mb-0 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-800">
                        <span className="font-bold">{t("COMPLIMENTARY")}</span>
                        <span className="ms-1">{t("auth")}: {detail.nc_authorized_by}{detail.nc_note ? ` · ${detail.nc_note}` : ""}</span>
                      </div>
                    )}
                    {splitMode && (
                      <p className="m-3 mb-0 rounded-xl bg-brand-50 px-3 py-1.5 text-xs text-brand-700">{t("Tick the lines moving to the new bill.")}</p>
                    )}
                    <ul className="divide-y divide-zinc-100">
                      {detail.items.map((it) => (
                        <li key={it.row} className="group flex items-center justify-between gap-2 px-4 py-2.5">
                          <span className={cn("flex min-w-0 items-center gap-2", !!it.voided && "text-zinc-400 line-through")}>
                            {splitMode && !it.voided && (
                              <input type="checkbox" className="size-4 accent-brand-600"
                                checked={splitSel.has(it.row)} onChange={() => toggleSplitSel(it.row)} />
                            )}
                            <span className="min-w-0">
                              <b className="text-[13px] font-semibold">{Math.round(it.qty)}× {it.item_name}</b>
                              {!it.voided && it.kot_status !== "New" && <span className="ms-1.5 text-[10px] text-zinc-400">{t(it.kot_status)}</span>}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="tabular-nums text-[13px] font-semibold">{cur()}{inr(it.amount)}</span>
                            {!splitMode && !it.voided && detail.status !== "Delivered" && (
                              <button title={t("Void line")} onClick={() => { setVoiding(it); setVoidReason("") }}
                                className="text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500">
                                <XCircle className="size-4" />
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {voiding && (
                      <div className="m-3 rounded-xl border border-rose-200 bg-rose-50 p-2">
                        <p className="mb-1 text-xs font-medium text-rose-700">{t("Void")} {voiding.item_name} — {t("reason required")}</p>
                        <div className="flex gap-1.5">
                          <input autoFocus className={cn(inputCls, "!h-9 text-xs")} placeholder={t("e.g. spilled, wrong item")}
                            value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && confirmVoid()} />
                          <Button variant="outline" className="!h-9 !px-2 text-xs font-semibold text-rose-600" disabled={busy || !voidReason.trim()} onClick={confirmVoid}>{t("Void")}</Button>
                          <Button variant="ghost" className="!h-9 !px-2 text-xs" onClick={() => setVoiding(null)}>✕</Button>
                        </div>
                      </div>
                    )}
                    {splitMode && (
                      <div className="m-3 flex gap-1.5">
                        <Button className="h-11 flex-1" disabled={busy || splitSel.size === 0 || splitSel.size >= detail.items.filter((i) => !i.voided).length} onClick={confirmSplit}>
                          <Scissors className="size-4" />{t("Move")} {splitSel.size || ""} {t("to new bill")}
                        </Button>
                        <Button variant="ghost" className="h-11" onClick={() => { setSplitMode(false); setSplitSel(new Set()) }}>✕</Button>
                      </div>
                    )}
                    {cart.length > 0 && <h4 className="px-4 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gold-700">{t("New round — not sent")}</h4>}
                  </>
                )}

                {cart.length === 0 && !(selected && detail) ? (
                  <div className="grid h-full place-items-center px-6 py-10 text-center">
                    <div className="grid gap-1.5 text-sm text-zinc-400">
                      <UtensilsCrossed className="mx-auto size-8 text-zinc-300" />
                      {t("Tap menu items to add.")}
                    </div>
                  </div>
                ) : (
                  <ul className={cn(cart.length > 0 && (selected && detail) && "bg-gold-50/40")}>
                    {cart.map((l) => (
                      <li key={l.menu_item} className="border-b border-zinc-100 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-[13px] font-semibold">{l.item_name}</b>
                            {selected && <span className="text-[10px] font-semibold text-gold-700">{t("New — not sent")}</span>}
                          </span>
                          <div className="flex items-center overflow-hidden rounded-xl border border-zinc-300">
                            <button onClick={() => setQty(l.menu_item, -1)} className="grid size-11 place-items-center text-brand-700 active:bg-brand-50"><Minus className="size-4" /></button>
                            <b className="w-8 text-center text-sm tabular-nums">{l.qty}</b>
                            <button onClick={() => setQty(l.menu_item, 1)} className="grid size-11 place-items-center text-brand-700 active:bg-brand-50"><Plus className="size-4" /></button>
                          </div>
                          <span className="w-16 text-end text-[13px] font-semibold tabular-nums">{cur()}{inr(l.qty * l.price)}</span>
                          <button onClick={() => setQty(l.menu_item, -l.qty)} className="text-zinc-300 hover:text-rose-500"><Trash2 className="size-4" /></button>
                        </div>
                        <input className="mt-1.5 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs" placeholder={t("Instructions")}
                          value={l.instructions} onChange={(e) => setInstr(l.menu_item, e.target.value)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* NC / cancel inline forms */}
              {ncOpen && selected && (
                <div className="border-t border-zinc-100 bg-gold-50 p-3">
                  <p className="mb-1 text-xs font-medium text-gold-800">{t("Complimentary (no charge) - who authorized?")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <select className={cn(inputCls, "!h-9 !w-28 text-xs")} value={ncBy} onChange={(e) => setNcBy(e.target.value)}>
                      {["Captain", "Chef", "Manager", "GM", "Management", "Owner"].map((w) => <option key={w}>{t(w)}</option>)}
                    </select>
                    <input autoFocus className={cn(inputCls, "!h-9 min-w-[8rem] flex-1 text-xs")} placeholder={t("Reference (birthday, complaint #, promo…)")}
                      value={ncNote} onChange={(e) => setNcNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveNc()} />
                    <Button variant="outline" className="!h-9 !px-2 text-xs font-semibold text-gold-700" disabled={busy} onClick={() => saveNc()}>{t("NC")}</Button>
                    <Button variant="ghost" className="!h-9 !px-2 text-xs" onClick={() => setNcOpen(false)}>✕</Button>
                  </div>
                </div>
              )}
              {cancelling && (
                <div className="border-t border-zinc-100 bg-rose-50 p-3">
                  <p className="mb-1 text-xs font-medium text-rose-700">{t("Cancel this order - reason required")}</p>
                  <div className="flex gap-1.5">
                    <input autoFocus className={cn(inputCls, "!h-9 text-xs")} placeholder={t("e.g. guest left")}
                      value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmCancel()} />
                    <Button variant="outline" className="!h-9 !px-2 text-xs font-semibold text-rose-600" disabled={busy || !cancelReason.trim()} onClick={confirmCancel}>{t("Cancel order")}</Button>
                    <Button variant="ghost" className="!h-9 !px-2 text-xs" onClick={() => setCancelling(false)}>✕</Button>
                  </div>
                </div>
              )}

              {/* totals */}
              <div className="shrink-0 space-y-1 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{t("Discount")}</span>
                  {discOpen ? (
                    <span className="flex items-center gap-1">
                      <input autoFocus className={cn(inputCls, "!h-8 !w-24 text-xs")} placeholder={`${cur()}`} inputMode="numeric"
                        value={discount} onChange={(e) => setDiscount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyDiscount()} />
                      <Button variant="outline" className="!h-8 !px-2 text-xs" disabled={busy} onClick={applyDiscount}>{t("OK")}</Button>
                    </span>
                  ) : (
                    <button onClick={() => setDiscOpen(true)} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                      <Tag className="size-3" />
                      {(selected && detail ? detail.discount_amount : disc) > 0
                        ? `−${cur()}${inr(selected && detail ? detail.discount_amount : disc)}`
                        : t("Add discount")}
                    </button>
                  )}
                </div>
                <div className="flex justify-between text-zinc-500"><span>{t("Subtotal")}</span><span className="tabular-nums">{cur()}{inr2(taxable)}</span></div>
                {taxLabel() === "VAT" ? (
                  <div className="flex justify-between text-xs text-zinc-400"><span>{t("VAT")} ({gstRate}%)</span><span className="tabular-nums">{cur()}{inr2(gstAmt)}</span></div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs text-zinc-400"><span>CGST ({gstRate / 2}%)</span><span className="tabular-nums">{cur()}{inr2(gstAmt / 2)}</span></div>
                    <div className="flex justify-between text-xs text-zinc-400"><span>SGST ({gstRate / 2}%)</span><span className="tabular-nums">{cur()}{inr2(gstAmt / 2)}</span></div>
                  </>
                )}
                <div className="flex items-center justify-between border-t border-dashed border-zinc-300 pt-1.5 text-lg font-bold"><span>{t("Total")}</span><span className="tabular-nums">{cur()}{inr2(grand)}</span></div>
              </div>

              {/* actions */}
              <div className="shrink-0 space-y-2 border-t border-zinc-100 bg-zinc-50 px-3 pb-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button data-pos-action="send-kot" disabled={!canFire} onClick={kotAction}
                    className={cn("flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand-800 text-[15px] font-bold text-white shadow transition hover:bg-brand-900",
                      !canFire && "cursor-not-allowed opacity-45")}>
                    <Send className="size-5" />{selected ? t("Add & fire") : t("To kitchen")}
                  </button>
                  <button data-pos-action="pay" disabled={!canPay}
                    onClick={proceedToPay}
                    className={cn("flex h-14 items-center justify-center gap-2 rounded-2xl bg-gold-500 text-[15px] font-bold text-[#3A2405] shadow-[0_4px_12px_rgba(232,150,62,0.3)] transition hover:brightness-105",
                      !canPay && "cursor-not-allowed opacity-45")}>
                    <Wallet className="size-5" />{isRoomOrNc ? (selected && detail?.nc ? t("Close bill") : t("To room")) : t("Pay")}
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <MiniAct icon={PauseCircle} label={t("Hold")} disabled={busy || !!selected || cart.length === 0 || !newOrderContextReady} onClick={hold} />
                  <MiniAct icon={Scissors} label={t("Split")} disabled={busy || !selected || !detail || detail.items.filter((i) => !i.voided).length < 2 || detail.status === "Delivered"} onClick={() => { setSplitMode(true); setSplitSel(new Set()) }} />
                  <MiniAct icon={Tag} label={t("Discount")} disabled={busy || (!selected && cart.length === 0)} onClick={() => setDiscOpen(true)} />
                  <MiniAct icon={Receipt} label={t("Bill")} disabled={busy || !selected} onClick={printBill} />
                  <div className="relative">
                    <MiniAct icon={MoreHorizontal} label={t("More")} disabled={busy || !selected} onClick={() => setMoreOpen((v) => !v)} />
                    {moreOpen && selected && detail && (
                      <div className="absolute bottom-full end-0 z-20 mb-1 w-48 rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg">
                        <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-xs hover:bg-zinc-50"
                          disabled={detail.status === "Delivered"} onClick={() => { setMoreOpen(false); detail.nc ? saveNc(true) : setNcOpen(true) }}>
                          <Gift className="size-4 text-gold-600" />{detail.nc ? t("Undo complimentary") : t("Complimentary")}
                        </button>
                        <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-xs hover:bg-zinc-50"
                          disabled={!detail.kot_no} onClick={() => { setMoreOpen(false); reprintKot() }}>
                          <Printer className="size-4 text-zinc-500" />{t("Reprint KOT")}
                        </button>
                        <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => { setMoreOpen(false); setCancelling(true); setCancelReason("") }}>
                          <Ban className="size-4" />{t("Cancel order")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* ═══ FOOTER — shortcuts (desktop) / running action bar (mobile) ═══ */}
          <footer className="hidden shrink-0 items-center justify-center gap-x-6 gap-y-1 border-t border-zinc-200 bg-white px-4 py-2 text-[11px] text-zinc-400 lg:flex">
            {([["F2", t("New bill")], ["F3", t("Cycle open bills")], ["F4", t("Proceed to pay")], ["F5", t("Hold bill")], ["F6", t("Fire KOT")]] as const).map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-semibold text-zinc-600">{k}</kbd>{l}
              </span>
            ))}
            <span className="text-zinc-300">|</span>
            <span>{t("ZATCA invoice with QR at payment")}</span>
          </footer>
          {/* mobile bottom action bar */}
          <footer className="flex shrink-0 items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-zinc-400">{t("Total")}</div>
              <b className="tabular-nums text-base">{cur()}{inr2(grand)}</b>
            </div>
            {cart.length > 0 ? (
              <button disabled={!canFire} onClick={kotAction}
                className={cn("flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-800 text-sm font-bold text-white", !canFire && "opacity-45")}>
                <Send className="size-4" />{selected ? t("Add & fire") : t("To kitchen")}
              </button>
            ) : (
              <button disabled={!canPay} onClick={proceedToPay}
                className={cn("flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gold-500 text-sm font-bold text-[#3A2405]", !canPay && "opacity-45")}>
                <Wallet className="size-4" />{isRoomOrNc ? t("Post") : t("Pay")}
              </button>
            )}
          </footer>
        </>
      )}

      {/* ═══ overlays ═══ */}
      {printNote && (
        <div className="fixed inset-inline-start-4 bottom-4 z-[80] flex max-w-sm items-center gap-3 rounded-2xl bg-brand-900 px-4 py-3 text-sm text-white shadow-lg" style={{ insetInlineStart: "1rem" }} role="status">
          <BadgeCheck className="size-5 shrink-0 text-emerald-400" />
          <span className="flex-1">{printNote}</span>
          <button className="text-xs font-semibold text-gold-400" onClick={() => setPrintNote(null)}>{t("Dismiss")}</button>
        </div>
      )}

      {/* pay sheet */}
      {settling && selected && (
        <PosSheet t={t} title={t("Take payment")} onClose={() => setSettling(false)}>
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
            <span className="text-sm text-zinc-500">{t("Amount due")}</span>
            <b className="text-2xl font-bold tabular-nums">{cur()}{inr2(grand)}</b>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(["Cash", "Card", "Mada", "Digital Wallet"] as const).map((m) => (
              <button key={m} disabled={busy} onClick={() => settle(m)}
                className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 bg-white text-sm font-bold text-zinc-800 transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50">
                <Wallet className="size-5 text-brand-600" />{t(m)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-400">{t("ZATCA invoice with QR at payment")}</p>
        </PosSheet>
      )}

      {/* reserve modal */}
      {reserveOpen && (
        <PosSheet t={t} title={t("Reserve a table")} onClose={() => setReserveOpen(false)}>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-zinc-500">{t("Table")}
                <select className={cn(inputCls, "mt-1")} value={resForm.table} onChange={(e) => setResForm({ ...resForm, table: e.target.value })}>
                  <option value="">{t("Table…")}</option>
                  {tables.filter((tl) => !tl.temp).map((tl) => <option key={tl.table} value={tl.table}>{tl.table}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-zinc-500">{t("When")}
                <input className={cn(inputCls, "mt-1")} type="datetime-local" value={resForm.at} onChange={(e) => setResForm({ ...resForm, at: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-zinc-500">{t("Guest name")}
                <input className={cn(inputCls, "mt-1")} value={resForm.guest} onChange={(e) => setResForm({ ...resForm, guest: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-zinc-500">{t("Phone")}
                <input className={cn(inputCls, "mt-1")} inputMode="tel" value={resForm.phone} onChange={(e) => setResForm({ ...resForm, phone: e.target.value })} />
              </label>
            </div>
            <label className="block text-xs font-semibold text-zinc-500">{t("Party")}
              <input className={cn(inputCls, "mt-1 !w-28")} inputMode="numeric" value={resForm.party} onChange={(e) => setResForm({ ...resForm, party: e.target.value.replace(/\D/g, "") })} />
            </label>
            <Button className="h-12" disabled={busy || !resForm.table || !resForm.guest.trim() || !resForm.at} onClick={saveReservation}>{t("Reserve")}</Button>
          </div>
        </PosSheet>
      )}

      {/* today's orders / history sheet */}
      {historyOpen && (
        <PosSheet t={t} title={t("Today's orders")} onClose={() => setHistoryOpen(false)}>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {recent.length === 0 && <p className="py-6 text-center text-sm text-zinc-400">{t("No orders yet today.")}</p>}
            {recent.map((r) => (
              <li key={r.name}>
                <button disabled={!r.open} onClick={() => { setHistoryOpen(false); openTab(r.name) }}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm", r.open ? "hover:bg-brand-50" : "cursor-default opacity-60")}>
                  <span className="min-w-0"><b className="text-zinc-800">{r.label}</b><span className="ms-1 text-zinc-400">· {t(r.order_type || "Dine In")}</span></span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <b>{cur()}{inr(r.order_total)}</b>
                    {r.nc ? <span className="rounded bg-gold-50 px-1.5 text-[10px] font-bold text-gold-700">{t("NC")}</span>
                      : r.paid ? <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-700">{t(r.payment_mode || "")}</span>
                        : r.status === "Cancelled" ? <span className="rounded bg-rose-50 px-1.5 text-[10px] font-medium text-rose-600">✕</span> : null}
                    <span className="text-zinc-400">{ago(r.modified)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PosSheet>
      )}
    </div>
  )
}

// ── Left-pane: Dine In (zone table grid) ──
function DineInPane(p: {
  t: (s: string) => string
  tables: TableTile[]; visibleTables: TableTile[]; tableGroups: [string | null, TableTile[]][]
  tableQuery: string; setTableQuery: (v: string) => void
  tableFilter: "all" | "available" | "occupied"; setTableFilter: (v: "all" | "available" | "occupied") => void
  areas: string[]; areaFilter: string; setAreaFilter: (v: string) => void
  availableCount: number; selected: string | null; table: string
  chooser: string | null; setChooser: (v: string | null) => void
  resTile: string | null; setResTile: (v: string | null) => void
  onTapTile: (t: TableTile) => void; onOpenBill: (o: string) => void
  onNewOnTable: (t: string) => void; onTempTable: () => void; onReserve: () => void
  seatReservation: (t: TableTile) => void; closeReservation: (t: TableTile, s: "Cancelled" | "No Show") => void
  busy: boolean; customTable: boolean; setCustomTable: (v: boolean) => void
  setTable: (v: string) => void; guests: string; setGuests: (v: string) => void
}) {
  const { t, tables } = p
  if (tables.length === 0) {
    return (
      <p className="py-2 text-xs text-zinc-400">
        {t("No table layout for this outlet yet — add tables on the POS Outlet.")}
      </p>
    )
  }
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" style={{ insetInlineStart: "0.6rem" }} />
          <input className="h-9 w-full rounded-lg border border-zinc-200 bg-white ps-8 pe-2 text-xs focus:outline-2 focus:outline-brand-600"
            placeholder={t("Search table…")} value={p.tableQuery} onChange={(e) => p.setTableQuery(e.target.value)} />
        </div>
        <button onClick={p.onReserve} className="h-9 shrink-0 rounded-lg border border-zinc-200 px-2 text-[11px] font-semibold text-zinc-600 hover:border-violet-400 hover:text-violet-700">+ {t("Reserve")}</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {([["all", `${t("All")} (${tables.length})`], ["available", `${t("Available")} (${p.availableCount})`], ["occupied", `${t("Occupied")} (${tables.length - p.availableCount})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => p.setTableFilter(k)}
            className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", p.tableFilter === k ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}>{l}</button>
        ))}
      </div>
      {p.areas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {["All", ...p.areas].map((a) => (
            <button key={a} onClick={() => p.setAreaFilter(a)}
              className={cn("rounded-full px-2.5 py-1 text-[11px]", p.areaFilter === a ? "bg-zinc-800 font-medium text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-zinc-400")}>{a}</button>
          ))}
        </div>
      )}
      {p.tableGroups.map(([groupName, group]) => (
        <div key={groupName ?? "_"}>
          {groupName && <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">{groupName}</h4>}
          <div className="grid grid-cols-3 gap-2">
            {group.map((tl) => {
              const isSel = tl.orders.some((b) => b.order === p.selected) || p.chooser === tl.table ||
                (tl.bills === 0 && p.selected === null && p.table === tl.table)
              return (
                <button key={tl.table} onClick={() => p.onTapTile(tl)}
                  className={cn("relative grid min-h-[3.75rem] place-content-center gap-0.5 rounded-2xl border-[1.5px] p-1.5 text-center transition", TILE[tl.state],
                    tl.temp && "border-dashed", isSel && "ring-2 ring-brand-600 ring-offset-1")}>
                  {tl.bills > 1 && (
                    <span className="absolute -end-1.5 -top-1.5 flex items-center gap-0.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <Users className="size-2.5" />{tl.bills}
                    </span>
                  )}
                  <b className="text-[15px] tabular-nums leading-none">{tl.table}</b>
                  <span className="truncate text-[10px] font-semibold opacity-70">
                    {tl.bills > 0
                      ? <>{cur()}{inr(tl.order_total)}{tl.since ? ` · ${ago(tl.since)}` : ""}</>
                      : tl.state === "reserved" ? `${t("Res")} ${tl.res_time}`
                        : tl.state === "cleaning" ? t("Cleaning")
                          : tl.seats ? `${tl.seats} ${t("seats")}` : " "}
                  </span>
                </button>
              )
            })}
            {groupName === null && p.visibleTables.length === 0 && (
              <p className="col-span-3 py-3 text-center text-xs text-zinc-400">{t("No tables match.")}</p>
            )}
          </div>
        </div>
      ))}

      {/* guest count when starting a new dine-in on a chosen table */}
      {!p.selected && p.table && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-xs font-semibold text-brand-800">{t("Table")} {p.table}</span>
          <div className="ms-auto flex items-center gap-1.5">
            <Users className="size-3.5 text-brand-600" />
            <input className="h-9 w-16 rounded-lg border border-zinc-300 bg-white px-2 text-sm" placeholder={t("Guests")} inputMode="numeric"
              value={p.guests} onChange={(e) => p.setGuests(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
      )}

      {/* reserved-tile popover */}
      {p.resTile && (() => {
        const tl = tables.find((x) => x.table === p.resTile)
        if (!tl || tl.state !== "reserved") return null
        return (
          <div className="space-y-1.5 rounded-2xl border border-violet-200 bg-violet-50 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-violet-900">{tl.table} · {tl.res_time} · {tl.res_guest}{tl.res_party ? ` · ${tl.res_party} ${t("pax")}` : ""}</span>
              <button onClick={() => p.setResTile(null)} className="text-violet-400 hover:text-violet-700">✕</button>
            </div>
            {tl.res_phone && <p className="text-[11px] text-violet-700"><bdi dir="ltr">{tl.res_phone}</bdi></p>}
            <div className="flex gap-1.5">
              <Button className="h-9 flex-1 text-xs" disabled={p.busy} onClick={() => p.seatReservation(tl)}>{t("Seat now")}</Button>
              <Button variant="outline" className="!h-9 !px-2 text-xs" disabled={p.busy} onClick={() => p.closeReservation(tl, "No Show")}>{t("No show")}</Button>
              <Button variant="outline" className="!h-9 !px-2 text-xs text-rose-600" disabled={p.busy} onClick={() => p.closeReservation(tl, "Cancelled")}>{t("Cancel")}</Button>
            </div>
          </div>
        )
      })()}

      {/* multi-bill chooser popover */}
      {p.chooser && (() => {
        const tl = tables.find((x) => x.table === p.chooser)
        if (!tl) return null
        return (
          <div className="space-y-1 rounded-2xl bg-zinc-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">{tl.table} — {tl.bills} {t("bills")}</span>
              <button onClick={() => p.setChooser(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
            </div>
            {tl.orders.map((b) => (
              <button key={b.order} onClick={() => p.onOpenBill(b.order)}
                className={cn("flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-xs transition", TILE[b.state])}>
                <span>{b.label}</span><span className="tabular-nums">{cur()}{inr(b.order_total)}</span>
              </button>
            ))}
            <button onClick={() => p.onNewOnTable(tl.table)}
              className="w-full rounded-xl border border-dashed border-zinc-400 px-2 py-2 text-xs text-zinc-600 hover:border-brand-500 hover:text-brand-700">
              <Plus className="me-0.5 inline size-3" />{t("New bill")}
            </button>
          </div>
        )
      })()}

      <button onClick={p.onTempTable}
        className="h-10 w-full rounded-xl border border-dashed border-zinc-300 text-xs font-semibold text-zinc-500 transition hover:border-brand-500 hover:text-brand-700">
        <Plus className="me-0.5 inline size-3.5" />{t("Temp table")}
      </button>

      {p.customTable && !p.selected && (
        <div className="flex gap-1.5">
          <input autoFocus className={inputCls} placeholder={t("Table name")} value={p.table} onChange={(e) => p.setTable(e.target.value)} />
          <Button variant="ghost" className="!px-2" onClick={() => { p.setCustomTable(false); p.setTable("") }}>✕</Button>
        </div>
      )}
    </div>
  )
}

// ── Left-pane: Room Service (in-house room + guest search = stay verification) ──
function RoomServicePane(p: {
  t: (s: string) => string
  rooms: { name: string; room_number: string; guest_name: string | null }[]
  roomQuery: string; setRoomQuery: (v: string) => void
  room: string; setRoom: (v: string) => void; selected: string | null; detail: Detail | null
  guests: string; setGuests: (v: string) => void; onPick: () => void
}) {
  const { t } = p
  if (p.selected && p.detail) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm">
        <div className="flex items-center gap-2 text-brand-800"><BedDouble className="size-4" /><b>{p.detail.room ? `${t("Room")} ${p.detail.room.split("-").pop()}` : t("Room service")}</b></div>
        <p className="mt-1 text-xs text-zinc-500">{t("Bill selected — items are in the cart.")}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-zinc-400" style={{ insetInlineStart: "0.75rem" }} />
        <input className="h-11 w-full rounded-xl border border-zinc-300 bg-white ps-9 pe-3 text-sm focus:outline-2 focus:outline-brand-600"
          placeholder={t("Search room or guest…")} value={p.roomQuery} onChange={(e) => p.setRoomQuery(e.target.value)} />
      </div>
      {p.rooms.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">{t("No in-house rooms match.")}</p>
      ) : (
        <ul className="space-y-1.5">
          {p.rooms.map((r) => (
            <li key={r.name}>
              <button onClick={() => { p.setRoom(r.name); p.onPick() }}
                className={cn("flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition",
                  p.room === r.name ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-zinc-200 bg-white hover:border-brand-400")}>
                <BedDouble className="size-4 shrink-0 text-brand-600" />
                <span className="min-w-0 flex-1">
                  <b className="block text-sm"><bdi dir="ltr">{t("Room")} {r.room_number}</bdi></b>
                  {r.guest_name && <span className="block truncate text-[11px] text-zinc-400">{r.guest_name}</span>}
                </span>
                {p.room === r.name && <Check className="size-4 text-brand-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {p.room && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
          <Users className="size-3.5 text-brand-600" />
          <input className="h-9 w-16 rounded-lg border border-zinc-300 bg-white px-2 text-sm" placeholder={t("Guests")} inputMode="numeric"
            value={p.guests} onChange={(e) => p.setGuests(e.target.value.replace(/\D/g, ""))} />
          <span className="text-[11px] text-zinc-500">{t("Posts to the guest folio at checkout.")}</span>
        </div>
      )}
    </div>
  )
}

// ── Left-pane: Takeaway / Delivery ──
function CustomerPane(p: {
  t: (s: string) => string; mode: OrderType; selected: string | null; detail: Detail | null
  custName: string; setCustName: (v: string) => void
  custPhone: string; setCustPhone: (v: string) => void
  custAddr: string; setCustAddr: (v: string) => void
  ready: boolean; hint: string
}) {
  const { t } = p
  const Icon = p.mode === "Delivery" ? Bike : ShoppingBag
  if (p.selected && p.detail) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm">
        <div className="flex items-center gap-2 text-brand-800"><Icon className="size-4" /><b>{t(p.mode)}{p.detail.customer_name ? ` · ${p.detail.customer_name}` : ""}</b></div>
        {p.detail.customer_phone && <p className="mt-1 text-xs text-zinc-500"><bdi dir="ltr">{p.detail.customer_phone}</bdi></p>}
        {p.detail.delivery_address && <p className="text-xs text-zinc-500">{p.detail.delivery_address}</p>}
        <p className="mt-1 text-xs text-zinc-400">{t("Bill selected — items are in the cart.")}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
        <Icon className="size-5 text-brand-600" />
        <span>{p.mode === "Takeaway" ? t("Counter pickup — no table required") : t("Customer, phone and address required")}</span>
      </div>
      <label className="block text-xs font-semibold text-zinc-500">{t("Customer name")}{p.mode === "Delivery" && <span className="text-rose-500"> *</span>}
        <input className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm focus:outline-2 focus:outline-brand-600"
          value={p.custName} onChange={(e) => p.setCustName(e.target.value)} placeholder={t("Customer name")} />
      </label>
      <label className="block text-xs font-semibold text-zinc-500">{t("Phone")}{p.mode === "Delivery" && <span className="text-rose-500"> *</span>}
        <input className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm focus:outline-2 focus:outline-brand-600" dir="ltr"
          inputMode="tel" value={p.custPhone} onChange={(e) => p.setCustPhone(e.target.value)} placeholder="+9665…" />
      </label>
      {p.mode === "Delivery" && (
        <label className="block text-xs font-semibold text-zinc-500">{t("Delivery address")}<span className="text-rose-500"> *</span>
          <textarea className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-brand-600" rows={2}
            value={p.custAddr} onChange={(e) => p.setCustAddr(e.target.value)} placeholder={t("Delivery address")} />
        </label>
      )}
      <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
        p.ready ? "bg-emerald-50 text-emerald-700" : "bg-gold-50 text-gold-800")}>
        {p.ready ? <Check className="size-4" /> : <Sparkles className="size-4" />}
        {p.ready ? t("Order details are ready") : p.hint}
      </div>
    </div>
  )
}

// ── mini action button (cart) ──
function MiniAct({ icon: Icon, label, disabled, onClick }: { icon: typeof Tag; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-zinc-200 bg-white text-[10px] font-semibold text-zinc-600 transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
      <Icon className="size-4" />{label}
    </button>
  )
}

// ── bottom-sheet / modal ──
function PosSheet({ t, title, onClose, children }: { t: (s: string) => string; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[22px] border border-zinc-200 bg-white p-4 shadow-xl sm:rounded-[22px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100" aria-label={t("Close")}><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── loading skeleton (3 panes) ──
function PosSkeleton() {
  return (
    <div className="flex h-full min-h-0 animate-pulse flex-col">
      <div className="h-14 shrink-0 bg-brand-900" />
      <div className="h-12 shrink-0 bg-brand-800" />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[296px_minmax(0,1fr)_376px]">
        <div className="border-e border-zinc-200 bg-white p-3">
          <div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-zinc-100" />)}</div>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-36 rounded-2xl bg-zinc-100" />)}</div>
        </div>
        <div className="border-s border-zinc-200 bg-white p-4"><div className="h-full rounded-2xl bg-zinc-100" /></div>
      </div>
    </div>
  )
}

function MenuCard({ it, qty, onAdd }: { it: MenuItem; qty: number; onAdd: () => void }) {
  const [imgError, setImgError] = useState(false)
  const parts = it.item_name.split("|").map((part) => part.trim()).filter(Boolean)
  const arabic = document.documentElement.dir === "rtl"
  const primary = arabic ? parts[0] : (parts[1] || parts[0])
  const secondary = arabic ? parts[1] : parts.length > 1 ? parts[0] : ""
  return (
    <button onClick={onAdd}
      className="group flex min-h-[9rem] flex-col overflow-hidden rounded-2xl border-[1.5px] border-zinc-200 bg-white text-start transition duration-150 hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500 active:scale-[0.97]">
      <div className="relative h-[4.75rem] overflow-hidden bg-brand-50">
        {it.image && !imgError ? (
          <img src={it.image} alt={primary} loading="lazy" onError={() => setImgError(true)} className="size-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-50 to-gold-50 text-brand-300">
            <UtensilsCrossed className="size-7" />
          </div>
        )}
        {qty > 0 && (
          <span className="absolute top-2 grid min-w-[1.4rem] place-items-center rounded-full bg-brand-700 px-1 py-0.5 text-xs font-bold text-white shadow" style={{ insetInlineStart: "0.5rem" }}>{qty}</span>
        )}
        <Leaf className={cn("absolute bottom-2 size-3.5", it.is_veg ? "text-emerald-500" : "text-rose-400")} style={{ insetInlineEnd: "0.5rem" }} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span dir="auto" className="line-clamp-2 text-[12.5px] font-bold leading-snug text-zinc-900">{primary}</span>
        {secondary && <span dir="auto" className="truncate text-[10px] text-zinc-400">{secondary}</span>}
        <span className="mt-auto text-[13px] font-bold tabular-nums text-brand-800">{cur()}{inr(it.price)}</span>
      </div>
    </button>
  )
}
