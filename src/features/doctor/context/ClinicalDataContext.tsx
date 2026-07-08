import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { patientService } from '@/services/patient.service'
import { nodeService } from '@/services/node.service'
import { toast } from '@/lib/toast'
import {
  patientDisplayName,
  type MonitoringActivePatient,
  type Node,
  type NodeCreate,
  type PatientUser,
  type PatientUserCreate,
  type PatientUserUpdate,
} from '@/types'

interface ClinicalDataValue {
  patients: PatientUser[]
  nodes: Node[]
  monitoringActive: MonitoringActivePatient[]
  loading: boolean
  refresh: () => Promise<void>
  createPatient: (body: PatientUserCreate) => Promise<PatientUser>
  updatePatient: (id: string, body: PatientUserUpdate) => Promise<PatientUser>
  assignPatientNode: (patientId: string, nodeId: string | null) => Promise<PatientUser>
  deletePatient: (id: string) => Promise<void>
  createNode: (body: NodeCreate) => Promise<Node>
  deleteNode: (id: string) => Promise<void>
}

const ClinicalDataContext = createContext<ClinicalDataValue | undefined>(undefined)

export function ClinicalDataProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<PatientUser[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [monitoringActive, setMonitoringActive] = useState<MonitoringActivePatient[]>([])
  const [loading, setLoading] = useState(true)

  const refreshMonitoringActive = useCallback(async () => {
    try {
      const list = await patientService.listMonitoringActive()
      setMonitoringActive(list)
    } catch {
      /* el cliente API ya muestra el toast si aplica */
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [pRes, nRes] = await Promise.allSettled([
      patientService.list(),
      nodeService.list({}, true),
    ])
    if (pRes.status === 'fulfilled') {
      setPatients(pRes.value.filter((u) => u.type_user === 'patient'))
    }
    if (nRes.status === 'fulfilled') setNodes(nRes.value)
    await refreshMonitoringActive()
    setLoading(false)
  }, [refreshMonitoringActive])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createPatient = useCallback(
    async (body: PatientUserCreate) => {
      const created = await patientService.create(body)
      setPatients((prev) => [...prev, created])
      await refreshMonitoringActive()
      toast.success(`Paciente «${patientDisplayName(created)}» creado correctamente.`)
      return created
    },
    [refreshMonitoringActive],
  )

  const updatePatient = useCallback(
    async (id: string, body: PatientUserUpdate) => {
      const updated = await patientService.update(id, body)
      setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)))
      await refreshMonitoringActive()
      return updated
    },
    [refreshMonitoringActive],
  )

  const assignPatientNode = useCallback(
    async (patientId: string, nodeId: string | null) => {
      const updated = await patientService.assignNode(patientId, nodeId)
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)))
      await refreshMonitoringActive()
      toast.success(nodeId ? 'Nodo asignado al paciente.' : 'Nodo desasignado.')
      return updated
    },
    [refreshMonitoringActive],
  )

  const deletePatient = useCallback(
    async (id: string) => {
      await patientService.remove(id)
      setPatients((prev) => prev.filter((p) => p.id !== id))
      await refreshMonitoringActive()
      toast.success('Paciente eliminado.')
    },
    [refreshMonitoringActive],
  )

  const createNode = useCallback(async (body: NodeCreate) => {
    const created = await nodeService.create(body)
    setNodes((prev) => [...prev, created])
    toast.success(`Nodo «${created.name}» creado correctamente.`)
    return created
  }, [])

  const deleteNode = useCallback(async (id: string) => {
    await nodeService.remove(id)
    setNodes((prev) => prev.filter((n) => n.id !== id))
    toast.success('Nodo eliminado.')
  }, [])

  const value = useMemo<ClinicalDataValue>(
    () => ({
      patients,
      nodes,
      monitoringActive,
      loading,
      refresh,
      createPatient,
      updatePatient,
      assignPatientNode,
      deletePatient,
      createNode,
      deleteNode,
    }),
    [
      patients,
      nodes,
      monitoringActive,
      loading,
      refresh,
      createPatient,
      updatePatient,
      assignPatientNode,
      deletePatient,
      createNode,
      deleteNode,
    ],
  )

  return <ClinicalDataContext.Provider value={value}>{children}</ClinicalDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClinicalData(): ClinicalDataValue {
  const ctx = useContext(ClinicalDataContext)
  if (!ctx) throw new Error('useClinicalData debe usarse dentro de ClinicalDataProvider')
  return ctx
}
