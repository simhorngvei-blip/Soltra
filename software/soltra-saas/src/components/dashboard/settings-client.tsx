'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, MapPin, Server, CheckCircle, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { useToast, ToastContainer } from '@/components/ui/toast'
import type { SoltraUser, Site, Node } from '@/lib/types'

const TIMEZONES = [
  'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila',
  'Asia/Bangkok', 'Asia/Kolkata', 'UTC', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Los_Angeles', 'Australia/Sydney',
]

const inputClass = 'w-full bg-zinc-900 border border-zinc-700 p-2.5 text-sm font-mono text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-all rounded-lg'

function Section({ title, icon: Icon, children }: {
  title: string; icon: any; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
        <Icon size={14} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

interface Props {
  profile: SoltraUser | null
  sites:   (Site & { nodes: Node[] })[]
  userId:  string
}

export function SettingsClient({ profile, sites, userId }: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const { toasts, toast, dismiss } = useToast()

  // Profile
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Site editing
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [siteName, setSiteName]           = useState('')
  const [siteTimezone, setSiteTimezone]   = useState('')
  const [savingSite, setSavingSite]       = useState(false)

  // Node editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [nodeLabel, setNodeLabel]         = useState('')
  const [savingNode, setSavingNode]       = useState(false)

  // Confirm delete
  const [pendingDeleteNode, setPendingDeleteNode] = useState<string | null>(null)

  // ── Save profile ─────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSavingProfile(true)
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName.trim() || null })
      .eq('id', userId)
    setSavingProfile(false)
    if (error) toast('Failed to update profile. Please try again.', 'error')
    else toast('Profile updated successfully.')
  }

  // ── Save site ────────────────────────────────────────────────────────────────
  const startEditSite = (site: Site) => {
    setEditingSiteId(site.id)
    setSiteName(site.name)
    setSiteTimezone(site.timezone)
  }

  const saveSite = async () => {
    if (!editingSiteId) return
    setSavingSite(true)
    const { error } = await supabase
      .from('sites')
      .update({ name: siteName.trim(), timezone: siteTimezone })
      .eq('id', editingSiteId)
    setSavingSite(false)
    if (error) {
      toast('Failed to update site. Please try again.', 'error')
    } else {
      toast('Site updated.')
      setEditingSiteId(null)
      router.refresh()
    }
  }

  // ── Save node label ──────────────────────────────────────────────────────────
  const startEditNode = (node: Node) => {
    setEditingNodeId(node.id)
    setNodeLabel(node.label ?? '')
  }

  const saveNode = async () => {
    if (!editingNodeId) return
    setSavingNode(true)
    const { error } = await supabase
      .from('nodes')
      .update({ label: nodeLabel.trim() || null })
      .eq('id', editingNodeId)
    setSavingNode(false)
    if (error) {
      toast('Failed to update node label.', 'error')
    } else {
      toast('Node label updated.')
      setEditingNodeId(null)
      router.refresh()
    }
  }

  // ── Delete node ──────────────────────────────────────────────────────────────
  const deleteNode = async (nodeId: string) => {
    const { error } = await supabase.from('nodes').delete().eq('id', nodeId)
    if (error) toast('Failed to remove node.', 'error')
    else {
      toast('Node removed from your installation.', 'success')
      setPendingDeleteNode(null)
      router.refresh()
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your account, sites, and hardware nodes.</p>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={User}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5 block">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5 block">Email</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className={`${inputClass} opacity-50 cursor-not-allowed`}
            />
            <p className="text-xs text-zinc-600 mt-1 font-mono">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5 block">Account Type</label>
            <p className="text-sm font-mono text-zinc-400">
              {profile?.role === 'fleet_admin' ? '⚡ Fleet Admin' : '🏠 Homeowner'}
              {' · '}
              <span className="text-amber-400 capitalize">{profile?.subscription_tier ?? 'free'}</span>
            </p>
          </div>
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-white transition-all disabled:opacity-50"
          >
            {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Save Profile
          </button>
        </div>
      </Section>

      {/* Sites & Nodes */}
      <Section title="Sites & Nodes" icon={MapPin}>
        {sites.length === 0 ? (
          <p className="text-sm text-zinc-500 font-mono">No sites registered yet.</p>
        ) : (
          <div className="space-y-6">
            {sites.map((site) => (
              <div key={site.id} className="space-y-3">
                {/* Site header */}
                <div className="flex items-center justify-between">
                  {editingSiteId === site.id ? (
                    <div className="flex-1 space-y-2 mr-3">
                      <input
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        className={inputClass}
                        placeholder="Site name"
                      />
                      <select
                        value={siteTimezone}
                        onChange={(e) => setSiteTimezone(e.target.value)}
                        className={inputClass}
                      >
                        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={saveSite}
                          disabled={savingSite}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          {savingSite ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSiteId(null)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 px-3 py-1.5 text-xs hover:text-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">{site.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{site.timezone}</p>
                      </div>
                      <button
                        onClick={() => startEditSite(site)}
                        className="text-xs font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-700 rounded px-2 py-1 transition-colors"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>

                {/* Nodes for this site */}
                {site.nodes.length > 0 && (
                  <div className="pl-3 border-l border-zinc-700/50 space-y-2">
                    {site.nodes.map((node) => (
                      <div key={node.id} className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-3 py-2.5">
                        {editingNodeId === node.id ? (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1 block">Node Label</label>
                              <input
                                value={nodeLabel}
                                onChange={(e) => setNodeLabel(e.target.value)}
                                placeholder="e.g. South Array, Rooftop Unit A"
                                className={inputClass}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={saveNode}
                                disabled={savingNode}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                              >
                                {savingNode ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                Save Label
                              </button>
                              <button
                                onClick={() => setEditingNodeId(null)}
                                className="rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 px-3 py-1.5 text-xs hover:text-zinc-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-zinc-300">{node.label ?? 'Unnamed Node'}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">{node.mac_address}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  node.status === 'active' ? 'bg-emerald-400' :
                                  node.status === 'maintenance' ? 'bg-amber-400' : 'bg-zinc-600'
                                }`} />
                                <span className="text-[10px] text-zinc-500 capitalize">{node.status}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditNode(node)}
                                className="text-xs font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-700 rounded px-2 py-1 transition-colors"
                              >
                                <Server size={11} className="inline mr-1" />
                                Rename
                              </button>
                              {pendingDeleteNode === node.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-red-400 font-mono">Remove?</span>
                                  <button
                                    onClick={() => deleteNode(node.id)}
                                    className="text-xs text-red-400 hover:text-red-300 font-mono border border-red-800/50 rounded px-2 py-1 transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setPendingDeleteNode(null)}
                                    className="text-xs text-zinc-500 hover:text-zinc-300 font-mono border border-zinc-700 rounded px-2 py-1 transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setPendingDeleteNode(node.id)}
                                  className="text-zinc-600 hover:text-red-400 transition-colors"
                                  title="Remove node"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Password */}
      <Section title="Security" icon={AlertTriangle}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Password</p>
            <p className="text-xs text-zinc-500 font-mono">Update your account password</p>
          </div>
          <a
            href="/dashboard/reset-password"
            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Change Password →
          </a>
        </div>
      </Section>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
