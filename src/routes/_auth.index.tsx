// src/routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/')({
  beforeLoad: ({ context }) => {
    const { profile, membershipStatus } = context

    if (!profile?.display_name || !membershipStatus) {
      throw redirect({ to: '/create-profile' })
    }

    if (membershipStatus !== 'active') {
      throw redirect({ to: '/vouch-pending' })
    }

    throw redirect({ to: '/dashboard' })
  },
})