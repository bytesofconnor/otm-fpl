// Description: Tiny soccer pitch that plots formation and highlights a player's slot
"use client"

import * as React from 'react'
import { motion } from 'framer-motion'

type Props = {
  formation: string // e.g., "4-3-3" (DEF-MID-FWD). GK is assumed 1
  playerPosition: 'GKP' | 'DEF' | 'MID' | 'FWD'
  role?: string | null // e.g., "FWD 1/2" (optional)
  className?: string
  aspectRatio?: string // CSS aspect-ratio, default '5 / 2'
}

function parseFormation(formation: string): { DEF: number; MID: number; FWD: number } {
  const parts = formation.split('-').map((n) => Math.max(0, parseInt(n, 10) || 0))
  if (parts.length >= 3) return { DEF: parts[0], MID: parts[1], FWD: parts[2] }
  // Sensible fallback
  return { DEF: 4, MID: 4, FWD: 2 }
}

function parseRole(role?: string | null): { pos?: string; idx?: number } {
  if (!role) return {}
  const m = role.match(/([A-Z]{2,3})\s+(\d+)\//)
  if (!m) return {}
  return { pos: m[1], idx: parseInt(m[2], 10) || undefined }
}

export function FormationMini({ formation, playerPosition, role, className, aspectRatio = '5 / 2' }: Props): React.ReactElement {
  const { DEF, MID, FWD } = parseFormation(formation)
  const rows: Array<{ key: string; count: number } > = [
    { key: 'GKP', count: 1 },
    { key: 'DEF', count: DEF },
    { key: 'MID', count: MID },
    { key: 'FWD', count: FWD },
  ]
  const { idx: roleIdx } = parseRole(role)
  // If role index is unknown, fall back to center of the row
  function getHighlightIndex(total: number, isPlayerRow: boolean): number | undefined {
    if (!isPlayerRow) return undefined
    if (roleIdx && roleIdx > 0 && roleIdx <= total) return roleIdx - 1
    return Math.floor((total - 1) / 2)
  }

  return (
    <div className={"relative overflow-hidden border border-border bg-background " + (className ?? "")} style={{ width: "100%", aspectRatio }}>
      {/* rows */}
      <div className="absolute inset-0 p-2 flex flex-col justify-between">
        {rows.map((r, rIdx) => {
          const isPlayerRow = (r.key === playerPosition)
          const total = Math.max(1, r.count)
          return (
            <div key={rIdx} className="relative flex items-center justify-center" style={{ height: '20%' }}>
              <div className="absolute inset-x-4 h-px bg-line" />
              <div className="relative flex items-center justify-center gap-2" style={{ width: '100%' }}>
                {Array.from({ length: total }).map((_, i) => {
                  const hi = getHighlightIndex(total, isPlayerRow)
                  const isPlayer = typeof hi === 'number' && hi === i
                  return isPlayer ? (
                    <motion.div
                      key={i}
                      className="h-3 w-3 rounded-full bg-foreground"
                      title={`${r.key} ${hi != null ? hi + 1 : ''} in ${formation}`}
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    />
                  ) : (
                    <div key={i} className="h-2.5 w-2.5 rounded-full bg-muted/40" />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


