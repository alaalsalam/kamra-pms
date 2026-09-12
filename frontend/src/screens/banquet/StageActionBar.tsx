/*  The workflow action bar shared by every Event/Banquet stage: Back, Save,
    and a stage-specific primary (Save & Continue / Approve & Continue / Close).

    Rendered INSIDE each stage screen (not just the parent), so the buttons live
    on the stage itself. Each stage passes its own `dirty` + `save`; the parent
    supplies `nav` (previous/next navigation + fresh-data validation). Saving is
    only ever fired when there are unsaved changes, so a clean or closed stage
    never triggers a pointless reprice or trips the closed-function guard. */

import { useState } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "../../components/ui/button"
import { t } from "../../lib/i18n"
import type { FunctionSheet } from "../../lib/api"
import type { StepId } from "./Steps"

export interface StageNav {
  step: StepId
  hasPrev: boolean
  busy: boolean
  /** Go to the previous stage (already persisted by the parent). */
  back: () => void
  /** Re-validate the current stage on freshly-fetched data, then navigate to
   *  the next stage. Returns the blocker message when the stage isn't ready
   *  (so the bar can show it), or null on success. */
  continueNext: () => Promise<string | null>
  /** Re-fetch the sheet after a save so the screen shows persisted data. */
  reload: () => Promise<FunctionSheet>
}

const STAGE_LABELS: Record<StepId, { back: string; cont: string }> = {
  enquiry: { back: "Back", cont: "Save and Create Quote" },
  quote: {
    back: "Back to Inquiry",
    cont: "Approve Quote and Continue to Profitability",
  },
  margin: {
    back: "Back to Quote",
    cont: "Approve Profitability and Continue to Payments",
  },
  money: { back: "Back to Profitability", cont: "Save and Continue to Documents" },
  documents: {
    back: "Back to Payments",
    cont: "Approve Documents and Continue to Event Execution",
  },
  close: { back: "Back to Documents", cont: "Save and Close Event" },
}

export function StageActionBar({
  nav,
  dirty = false,
  save,
  primary,
}: {
  nav: StageNav
  /** Whether the current stage has unsaved edits. */
  dirty?: boolean
  /** Persist this stage's data. Fired only when dirty; throws on failure. */
  save?: () => Promise<void>
  /** Override the primary (Continue) action - the terminal close stage uses it
   *  to open the settlement sheet, with its own readiness gate. */
  primary?: { label?: string; blocked?: string | null; run: () => void }
}) {
  const [working, setWorking] = useState(false)
  const [saved, setSaved] = useState(false)
  const [blocker, setBlocker] = useState<string | null>(null)
  const labels = STAGE_LABELS[nav.step]
  const disabled = nav.busy || working

  const doSave = async () => {
    if (!save) return
    setWorking(true)
    setBlocker(null)
    try {
      await save()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setBlocker(String((e as Error)?.message || e))
    } finally {
      setWorking(false)
    }
  }

  const doContinue = async () => {
    setWorking(true)
    setBlocker(null)
    try {
      if (primary) {
        if (primary.blocked) {
          setBlocker(primary.blocked)
          return
        }
        primary.run()
        return
      }
      if (dirty && save) await save()
      const b = await nav.continueNext()
      if (b) setBlocker(b)
    } catch (e) {
      setBlocker(String((e as Error)?.message || e))
    } finally {
      setWorking(false)
    }
  }

  const doBack = () => {
    if (
      dirty &&
      !window.confirm(t("You have unsaved changes. Leave without saving?"))
    )
      return
    setBlocker(null)
    nav.back()
  }

  return (
    <div className="sticky bottom-0 z-10 mt-4 border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] sm:rounded-b-xl">
      {blocker && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {blocker}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {nav.hasPrev && (
            <Button variant="outline" onClick={doBack} disabled={disabled}>
              <ArrowLeft className="size-4" />
              {labels.back}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={doSave}
            disabled={disabled || !dirty || !save}
          >
            {saved ? "Saved" : "Save"}
          </Button>
          <Button onClick={doContinue} disabled={disabled}>
            {primary?.label ?? labels.cont}
          </Button>
        </div>
      </div>
    </div>
  )
}
