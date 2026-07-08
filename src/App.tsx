import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { TopLoadingBar } from '@/components/feedback/TopLoadingBar'
import { ToastHost } from '@/components/feedback/ToastHost'
import { router } from '@/router'

export function App() {
  return (
    <AuthProvider>
      <TopLoadingBar />
      <ToastHost />
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
