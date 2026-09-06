import { useEffect, useState } from "react"
import { ExternalLink, Sparkles, Star } from "lucide-react"
import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { toFullPath } from "../lib/routing"
import { Button } from "./ui/button"
import { Sheet } from "./ui/sheet"
import { cn } from "../lib/utils"

/* The check-in flow: registration readiness at a glance (with the GRC a
   click away), then a room - the allocator's pick or the desk's - then
   check in. Opened from the arrivals board instead of a blind one-click. */

interface Context {
  reservation: {
    name: string
    status: string
    guest: string | null
    guest_name: string
    room_type_name: string | null
    check_in_date: string
    check_out_date: string
    adults: number
    children: number
    planned_check_in_time: string
    vip: 0 | 1
  }
  readiness: {
    phone: boolean
    email: boolean
    id_on_file: boolean
    address_on_file: boolean
    precheckin_status: string
    link_sent: boolean
  }
  room_assigned: {
    name: string
    room_number: string
    housekeeping_status: string
  } | null
  suggestion: {
    room: string
    room_number: string
    why: string
    needs_review: 0 | 1
  } | null
  rooms: { name: string; room_number: string; housekeeping_status: string }[]
}

const hkTone: Record<string, string> = {
  Clean: "text-emerald-700",
  Inspected: "text-sky-700",
  Dirty: "text-amber-700",
}

// room status on the picker chips: colour + dot + text (never colour alone)
const hkChip: Record<string, { text: string; dot: string }> = {
  Clean: { text: "text-emerald-700", dot: "bg-emerald-500" },
  Inspected: { text: "text-sky-700", dot: "bg-sky-500" },
  Dirty: { text: "text-amber-700", dot: "bg-amber-500" },
  _default: { text: "text-zinc-500", dot: "bg-zinc-400" },
}

function ReadyChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-zinc-50 text-zinc-500",
      )}
    >
      {ok ? "✓" : "·"} {label}
    </span>
  )
}

