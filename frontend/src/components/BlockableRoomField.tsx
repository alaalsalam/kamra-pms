import { useEffect, useState } from "react"

import { getCurrentProperty } from "../lib/api"
import { listResource } from "../lib/resource"

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

type RoomOpt = { name: string; label: string }

/**
 * Room picker for the Room Block form: only rooms of the CURRENT property that
 * are free for the chosen from/to dates (no live reservation, no active block).
 * Reacts to the date fields; the room already on the block stays selectable.
 */
export function BlockableRoomField({
  value,
  onChange,
  draft,
}: {
  value: unknown
  onChange: (v: unknown) => void
  draft: Record<string, unknown>
}) {
  const property = getCurrentProperty()
  const from = String(draft.from_date ?? "")
  const to = String(draft.to_date ?? "")
  const current = String(value ?? "")
  const datesReady = Boolean(from && to && to > from)

  const [rooms, setRooms] = useState<RoomOpt[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!property) return
      setLoading(true)
      try {
        const all = await listResource("Room", {
          fields: ["name", "room_number"],
          filters: [["property", "=", property]],
          orderBy: "room_number asc",
          limit: 500,
        })

        const taken = new Set<string>()
        if (datesReady) {
          const [blocks, resv] = await Promise.all([
            listResource("Room Block", {
              fields: ["room"],
              filters: [
                ["property", "=", property],
                ["block_status", "=", "Active"],
                ["from_date", "<", to],
                ["to_date", ">", from],
              ],
              limit: 500,
            }),
            listResource("Reservation", {
              fields: ["room", "status"],
              filters: [
                ["property", "=", property],
                ["check_in_date", "<", to],
                ["check_out_date", ">", from],
              ],
              limit: 500,
            }),
          ])
          for (const b of blocks) if (b.room) taken.add(String(b.room))
          for (const r of resv)
            if (
              r.room &&
              (r.status === "Confirmed" || r.status === "Checked In")
            )
              taken.add(String(r.room))
        }

        // keep the room already on this block selectable even if it now clashes
        const free = all
          .filter((r) => !taken.has(r.name) || r.name === current)
          .map((r) => ({
            name: r.name,
            label: r.room_number ? String(r.room_number) : r.name,
          }))
        if (!cancelled) setRooms(free)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, from, to, current])

  const placeholder = loading
    ? "Loading rooms…"
    : datesReady && rooms.length === 0
      ? "No rooms available for these dates"
      : "-"

  return (
    <>
      <select
        className={inputCls}
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {rooms.map((r) => (
          <option key={r.name} value={r.name}>
            {r.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-zinc-400">
        {datesReady
          ? "Only rooms free for these dates"
          : "Pick the dates first to see available rooms"}
      </span>
    </>
  )
}