export default function CheckInDialog(props: {
  reservation: string
  onDone: () => void
  onClose: () => void
}) {
  const [ctx, setCtx] = useState<Context | null>(null)
  const [room, setRoom] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    call<Context>("hotelpms.api.checkin_context", { reservation: props.reservation })
      .then((c) => {
        setCtx(c)
        setRoom(c.room_assigned?.name || c.suggestion?.room || "")
      })
      .catch((e) => setError(serverError(e)))
  }, [props.reservation])

  async function doCheckIn() {
    setBusy(true)
    setError(null)
    try {
      await call("hotelpms.api.check_in", {
        reservation: props.reservation,
        room: ctx?.room_assigned ? undefined : room,
      })
      props.onDone()
    } catch (e) {
      setError(serverError(e))
      setBusy(false)
    }
  }

  const r = ctx?.reservation
  const chosen =
    ctx?.room_assigned ??
    ctx?.rooms.find((x) => x.name === room) ??
    null
  const chosenDirty = chosen?.housekeeping_status === "Dirty"

  return (
    <Sheet
      title={r ? `Check in ${r.guest_name}` : "Check in"}
      description={
        r
          ? `${r.room_type_name ?? ""} · ${r.check_in_date} → ${r.check_out_date} · ${r.adults} adult${r.adults === 1 ? "" : "s"}${r.children ? ` + ${r.children}` : ""}${r.planned_check_in_time ? ` · ETA ${r.planned_check_in_time.slice(0, 5)}` : ""}`
          : undefined
      }
      onClose={props.onClose}
      footer={
        <div className="flex w-full items-center gap-3">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="ms-auto flex items-center gap-2">
            <Button variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button disabled={busy || !room || !ctx} onClick={doCheckIn}>
              {busy
                ? "Checking in…"
                : chosen
                  ? `Check in to ${chosen.room_number}`
                  : "Check in"}
            </Button>
          </div>
        </div>
      }
    >
      {!ctx && !error && <p className="text-sm text-zinc-500">Loading…</p>}
      {ctx && r && (
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-700">
                Registration
              </h3>
              {r.vip ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  VIP
                </span>
              ) : null}
              <a
                href={toFullPath(`/grc/${r.name}`)}
                target="_blank"
                rel="noreferrer"
                className="ms-auto flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                Open GRC <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ReadyChip
                ok={ctx.readiness.precheckin_status === "Verified"}
                label={
                  ctx.readiness.precheckin_status === "Not Started"
                    ? ctx.readiness.link_sent
                      ? "Online check-in sent, not filled"
                      : "Online check-in not sent"
                    : `Online check-in ${ctx.readiness.precheckin_status.toLowerCase()}`
                }
              />
              <ReadyChip ok={ctx.readiness.id_on_file} label="ID on file" />
              <ReadyChip
                ok={ctx.readiness.address_on_file}
                label="Address proof"
              />
              <ReadyChip ok={ctx.readiness.phone} label="Phone" />
              <ReadyChip ok={ctx.readiness.email} label="Email" />
            </div>
            {!ctx.readiness.id_on_file && (
              <p className="mt-2 text-xs text-zinc-500">
                Capture the ID on the GRC - check-in is never blocked, but the
                register wants it before the night audit.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-zinc-700">Room</h3>
            {ctx.room_assigned ? (
              <p className="text-sm text-zinc-700">
                Room{" "}
                <span className="font-semibold">
                  {ctx.room_assigned.room_number}
                </span>{" "}
                is assigned
                {ctx.room_assigned.housekeeping_status && (
                  <span
                    className={cn(
                      "ms-2 text-xs font-medium",
                      hkTone[ctx.room_assigned.housekeeping_status] ??
                        "text-zinc-500",
                    )}
                  >
                    {ctx.room_assigned.housekeeping_status}
                  </span>
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {ctx.suggestion && (
                  <button
                    onClick={() => setRoom(ctx.suggestion!.room)}
                    className={cn(
                      "flex min-h-[44px] w-full items-start gap-2 rounded-xl border p-3 text-start transition",
                      room === ctx.suggestion.room
                        ? "border-brand-400 bg-brand-50"
                        : "border-zinc-200 hover:border-brand-300",
                    )}
                  >
                    <Sparkles
                      className="mt-0.5 size-4 shrink-0 text-brand-600"
                      aria-hidden
                    />
                    <span className="text-sm">
                      <span className="font-semibold">
                        Room {ctx.suggestion.room_number}
                      </span>{" "}
                      <span className="text-zinc-500">— {ctx.suggestion.why}</span>
                    </span>
                  </button>
                )}
                {ctx.rooms.length > 0 && (
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-zinc-500">
                      {ctx.suggestion ? "Or pick another room" : "Pick a room"}
                    </span>
                    <div
                      role="group"
                      aria-label={ctx.suggestion ? "Or pick another room" : "Pick a room"}
                      className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
                    >
                      {ctx.rooms.map((x) => {
                        const selected = room === x.name
                        const tone = hkChip[x.housekeeping_status] ?? hkChip._default
                        return (
                          <button
                            key={x.name}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setRoom(x.name)}
                            className={cn(
                              "flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-start transition",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                              selected
                                ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                                : "border-zinc-200 bg-white hover:border-brand-300 hover:bg-brand-50/40",
                            )}
                          >
                            <span className="font-semibold text-zinc-900">
                              <bdi dir="ltr">{x.room_number}</bdi>
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                tone.text,
                              )}
                            >
                              <span
                                className={cn("size-1.5 rounded-full", tone.dot)}
                                aria-hidden
                              />
                              {x.housekeeping_status}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {ctx.rooms.length === 0 && (
                  <p className="text-sm text-rose-600">
                    No free room of this type for these dates - check the tape
                    chart for a move or an upgrade.
                  </p>
                )}
                {chosenDirty && (
                  <p className="text-xs font-medium text-amber-700">
                    {chosen?.room_number} hasn't been cleaned yet - housekeeping
                    will see the room flip to occupied.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </Sheet>
  )
}
